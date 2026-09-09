# Toolbar movement & reorganisation

Engine: `src/lib/palette/layout.svelte.ts` (hit-testing, live move, container
cleanup) + `src/lib/palette/drag-session.ts` (the low-level pointer session).
This file describes the **principles** of how toolbars, tracks and items are
re-organised while a palette is in edit mode. For the data model itself see
`docs/layout-and-drag.md` and `docs/architecture.md`.

## The mental model: previewing is moving

A drag session is **not** a "proposal" you can back out of. There is no escape
and no cancel: once the pointer has moved past the activation threshold, the
layout is re-shaped **live**, and releasing the button simply commits whatever
is on screen ("releasing the button just don't move it anymore").

The one invariant that makes this safe: **the moved element is removed from its
origin only when it is added somewhere else.** Origin and destination are
coupled — an object never sits in limbo, and it can never be dragged "into the
void" to disappear. Every move is a *relocation*, never a *removal*.

Three kinds of slot are eligible drop targets, in increasing order of scope:

| Slot          | What it holds               | Dropping there…                                   |
| ------------- | --------------------------- | ------------------------------------------------- |
| **toolbar space** | an item position inside a toolbar | merges the moved item(s) into that toolbar |
| **track space**   | a toolbar position inside a track | inserts a toolbar (or re-homes the moved items as one) |
| **stack space**   | a track position inside a border | inserts a brand-new single-toolbar track |

## What actually moves

A drag session always moves a single **toolbar** as its unit — either an
existing toolbar, or a freshly minted single-item "shell" toolbar.

- **Toolbar drag** — grabbing the toolbar chrome starts
  `createToolbarDragging`: the whole toolbar is the unit, `sourceItems` is a
  snapshot of its items, and `sourceTrackWasSingleton` remembers whether its
  track held *only* this toolbar.
- **Item drag** — grabbing a single item starts `createItemDragging`:
  - if the item's toolbar has **only one item**, this *is* a toolbar drag (the
    item is the toolbar);
  - otherwise the item is **detached** into an ephemeral single-item toolbar
    (its own border/track/toolbar), and that shell is the unit. Because the
    detach happens on `pointerdown`, activation re-inserts the item as the
    initial preview (see below); a plain click (no activation) re-inserts it
    exactly where it was — but that is a *click*, not a cancelled drag, since
    the drag never activated.

## Removal is coupled to placement

The re-shaping is a sequence of *relocations*, each of which removes the unit
from its current home only to immediately place it in a new one:

1. **Hovering a toolbar space** — `previewToolbarItems` removes the unit from
   its current track and splices its items into the target toolbar, recording a
   `toolbarPreview` describing the in-flight placement. The item is now *shown
   live* inside that toolbar; the origin toolbar/track is the moment-to-moment
   casualty, not a pending tombstone.
2. **Hovering a track/stack space** — the toolbar preview is cleared and the
   unit is placed directly into the real border via `moveToolbarToTrack` /
   `moveToolbarToStack`. Origin is removed as part of that same insertion.
3. **Releasing** — `startPaletteToolbarDragSession`'s `onStop` either
   `finalizeToolbarPreview` (keep the toolbar merge) or
   `collapseDeferredSourceTrack` (clean up the origin track if it started as a
   singleton), then deletes the session. There is no "restore on release" —
   release commits.

Concretely: moving an item over another toolbar shows the item *live* inside
that toolbar; moving it over empty space shows a ghost singleton toolbar about
to form; and once placed, it stays.

## The move cases

### Toolbar between tracks

Dragging a toolbar and releasing over a *track space* calls
`moveToolbarToTrack`: it removes the toolbar from its origin track, then
`insertToolbar` splits the target gap according to the pointer's position within
that gap (`split`) and re-inserts the toolbar. Moving within the same track only
resizes the surrounding gaps (`resizeToolbar`) — no removal, just reflow.

### Toolbar between stacks (tracks/borders)

Releasing over a *stack space* calls `moveToolbarToStack`: remove the toolbar,
then `insertTrackWithToolbar` creates a new single-toolbar track inside the
target border at the clamp of the stack index. This is how a toolbar crosses
regions or sits in a fresh stack lane.

### Tool → toolbar (merge)

Dropping an item (or a whole toolbar) onto another toolbar's *toolbar space*
splices the moved items into that toolbar at the hovered item index. The origin
toolbar loses them; if the origin track empties as a result, it is removed
too (see below).

### Tool → track/stack (singleton toolbar)

Dropping an item onto a *track* or *stack* space creates a **singleton toolbar**
containing just that item — `insertToolbar` / `insertTrackWithToolbar` with a
`[item]` toolbar. This is the canonical "a tool dropped in empty space becomes
its own toolbar" rule.

## Empty container cleanup

Reorganisation prunes containers that no longer hold anything — this is
structural housekeeping, **not** deletion of an editor. A toolbar that loses its
last item is dropped; when the enclosing track is left with zero slots, the
track itself is spliced out of its border (`removeToolbarFromDragTrack` /
`removeEmptyTrack` / `collapseDeferredSourceTrack`), and spacing is re-merged
(`removeToolbar`). Moving a tool out of a toolbar and leaving it empty therefore
removes the (empty) toolbar and, if needed, its track.

## Deletion is not drag

Dragging **never deletes** an editor. Relocation keeps the object alive
elsewhere; empty-container cleanup removes *containers*, never the tool itself.
The only ways to remove an editor are:

1. **Editing the editor** — the editor's own edit surface exposes a *delete*
   action (a "delete" button). Headless primitive: `removePaletteItem(item,
   toolbar, track, border)` in `layout.svelte.ts` (item-level, D2; lives in
   layout alongside `removeToolbar`, D3) — removes the item, prunes the emptied
   toolbar/track, re-merges spacing. Surfaced via `configuratorPresenter`'s
   `removable` + `remove()` and the `Delete editor` button in
   `BaseConfigurator.svelte`; the console carries the live
   toolbar/track/border on `palettes.inspecting` into the configurator scope.
2. **Moving it to parking, then removing it from parking** — an editor can be
   relocated into the parking area and deleted there. `Parking.svelte` binds
   the **live** top border (not a snapshot copy): rows render live toolbars,
   the `×` button removes from the real border, and every row is a real
   drag-engine drop target (stack + toolbar spaces bound to the live
   border/track). The command-box launcher row is hidden from the parking
   *view* only — the live border is untouched.

Parking is **not persisted** (D1): `SerializedPaletteLayout.parking` stays an
accepted-but-ignored field — `serialize`/`hydrate` round-trip borders only, so
parking is a session view over the live border, never stored layout.

In other words: a drag is always a *move*, and "getting rid of a tool" is a
separate, explicit action, never a side effect of dragging.

## Hit-testing & target resolution

On every pointer move, `paletteToolbarDragApplyMove` resolves up to three
candidate targets from live element geometry (registered by the `paletteToolbarSpace` /
`paletteTrackSpace` / `paletteStackSpace` actions):

```text
resolved =
  toolbar-space contained            → toolbar-space
  else track-space absent            → stack-space
  else stack-space absent            → track-space
  else stack-space contained         → stack-space
  else track-space contained         → track-space
  else (neither contained)           → track-space
```

In words: a contained toolbar space always wins; otherwise a contained space
beats a proximity-only one; and between a track and a stack that are both
proximity-only, the track wins (closer to "reflow within a lane" than "start a
new lane").

Ignored zones keep the object from fighting itself: a track space that is its
own current/next gap (`isIgnoredDropZone`), a toolbar space inside the toolbar
being moved or inside its current preview span (`isIgnoredToolbarSpace`), and a
stack space at the object's original position within ~12px of the drag start
(`isIgnoredStackSpace`).

## Proximity: mini-expansion of candidate targets

So that a valid slot doesn't require pixel-perfect aim, **every** drop-target
kind shares one near-enough test — `withinProximityHalo` (Euclidean
`rectDistanceToPoint <= 12px`, `PALETTE_PROXIMITY_HALO`). Track and toolbar
resolvers pre-filter with it before picking the nearest; the stack resolver
uses it directly (replacing the old directional `expandStackSpaceRect`
padding, kept only as a tested helper). A target within the halo but not
strictly contained is treated as *proximity* and is highlighted
(`data-proximity`) while the actually-contained target (if any) becomes the
*active* one (`data-active`). The CSS uses these flags to render the "slot is
offering itself" affordance — track spaces mini-expand (8px) exactly like
stack/item spaces.

## Session lifecycle

`startPaletteToolbarDragSession` wires a `startPaletteDragSession` (pointer
capture + `window` move/up/cancel/blur/visibility listeners) with a **4px
activation threshold**. Below 4px the gesture is a *click* (re-inserts a
detached item at its origin); at or above it the live-move path engages
(`onActivate`). Because the session object is assigned into the `$state`
`palettes` store, activation re-links the shell's border/track/toolbar through
the store's own proxies so every reference shares the same proxied arrays (see
`docs/architecture.md` §20).

## Action param freshness (repeat-move)

Svelte actions receive their param once at mount — the component rebuilds the
`target` object every render, but without an `update()` hook the action keeps
resolving the **pre-reorder** border/track/toolbar. After the first reorder the
stale references make the second drag silently no-op (hit-testing resolves
detached arrays, `createItemDragging` detaches from the wrong toolbar).

Every layout action (`paletteTrackSpace`, `paletteStackSpace`,
`paletteToolbarSpace`, `paletteToolbarDrag`, `paletteItemDrag`) therefore keeps
a `current` target and refreshes it in `update(next)`: space actions re-set
their `WeakMap` meta, drag actions re-point their `pointerdown` closure. The
registered geometry always resolves the live post-reorder arrays, so
repeat-moves commit exactly like first moves.

Once activated, **every** stop reason (`up`, `buttons`, `cancel`, `blur`,
`hidden`, `manual`) commits: the transient highlight flags are cleared, the
preview is finalised (or the deferred source track collapsed), and
`palettes.dragging` is deleted. There is no branch that undoes a move.
Catalogue (HTML5) inserts reuse the exact same `PaletteDragging` / preview /
finalize path via `beginPaletteCatalogInsertDrag`, so the same principles govern
both pointer and drag-from-catalogue reorganisation.

## Invariants

- **Previewing is moving** — there is no escape/cancel; releasing commits what
  is on screen.
- The moved element is **removed only when added elsewhere** — every move is a
  relocation, never a removal.
- A toolbar **can** move between tracks and between stacks (regions/borders).
- An item dropped in a toolbar **merges**; an item dropped in a track/stack
  **becomes a singleton toolbar**.
- An **emptied toolbar/track is pruned** and spacing re-merged — container
  cleanup, not editor deletion.
- **Deletion is not drag** — editors are removed only via their edit surface's
  delete action, or by parking then removing from parking.
- Candidate targets are **mini-expanded** (12px halo) so near-misses still
  register, and the resolved host is highlighted as active while near it.