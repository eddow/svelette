# Command box

Builders and model live in `src/lib/palette/command-box.svelte.ts`. Demo editors:
`src/lib/demo/editors/CommandBoxEditor.svelte`. Console overlay:
`src/lib/demo/ConsoleOverlay.svelte` + `src/lib/demo/console.svelte.ts`.

## Entry builders

| Builder                  | Contents                                                                 |
| ------------------------ | ------------------------------------------------------------------------ |
| `paletteCommandEntries`  | Executable commands: run tools, boolean on/off, enum per-value setters, number inc/dec. `mode: 'catalog'` keeps entries enabled for search/drag. `excludeTools` omits meta-tools (demo excludes `terminal` inside the console). |
| `paletteAddItemEntries`  | Add sources: one per editable tool (enum tools with `commandBoxEnumCommands !== 'per-value'` are skipped) + one per `editors.item` entry. Runnable tools are excluded (they already have command entries). |
| `paletteDerivedVariants` | Concrete insertable variants for an add source: `tool` (toolbar command), `set` (boolean/enum/number control — value chosen on bar/inspector), `action`, `item` (editor-only). |
| `paletteCatalogEntries`  | Full catalogue: `mode: 'catalog'` commands + flattened add variants (`add:<variant-id>`), sorted by label. Each carries `catalogDrag` (`{ kind: 'spec' }` or `{ kind: 'variant' }`). |
| `paletteEnumSubsetValues`| Filter enum values by keywords (powers `EnumSubsetConfigurator` + add-flow keyword filters). |

Labels are humanized (`fontSize` → `Font Size`); keywords collect tool/value/
category words; `meta` shows the key binding (`keys.findByTool`) or a fallback.
`can: false` entries are filtered from `results` (but stay searchable in catalog
mode). `commandRunner` throws `PaletteError` for non-runnable specs.

## Model (`paletteCommandBoxModel`)

```ts
const box = paletteCommandBoxModel({ entries, placeholder: 'Command…' })
```

**Init-time constraint:** create during component/module init only — `$state`
initializers throw (or detach) in late handlers, `setTimeout`, or after `await`.
Drive from handlers via `box.search()` / `box.execute()` / `box.input.value`.

- `input`: `{ value, placeholder?, clear() }` — setting `value` clears selection.
- `query`: `{ free, keywords, categories }` — parsed from input (`#cat` prefix
  selects categories; known keywords become tokens; rest is free text) unless
  overridden by `search({ free?, keywords?, categories? })`.
- `results`: filtered + scored entries (exact label +8, prefix +5, substring +2,
  then alphabetical). `suggestions`: keyword completions for the current word.
- `categories` / `keywords`: `available`, `active`, `toggle`/`addToken`/
  `removeToken`/`removeLast`/`clear`.
- `selection`: `index`, `item`, `set`/`select`/`next`/`previous`/`clear`.
- `select(entryId?)` / `execute(entryId?)` — execute runs `entry.run()`, then
  clears filters + selection. `handleKeyDown`: ArrowUp/Down navigate,
  Enter executes (or selects with `enterAction: 'select'`), Backspace on empty
  input pops tokens, Escape clears selection then filters, Space/Tab accepts the
  keyword suggestion.

Helpers: `setPaletteCommandBoxInput(box, event)`,
`handlePaletteCommandBoxInputKeydown({ commandBox, event, onAfterExecute? })`,
`handlePaletteCommandChipKeydown({ commandBox, event, token, type? })`.

`$derived` values are exposed through getters on the returned object, never as
shorthand properties — shorthand captures the initial value and breaks
reactivity (`state_referenced_locally`).

## Add-to-toolbar flow (demo)

Edit mode swaps the console box to `paletteAddItemEntries` with
`enterAction: 'select'`. Selecting an entry expands `paletteDerivedVariants`
into variant cards (boolean/number/enum value inputs, enum allowed-values +
keyword filters); the chosen variant builds a live `Toolbar` preview. Catalogue
rows (`paletteCatalogEntries`) are `draggable`; both paths start native HTML5
drags (`PALETTE_CATALOG_DRAG_MIME` on `dataTransfer`,
`beginPaletteCatalogInsertDrag` + `notifyPaletteCatalogNativeDragStarted` on
`dragstart`); drops land in the toolbar/track/stack zones. `Parking` (seeded
from the live top border minus the command box) offers remove/restore while
editing.

Payloads: `serializePaletteCatalogDragPayload` / `parsePaletteCatalogDragPayload`
/ `paletteToolbarItemFromCatalogPayload` (spec → default editor variant +
label/icon/hint; variant → item per kind). Invalid payloads return `undefined`.
