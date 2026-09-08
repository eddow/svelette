1- We could initiate the demo several ways: R-O (with a command-box tool), R/W (with a command-box tool and "edit" command) and R/W (without command-box tool, just a "console" command bound to "`")
2- The timer should be a "tool" (indeed a status who launches nothing) - the point of it is to add some custom sth

## Status (2026-09-08)

- **Done:** the demo now ships **three configurations** (`demoConfigs` in
  `src/lib/demo/palette.svelte.ts`), each loaded by its own reset button in the demo bar:
  - `rw-combobox` — R/W + command-box combobox (console opens in edit mode)
  - `rw-command-first` — R/W, no combobox (console command-first + square edit-icon button)
  - `ro-combobox` — R-O + combobox (read-only; combobox runs commands, layout not editable)
- **Still open:** the timer as a tool (item 2) — not yet done.