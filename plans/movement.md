# Movement — Analysis & Plan

> Status: **Phases 1–4 implemented** (G1 uniform halo, G2 delete, G3 live
> parking). Remaining: e2e verification + this file's retirement per `AGENTS.md`.
> Permanent principles live in `docs/movements.md`.

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

### Phase 5 — Docs — IN PROGRESS

- [x] `docs/movements.md` updated (uniform halo, deletion paths, D1/D2/D3).
- [ ] Full gates (`check`/`lint`/`test`/`test:e2e`/`build`) then retire this file
  per `AGENTS.md` (remove completed items; permanent details already migrated).

## Open decisions — all decided

- **D1 — Parking persistence:** NOT persisted. Parking is a session view over
  the live border; `SerializedPaletteLayout.parking` stays accepted-but-ignored.
- **D2 — Remove scope:** item-level. `removePaletteItem` removes the single
  item; parking's `×` removes the whole toolbar row (toolbar-level prune).
- **D3 — Where the remove primitive lives:** `layout.svelte.ts`, alongside
  `removeToolbar`/`removeEmptyTrack` (pure, reuses spacing re-merge).
