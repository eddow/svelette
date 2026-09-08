# Console & Command-box Architecture — Analysis & Plan

> Status: implementation complete; permanent details live in `docs/`
> (`architecture.md`, `core-concepts.md`, `command-box.md`, `layout-and-drag.md`,
> `using-the-default-head.md`, `creating-a-head.md`, `testing.md`).

## Completed (record for history — all shipped, 2026-09-08)

- Restored the toolbar `commandBox` as a real commands-combo-box (text input + results
  combo popup, Ctrl-Shift-P style) — `CommandBoxEditor.svelte` builds its own
  `paletteCommandBoxModel` via `commandBoxPresenter`; `commandBoxLauncherPresenter` removed.
- Console edit control is a **pressable square icon button** (`console-mode-toggle`,
  `aria-pressed`, `✎`/`✓`) on the left of the console command box (shown only when R/W and
  no combobox is displayed).
- Single drag surface: the add-box results list (`console-results`); removed the scoped
  `console-catalogue` re-list and the details-panel `<Toolbar>` drag preview.
- Console **run-mode** state (`consoleState`, `consoleTool`, `openConsole`/`closeConsole`/
  `toggleConsole`) moved into `core.svelte` — read-only palettes can open a command console;
  only edition state (`resetConsoleAddState`, `popupAddList`) stays in `edition`.
- Demo modes: `demoConfigs` (`rw-combobox`, `rw-command-first`, `ro-combobox`) with per-mode
  reset buttons; `demoLayoutFor(id)` flips `demoEditable` reactively.
- Edit-mode inert fix: `paletteItemShield` gained an `update()` so `element.inert` flips in
  edit mode (the combobox and every toolbar editor is inactive/editable-only while editing).

## 3. Decision B — One command-box role, two entry modes (SUPERSEDED 2026-09-08)

> **Superseded** — see §8. The "command box becomes an edit-only launcher" move was wrong: it
> deleted the real commands-combo-box widget. Reverted: the command box is again an inline
> combobox (run surface); the console is a separate modal whose mode depends on whether the
> combobox is present. Kept below for history.

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

## 4. Decision C — core/edition export split (implemented)

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
  `Palette.editing` is read by both the console and layout components).
- **Non-goal:** we do **not** split into separate packages (`@svelette/palette-core` vs
  `-edition`) yet — one package, two barrel exports (`$lib/palette/core` and
  `$lib/palette/edition`). No `index.svelte.ts` back-compat barrel (removed, no-backcompat
  policy). Package split can follow later if a consumer actually needs it.

The `editable !== false` flag already gates behaviour at runtime; the split gates it at
**import/compile** time, which is strictly stronger and is the point of the exercise.

## 5. Implementation status (all DONE — kept as a one-line record)

Phases 0–3 + 1b/2b/2c done: console elevated to core+head (`palette/console.svelte.ts` +
`head/Console.svelte`, `consoleTool` bound to `` ` ``); keys suppressed in edit mode; drawer
cycle broken (`drawer-state.svelte.ts`); commandBox restored as a real combobox
(`commandBoxPresenter` — the Decision-B launcher conversion was **reverted**, see §8) +
pressable edit button (`console-mode-toggle`, `aria-pressed`); presentation-only inspector
(`data-inspected` highlight, single `console-details-panel`); auto-detect edit-only vs
command-first (`hasCommandBoxTool`) + CSS fix; single drag surface (add-box `console-results`,
no `console-catalogue` re-list or details-panel drag preview); console run-mode moved into
`core.svelte` (R-O palettes can open a command console). Details in `docs/`; history in git.

## 6. Resolved decisions (user, 2026-09-06) — kept (not in `docs/`)

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

### Correction — "tools don't run in edit mode" is *already implemented* (kept — retraction not in `docs/`)

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

**Resolved (2026-09-06):** no tool key bindings fire while `palette.editing` — suppressed in
`paletteRoot`'s `keydown` handler (early `if (palette.editing) return`). Rationale: shortcuts
will become editable by pressing them, so the keys must be free while editing. This mirrors the
pointer side (`inert` shield). **Done** + locked by `tests/palette/components.test.ts`
("suppresses tool shortcuts while editing").

## 7. Edition management — resolved rules (2026-09-08, corrected)

The console's edition lifecycle follows two rules. R-O vs R/W is the same distinction
`editable: false` already encodes. **Read-only palettes CAN open a command console**: the
console's run-mode surface (`consoleState`, `consoleTool`, `openConsole`/`closeConsole`/
`toggleConsole`) lives in `core.svelte`; only the edition state (`resetConsoleAddState`,
`popupAddList`) lives in `edition.svelte`.

1. **`commandBox` (combobox) in the tools → the console always opens in edit mode.** Running
   already happens inline in the combobox, so the modal is for edition only — no edit button.
   (`hasCommandBoxTool` sets `editOnly`; add box active.)
2. **No `commandBox` item → command-first by default.** The console opens in `run` mode (`` ` ``
   → `toggleConsole()` opens run; the same press toggles it closed). If the palette is **R/W**
   (`editable !== false`), the console renders a pressable **square icon edit button**
   (`console-mode-toggle`, `aria-pressed`, `✎`/`✓`) on the left of the command box to
   enter/leave edit mode; a read-only palette gets no edit button.

**Closing the console always stops edition.** `close()` (and the backdrop/`closeConsole` paths)
explicitly clear the `palettes.editing` mirror and `palettes.inspecting`, so the toolbars never
stay inert after the console closes while editing. Documented in `docs/` (`architecture.md`
console bullet, `command-box.md` add-flow intro).

## 8. Corrections after deep review (2026-09-08) — Decision B reverted

The user's review surfaced four defects, all rooted in Decision B (§3) over-applying "command
box → launcher". **All fixed (see "Completed" above):**

1. **Restored the command box as a real combobox.** `CommandBoxEditor.svelte` was a bare
   `command-launcher` button; it is again a text-input + results combo popup built on
   `paletteCommandBoxModel` + `paletteCommandEntries` via `commandBoxPresenter`.
   `commandBoxLauncherPresenter` removed. The demo's two duplicated console-open buttons
   ("Command" launcher + "Terminal") are resolved: "Command" is now a combobox (run surface),
   "Terminal" is the `console` run tool that opens the modal.
2. **Edit control is a pressable square icon button** (`aria-pressed`, `✎`/`✓`) on the left of
   the console command box, not a checkbox.
3. **Single drag surface** = the add-box results list (`console-results`); removed the scoped
   `console-catalogue` re-list and the details-panel `<Toolbar>` drag preview.
4. **Command mode reachable by default** when no combobox is present (the `editOnly` flag only
   sets the *default* mode, it no longer collapses run/edit into one modal).
