# Review — palette implementation (Phases 1–3)

Date: 2026-09-05 · Scope: `src/lib/palette/*`, `src/lib/demo/*`, `tests/palette/*`

## Verdict

All items corrected and migrated to `docs/architecture.md` §12.
Gates green: `lint | check | test (40) | build`.

## Remaining (Phase 5)

- `<PaletteItem>` renderer component binding `resolveEditorContext` output to
  `<Editor context={...} />` — tracked in `plans/palette.md` Phase 5.

---

# Review — Phase 4 (command box)

Date: 2026-09-05 · Scope: `src/lib/palette/command-box.svelte.ts`, `tests/palette/command-box.test.ts`

## Verdict

**Faithful, high-quality port.** Compared line-for-line against the reference
`ui/src/palette/command-box.ts`, the Svelte version is a correct translation:
`mutts.reactive` → `$state`, `mutts.lift` → `$derived.by`, icons → `PaletteIcon`.
The model's public surface (`input`, `query`, `results`, `suggestions`,
`categories`, `keywords`, `selection`, `select`, `execute`, `search`,
`handleKeyDown`) matches exactly, as do the entry builders (`paletteCommandEntries`,
`paletteAddItemEntries`, `paletteCatalogEntries`, `paletteDerivedVariants`,
`paletteEnumSubsetValues`), the catalogue payload (de)serialization, and the three
DOM bridge helpers. Test coverage is strong (25 tests) and exercises the
tricky paths: run/catalog phrasing, enum `commandBoxEnumCommands` (`per-value` vs
default), reader-function entries (driven through a probe component), ranking,
suggestion consumption, chip/input keydown, and payload round-trips.

Gates: `lint` clean, `svelte-check` 0/0, `test` 65 passing (6 files).

## Notes (non-blocking)

1. **Runes init-time constraint.** `paletteCommandBoxModel` declares `$state`/`$derived`
   inside the factory, so it must be created during component/module init — not in an
   event handler or async callback (same constraint as `hydratePaletteLayout`). This is
   a real divergence from `mutts` (which had no such restriction) and is documented in
   the source. It works, but consumers will trip over it; consider a factory that
   throws a clear error (or a doc warning) if called outside init.
2. **`commandRunner` throws a plain `Error`** (not `PaletteError`) for non-runnable
   specs. Faithful to the reference, but inconsistent with the rest of the palette's
   error taxonomy. Cosmetic.
3. **`selection.set` / `selection.item` read `model.results`** (a `$derived`) from plain
   getters — fine in event handlers (no reactive subscription), but worth keeping in
   mind if any future code reads `selection.item` inside a `$derived`/`$effect` (it would
   then subscribe and could introduce a cycle).
4. `parsePaletteCatalogDragPayload` validates only `kind`/`id`/`label`/`meta` on variants
   — shallow, but exactly matches the reference; `paletteToolbarItemFromCatalogPayload`
   re-validates against the palette anyway.

No action required before Phase 5; the four notes are documentation/ergonomics only.
