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

## Toolbar slide: grab-point formula

Sliding a whole toolbar must feel like grabbing it at a fixed point: the cursor
stays at the same spot on the toolbar while it moves. Because toolbars have
fixed pixel widths, the slide is computed in **pixels**, not track fractions —
the gaps absorb all motion and the toolbar span is constant.

Notation (pixels, horizontal; swap axes for vertical):

- `G` — total free gap width: `G = trackWidth − Σ toolbar[n].width`.
- `budget = (spaces[i] + spaces[i+1]) × G` — the two gaps around toolbar `i`,
  constant during the drag, so the neighbours never move.
- `left = Σ_{n<i} (spaces[n] × G + toolbar[n].width)` — fixed left boundary
  (everything before the leading gap); `right = left + budget` — right boundary
  (`total-width` when `i` is the last toolbar, i.e. the trailing gap is
  implicit).
- `x₀`, `t₀` — cursor and toolbar left-edge positions captured on mousedown.

Per move, keep the cursor at its fixed offset on the toolbar and clip the
leading gap to its budget:

```
x    = clamp(x − x₀ + t₀, left, right)
spaces[i]   = (x − left) / G
spaces[i+1] = budget − spaces[i]
```

applied via `resizeToolbar(track, i, spaces[i] / budget)`. `resizeToolbar` folds
the implicit trailing gap in when `i = n − 1`, so the last toolbar is not a
special case. In the code, `left`/`right` are read directly from the
`.toolbar-track-slot` siblings (leading/trailing gap elements), which sit
between the two gaps — no registry or width bookkeeping is needed.

## TODO

toolbar reposition movement lag when no devTools

We should try this way perhaps:

```ts
let latestX = 0;
let latestY = 0;
let dirty = false;

// 1. Just store the latest coordinates asynchronously
window.addEventListener('pointermove', (e) => {
  latestX = e.clientX;
  latestY = e.clientY;
  dirty = true;
}, { passive: true });

// 2. Drive the DOM update loop synchronously on the render tick
function update() {
  if (dirty) {
    dragItem.style.transform = `translate3d(${latestX}px, ${latestY}px, 0)`;
    dirty = false;
  }
  requestAnimationFrame(update);
}
requestAnimationFrame(update);
```