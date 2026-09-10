# Movement — restart from scratch

> Status: **stripped (2026-09-10).** Drag & drop, hit-testing, preview, and the
> catalogue-insert session were removed; `palettes.dragging` is an empty
> placeholder and item guards only inspect. The next movement design starts
> here. Permanent principles will live in `docs/movements.md` (currently a
> stub).

## The target behaviour (agreed, kept)

1. **Previewing is moving** — a drag session can't be escaped/cancelled; once
   activated, releasing commits whatever is on screen. The moved element is
   removed from its origin **only when added elsewhere**.
2. **Toolbar** moves between stacks and tracks.
3. **Tool → track/stack** creates a singleton toolbar; **tool → toolbar** merges.
4. **Emptying a toolbar removes it** (and its track, if that empties too).
5. **Candidate targets mini-expand** (a few pixels) when the pointer gets near.
6. **Deletion is not drag.** The only ways to remove an editor are:
   - **editing the editor** (a "delete" button on its edit surface), or
   - **moving it to parking, then removing it from parking.**

## What remains (verified)

- Layout primitives: `insertToolbar`, `insertTrackWithToolbar`,
  `removeToolbar`, `removeEmptyTrack`, `removePaletteItem`, `resizeToolbar`.
- Passive space/drag action stubs; `paletteItemDrag` only inspects.
- Deletion via editor edit surface ("delete" button) — `removePaletteItem` +
  `configuratorPresenter.removable/remove()` + `BaseConfigurator` delete button.
- Deletion via parking → remove — `Parking.svelte` binds the live top border;
  `×` removes from the real border. (Parking rows are display-only until the
  next movement design; parking is not persisted — `serialize`/`hydrate`
  round-trip borders only.)

## Next design (to be written)

- Drop-target model, hit-testing approach, preview affordance, session
  lifecycle, and invariants — see `docs/movements.md` stub.
