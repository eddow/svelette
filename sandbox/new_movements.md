# Toolbar movement & reorganisation

> Status: **stripped for restart (2026-09-10).** Drag & drop, hit-testing, and
> preview were removed from `src/lib/palette/layout.svelte.ts` (plus the
> catalogue-insert session and the `data-active`/`data-proximity` chrome).
> What remains: pure layout primitives (`insertToolbar`,
> `insertTrackWithToolbar`, `removeToolbar`, `removeEmptyTrack`,
> `removePaletteItem`, `resizeToolbar`), passive space/drag action stubs, and
> inspect-on-`pointerdown` via `paletteItemDrag`. The next movement design
> will be built on top of those primitives — this file is the scratchpad for
> the new principles, not a record of the old engine.

Engine: `src/lib/palette/layout.svelte.ts` (layout primitives + action stubs).
For the data model itself see `docs/layout-and-drag.md` and
`docs/architecture.md`.

## What remains (verified)

- Layout primitives: insert/remove/resize toolbars and tracks, plus
  headless item removal (`removePaletteItem`, the single mutation behind the
  editor delete button and parking's `×` button).
- `paletteItemDrag` only inspects on `pointerdown` (sets
  `palettes.inspecting`); `paletteToolbarDrag` and the three space actions
  are passive placeholders.
- `palettes.dragging` is an empty placeholder slot (nothing sets it yet).

## Next design (to be written)

- Drop-target model (what slots exist, what moves, what commits).
- Hit-testing approach (no halo legacy — restart from scratch).
- Preview affordance (how the landing spot shows before commit).
- Session lifecycle (activation, move, release/cancel).
- Invariants (conservation, cleanup, deletion-is-not-drag).
