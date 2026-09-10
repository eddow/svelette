from pathlib import Path
root = Path('/home/fmdm/dev/svelette')

# --- components.test.ts: drop catalogue-insert block, fix store resets, drop dragging-state test ---
p = root / 'tests/palette/components.test.ts'
t = p.read_text()
t = t.replace(
    "import {\n\tbeginPaletteCatalogInsertDrag,\n\tPalette,\n\tpaletteItemDrag,\n\tpaletteItemShield,\n\tpaletteRoot,\n\tpalettes,\n} from '$lib/palette/edition.svelte'",
    "import {\n\tPalette,\n\tpaletteItemDrag,\n\tpaletteItemShield,\n\tpaletteRoot,\n\tpalettes,\n} from '$lib/palette/edition.svelte'",
)
t = t.replace(
    "describe('catalogue insert session', () => {\n\tafterEach(() => {\n\t\tpalettes.catalogDrag = undefined\n\t\tpalettes.dragging = undefined\n\t})\n\n\tit('tags the ephemeral shell so drop-after-move skips a second insert', () => {\n\t\tconst palette = testPalette(() => {})\n\t\tconst item = { tool: 'run' as const, editor: 'button' as const, config: {} }\n\t\tbeginPaletteCatalogInsertDrag(palette, item as never)\n\t\tconst session = palettes.dragging\n\t\texpect(session?.catalogInsert).toBe(true)\n\t\t// `$state` deep-proxies the session, so the seed border and `border`\n\t\t// are equal proxies of the same array, not `===` identical.\n\t\texpect(session?.catalogInsertSeedBorder).toStrictEqual(session?.border)\n\t})\n})\n\n",
    "",
)
t = t.replace(
    "describe('paletteRoot', () => {\n\tafterEach(() => {\n\t\tdocument.body.replaceChildren()\n\t\tpalettes.catalogDrag = undefined\n\t\tpalettes.editing = undefined\n\t\tpalettes.dragging = undefined\n\t\tpalettes.inspecting = undefined\n\t})",
    "describe('paletteRoot', () => {\n\tafterEach(() => {\n\t\tdocument.body.replaceChildren()\n\t\tpalettes.editing = undefined\n\t\tpalettes.inspecting = undefined\n\t})",
)
t = t.replace(
    "\tit('reflects editing and dragging state on the root element', async () => {\n\t\tconst run = vi.fn()\n\t\tconst palette = testPalette(run)\n\t\trender(PaletteRootProbe, { props: { palette } })\n\t\tconst root = screen.getByTestId('palette-root')\n\n\t\tpalettes.editing = palette\n\t\tawait Promise.resolve()\n\t\texpect(root.dataset.editing).toBe('true')\n\t\texpect(root.classList.contains('palette-editing')).toBe(true)\n\n\t\tpalettes.dragging = {\n\t\t\tborder: [],\n\t\t\tcreatedTracks: [],\n\t\t\tindex: 0,\n\t\t\tpalette,\n\t\t\tregion: 'top',\n\t\t\tsourceItems: [],\n\t\t\tsourceBorder: [],\n\t\t\tsourceRegion: 'top',\n\t\t\tsourceTrack: [],\n\t\t\tsourceTrackIndex: 0,\n\t\t\tsourceTrackWasSingleton: false,\n\t\t\ttoolbar: [],\n\t\t\ttrack: [],\n\t\t\ttrackIndex: 0,\n\t\t}\n\t\tawait Promise.resolve()\n\t\texpect(root.dataset.dragging).toBe('true')\n\t\texpect(root.classList.contains('palette-dragging')).toBe(true)\n\t})\n\n",
    "\tit('reflects editing state on the root element', async () => {\n\t\tconst run = vi.fn()\n\t\tconst palette = testPalette(run)\n\t\trender(PaletteRootProbe, { props: { palette } })\n\t\tconst root = screen.getByTestId('palette-root')\n\n\t\tpalettes.editing = palette\n\t\tawait Promise.resolve()\n\t\texpect(root.dataset.editing).toBe('true')\n\t\texpect(root.classList.contains('palette-editing')).toBe(true)\n\t})\n\n",
)
t = t.replace("\t\texpect(palettes.dragging).toBeUndefined()\n", "")
p.write_text(t)
print('components patched')

# --- palette.test.ts: drop catalogue-drag helpers + store resets ---
p = root / 'tests/palette/palette.test.ts'
t = p.read_text()
t = t.replace(
    "import {\n\tclearPaletteCatalogDragOnNativeDragEnd,\n\tisEditableTool,",
    "import {\n\tisEditableTool,",
)
t = t.replace(
    "\tisRunTool,\n\tnotifyPaletteCatalogNativeDragStarted,\n\tPalette,",
    "\tisRunTool,\n\tPalette,",
)
t = t.replace(
    "\tafterEach(() => {\n\t\tpalettes.catalogDrag = undefined\n\t\tpalettes.editing = undefined\n\t\tpalettes.dragging = undefined\n\t})",
    "\tafterEach(() => {\n\t\tpalettes.editing = undefined\n\t})",
)
t = t.replace(
    "\tit('clears catalogDrag on native dragend', () => {\n\t\tconst palette = createPalette()\n\t\tnotifyPaletteCatalogNativeDragStarted(palette)\n\t\texpect(palettes.catalogDrag).toBeDefined()\n\t\tclearPaletteCatalogDragOnNativeDragEnd()\n\t\texpect(palettes.catalogDrag).toBeUndefined()\n\t})\n\n",
    "",
)
p.write_text(t)
print('palette patched')
