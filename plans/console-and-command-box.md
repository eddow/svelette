# Console & Command-box Architecture — Analysis & Plan

> Status: **decisions resolved, documentation done — awaiting implementation**. Input: a
> non-expert spec (see `demo.md`), so every claim below is double-checked against the actual
> code before being treated as fact. §6–§7 are the locked decisions + verified edit-mode
> semantics; §5 is the phased implementation to execute.

## 1. Current state (verified against source)

There are **two** command-box entry points and **two** edit affordances today, and they are
not the same concept:

| Surface | File | Role | Edits? |
| --- | --- | --- | --- |
| Toolbar command box | `head/editors/CommandBoxEditor.svelte` + `commandBoxPresenter` | `item` editor variant (`editor: 'commandBox'`). Run-only (`paletteCommandEntries`). | ❌ never |
| Console overlay | `demo/ConsoleOverlay.svelte` + `demo/console.svelte.ts` | Modal opened by the `terminal` run tool. Hosts a **run** box *and* an **add-to-toolbar** box (swaps on `palettes.editing`), catalogue, parking. | ✅ only here |
| Edit toggle | `editToolbars` boolean tool, `editor: 'toggle'` in the top border | Toggles `palettes.editing`. | — |
| Edit button | `+page.svelte` `Edit palette` / `Done` button | Also toggles `palettes.editing`. | — |

### The problems the user is pointing at

1. **"Edition should be only in the console"** — but the edit affordance lives in *three* places
   (toolbar `editToolbars` toggle, the page-level button, and the console's own mode checkbox).
   `ConsoleOverlay` even renders its own `console-mode-toggle` checkbox that flips
   `palettes.editing` — so edition state is reachable from everywhere and the "single source of
   truth for editing" is unclear.

2. **"The edit button is not a button in edit mode"** — `editToolbars` is a **boolean** tool
   rendered as a `toggle`. When editing is active it reads "pushed in" (pressed state), not a
   button you'd click to leave. A boolean toggle is the wrong widget for a mode switch that
   should read as "Edit" / "Done".

3. **"The command cannot be in edit and used mode"** — a single `commandBox` instance is
   *either* a run box (toolbar) *or* an add box (console, in edit mode). The demo papered over
   this by instantiating **two** boxes and swapping them with `activeBox = $derived(isEditing ?
   popupAddCommandBox : popupCommandBox)`. That is exactly the "can't be in both" tension: the
   toolbar box can never edit, and the console box has to rebuild its model on mode change.

## 2. Decision A — The console is a first-class, core-owned concept

The console should **stop living in `demo/`** and become a core concept with a head face —
mirroring the existing `core (headless) ↔ head (markup+CSS)` split already used for every
editor.

- **Core** (`src/lib/palette/console.svelte.ts`): headless console state + model —
  `open`/`close`/`toggle`, the active mode (`run` | `edit`), the command-entry sets to feed
  (`run` entries vs `add`/`catalog` entries), and the parking seed. **No markup, no CSS.**
- **Head** (`src/lib/head/Console.svelte`): the **fixed-size modal masking the working zone**
  (backdrop + centred panel), wiring the core model to the existing command-box presenters,
  catalogue rows, add-panel, and `Parking`. The head owns the "modal thingy" styling (size,
  mask, graying), exactly as the user requested ("defined in the core but use extensively the
  head — even for the modal").

Concretely this is a **rename-and-elevate** of `demo/ConsoleOverlay.svelte` +
`demo/console.svelte.ts` into `palette/` (headless) + `head/` (component), with the demo
providing only the *tools/keys/theme* (Stellar Outpost) on top — not the console itself.

### What the console always contains

- **Run mode:** command box (search + execute runnable commands).
- **Edit mode:** command box swapped to add-to-toolbar + catalogue (draggable) + `Parking`
  (remove/restore) + per-item configurator/inspector. This is the **only** place edition
  happens.

## 3. Decision B — One command-box role, two entry modes

The command box stops being "a run box that also happens to be near edit". Instead:

- **If the command box is placed in the tools** (the `item` `commandBox` editor, as now in the
  top border): it becomes an **edit-only launcher** — a *button* (not a text box) that opens the
  console directly in **edit mode**. It is no longer a run box; running happens in the console.
- **If the command box is *not* in the tools** (no `commandBox` item anywhere): the console
  itself carries an **edit checkbutton** ("pushed or not") to toggle edit mode, so edition is
  still reachable without a toolbar launcher.

Both satisfy "edition is only in the console" and remove the "run vs edit" ambiguity on a single
instance. The `editToolbars` boolean tool and the page-level `Edit palette` button are **removed**
in favour of this unified affordance (see §5). `editToolbars` currently proxies
`palettes.editing` — that proxy moves into the console's edit checkbutton / launcher.

## 4. Decision C — Split the palette into `core` and `edition`

**Recommendation: yes, split — as an export surface, not a file reshuffle.**

The concrete use case ("give a palette and don't let the user modify it — a predefined,
read-only placement with a smaller import surface") is real and already *half-supported* via
`editable: false` on `PaletteConfig`. The split formalizes it at the import boundary.

### Proposed boundary

- **`core`** — what a read-only consumer needs:
  - `Palette` runtime, tool/spec resolution, `keys`
  - layout **display** (`PaletteToolbar`/`Ide`/`Toolbar` rendering, `surfaceContextFromScope`)
  - editor **registry + resolution** (`resolveEditor`, `renderEditor`)
  - command-box **run** model (`paletteCommandEntries`, `paletteCommandBoxModel`)
  - presenters (read views), the head components
- **`edition`** — the mutation surface (depends on `core`, never the reverse):
  - editing state (`palettes.editing`, `isEditing`, `Palette.editing`)
  - drag/drop + insertion (`paletteItemDrag`, `insertToolbar`, `removeToolbar`, `resizeToolbar`,
    `resolveItemPlacementTarget`)
  - catalogue / add builders (`paletteAddItemEntries`, `paletteDerivedVariants`,
    `paletteCatalogEntries`)
  - configurators / `describeItemConfiguration`, `Parking`, the **console** (§2)

### Tradeoffs (stated, so the decision is informed)

- **Pro:** smaller import for read-only apps; a clear, enforced dependency direction
  (`edition → core`); a compile-time guarantee that a "read-only palette" can't reach mutation
  APIs; matches the existing `core↔head` mental model (a third axis `edition`).
- **Con:** two entry points to document/version; some types straddle the line (e.g.
  `Palette.editing` is read by both the console and layout components); a one-time churn across
  `index.svelte.ts` + all `demo/`/`head/` imports.
- **Non-goal:** we do **not** split into separate packages (`@svelette/palette-core` vs
  `-edition`) yet — one package, two barrel exports (`$lib/palette/core` and
  `$lib/palette/edition`, with `$lib/palette` re-exporting both for back-compat). Package split
  can follow later if a consumer actually needs it.

The `editable !== false` flag already gates behaviour at runtime; the split gates it at
**import/compile** time, which is strictly stronger and is the point of the exercise.

## 5. Implementation plan (phased)

### Phase 1 — Elevate the console to core + head (Decision A)
1. Move `demo/console.svelte.ts` → `palette/console.svelte.ts` (drop demo-only bits; expose
   `consoleState`/`openConsole`/`closeConsole`/`toggleConsole` + `mode: 'run' | 'edit'`).
2. Move `demo/ConsoleOverlay.svelte` → `head/Console.svelte`, restyled as a **fixed-size modal
   masking the work-zone** (backdrop + dimming, centred fixed panel). Demo keeps only its
   `+page.svelte` `<Console />` slot + `is-dimmed` wiring (or the head owns the mask).
3. `terminal` run tool now just calls `toggleConsole()` (already does).

### Phase 2 — Unify the command-box role (Decision B)
4. Change the `item` `commandBox` editor from a run box to an **edit-only launcher button**:
   `CommandBoxEditor.svelte` → a button whose click opens the console in edit mode. (The
   `commandBoxPresenter` run-model path moves to the console's run mode.)
5. Add the **edit checkbutton** to the console for the "no toolbar command box" case (pushed =
   editing). Remove the old `console-mode-toggle` in favour of this (or the launcher).
6. Delete `editToolbars` tool + the page-level `Edit palette` button; editing is entered/exited
   only through the console affordances. Keep `palettes.editing` as the single source of truth.

### Phase 3 — core/edition export split (Decision C)
7. Introduce `palette/core.ts` and `palette/edition.ts` barrels; classify every current
   `index.svelte.ts` export (§4). Keep `palette/index.svelte.ts` re-exporting both (back-compat).
8. Rewire `head/` and `demo/` imports to the tighter surface (`demo` imports `edition` +
   `core`; `head` imports `core` + reads `edition` state). Add a lint/CI guard (no `edition`
   import from `head` components; `core` imports nothing from `edition`).
9. Add a read-only demo/smoke (a palette with `editable: false` importing only `core`) to prove
   the smaller surface; update `docs/` (`core-concepts.md`, `command-box.md`, new
   `console.md`) and delete the completed items from this file per the repo protocol.

## 6. Resolved decisions (user, 2026-09-06)

- **Modal shape:** a literal **fixed rem/pixel box**, centred over the work-zone.
- **Mask:** **dimmed-but-visible** (keep the current `is-dimmed` behaviour — content stays
  faintly visible, not opaque).
- **Entry point:** the **console is itself a first-class `run` tool** (supplied by core/head,
  replacing the demo-only `terminal` tool). The app's configuration binds it — e.g. `'`'` →
  `console` — so the key is just config. When the console is open:
  - underlying tools **do not run** — they are **only edited**;
  - the `'`'` press **hides** the console (quake-style toggle).

### Consequence for the plan
- §3/§5 Phase 1: `terminal` is renamed to a core-provided **`console` run tool** — a tool named
  `console` whose `run()` means "show the console" (quake-style toggle). The demo only supplies
  the key binding (`` ` `` → `console`) and its label/icon via config, not the tool logic.
  `console.run()` = `toggleConsole()`.
- The "edit-only launcher" (Decision B, command box *in tools*) and the "edit checkbutton"
  (command box *not* in tools) both open the console in **edit** mode; the `console` run tool /
  `` ` `` opens it in **run** mode (then toggles closed). The console internally still owns the
  run/edit mode switch.
- **Modal placement is a head decision.** Core only knows `open`/`close`/`toggle` + `mode`
  (`run` | `edit`) — no geometry, no mask, no positioning. The default head renders it
  **centred** over the work-zone (a fixed rem/pixel box + dimmed-but-visible backdrop), but a
  custom head may anchor it top/bottom/side. Same split as every editor: core = state + model,
  head = markup + CSS + placement.

### Correction — "tools don't run in edit mode" is *already implemented*

The earlier wording ("tools don't run while the console is open; add a `paletteRoot`
short-circuit + `can: false`") is **wrong** and is retracted. The correct mechanism is
**edit mode**, not "console open", and it already exists in core:

- `Toolbar.svelte` wraps each item's content in `use:paletteItemShield={shieldActive()}`, where
  `shieldActive()` is `true` when `palette.editing`. `paletteItemShield` sets `element.inert =
  active` — so while editing, a run `button` / boolean `toggle` / `checkbox` **does not run,
  toggle, or check** on click. The click is swallowed by `inert`.
- `Toolbar.svelte` additionally renders a `.toolbar-item-guard` overlay (only when `editing`)
  with `use:paletteItemDrag`. That guard owns `pointerdown`: it sets `palettes.inspecting =
  { item, palette, region }` (select-for-edition) and starts an item drag (move). A plain click
  (no activation) restores the item at its origin; activation moves it.

So the user-facing rule — "in edit mode, run-buttons/checkboxes are moved or selected for
edition, not clicked/checked" — is exactly the `inert` shield + drag guard, **reused as-is** by
the console's edit mode (which just sets `palettes.editing`). **No new gating is required** for
this behaviour. The only genuinely new runtime pieces are: (a) the `console` run tool → headless
`toggleConsole()`, and (b) the head modal itself.

**Open question (keyboard, not pointer):** `paletteRoot`'s `keydown` handler currently runs
tools *without* checking `palette.editing`. So in edit mode a *click* on a run button is inert,
but a bound *key* (`E` → `emergencyProtocol`) still runs. Decide later whether key bindings
should also be suppressed while `editing` — flagged, not part of this phase.

## 7. Edit-mode interaction semantics (verified)

Reference: `src/lib/palette/components/Toolbar.svelte`,
`src/lib/palette/layout.svelte.ts` (`paletteItemShield`, `paletteItemDrag`).

| While `palette.editing` | Behaviour | Mechanism |
| --- | --- | --- |
| Click a run button / toggle / checkbox | **Nothing** — no run, no toggle, no check | `paletteItemShield` → `element.inert = true` on `.toolbar-item-content` |
| `pointerdown` on an item | Item is **selected for edition** (inspector) and begins a move | `.toolbar-item-guard` overlay + `paletteItemDrag` (sets `palettes.inspecting`, starts drag session) |
| Drag (≥4px) | Item **moves** across borders/tracks/toolbars | `startPaletteToolbarDragSession` → `paletteToolbarDragApplyMove` |
| Click without drag | Item restored at origin, inspector open | `onClick` splice-back + `inspecting` |
| Catalogue / add / parking | Enabled (drag into toolbars, remove/restore) | `paletteCatalogEntries`, `bindPaletteCatalogDrop`, `Parking` |

The console's **edit** mode sets `palettes.editing` and thus inherits all of this for free;
its **run** mode is where the command box actually *executes* runnable commands.
