# Architecture — svelette

Foundational decisions for the Svelte 5 re-implementation of `@sursaut/ui/palette`.

## 1. Identity

- **svelette** = a Svelte 5 (runes) port of `@sursaut/ui/palette` — the headless palette
  subsystem **only**.
- **Headless** contract is preserved: the palette owns state, a11y semantics, tool resolution,
  editing, and drag/drop — **not** styling. Adapters (demo editors) own markup and CSS.
- Read-only reference source lives in `ui/` (symlink). Never edit it; treat it as the spec.
- **Out of scope:** the rest of `@sursaut/ui` — the `*Model` functions (button/checkbox/select/…),
  directives, and the `uiComponent` variant factory (styled variants + dot-syntax accessors). The
  palette has no model layer and no variant layer.

## 2. Toolchain (locked)

| Tool | Version |
|------|---------|
| Node | 24.x |
| npm | 11.x |
| Svelte | `^5.57.0` (runes mode) |
| SvelteKit | `^2.70.3` |
| Vite | `^8.2.2` |
| `@sveltejs/vite-plugin-svelte` | `^7.3.0` |
| TypeScript | `^6.0.3` (TS 7 native compiler is **not** supported by `svelte-check`) |
| Biome | `^2.5.12` |
| Vitest | `^5.0.0` (+ `@testing-library/svelte`, jsdom) |
| Playwright | `^1.62.1` |

## 3. Runtime mapping

| Sursaut | Svelte 5 |
|---------|----------|
| `mutts.reactive(x)` | `$state(x)` |
| `mutts.effect(fn)` | `$effect(fn)` |
| `mutts.unwrap(x)` | `x` (proxies are transparent) |
| `mutts.lift(fn)` | `$derived` / `$derived.by` |
| `JSX.Element` / `() => JSX.Element` | `Component` (`Snippet` excluded — no runtime discriminator) |
| `options.iconFactory` | module-level `$state` icon factory |
| Sursaut `use:directive` | Svelte `use:` action |
| `latch()` portal | `mount(Component, { target })` from `svelte` |
| `env` / scope | Svelte context or props |
| `componentStyle.css` | global `styles/palette.css` (no scoping, no injection) |
| `options` global config | module-level `$state` |

## 4. File & naming rules

- Runes (`$state` / `$derived` / `$effect`) **only** compile in `.svelte.ts` / `.svelte.js`.
- Pure algorithms → `.ts`; reactive modules → `.svelte.ts`; UI → `.svelte`.
- One module = one concern, mirroring the reference source map (`types`, `keys`, `palette`,
  `command-box`, `components/*`, `drawer-editor`, `styles/*`).
- Public entry point: `src/lib/palette/index.svelte.ts` barrel export.

## 5. Editors are components — no model / variant layer

The palette does **not** use `@sursaut/ui`'s `*Model` lazy-getter pattern (`buttonModel`,
`checkboxModel`, …). That pattern belongs to the general UI library, which is out of scope.

- A palette **editor** is a plain Svelte component that receives a `PaletteEditorContext`
  (`item`, `tool`, `scope`, `flags`, `surface`) and renders itself.
- No grouped-attribute objects to spread (`model.button`, `model.input`), no self-referential
  getters.
- No `uiComponent` variant factory and no styled variants. The palette is headless; any visual
  styling belongs to the demo/adapter, never the palette core.
- `PaletteEditorSpec.editor` / `.configure` hold a component (or a function returning one), not a
  JSX factory.

## 6. Shared runtime state

- A single module-level `$state` object (`palettes`) owns `catalogDrag`, `dragging`, `editing`,
  `inspecting` — exactly one palette editable at a time.
- The drawer collapse signal (`paletteDrawerCollapse`) is a `$state({ version: 0 })`; consumers bump
  `version` to close all open drawers synchronously.
- Both live in `.svelte.ts` modules so any importer reacts to changes.

## 7. Editor registry

- Registries are keyed **family → variant** (`run`, `boolean`, `number`, `enum`, `item`).
- A `PaletteEditorSpec.editor` is a Svelte **component** (not a JSX factory). Rendering resolves the
  spec then mounts it dynamically (`svelte:component` or `mount`).
- `PaletteEditorContext` carries `item`, `tool`, `scope`, `flags`, and `surface` (axis + region).
- `surface.axis` derives from region: `top`/`bottom` → `horizontal`, `left`/`right` → `vertical`.

## 8. Icons

Sursaut's `@sursaut/ui` is **not** hardcoded to a glyph library: the palette only carries an icon
value and never renders it itself. Rendering is delegated to a pluggable `options.iconFactory`;
the `pure-glyf` package (a separate optional Vite-plugin + adapter, `registerGlyfIconFactory()`)
is merely *one* such factory.

svelette mirrors that split, in a Svelte-idiomatic way:

- **Palette core stays icon-agnostic.** `PaletteIcon = string | Component` flows through
  tools / entries / toolbar items to the editor, which is the *only* thing that renders it.
  (`Snippet` is excluded: `Component` and `Snippet` are both callables with no runtime
  discriminator, so the `Icon` helper could never render a `Snippet` member. Callers with
  inline markup wrap it in a component or render it directly with `{@render}`.)
- **One small `Icon.svelte` helper** (demo/adapter layer, not core) resolves the two cases:
  - `Component` → `<svelte:component this={...} />`
  - `string` → a registered string resolver, else `<span data-icon="name">name</span>`
- **String-name resolution** is a consumer concern, provided as a module-level `$state` factory
  (the Svelte equivalent of `options.iconFactory`), e.g. `icons.factory = (name) => <i class={name} />`.

We do **not** port `pure-glyf`; the demo can use `Component` directly, emoji strings, or
register a factory that maps names to CSS classes.

## 9. Portal pattern (drawer)

Drawers render a popup perpendicular to their parent axis into `document.body` via
`mount()`. The popup root receives a new scope carrying `palette` and `region` so nested
`Toolbar`s resolve tools and nested drawers invert their axis correctly.

## 10. Serialization

- `serializePaletteLayout` / `validatePaletteLayout` are pure (`.ts`).
- `hydratePaletteLayout` rebuilds deeply reactive structures with `$state` (`.svelte.ts`).

## 11. Styling — global CSS, never scoped or injected

- CSS is **always global** unless true component scoping is required. Palette styles live in
  `src/lib/palette/styles/` (`palette.css` headless layout + edit-mode affordances,
  `palette-default.css` demo theme) and are imported once by the app — never injected at
  runtime, never duplicated per instance.
- Selectors stay specific through class hierarchy (`.palette-ide.editing .toolbar:hover::before`),
  never bare names (`.active {`). No `data-palette-id` scoping: only one palette is editable at
  a time (`palettes.editing`), so per-instance `<style>` elements are pure overhead.
- The reference `componentStyle.css` injection (`paletteInstanceStyle` + `#disposeStyle`) was
  deleted. `Palette.dispose()` is a no-op kept for API parity.
- Edit-mode hover states are live, not just unblocked: `paletteRoot` toggles
  `editing`/`palette-editing` classes + `data-editing` from `palette.editing`, and the
  ported `.palette-ide.editing .toolbar…` / `.toolbar-item-guard…` rules render the
  hover/active chrome. Verified in the Phase 9 demo (edit toggle → hover a toolbar).
- Drawer popup classes use the `svelette-` prefix (`.svelette-palette-drawer__popup`), not
  `sursaut-`.

## 12. Palette runtime (Phase 3 — implemented, review fixes applied)

- `src/lib/palette/palette.svelte.ts` ports `ui/src/palette/palette.ts` verbatim except for the
  Sursaut runtime swaps below; `src/lib/palette/index.svelte.ts` is the barrel entry point.
- `mutts.reactive(x)` → `$state(x)`; `mutts.unwrap` → direct reads. Svelte `$state` never
  proxies class instances, so palette identity is plain `===` (`palettes.editing === this`).
- `mutts.effect` in `setter()` is omitted: module scope has no effect context, the `WeakMap`
  restore entry is GC-hygienic on its own. Verified divergence: with two setters on one tool
  (`fontSize|11`, `fontSize|12`), the second `run()` overwrites the first's stored restore
  value without sursaut's effect cleanup, so re-running the second setter restores the stale
  value instead of `default`. Single-setter behaviour is identical.
- `renderEditor` / `renderConfigurator` **return** the editor/configurator component (the adapter
  renders it with a `context` prop built by `resolveEditorContext`) instead of invoking a JSX
  factory. `Palette.Toolbar` / `Palette.Ide` factories are omitted here — layout components land
  in `components/` (Phase 5).
- `resolveConfiguratorScope` computes sursaut's `augmentedScope` (`scope` + `editorChoices`)
  for **both** configurator paths: the `configurator` fallback receives it as its `scope`
  argument, and adapters rendering a registry `spec.configure` component bind it as
  `context.scope` (via `resolveConfiguratorContext`). `surfaceContextFromScope` centralizes
  region→axis derivation; `setPaletteScope` / `getPaletteScope` carry the scope record through
  Svelte context (drawer portals propagate `palette` + `region` through it).
- `$state` is only legal as a variable initializer, so `hydratePaletteLayout` builds a plain
  layout first and wraps it once (`const borders: PaletteBorders = $state(plain)`); nesting
  becomes reactive via deep `$state` proxying. Call it during component/module init, not from
  late event handlers or async callbacks. The native `dragend` listener stays a boolean-guarded
  `window.addEventListener` (capture): `svelte` exposes no `effectRoot`, and module scope has
  no effect context; the handler delegates to `clearPaletteCatalogDragOnNativeDragEnd` (tested).
- Tests: `tests/palette/palette.test.ts` (17) + `tests/palette/serialization.test.ts` (15) +
  `tests/palette/command-box.test.ts` (25) port `palette.spec.tsx` + `serialization.spec.ts` +
  `command-box.spec.ts`; JSX-factory assertions become component-identity assertions,
  `mutts.reactive` fixtures become plain objects, and the `configure`-call-count assertion is
  dropped (spec components are returned, not invoked). Added: configurator-scope injection,
  surface-axis derivation, `dragend` clearing, multi-setter divergence, and hydrated
  reactivity (`HydratedBordersProbe.svelte`).

## 13. Command box (Phase 4 — implemented)

- `src/lib/palette/command-box.svelte.ts` ports `ui/src/palette/command-box.ts` verbatim except
  for the Svelte runtime swaps: `mutts.reactive` → `$state`, `mutts.lift` → `$derived.by`,
  `string | JSX.Element | (() => JSX.Element)` icons → `PaletteIcon`.
- `paletteCommandBoxModel` must be created during component/module init (same `$state`
  init-time constraint as `hydratePaletteLayout`). `entries` may be a static array or a reader
  function re-read inside `$derived`; a component-owned `$state` source refreshes `results`
  (asserted via `CommandBoxEntriesProbe.svelte`).
- `$derived` values are exposed through getter properties on the returned model object, never
  as shorthand properties — shorthand captures the initial value and breaks reactivity
  (`state_referenced_locally`).
- `commandRunner` throws `PaletteError` (not plain `Error`) for non-runnable specs, matching
  the palette error taxonomy (deliberate divergence from the reference, which throws `Error`).
- Tests: `tests/palette/command-box.test.ts` (26) ports `command-box.spec.ts`; `h()` fixtures
  become stub components, `mutts.reactive` becomes a probe-owned `$state`. Added:
  non-runnable spec throws `PaletteError`.

## 15. Layout components (Phase 5 — implemented)

- `src/lib/palette/layout.svelte.ts` ports `ui/src/palette/components.tsx` headless logic:
  track spacing (`actualTrackSpaceAt`/`insertToolbar`/`removeToolbar`/`resizeToolbar`),
  toolbar moves (`moveToolbarToTrack`/`moveToolbarToStack`), hit-testing
  (`resolveTrackSpaceTarget`/`resolveToolbarSpaceTarget`/`resolveStackSpaceTarget`),
  toolbar preview (`previewToolbarItems`/`finalizeToolbarPreview`), catalogue insert
  (`beginPaletteCatalogInsertDrag` + native `dragover`/`dragend` window listeners), and
  Svelte actions (`paletteRoot`, `paletteTrackSpace`, `paletteStackSpace`,
  `paletteToolbarSpace`, `paletteToolbarDrag`, `paletteItemDrag`, `paletteItemShield`).
- `src/lib/palette/drag-session.ts` ports `startLocalDragSession` trimmed to pointer
  capture + window move/up listeners (no preview element; the 4px activation threshold
  lives in the caller, matching the reference).
- Runtime swaps: `mutts.reactive` → plain arrays (the `$state` `palettes` store proxies the
  session on assignment); `mutts.unwrap` → direct reads; `mutts.effect` in `paletteRoot` →
  `$effect` inside the action body (actions run in component init context — verified with a
  throwaway probe before implementing); `startLocalDragSession` → `startPaletteDragSession`.
- Dropped with rationale: `arranged()` scope classes (no `orientation-*`/`density-*`
  selectors exist in the ported CSS; direction flows through `palette-horizontal` /
  `palette-vertical` + `stack-*`); `use:toolbarsContainer` (no definition anywhere in the
  reference source or its dependencies — layout is fully described by CSS classes).
- `Palette` interface gains `resolveConfiguratorScope` / `resolveEditorContext` (already
  implemented on the class in Phase 3; the interface was missing them and `Toolbar` needs
  them for the `<PaletteItem>` bind step).
- Components (`components/`): `Ide.svelte` (four optional borders + center slot, `$derived`
  scope record published via `setPaletteScope`), `Toolbar.svelte` (toolbar + item spaces, edit-guard
  overlay, click-to-inspect), `ToolbarTrack.svelte` (slots + spacing), `ToolbarBorder.svelte`
  (region border, `inverse` reverses track order), `Parking.svelte` (owns its border seeded
  once from `toolbars`, delete-button per row), `PaletteItem.svelte` (binds
  `resolveEditorContext` output to `<Editor context={...} />`).
- Components take `palette` (runtime class) + `scope` as props instead of Sursaut's ambient
  scope/second-arg; `Toolbar` computes `dragTarget`/`spaceTarget` via functions (not `$derived`
  shorthand) so space registration always sees current props.
- Actions return `ReturnType<Action>` (`{ destroy() }`), not bare cleanups — Svelte's action
  contract requires the object shape.
- Tests: `tests/palette/components.test.ts` (13) ports `components.spec.ts` via
  `PaletteRootProbe`/`PaletteItemDragProbe`/`IdeProbe`/`ParkingProbe` + `ParkingEditorStub`
  (`rootEnv` directives become `use:` actions; `$state` proxies force `toStrictEqual` over
  `toBe` for `inspecting.item` and the catalogue seed border); `tests/palette/item-movement.test.ts`
  (13) is a verbatim port of `item-movement.spec.ts` locking the Phase 3
  `resolveItemPlacementTarget` contract.

## 16. Demo editors & configurators (Phase 6 — implemented)

- `src/lib/demo/editors/` holds plain Svelte editor components (no model layer, no variant
  factory): `Button` / `SplitButton` (run), `Toggle` (boolean), `Flip` / `Radio` / `Select` /
  `Segmented` / `SplitRadio` (enum), `Slider` / `Stepper` / `Stars` (number), `CommandBox`
  (item). Each takes `context: PaletteEditorContext` and mutates the `$state` tool directly.
- Shared helpers live in `editors/meta.ts` (`toolbarMeta` / `tooltip` / `layoutFromSurface` /
  `regionFromScope` / `menuChevron` / enum-subset filtering + display). Helpers accept the
  generic `PaletteToolbarItem<string, string, unknown>` (`AnyItem`) so demo components stay
  assignable at the `Toolbar` render boundary without per-schema generics.
- Split/menu editors (`SplitButton`, `SplitRadio`) use local `$state` open flags + plain
  `{#if open}` menus (no `*Model` popover helpers); `Stars` renders `maximum` buttons with
  `role="radio"`; `Slider` binds `min`/`max`/`step` from the number tool; `CommandBox` builds
  its own `paletteCommandBoxModel` from `context.scope.palette` at init (editors receive only
  `context`, so the box cannot be injected as a prop; seeding is deliberate and
  `state_referenced_locally` is suppressed).
- Configurators (`BaseConfigurator` label/icon/hint/editor/tone + `EnumSubsetConfigurator`
  choice-display/allowed-values/keyword-filter) read `context.scope.editorChoices` injected by
  `resolveConfiguratorScope`; `registry.ts` wires `spec(editor, configure, footprint)` per
  family → variant, mirroring the reference `demoEditors` registry.
- Demo palette (`src/lib/demo/palette.svelte.ts`): `$state` demo state + `Palette` with key
  bindings, `editorDefaults: { run: 'button' }`, and `initialIdeConfig: PaletteBorders`
  covering every tool family in every region (top command/toggle/splitRadio/select +
  mode/slider/splitButton; left flip/splitRadio; right slider/stars; bottom stars/segmented +
  segmented/slider). `src/routes/+page.svelte` renders `Ide` with `$state` borders, an
  edit-mode toggle, and an inspector binding `renderConfigurator` +
  `resolveConfiguratorContext` output to `<Configurator context>`.
- Defensive failure mode confirmed: `Toolbar.svelte` try/catch renders nothing on unknown
  tools/missing editors — desired, keeps broken items inert in edit mode instead of crashing
  the bar.
- Gates: `check` 0/0, `lint` clean, `test` 92 pass, `build` ok.

## 17. Drawer editor (Phase 7 — implemented)

- `src/lib/palette/drawer-editor.svelte.ts` ports `ui/src/palette/drawer-editor.tsx`:
  `paletteDrawerCollapse` is module-level `$state({ version: 0 })` (same pattern as
  `palettes`); `createPaletteDrawerEditor({ portalContainer })` returns a spec whose
  `editor` is the shared `DrawerEditor` component (`flags: { footprint: 'horizontal' }`).
  Dropped with rationale: per-instance `triggerClass` / `overlayClass` / `popupClass` /
  `popupExtraClass` (CSS is global — `svelette-palette-drawer__*` in `styles/palette.css`),
  `renderIcon: JSX.Element` / `renderTrigger` (icons are `PaletteIcon`, trigger is fixed
  icon + label + chevron), `triggerStyle` (no parent-toolbar square-size override to fight).
- `components/DrawerEditor.svelte` (trigger) + `components/DrawerPopup.svelte` (portal root)
  replace `latch(host, jsx, env)`: the trigger holds local `$state` `open` + `popupPos`,
  the portal `$effect` reads `open`/`item` up-front (so close re-runs teardown), then
  `mount(DrawerPopup, { target: host })` into `document.body` (or the factory
  `portalContainer`); teardown removes listeners + `unmount(app)` + `host.remove()`.
  `DrawerPopup` publishes `palette` + child `region` via `setPaletteScope` and binds the
  same scope to the child `Toolbar` — nested drawers resolve tools and invert their own
  axis without prop-drilling.
- Perpendicular-direction contract (verbatim): child direction inverts the parent axis,
  child region follows (`vertical` → `'left'`, `horizontal` → `'top'`).
  `open` (`click` | `hover` | `press`) and `placement` (`start` | `center` | `end`) come
  from the item `config`, defaulting to `click` / `center`.
- Collapse signal: drawers track a plain non-reactive `seenVersion` (seeds on first
  run, closes on later bumps — no `untrack` idiom). `syncPopup()` only assigns
  `popupPos` when the rect actually changed — unconditional writes re-trigger the portal
  effect forever (`effect_update_depth_exceeded`); the whole read sits in try/catch so a
  detached trigger can never break the effect.
- Portal hygiene: the missing-palette guard runs before `appendChild` (no leaked host
  `<div>`); the portal receives the shared `$state` `popupPos` object so resize/scroll
  re-renders in place instead of remounting (nested state preserved). `open: 'hover'`
  uses a 120ms leave-grace: trigger-leave schedules a close that popup-enter cancels,
  so the pointer can travel to the body-portaled popup. Scope flows via props today
  (explicit, serializable); `setPaletteScope`/`getPaletteScope` stay as the documented
  portal-propagation path (`Ide` + `DrawerPopup` publish it).
- `Toolbar.svelte` editor-only fix: `resolveItem` no longer bails on `tool === undefined`,
  so `drawer` / `commandBox` items resolve through the `item` registry (tool-backed items
  still render nothing on unknown tools — desired). `Palette` interface gains the missing
  `resolveConfiguratorContext` (already on the class; `DrawerPopup`'s `Toolbar` needs it
  for the `<PaletteItem>` bind). Demo registry wires `item.drawer`; demo layout adds a top
  drawer (toggle + stars) and a left drawer with a nested toolbar (segmented + stepper).
- Tests: `tests/palette/drawer.test.ts` (6) — factory shape, open-on-click + Escape close,
  collapse-signal close, axis inversion both ways, popup scope publishing, hover travel
  stays open. Gates: `check` 0/0, `lint` clean, `test` 101 pass, `build` ok.

## 18. Demo page (Phase 9 — complete)

- `src/routes/+page.svelte` exercises all four regions (top command/toggle/splitRadio/select
  + mode/slider/drawer/splitButton; left flip/splitRadio/nested drawer; right slider/stars;
  bottom stars/segmented + segmented/slider + a second track with `button` run editors
  (`terminal`/`presentation`/`inspectPreset`) and `radio` enum editors (`theme`/`mode`)), the
  edit-mode toggle (`palettes.editing`), the toolbar command box, drawer popups with axis
  inversion, and the item inspector (`renderConfigurator` + `resolveConfiguratorContext` →
  `<Configurator context>`).
- Center content shows a live-state panel (hero + pills + state grid bound to `$state`
  `demoState`) so every tool mutation is visible without opening devtools.
- Console overlay (`src/lib/demo/console.svelte.ts` + `src/lib/demo/ConsoleOverlay.svelte`,
  opened by the `terminal` run tool): popup command-box overlay reusing the
  `.palette-default-command-*` styles. Command mode runs `paletteCommandEntries` (state tools
  like "Set Theme to Dark" / "Increase Font Size" execute in both the toolbar box and the
  console); edit mode swaps to `paletteAddItemEntries` with `enterAction: 'select'`. A
  checkbutton bound to `palettes.editing` toggles *Command* ↔ *Toolbar edition*.
- Add-to-toolbar flow: selected add entry expands via `paletteDerivedVariants` into variant
  cards (boolean/number/enum value inputs, enum allowed-values/keyword filters mirroring the
  reference `popupAddItem`); the selected variant builds a live `Toolbar` preview. Catalogue
  (`paletteCatalogEntries`) renders draggable rows. Both paths start native HTML5 drags
  (`PALETTE_CATALOG_DRAG_MIME` + `serializePaletteCatalogDragPayload` on `dataTransfer`,
  `beginPaletteCatalogInsertDrag` + `notifyPaletteCatalogNativeDragStarted` on `dragstart`);
  drops land in the existing `bindPaletteCatalogDrop` toolbar/track/stack zones.
- `Parking` renders at the top of the console, seeded from the live top border minus the
  command-box item (mirrors the reference `popupParkingToolbars`); parked toolbars can be
  removed/restored through the parking drop zones while editing.
- Persistence: `+page.svelte` seeds `structuredClone(initialIdeConfig.*)` `$state` at init
  (server + client first render identical, no hydration mismatch; also avoids mutating the
  shared module object) and splices a validated stored snapshot in `onMount`
  (`hydratePaletteLayout` can't run post-init — its `$state` is init-only — so the plain
  stored borders are spliced directly into the deep proxies). "Save layout" / "Reset layout"
  buttons round-trip through localStorage.
- Inspector structural actions: `describeItemConfiguration` on the live toolbar/index
  (resolved by item identity across all four borders) drives move-backward/move-forward
  (splice within the toolbar) + remove buttons and the `bindings.shortcut` display
  (`findByTool`).
- Init-time constraint respected: all `paletteCommandBoxModel` instances are created during
  component init; stored-layout restore splices plain data in `onMount`, never in handlers.
- Gates: `check` 0/0, `lint` clean, `test` 101 pass, `build` ok.

## 19. E2E coverage (Phase 10 — complete)

- `e2e/palette.spec.ts` (6): edit-mode toggle label + `.palette-ide.editing` chrome,
  toolbar command-box search/execute ("Set Theme to Dark" → `🎨 dark` pill), drawer open
  with axis inversion (top drawer → `is-vertical` popup) + Escape close, inspector via
  `pointerdown` on the edit-mode `.toolbar-item-guard` (shortcut display, move-back
  disabled / move-forward enabled, forward → "Item moved forward"), layout save → reload
  → "restored" badge → reset, pointer drag reorder (synthetic `PointerEvent`
  `pointerdown` on the notifications guard + `pointermove`/`pointerup` on `window` with
  a shared `pointerId`, drop on the gap after theme → order flips to
  `[commandBox, layout, theme, notifications]`).
- `e2e/console.spec.ts` (6): backtick opens the console (Ide root focused first —
  `paletteRoot` listens on the root `keydown`, so a bare body-level press never reaches
  it) + command execute closes the overlay, Terminal button open + Escape close,
  checkbutton swaps `Command…` ↔ `Add to toolbar…` placeholders with catalogue + add
  panel, add flow (Notifications entry → variant card → value select), catalogue rows
  carry `draggable="true"`, catalogue drop (synthetic `dragstart`/`dragover`/`drop`
  with a `dataTransfer` stub → session path inserts the row's item into the first
  toolbar gap, count + 1).
- E2E lessons: `paletteItemDrag` inspects on `pointerdown`, so tests dispatch
  `pointerdown`/`pointerup` on the guard instead of `click({ force: true })`; keyboard
  shortcut tests must focus `.palette-ide` (tabindex=0) before pressing. Trusted
  Playwright `mouse`/`pointerdown` events carry `isPrimary: false` / `buttons: 0` on
  the first move, which the drag session ignores — drag tests use synthetic
  `PointerEvent`s with an explicit `pointerId`/`isPrimary`. Gaps are zero-width until
  proximity chrome expands them, so drop points target the gap edge (`rect.left`),
  never a `+2px` nudge (which lands outside and resolves to a track/stack move).
  `new DragEvent(..., { dataTransfer })` rejects non-native transfers — catalogue
  tests fire plain `Event`s with a shadowed `dataTransfer` stub instead.
- Drag-engine fixes found via e2e (see §20): deferred item preview to activation +
  `$state` proxy re-link + unconditional catalogue seed insert.
- Flake note: toolbar command-box e2e failed once under 11-worker `fullyParallel`
  (result `toBeVisible` timeout; green in 2 full + 3 isolated reruns) — mitigated by
  waiting for `.palette-default-command-popover` before asserting the result (the
  140ms `inline-size` transition delays popover visibility vs. actionability).
- Gates: `check` 0/0, `lint` clean, `test` 101 pass, `test:e2e` 13 pass, `build` ok.

## 20. Drag-engine `$state` proxy hazards (Phase 10 — found via e2e)

- `createItemDragging` detaches the item on `pointerdown` but defers the re-insertion
  preview to drag activation (`onActivate` in `paletteItemDrag`): previewing on the
  still-plain session object stores the live source toolbar in the preview, and the
  subsequent `palettes.dragging = dragging` `$state` assignment breaks the shared
  ephemeral border/track references — the next move's preview no-ops
  (`border.indexOf(track)` misses) while the removal stands, so the item vanishes.
  A plain click (no activation) restores the item at its origin via `onClick`.
- Activation re-links the ephemeral shell through the store's own proxies
  (`active.track = active.border[0]`, `active.toolbar = track[0].toolbar`) before
  running `onActivate`: without this, `indexOf` still misses even for the deferred
  preview (proxied border vs. plain track).
- Catalogue `onDrop` inserts the session item unconditionally when no preview was
  committed: the old seed-border `===` guard fails under `$state` proxies even when
  the session never moved, silently dropping the insert. Double-insert is impossible
  (`delete palettes.dragging` makes a second drop fall through to the spent MIME
  path).

## 14. Tooling conventions

- Lint/format: `npm run lint` / `npm run lint:fix` (Biome — tabs, single quotes, `asNeeded`
  semicolons, width 100; Svelte via `html.experimentalFullSupportEnabled`).
- Type-check: `npm run check` (`svelte-kit sync && svelte-check`).
- Unit: `npm test` (Vitest, jsdom, `resolve.conditions: ['browser']` for Svelte client build).
- E2E: `npm run test:e2e` (Playwright, builds + previews on port 4173).
- Scratch files go in `sandbox/` (git-ignored), never `/tmp`.

### Gotchas (recorded)

- Run `svelte-kit sync` before Vitest — the generated `.svelte-kit/tsconfig.json` is required by
  the resolver (`tsconfig not found`).
- Vitest must set `resolve.conditions: ['browser']`, else Svelte resolves to its server build and
  `mount()` throws `lifecycle_function_unavailable`.
- Biome 2.x has no `files.ignores`; exclusions are `!`-prefixed entries in `files.includes`.
