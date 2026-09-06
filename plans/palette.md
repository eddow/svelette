# svelette — Palette for Svelte

Re-implement the **headless palette system** from `@sursaut/ui/palette` (read-only reference in
`ui/`) idiomatically for **Svelte 5 (runes)**, preserving API semantics while replacing the
Sursaut-specific runtime (mutts, JSX, `latch`, `env`) with Svelte equivalents.

> Workflow (from `AGENTS.md`): pull tasks from this file, check them off as they are implemented,
> and migrate permanent technical detail into `docs/` once verified.

## 1. Locked decisions

| Decision | Choice |
|----------|--------|
| Package manager | `npm` |
| Structure | Single SvelteKit app — palette lives in `src/lib/palette/`, demo in `src/routes/` |
| Runtime | Svelte 5 (runes: `$state` / `$derived` / `$effect`) |
| Scope | Full headless parity with `@sursaut/ui/palette` |
| Reference | `ui/` is read-only; never edit it |

## 2. Architecture mapping (sursaut → Svelte 5)

| Sursaut concept | Svelte 5 equivalent |
|-----------------|---------------------|
| `mutts.reactive(x)` | `$state(x)` (deeply reactive proxy) — requires a `.svelte.ts` file |
| `mutts.effect(fn)` | `$effect(fn)` |
| `mutts.unwrap(x)` | read `x` directly (Svelte proxies are transparent) |
| `mutts.lift(fn)` | `$derived` / `$derived.by(fn)` |
| `JSX.Element` / `() => JSX.Element` | `Component` (`Snippet` excluded — no runtime discriminator) |
| `use:directive` (Sursaut directives) | Svelte actions (`use:`) |
| `latch()` portal | `mount(Component, { target: document.body })` from `svelte` |
| `env` / `DisplayContext` / scope | Svelte context (`getContext` / `setContext`) or props |
| `componentStyle.css` | global `styles/palette.css` — never scoped, never injected (see `docs/` §11) |
| `options` global config | module-level `$state` config object |

**File-extension rule (critical):** runes only compile inside `.svelte.ts` / `.svelte.js`. Pure
logic (no reactivity) stays in `.ts`; anything that declares `$state` / `$derived` / `$effect` must
be `.svelte.ts`. Components are `.svelte`.

## 3. Target source layout

```
src/lib/palette/
├── index.svelte.ts        # barrel export (single entry point)
├── types.ts               # pure types (port of sursaut types.ts)
├── keys.ts                # keystroke normalization (pure, no runes)
├── palette.svelte.ts      # Palette class, valueActions, shared `palettes` $state, serialization
├── command-box.svelte.ts  # command/add-item/catalogue entry builders + command box model
├── drag-session.ts        # pointer drag-session helper (no runes, pure listeners)
├── layout.svelte.ts       # track spacing, toolbar moves, hit-testing, catalogue insert, actions
├── editors.ts             # default editor capability descriptors (pure data)
├── drawer-editor.svelte.ts# createPaletteDrawerEditor factory + collapse signal
├── components/
│   ├── Ide.svelte
│   ├── PaletteItem.svelte
│   ├── Toolbar.svelte
│   ├── ToolbarTrack.svelte
│   ├── ToolbarBorder.svelte
│   └── Parking.svelte
└── styles/
    ├── palette.css        # base headless styles (ported)
    └── palette-default.css
```

Demo editors (button/toggle/slider/select/segmented/stepper/stars/…) live under
`src/lib/demo/editors/` and are NOT part of the public palette API.

## 4. Public API parity checklist

Every export of `@sursaut/ui/palette` must have a Svelte equivalent. Source: `ui/src/palette/index.ts`.

### Keys (`keys.ts`) — done
### Palette runtime (`palette.svelte.ts`) — done (incl. scope/context helpers)

### Command box (`command-box.svelte.ts`) — done (incl. model + catalogue payloads)
- [x] `paletteCommandEntries`
- [x] `paletteCommandBoxModel`
- [x] `paletteAddItemEntries`
- [x] `paletteCatalogEntries`
- [x] `paletteDerivedVariants`
- [x] `paletteEnumSubsetValues`
- [x] `PALETTE_CATALOG_DRAG_MIME`
- [x] `serializePaletteCatalogDragPayload`, `parsePaletteCatalogDragPayload`
- [x] `paletteToolbarItemFromCatalogPayload`
- [x] `setPaletteCommandBoxInput`, `handlePaletteCommandBoxInputKeydown`, `handlePaletteCommandChipKeydown`

### Layout components (`components/`)
- [x] `Ide`
- [x] `Toolbar`
- [x] `ToolbarTrack`
- [x] `ToolbarBorder`
- [x] `Parking`
- [x] `beginPaletteCatalogInsertDrag`

### Drawer editor (`drawer-editor.svelte.ts`)
- [ ] `createPaletteDrawerEditor`
- [ ] `paletteDefaultDrawerEditor`
- [ ] `paletteDrawerCollapse` (shared `$state` signal)

## 5. Phases

### Phase 0 — Toolchain ✅ (done, see `docs/architecture.md` §2)
### Phase 1 — Types (`types.ts`) ✅ (done; `PaletteIcon = string | Component`, Snippet excluded)
### Phase 2 — Keys (`keys.ts`) ✅ (done, 8 tests green)
### Phase 3 — Palette runtime (`palette.svelte.ts`) ✅ (done, 17 + 15 tests green; see `docs/architecture.md` §12)

### Phase 4 — Command box (`command-box.svelte.ts`) ✅ (done, 26 tests green; see `docs/architecture.md` §13)
- [x] `commandRunner` throws `PaletteError` for non-runnable specs (aligned with palette error taxonomy)
- [x] `paletteCommandBoxModel` init-time constraint documented as a WARNING in the factory JSDoc
      (create during component/module init only; late creation throws / detaches)

### Phase 5 — Layout components ✅ (done, 13 + 13 tests green; see `docs/architecture.md` §15)

### Phase 6 — Editors & configurators
- [x] Editor-registry render path via `svelte:component` / `mount` (dynamic editor component)
      (`Toolbar.svelte` → `PaletteItem.svelte` `<Editor context>`)
- [x] Axis-aware `PaletteEditorContext.surface` foundation (top/bottom→horizontal,
      left/right→vertical via `surfaceContextFromScope` + `resolveEditorContext`; rendering in Phase 5)
- [x] `Icon.svelte` helper (demo layer): `Component` / string → `<span data-icon>` fallback
      (`src/lib/demo/Icon.svelte`; `Snippet` excluded — render inline markup with `{@render}`)
- [x] Module-level `$state` icon factory (`src/lib/demo/icons.svelte.ts`)
- [x] Default demo editors: button, splitButton, toggle, flip, radio, select, segmented,
      splitRadio, slider, stepper, stars, commandBox (`src/lib/demo/editors/`)
- [x] Configurator panels driven by `describeItemConfiguration` descriptor
      (`BaseConfigurator` + `EnumSubsetConfigurator` read `scope.editorChoices`)
- [x] Bind configurator components with `resolveConfiguratorContext` so registry
      `spec.configure` components receive `context.scope.editorChoices` (the `configurator`
      fallback already gets it via `renderConfigurator`; demo `+page.svelte` binds it)
- [x] Confirm defensive editor resolution failure mode: `Toolbar.svelte` try/catch renders
      nothing on unknown tools/missing editors — desired (keeps broken items inert in edit mode)
- [x] Definition of done: a demo palette renders every tool family in every region
      (`src/lib/demo/palette.svelte.ts` + `src/routes/+page.svelte`: run/boolean/enum/number/item
      across top/left/right/bottom; `check`/`lint`/`test`/`build` green)
- [x] `ToggleEditor` icon: prefers `meta.icon` → `tool.icon` → neutral `●`/`○` (works for any
      boolean tool, not just the notifications demo)
- [x] Editor-registry generics: `spec<TTool>()` infers the family from `editor`; broad
      configurators assign contravariantly, so `registry.ts` no longer needs `as never`
- [x] Demo-editor/configurator smoke test (`tests/palette/editors.test.ts`: toggle, select,
      `BaseConfigurator` editor-choices)

### Phase 7 — Drawer editor
- [x] `createPaletteDrawerEditor(options)` factory returning a Svelte editor spec
      (`src/lib/palette/drawer-editor.svelte.ts`; only `portalContainer` is configurable —
      per-instance CSS classes / `renderIcon` / `renderTrigger` dropped: CSS is global,
      icons are `PaletteIcon`)
- [x] Perpendicular-direction contract documented (`types.ts`: `PaletteDrawerToolbarItem`,
      `PaletteSurfaceContext`, `PaletteEditorContext`; scope carries `palette` + `region`)
- [x] Portal via `mount()`; scope (`palette` + `region`) propagated to popup root
      (`components/DrawerEditor.svelte` + `components/DrawerPopup.svelte`: popup publishes
      `palette` + child `region` via `setPaletteScope` and binds it to the child `Toolbar`;
      `unmount` + `host.remove()` + listener removal in the effect teardown)
- [x] `paletteDrawerCollapse` signal; `open: click|hover|press`, `placement`
      (`$state({ version: 0 })`; drawers `untrack` the initial read and close on bumps;
      `open`/`placement` read from item `config` per render)
- [x] Definition of done: nested drawers open with correct axis inversion
      (child direction inverts parent axis, child region follows; demo has top + left
      drawers with nested toolbars; `tests/palette/drawer.test.ts` 6 pass)
- [x] Fix portal leak: guard moved before `appendChild` — no empty `<div>` on missing palette
- [x] `getPaletteScope` / `setPaletteScope` (dead context helpers) removed — scope flows via
      props today (`Ide` → children, `DrawerEditor` portal → `DrawerPopup` → child `Toolbar`);
      no consumer read the context, so the helpers + context key + `svelte` `getContext`/`setContext`
      import are gone (re-add if a future nested-portal consumer needs ambient scope)
- [x] `open: 'hover'` fixed for portals: trigger leave schedules a 120ms close that popup
      enter cancels (and vice versa); covered by a hover-travel test
- [x] Popup reposition no longer remounts: portal receives the shared `$state` `popupPos`
      object, so resize/scroll re-renders in place (nested state preserved)
- [x] Collapse subscription simplified: plain non-reactive `seenVersion` tracker, no
      `collapseArmed` + `untrack` idiom

### Phase 8 — CSS ✅ (base port done; see `docs/architecture.md` §11)
- [x] Import the stylesheets in the demo layout (`+page.svelte` imports `palette.css` +
      `palette-default.css`)
- [x] Edit-mode hover states unblocked: `Ide`/`Toolbar` exist (Phase 5); verify visually in Phase 9

### Phase 9 — Demo + docs migration
- [ ] Demo page in `src/routes/` exercising all four regions, edit mode, command box, drawer
- [ ] Migrate this plan's "done" details into `docs/`; remove completed checkboxes

### Phase 10 — Full test parity + e2e
- [x] Port remaining specs: `components` (13), `item-movement` (13)
      (`keys`, `palette`, `serialization`, `command-box` already ported in Phases 2–4)
- [ ] Playwright e2e: edit mode toggle, drag reorder, command box search/execute, drawer open/close

## 6. Reactivity conventions

```ts
// tools are plain $state objects supplied by the consumer
const tools = $state({
  fontSize: { type: 'number', value: 14, default: 14, min: 10, max: 40, step: 1 },
  theme: { type: 'enum', value: 'dark', default: 'dark', values: [{ value: 'dark' }, { value: 'light' }] },
})

// shared module state (palettes, collapse signal) — must be .svelte.ts
export const palettes = $state<{ editing?: Palette }>({})
```

Rules:
1. Runes only in `.svelte.ts` / `.svelte`; keep pure algorithms in `.ts`.
2. Mutate `$state` directly (no `unwrap`); derive with `$derived`.
3. Editors are plain Svelte components reading `$state`/`$derived` — no model layer, no variant
   factory, no imperative DOM mutation.
4. One shared editing palette at a time (mirrors `palettes.editing` semantics).

## 7. Risks / open questions

- [ ] Svelte 5 `mount()` for the drawer portal: confirm cleanup/dispose on collapse.
- [ ] Native HTML5 DnD + Svelte reorder: decide pointer-events vs. HTML5 DnD (sursaut uses both).
- [ ] `$state` deep reactivity on large nested layouts: verify perf vs. sursaut's `reactive`.
- [ ] Icon type: settled — `Component | string` (`Snippet` excluded, see Phase 1).

## 8. Completion

Svelette is based on sursaut-ui/palette, but sursaut-ui/palette is not complete and finished. We need to end up with a complete and consistent palette system who will serve as an example to finish sursaut-ui/palette as well as other implementations (react, ...) - so this library should be:
- complete: no more tinkering and have all cases covered. All functionalities will have to be thought about
- consistent: highly tested, all edge-cases taken into consideration and every errors reported properly

## 9. Heads

Should we do a default head? (svelette is headless) - tutorial to make some ?