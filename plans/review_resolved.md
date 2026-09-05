# Review — palette implementation (Phases 1–3) — resolved

Date: 2026-09-05 · Scope: `src/lib/palette/*`, `src/lib/demo/*`, `tests/palette/*`

All items corrected. Details migrated to `docs/architecture.md` §12.
Gates green: `lint | check | test (40) | build`.

## Resolved

- Style injection (`paletteInstanceStyle` + `#disposeStyle` + `data-palette-id`): deleted.
  Edit-mode affordances are global in `styles/palette.css`, gated on
  `.palette-ide.editing`; `dispose()` is a parity no-op. Selectors stay
  specific via hierarchy/prefixes, never bare (`.active {`).
- `renderConfigurator` `augmentedScope`: fixed via `resolveConfiguratorScope`
  (both paths) + `resolveEditorContext` + `surfaceContextFromScope` +
  `setPaletteScope`/`getPaletteScope`. Full `<PaletteItem>` renderer lands in Phase 5.
- `editing`/`isEditing`: plain `===` (class instances are never `$state`-proxied).
- `PaletteScope`: typed `editorChoices` (`PaletteEditorChoice`) + context helpers;
  index signature kept for reference parity.
- `hydratePaletteLayout`: init-time constraint documented + reactivity test
  (`HydratedBordersProbe.svelte`).
- `dragend` listener: boolean guard kept deliberately (`svelte` exposes no
  `effectRoot`); handler extracted as `clearPaletteCatalogDragOnNativeDragEnd` + tested.
- `PaletteIcon`: `string | Component` (Snippet excluded, documented).
- `setter` divergence: verified against reference, documented, multi-setter test added.
- Configurator return types: `PaletteConfiguratorComponent` throughout, no cross-cast.
- Barrel: `from './palette.svelte'` is required (explicit `.svelte.ts` rejected by
  `svelte-check`); kept as-is.

## Remaining (Phase 5)

- `<PaletteItem>` renderer component binding `resolveEditorContext` output to
  `<Editor context={...} />` — tracked in `plans/palette.md` Phase 5.
