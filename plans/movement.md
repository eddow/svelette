# Movement — Analysis & Plan

> Status: **NOT done.** Phases 1–4 closed the *unit-testable* gaps (G1 uniform
> halo, G2 delete, G3 live parking), but real-browser testing (trusted
> `page.mouse`, not synthetic `dispatchEvent`) reproduces two live bugs the
> current suite does not catch. See "Re-opened — live bugs" below. Permanent
> principles live in `docs/movements.md`.

## Re-opened — live bugs (reproduced with real mouse, 2026-09-09)

Both repro'd against the demo (`autoOxygen` in the top border, edit mode):

1. **In-toolbar drop zones never expand during traversal.** Item-spaces are
   `width: 0` and stack/track spaces `height: 0`; a target only registers at its
   literal edge (`rectContainsPoint` is inclusive). A real cursor drifts through
   the **void between gaps**, where no target is ever "near enough", so
   `data-proximity`/`data-active` never fire and the zones never mini-expand.
2. **Hovering a bar container (stack/track) after a void segment loses the
   tool.** The current e2e helpers dispatch a *single* `pointermove` straight at
   the target; a real browser emits dozens of `pointermove` events through
   intermediate void positions. That void path is where `resolvedTarget` is
   `undefined` and the tool can be dropped into an invisible shell — the
   "tool just disappears" symptom.

### Why the suite is green despite the bugs

The tests assert **final outcomes** (count before == count after) but never
traverse the **intermediate positions** a real cursor crosses. They jump A → B
in one synthetic event, so:

- the void branch (`resolvedTarget === undefined`) is ~never exercised with a
  real intermediate event under the cursor;
- "drop zone doesn't open" (a *mid-gesture* visual state) isn't asserted;
- conservation is only checked *after* release, not at *every intermediate
  frame*, so a transient disappearance isn't caught.

### New root cause found: fast drag skips the halo (2026-09-09)

Real-mouse reproduction (`page.mouse`, slow + sampled) **conserves items and
creates singletons correctly** — the engine works when the cursor *lingers*
within 12px of a gap. But human drags move the pointer tens of px between
`pointermove` events, and the drop zones are **zero-width/zero-height**; their
only hit area is a 12px halo around a 0px edge. A fast cursor sails from one
item to the next without ever landing inside a halo, so `data-proximity` never
fires and the zones never "open" — exactly the reported symptom. The bug is a
**hit-area-too-small** problem, not a correctness problem in the move logic:
- the mini-expansion (`data-proximity` → `min-inline-size: 8px`) only helps
  *after* the pointer is already inside the 12px halo;
- the halo is axis-distance-based and tiny relative to item stride (~50–200px).

### Chosen fix: "4 nearest drop-zones always open" (2026-09-09)

Drop-zone expansion must happen **far before** the pointer reaches a slot, so
the user always sees where it will land. Best case (adopted): during a drag there
are always up to **4 open zones** — the nearest on the right, nearest on the
left, nearest above, nearest below — regardless of distance. Zero dead-zone.

Design:

- `nearestDragTargetsByDirection(candidates, point)` — pure helper: from the
  unified, ignore-filtered candidate list, returns `{ left, right, up, down,
  nearest }`. `left`/`right`/`up`/`down` are the four directional nearests (by
  rect centre); `nearest` is the single nearest overall (containment preferred)
  and is the **commit** target.
- `paletteToolbarDragApplyMove` builds the unified candidate list from
  `toolbarSpaceTargets`/`trackSpaceTargets`/`stackSpaceTargets` (respecting
  `isIgnoredToolbarSpace`/`isIgnoredDropZone`/`isIgnoredStackSpace`), then:
  - marks the four directional nearests `data-proximity` (mini-expand, always),
  - marks `nearest` `data-active` (the commit target),
  - drives the existing preview/move path from `nearest`.

This replaces the single-nearest-within-12px-halo resolution in `applyMove` (the
`resolveDragTarget` decision table and the `*FromTargets` resolvers stay for the
catalogue/legacy paths and are unchanged).

### Chosen fix: whole-toolbar drag never merges (2026-09-10)

Dropping a whole toolbar (2+ items) onto a toolbar space concatenated its tools
into the host (`A B C` onto `X Y` → `X A B C Y`), losing the toolbar boundary.
`isIgnoredToolbarSpace` now bails when the session is flagged `wholeToolbar`, so
every toolbar space is ignored for a whole-toolbar drag — it must land in a
track or stack space as its own toolbar. A single-item (tool) drag still
merges. The "4 nearest drop-zones" affordance is the standard for **any** drag
kind (the ignore guard simply drops toolbar spaces from the candidates of a
whole-toolbar drag).

### Implemented: multi-tool = whole-toolbar drag only (2026-09-10)

Several tools move at once **only** when a whole toolbar is dragged (grabbing
the toolbar chrome). `createToolbarDragging` flags the session `wholeToolbar`;
the whole toolbar is the moving unit, kept together, never reordered among
itself. There is no separate selection mechanism — multi-tool drag is exactly
the whole-toolbar drag path, not a shift-click selection.

### TODOs (re-opened)

- [x] **Repeat-move DZ re-open** — second drag session never opened drop-zones
      (`openCount === 0`). Root cause: `createItemDragging`'s guard
      `target.toolbar[target.itemIndex] !== target.item` fails on the second
      drag because the first move's commit splices a `$state`-proxied item into
      the live (plain) toolbar, so array identity no longer matches the raw
      `target.item`. Same proxy-identity hazard hit two spots:
      - the `createItemDragging` slot-match guard → `createItemDragging`
        returned `undefined`, so the session never started;
      - the `onActivate` detach `live.toolbar.indexOf(pending.item)` → the
        detach silently no-oped, duplicating the item (`[a,b,b,c]`).
      Both fixed with structural (`JSON.stringify`) matching, mirroring the
      existing `Toolbar.svelte` `isInactiveSpace` membership rule.
- [ ] **Real-mouse e2e:** replace/augment `dispatchEvent` drags with
      `page.mouse` multi-step drags that pass through the void between gaps.
- [ ] **Void-traversal conservation:** assert the live item count never drops
      below baseline at *any* intermediate frame during a slow multi-segment
      drag (not just after `up`).
- [ ] **Drop-zone expansion:** assert `data-proximity`/`data-active` actually
      fire on a target as the cursor moves *near* a gap (not merely on a
      pixel-exact edge), across all three slot kinds.
- [ ] **Bar-container singleton:** drag a tool onto a *track/stack* bar via
      real mouse and assert a singleton toolbar appears (the current
      `dispatchEvent` version only proves the collision handler, not the live
      gesture).
- [ ] **Fix the void path:** once tests expose it, make the engine keep the
      dragged tool visible/deterministic across void segments (never
      disappear; nearest-in-halo target wins) — see G1/G2 design in
      `docs/movements.md`.

## The target behaviour (agreed)

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

## What is implemented (verified against `src/lib/palette/`)

| Behaviour | Status | Where |
| --------- | ------ | ----- |
| Live re-shape, no cancel/escape; all stop reasons commit | ✅ | `layout.svelte.ts` `paletteToolbarDragApplyMove`, `startPaletteToolbarDragSession.onStop`, `finalizeToolbarPreview` |
| Removal coupled to placement (`previewToolbarItems` / `moveToolbarToTrack` / `moveToolbarToStack`) | ✅ | `layout.svelte.ts` |
| Toolbar between tracks / stacks (cross-region) | ✅ | `moveToolbarToTrack`, `moveToolbarToStack` |
| Tool → toolbar merge | ✅ | `previewToolbarItems` (toolbar-space target) |
| Tool → track/stack singleton | ✅ | `insertToolbar` / `insertTrackWithToolbar` |
| Empty toolbar/track pruning | ✅ | `removeToolbarFromDragTrack`, `removeEmptyTrack`, `collapseDeferredSourceTrack` |
| **Mini-expansion of targets (G1)** | ✅ | `withinProximityHalo` shared by all three `*FromTargets` resolvers; `palette.css` track `data-proximity` 8px mini-expansion |
| Deletion via editor edit surface ("delete" button) (G2) | ✅ | `removePaletteItem` + `configuratorPresenter.removable/remove()` + `BaseConfigurator` delete button; live location via `palettes.inspecting` |
| Deletion via parking → remove (G3) | ✅ | `Parking.svelte` binds the live top border; `×` removes from the real border; rows are real drag-engine drop targets |

## Gaps — all closed

### G1 — Mini-expansion is inconsistent → FIXED

Shared `withinProximityHalo(rect, point)` (`rectDistanceToPoint <= 12px`) is now
the single near-enough test for track, toolbar, and stack resolvers (stack no
longer uses directional `expandStackSpaceRect` padding). CSS mini-expands track
spaces on `data-proximity` exactly like stack/item spaces.

### G2 — No "delete" action on the editor edit surface → WIRED

- `removePaletteItem(item, toolbar, track, border)` in `layout.svelte.ts` (D3:
  layout, alongside `removeToolbar`; D2: item-level).
- `configuratorPresenter(context, location)` exposes `removable: true` +
  `remove()` (delegates to `removePaletteItem`).
- `BaseConfigurator.svelte` renders a `Delete editor` button
  (`data-testid="configurator-delete"`) wired to `view.remove()`; the console
  carries the live toolbar/track/border from `palettes.inspecting` into the
  configurator scope.

### G3 — Parking is a disconnected mirror, not a real target → LIVE

`Parking.svelte` takes an optional live `border` (+ `region`): the console
passes the real top border, rows render live toolbars, `×` removes from the
real border, and every row binds real `paletteStackSpace`/toolbar spaces so
parking is a valid drag-engine drop target. Command-box row hidden from the
parking *view* only. D1 decided: parking is **not persisted** —
`SerializedPaletteLayout.parking` stays accepted-but-ignored; serialize/hydrate
round-trip borders only.

## Testing strategy

Testing comes **first** (Phase 1): we need it to *diagnose* the microbugs and to
*write precise todos*, not just to verify at the end. The bugs reported — "tool
sometimes disappears", "drop zones don't extend after a first move" — are
**intermediate drag-session states**, which e2e can't sample deterministically and
which pixel-based assertions can't pin down across browser/zoom/DPR differences.

Three layers, in order of primary value:

1. **Pure geometry unit tests (Vitest, synthetic rects).** Decouple *measurement*
   (the one DOM-touching step) from *resolution* (pure), then exhaustively unit-test
   `resolveCandidate`, `rectContainsPoint`, `rectDistanceToPoint`, the halo
   expansion, the ignored-zone rules, and the `resolvedTarget` decision table —
   with hand-written rects, no DOM. Deterministic, browser-independent, and exactly
   the "exact behaviour" to lock down.
2. **jsdom integration with mocked rects.** jsdom has no layout, so
   `getBoundingClientRect()` is all-zeros — we inject fixed rects and drive
   `paletteItemDrag`/`paletteToolbarDrag` with synthetic pointer events, then assert
   **reactive outcomes** (order, toolbar/track lengths, `palettes.dragging`
   lifecycle), never pixels. The two invariants that encode the reported bugs:
   - **Conservation:** total item count across all borders is identical before/after
     any drag sequence — and after an abandoned (`buttons === 0`) drag. A violation
     == "tool disappeared".
   - **Repeat-move:** run a second move after the first commits and assert it still
     resolves + commits. A failure == "zones don't re-extend after first move"
     (stale registration / `$state` proxy re-link in
     `startPaletteToolbarDragSession.onActivate`).
3. **e2e invariant smoke.** Keep one happy-path reorder, but assert *invariants*
   (count before == count after, no empty toolbar/track left, expected order), never
   a target coordinate; compute drop points from neighbour rects and tolerate the
   halo (±few px).

## Plan

### Phase 1 — Test harness + diagnostics (foundation; drives the todo list) — DONE

- [x] **Refactor hit-testing to be pure:** `resolveTrackSpaceTargetFromTargets` /
  `resolveToolbarSpaceTargetFromTargets` / `resolveStackSpaceTargetFromTargets` /
  `resolveCandidate` take a `targets` array + `point` — no live
  `getBoundingClientRect()` inside the resolution path.
- [x] **Red tests first:** conservation, repeat-move, zero-width gaps, halo
  threshold, precedence + ignored-zone rules (`hit-testing.test.ts`,
  `drag-invariants.test.ts`, `e2e/drag-invariants.spec.ts`).
- [x] **jsdom probes** driving `paletteItemDrag`/`paletteToolbarDrag` with mocked
      rects (`PaletteItemDragProbe` / `ParkingProbe` pattern).
- [x] **e2e invariant smoke** (`e2e/drag-invariants.spec.ts`).

### Phase 2 — Fix mini-expansion (G1) — DONE

- [x] Single `withinProximityHalo` test shared by all three resolvers.
- [x] Same halo on track/toolbar resolvers; `data-proximity`/`data-active` fire
  consistently for every slot kind.
- [x] CSS mini-expands track spaces on `data-proximity` (8px, uniform).
- [x] Phase 1 halo tests green (29/29 `hit-testing.test.ts`).

### Phase 3 — Headless removal + editor "delete" (G2) — DONE

- [x] `removePaletteItem(item, toolbar, track, border)` in `layout.svelte.ts`.
- [x] `configuratorPresenter` extended with `removable` + `remove()`.
- [x] Delete control in `BaseConfigurator.svelte` wired to `remove()`; console
  carries live location via `palettes.inspecting`.
- [x] Unit + component tests (`editors.test.ts` G2 block).

### Phase 4 — Parking as a real target + persistence (G3) — DONE

- [x] Parking binds the **live** border (`border` + `region` props); `×` removes
  from the real toolbar; rows are real drag-engine drop targets.
- [x] D1 decided: parking **not persisted** (accepted-but-ignored field).

### Phase 5 — Docs + live-drag hardening — DONE

- [x] `docs/movements.md` updated (uniform halo, deletion paths, D1/D2/D3,
  detach-on-activate, mid-drag chrome membership rule, shell-aware stack move,
  true-origin source refs).
- [x] Detach-on-activate: click never removes the tool; activated drag over
  void keeps it alive via the origin preview (`live-drag.test.ts`: click,
  void-conservation, mid-drag chrome).
- [x] Mid-drag chrome: origin toolbar renders `data-dragging` + inactive
  preview-span gaps via membership match (proxy-safe).
- [x] Stack singleton: item drag onto a stack space spawns a singleton
  toolbar (shell-aware `moveToolbarToStack` + true-origin source refs);
  e2e proximity-stack test green.
- [x] Full gates green (`check`/`lint`/`test`/`test:e2e`/`build`).
- [ ] Retire this file per `AGENTS.md` (remove completed items; permanent
  details already migrated to `docs/movements.md`).

## Open decisions — all decided

- **D1 — Parking persistence:** NOT persisted. Parking is a session view over
  the live border; `SerializedPaletteLayout.parking` stays accepted-but-ignored.
- **D2 — Remove scope:** item-level. `removePaletteItem` removes the single
  item; parking's `×` removes the whole toolbar row (toolbar-level prune).
- **D3 — Where the remove primitive lives:** `layout.svelte.ts`, alongside
  `removeToolbar`/`removeEmptyTrack` (pure, reuses spacing re-merge).
