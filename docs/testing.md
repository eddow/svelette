# Testing

## Unit (Vitest, jsdom) — 101 tests, 10 files

Run: `npm run test`. Config: `vitest.config.ts` (`environment: jsdom`,
`resolve.conditions: ['browser']`, alias `$lib`, setup `tests/setup.ts`).

| File | Count | Covers |
| ---- | ----- | ------ |
| `tests/smoke.test.ts` | 1 | harness sanity |
| `tests/component.test.ts` | 1 | testing-library Svelte mount |
| `tests/palette/keys.test.ts` | 6 | keystroke normalization, event derivation, binding resolution |
| `tests/palette/palette.test.ts` | 17 | tool resolution, setter/action runners, editor resolution, configurator scope, surface axis, `dragend` clearing, multi-setter divergence, hydrated reactivity (`HydratedBordersProbe`) |
| `tests/palette/serialization.test.ts` | 15 | `serialize` / `validate` / `hydrate` round-trips |
| `tests/palette/command-box.test.ts` | 26 | entry builders, model search/filter/score, keyboard, non-runnable `PaletteError` (`CommandBoxEntriesProbe` for reactive entries) |
| `tests/palette/components.test.ts` | 13 | `paletteRoot`, item drag/inspect, `Ide`, `Parking` (`PaletteRootProbe`, `PaletteItemDragProbe`, `IdeProbe`, `ParkingProbe`, `ParkingEditorStub`) |
| `tests/palette/item-movement.test.ts` | 13 | `resolveItemPlacementTarget` contract |
| `tests/palette/drawer.test.ts` | 6 | factory shape, open/Escape, collapse signal, axis inversion, popup scope, hover travel |
| `tests/palette/editors.test.ts` | 3 | toggle/select editors, `BaseConfigurator` editor-choices |

Gotchas:

- Run `svelte-kit sync` before Vitest (generated `.svelte-kit/tsconfig.json` is
  required by the resolver) — `npm run check` covers this.
- `resolve.conditions: ['browser']` is mandatory, else Svelte resolves to its
  server build and `mount()` throws `lifecycle_function_unavailable`.
- `$state` proxies force `toStrictEqual` over `toBe` for `inspecting.item` and
  the catalogue seed border.
- `paletteCommandBoxModel` / `hydratePaletteLayout` must be created during
  probe init, never in handlers (same init-time constraint as app code).

## E2E (Playwright) — 13 tests, 3 files

Run: `npm run test:e2e` (builds + previews on port 4173, `reuseExistingServer`
outside CI). `test.beforeEach` clears `localStorage` and reloads.

- `e2e/smoke.spec.ts` (1): home page renders.
- `e2e/palette.spec.ts` (6): edit toggle + `.palette-ide.editing` chrome;
  command-box search/execute (`Set Threat Level to Red` → `⚠️ red` pill); drawer
  open with axis inversion (left drawer → `is-horizontal`) + Escape close;
  inspector via `pointerdown` on `.toolbar-item-guard` (shortcut, move-back
  disabled / move-forward enabled → `Item moved forward`); layout save → reload
  → restored badge → reset; pointer drag reorder (`[commandBox, editToolbars,
  emergencyProtocol, autoOxygen, shieldGenerator, alertLevel]` →
  `[commandBox, editToolbars, emergencyProtocol, shieldGenerator, alertLevel,
  autoOxygen]`).
- `e2e/console.spec.ts` (6): backtick opens console (Ide root focused first —
  `paletteRoot` listens on root `keydown`); Terminal button + Escape (+ work-zone
  `is-dimmed` while open); checkbutton swaps `Command…` ↔ `Add to toolbar…`;
  add flow (Life Support entry → variant card → value); catalogue rows
  `draggable`; catalogue drop inserts into first toolbar gap.

E2E lessons (see `docs/architecture.md` §19–§20):

- `paletteItemDrag` inspects on `pointerdown` — dispatch `pointerdown`/`pointerup`
  on the guard, not `click`.
- Trusted Playwright mouse events carry `isPrimary: false` / `buttons: 0` —
  drag tests use synthetic `PointerEvent`s with explicit `pointerId`/`isPrimary`.
- Gaps are zero-width until proximity chrome expands them — target the gap edge
  (`rect.left`), never a `+2px` nudge.
- `new DragEvent(..., { dataTransfer })` rejects non-native transfers — fire
  plain `Event`s with a shadowed `dataTransfer` stub.
- Command-box popover needs a visibility wait (140ms `inline-size` transition
  delays visibility vs. actionability).

## Gates

`npm run check` (0 errors) · `npm run lint` (clean) · `npm run test` (101 pass) ·
`npm run test:e2e` (13 pass) · `npm run build` ok.
