# Movement

> Status: **slide/restructure mode + slide anchor fixed (2026-09-12).** Permanent
> principles live in `docs/movements.md`.

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

## Done (2026-09-12)

### The drag mode — one derived question, cached

`PaletteDragging.phase` (`'tools' | 'toolbar'`, recorded at grab) is replaced by
`mode` (`'restructure' | 'slide'`), derived and cached from a single question:
*"is there anything else than my dragged tools left in my toolbar?"*

- **no** → `'slide'` — the toolbar itself moves (true for a whole-toolbar grab
  *and* for a lone tool).
- **yes** → `'restructure'` — a subset to extract.

`refreshDragMode` runs after every structural commit, so a restructure becomes a
slide once its tools land in their own toolbar, and a slide becomes a restructure
as soon as a merge puts other tools beside it. `resolveDragMode` is exported for
tests; the mode is never re-derived per pointer move.

### Bug: sliding continued after a cast into another toolbar

`ToolbarTrack`'s arming `$effect` only ever *armed* — it had no `else` branch —
so after an item-space merge it re-armed `retargetToolbarSlide` over the merged
target toolbar, undoing the commit's `clearToolbarSlide()` in the same tick. The
toolbar kept translating even though the selection was no longer a whole toolbar.

Fixed by gating the effect on `mode === 'slide'` and adding the explicit
`else { clearToolbarSlide() }` disarm path. Merely not arming is not enough when
a live session is already transform-ing an element.

### Bug: ~toolbar-size position error when a restructure became a slide

`retargetToolbarSlide` anchored on `bounds.start` — the **leading gap's** edge —
while the toolbar actually rests at `bounds.start + leadingGapWidth`, and
`transform` is applied relative to that resting position. The anchor is now that
resting offset, so `clampSlideDelta` returns a shift from resting:

```
offset0 = rect.left − bounds.start
delta   = clamp(pointer − grabOffset − bounds.start) − offset0
```

A whole-toolbar grab has shift `0` at arm time (no jump); a recentered
restructure now lands centered on the cursor instead of one gap-width off.

Also removed a self-mutating effect dependency: the effect read
`dragging.grabOffset` while `retargetToolbarSlide` wrote it, re-running the
effect with different measured bounds. The effect no longer reads the field.

## Done earlier (2026-09-12)

### Track-gap commit — duplication fixed

**Two toolbars both holding the same tools** after hovering a gap with a tool
set. Two causes:

1. The drag kind was re-derived from the tool lists on every commit, so a drag
   starting in a multi-tool toolbar read as "partial" forever.
2. An identity bug: a toolbar stored in a `$state` border is a *proxy* of the
   array inserted, so reusing the raw local reference made every later
   `findIndex`/`includes` miss — which disabled the flanking-gap guard and let a
   second hover insert a duplicate. The commit now reads the placed toolbar back
   out of the track.

### Declarative slide arming, one slide math, dead code

`rearmToolbarSlide` + `tick().then(querySelector(…))` replaced by the track's
`$effect`. `slideToolbarInTrack` (never called) deleted; `clampSlideDelta` is the
single copy of the slide math. Removed the track-gap fallback
(`trackGapFallback`/`onTrackGap`/`slotIndex`), `isTrackSpaceHighlighted` and its
CSS, the three inert space actions, `PaletteItemDragTarget.itemIndex`, the debug
`console.log`s, and the false 4px-threshold comment.

## TODO

- **Stack DZ commits** (tool → new singleton toolbar in a track/stack).
- **Parking is not persisted** — `serialize`/`hydrate` round-trip borders only;
  parking rows are display-only until the next movement design.
- **Auto-hover-commit sharp edge** — a released drag over a gap commits even
  without intent. Options: keep as agreed ("previewing is moving"), require a
  click before promotion, or promote only after the pointer rests ~150ms.
- **Cross-axis gap commit** — a gap commit currently lands *between* toolbars.
  Should a commit near the track's cross-axis edge instead insert a **new
  track** (a parallel stack)?
- **Single-toolbar-per-item invariant** — confirm `composer`/`drawer` toolbars
  still cannot be split across toolbars by dragging after a placement.

