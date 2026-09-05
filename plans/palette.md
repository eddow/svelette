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
├── editors.ts             # default editor capability descriptors (pure data)
├── drawer-editor.svelte.ts# createPaletteDrawerEditor factory + collapse signal
├── components/
│   ├── Ide.svelte
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
- [ ] `Ide`
- [ ] `Toolbar`
- [ ] `ToolbarTrack`
- [ ] `ToolbarBorder`
- [ ] `Parking`
- [ ] `beginPaletteCatalogInsertDrag`

### Drawer editor (`drawer-editor.svelte.ts`)
- [ ] `createPaletteDrawerEditor`
- [ ] `paletteDefaultDrawerEditor`
- [ ] `paletteDrawerCollapse` (shared `$state` signal)

## 5. Phases

### Phase 0 — Toolchain ✅ (done, see `docs/architecture.md` §2)
### Phase 1 — Types (`types.ts`) ✅ (done; `PaletteIcon = string | Component`, Snippet excluded)
### Phase 2 — Keys (`keys.ts`) ✅ (done, 8 tests green)
### Phase 3 — Palette runtime (`palette.svelte.ts`) ✅ (done, 17 + 15 tests green; see `docs/architecture.md` §12)

### Phase 4 — Command box (`command-box.svelte.ts`) ✅ (done, 25 tests green; see `docs/architecture.md` §13)

### Phase 5 — Layout components
- [ ] `<PaletteItem>` renderer binding `resolveEditorContext` output to
      `<Editor context={...} />` (from review: bare-`Component` returns need a bind step)
- [ ] `Ide.svelte` — four optional borders around a center slot
- [ ] `Toolbar.svelte` — one toolbar in a region/direction
- [ ] `ToolbarTrack.svelte` — one track (toolbar slots + spacing)
- [ ] `ToolbarBorder.svelte` — a full region border
- [ ] `Parking.svelte` — parked toolbar staging area
- [ ] edit mode: draggable items, drop zones, item config on click
- [ ] catalogue insert drag + pointer reorder (match sursaut `components.tsx` semantics)
- [ ] Definition of done: port `components.spec.ts` and `item-movement.spec.ts`

### Phase 6 — Editors & configurators
- [ ] Editor-registry render path via `svelte:component` / `mount` (dynamic editor component)
- [x] Axis-aware `PaletteEditorContext.surface` foundation (top/bottom→horizontal,
      left/right→vertical via `surfaceContextFromScope` + `resolveEditorContext`; rendering in Phase 5)
- [x] `Icon.svelte` helper (demo layer): `Component` / string → `<span data-icon>` fallback
      (`src/lib/demo/Icon.svelte`; `Snippet` excluded — render inline markup with `{@render}`)
- [x] Module-level `$state` icon factory (`src/lib/demo/icons.svelte.ts`)
- [ ] Default demo editors: button, splitButton, toggle, flip, radio, select, segmented,
      splitRadio, slider, stepper, stars, commandBox
- [ ] Configurator panels driven by `describeItemConfiguration` descriptor
- [ ] Definition of done: a demo palette renders every tool family in every region

### Phase 7 — Drawer editor
- [ ] `createPaletteDrawerEditor(options)` factory returning a Svelte editor spec
- [x] Perpendicular-direction contract documented (`types.ts`: `PaletteDrawerToolbarItem`,
      `PaletteSurfaceContext`, `PaletteEditorContext`; scope carries `palette` + `region`)
- [ ] Portal via `mount()`; scope (`palette` + `region`) propagated to popup root
- [ ] `paletteDrawerCollapse` signal; `open: click|hover|press`, `placement`
- [ ] Definition of done: nested drawers open with correct axis inversion

### Phase 8 — CSS ✅ (base port done; see `docs/architecture.md` §11)
- [ ] Import the stylesheets in the demo layout (Phase 9)
- [ ] Verify edit-mode hover states visually once `Ide`/`Toolbar` exist (Phase 5)

### Phase 9 — Demo + docs migration
- [ ] Demo page in `src/routes/` exercising all four regions, edit mode, command box, drawer
- [ ] Migrate this plan's "done" details into `docs/`; remove completed checkboxes

### Phase 10 — Full test parity + e2e
- [ ] Port remaining specs: `components`, `item-movement`
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
