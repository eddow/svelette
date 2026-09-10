# Toolbar movement & reorganisation

Engine: `src/lib/palette/layout.svelte.ts` (hit-testing, live move, container
cleanup) + `src/lib/palette/drag-session.ts` (the low-level pointer session).
This file describes the **principles** of how toolbars, tracks and items are
re-organised while a palette is in edit mode. For the data model itself see
`docs/layout-and-drag.md` and `docs/architecture.md`.

## The mental model: previewing is moving

A drag session is **not** a "proposal" you can back out of. There is no escape
and no cancel: once the drag begins, the layout is re-shaped **live**, and
releasing the button simply commits whatever is on screen ("releasing the
button just don't move it anymore").

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
existing toolbar, or a freshly minted single-item "shell" toolbar. The moved
items stay together as that unit — they are **never reordered among
themselves** — until the drag is released; the drop zone only positions the
whole unit.

- **Toolbar drag** — grabbing the toolbar chrome starts
  `createToolbarDragging`: the whole toolbar is the unit, `sourceItems` is a
  snapshot of its items, and `sourceTrackWasSingleton` remembers whether its
  track held *only* this toolbar. This is the **only** way several tools move
  at once: dragging a whole toolbar carries every tool in it together.
- **Item drag** — grabbing a single item starts `createItemDragging`:
  - if the item's toolbar has **only one item**, this *is* a toolbar drag (the
    item is the toolbar);
  - otherwise the item is detached into a single-item "shell" toolbar, which is
    the moving unit. The item stays visible at its origin until the pointer
    hovers a drop zone; only then does the relocation begin. There is no
    distance threshold — movement is driven purely by hovering a drop zone.

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
   For item drags the unit lives in the ephemeral shell (proxy re-linking can
   leave `dragging.track` pointing at the shell's empty slot), so
   `moveToolbarToStack` handles the shell directly: drop the empty shell track
   from the ephemeral border, then `insertTrackWithToolbar` the unit as a
   singleton — the preview is cleared first so the item isn't duplicated.
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

Dropping **a single item** (a tool) onto another toolbar's *toolbar space*
splices the item into that toolbar at the hovered item index. The origin
toolbar loses it; if the origin track empties as a result, it is removed too
(see below).

### Toolbar → toolbar (no merge — separation is preserved)

A **whole toolbar** never merges into another toolbar: dropping it onto a
toolbar space would concatenate its tools into the host (`A B C` onto `X Y` →
`X A B C Y`) and lose the toolbar boundary. So every toolbar space is ignored
for a whole-toolbar drag (`isIgnoredToolbarSpace` bails when the session is
flagged `wholeToolbar`) — the toolbar must land in a *track* or *stack* space,
where it becomes its own toolbar in its own lane. Only a single-item (tool)
drag merges.

### Tool → track/stack (singleton toolbar)

Dropping an item onto a *track* or *stack* space creates a **singleton toolbar**
containing just that item — `insertToolbar` / `insertTrackWithToolbar` with a
`[item]` toolbar. This is the canonical "a tool dropped in empty space becomes
its own toolbar" rule. The item drag records the **true origin**
(`sourceBorder/track/index` point at the live layout, not the ephemeral
shell), so the stack-ignore rule only ignores stacks adjacent to the real
source lane — dropping onto any other stack always spawns the singleton.

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
stack space at the object's original position (`isIgnoredStackSpace`).

## Drop-zones (the visible landing targets)

While a drag is in progress the engine shows the drop-zones where the dragged
unit can land. They are **recomputed continuously and evolve as the pointer
moves** — never fixed at drag start. A drop-zone **materialises** by taking the
shade it already has (its hover/active tint) and acquiring a minimum
width/height, so a zero-width/zero-height gap becomes a visible landing slot.

### Coordinate terms (orientation-free)

Everything below is written for a **left-most vertical toolbar**. Every other
region is the exact mirror (swap `left`/`right` for `top`/`bottom` and invert
the centre), so the terms never mention `up/down/left/right` directly:

- **begin / end** — along the toolbar's main axis. For a vertical toolbar
  `begin` = top and `end` = bottom; for a horizontal toolbar `begin` = left and
  `end` = right.
- **centric / excentric** — perpendicular to the main axis. `centric` is toward
  the centre of the IDE, `excentric` toward the outer edge (for a left toolbar:
  centric = right, excentric = left).

A drop-zone is therefore always "the nearest begin/end/centric/excentric slot".

Every directional zone must **encompass the pointer along the perpendicular
axis** before it can open — "nearest" is not measured along one axis alone:

- **begin / end** zones (reorder + track-insert) span the toolbar's full
  cross-axis extent, so a gap is only a candidate when the pointer's cross-axis
  coordinate falls inside that span. Dragging on the left toolbar can therefore
  never open a reorder/insert zone on the right toolbar, even when the two share
  the same main-axis coordinate — the pointer's X only falls inside the left
  lane. (Transposed horizontally: a horizontal-toolbar gap must contain the
  pointer's Y.)
- **centric / excentric** zones (new-stack) span the full main-axis extent, so a
  stack gap is only a candidate when the pointer's main-axis coordinate falls
  inside its span — a stack gap on a far-away row never opens.

### Exhaustive list of drop-zones

**A. Inside a toolbar — reorder (begin/end).** The two reorder drop-zones are
the nearest gaps on **either side of what the pointer hovers** — they flank the
hovered position, independent of which tool was grabbed:

- With `X Y Z` and the pointer over `Y`, the drop-zones are the gap **between
  `X` and `Y`** (begin) and the gap **between `Y` and `Z`** (end).
- With `A B C D` and the pointer over the `B … C` span, the drop-zones are the
  gap **between `A` and `B`** (begin) and the gap **between `C` and `D`** (end).

So the zones always straddle the hovered region: the nearest gap before it and
the nearest gap after it. When the pointer is over the **first** tool, the begin
drop-zone is the gap *before that tool* — i.e. between this toolbar and the
previous (begin-side) one, or the track's begin edge when there is none. That
begin drop-zone has a minimum height (~5px) so it stays reachable at the very
top of the toolbar.

**B. In a track / toolbar — new stack (centric/excentric).** When the pointer is
in a track (or one of its toolbars), the **centric** and **excentric** drop-zones
each create a *new stack* — a new track — on their respective side. A new track
is only actually created if the pointer **rests in the drop-zone for ~1s**
(`STACK_CREATE_DWELL_MS`); a passing hover does not create it.

**C. Completely outside any toolbar — new track on the far side.** When the
pointer is entirely outside every vertical toolbar (e.g. in the open area to the
right of one), the available drop-zone toward the centre is the one that creates
a track on the right-most (centric-most) side.

### Materialisation

A drop-zone materialises by taking its existing shade and acquiring a minimum
width (horizontal axis) or minimum height (vertical axis). The zone the pointer
is actually over is the active commit target (`data-active`); the other
directional nearests stay visible (`data-proximity`) as the "offering itself"
hint. Hovering a drop-zone (no distance threshold) commits the move there; the
stack-space dwell (~1s) is the only delay, and only for creating a new track.
The ignore guards (`isIgnored*`) only remove slots the drag cannot land on: its
own lane, its own preview span, and — for whole-toolbar drags — every toolbar
space (separation preserved).

## Session lifecycle

`startPaletteToolbarDragSession` wires a `startPaletteDragSession` (pointer
capture + `window` move/up/cancel/blur/visibility listeners). Because the
session object is assigned into the `$state` `palettes` store, activation
re-links the shell's border/track/toolbar through the store's own proxies so
every reference shares the same proxied arrays (see `docs/architecture.md`
§20). The origin splice deliberately bypasses the proxied session: `$state`
deep-proxying breaks `indexOf` identity and write-through on the proxied
arrays, so the detach uses the plain `live` closure refs captured at
`pointerdown`.

## Mid-drag chrome (why the origin toolbar looks "dragged")

The session's unit toolbar is the ephemeral single-item shell — never rendered
— so `data-dragging` and the inactive preview-span gaps must key off the live
preview host (the origin toolbar showing the dragged item). `$state`
deep-proxying breaks `===` between the session's `toolbarPreview.toolbar` and
the component's `toolbar` prop (verified: `preview.toolbar === origin` is
`false` even for the host, same for `inspecting.toolbar`), so `Toolbar.svelte`
matches by membership instead: the host is the toolbar currently containing
the dragged source items (structural fingerprint via `JSON.stringify`, since
items are plain data). While the preview is live the host renders
`data-dragging="true"` and its preview-span gaps go inactive — the dragged
tool is shown, the in-toolbar drop zones collapse, and every other toolbar's
gaps stay live targets.

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

On release (or any end-of-drag event — `up`, `buttons`, `cancel`, `blur`,
`hidden`, `manual`), the transient highlight flags are cleared, the preview is
finalised (or the deferred source track collapsed), and `palettes.dragging` is
deleted. There is no branch that undoes a move.
Catalogue (HTML5) inserts reuse the exact same `PaletteDragging` / preview /
finalize path via `beginPaletteCatalogInsertDrag`, so the same principles govern
both pointer and drag-from-catalogue reorganisation.

## Invariants

- **Previewing is moving** — there is no escape/cancel; releasing commits what
  is on screen.
- The moved element is **removed only when added elsewhere** — every move is a
  relocation, never a removal.
- A toolbar **can** move between tracks and between stacks (regions/borders).
- A single item dropped in a toolbar **merges**; a whole toolbar dropped on a
  toolbar space is **ignored** (separation preserved) and must land in a
  track/stack space.
- An item or toolbar dropped in a track/stack **becomes its own toolbar**.
- The **four nearest drop-zones** (begin/end/centric/excentric) evolve with the
  pointer and stay open during any drag — the standard affordance for every drag.
- An **emptied toolbar/track is pruned** and spacing re-merged — container
  cleanup, not editor deletion.
- **Deletion is not drag** — editors are removed only via their edit surface's
  delete action, or by parking then removing from parking.
- Drop-zones materialise by taking their shade and acquiring a minimum
  width/height; hovering one (no distance threshold) moves the tool there.