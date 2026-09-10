from pathlib import Path
root = Path('/home/fmdm/dev/svelette')

# hit-testing: entire file tested the stripped hit-testing engine -> replace with placeholder
(root / 'tests/palette/hit-testing.test.ts').write_text(
    "import { describe, expect, it } from 'vitest'\n"
    "\n"
    "// Movement was stripped for a restart from scratch (hit-testing removed).\n"
    "// This placeholder keeps the suite green until the next movement design lands.\n"
    "describe('hit-testing (stripped)', () => {\n"
    "\tit('placeholder', () => {\n"
    "\t\texpect(true).toBe(true)\n"
    "\t})\n"
    "})\n"
)
print('hit-testing replaced')

# live-drag: tested preview/session chrome -> replace with inspect-only placeholder
(root / 'tests/palette/live-drag.test.ts').write_text(
    "import { render, screen } from '@testing-library/svelte'\n"
    "import { afterEach, describe, expect, it, vi } from 'vitest'\n"
    "import { Palette, palettes } from '$lib/palette/edition.svelte'\n"
    "import PaletteItemDragProbe from './PaletteItemDragProbe.svelte'\n"
    "import ParkingEditorStub from './ParkingEditorStub.svelte'\n"
    "\n"
    "function testPalette(): Palette {\n"
    "\treturn new Palette({\n"
    "\t\ttools: { run: { get can() { return true }, run() {} } },\n"
    "\t\tkeys: { N: 'run' },\n"
    "\t\teditor: () => ParkingEditorStub as never,\n"
    "\t})\n"
    "}\n"
    "\n"
    "// Movement was stripped: item guards only inspect on pointerdown (no detach,\n"
    "// no preview, no session). This locks the inspect-only contract in place.\n"
    "describe('item inspect (no movement yet)', () => {\n"
    "\tafterEach(() => {\n"
    "\t\tdocument.body.replaceChildren()\n"
    "\t\tpalettes.editing = undefined\n"
    "\t\tpalettes.inspecting = undefined\n"
    "\t})\n"
    "\n"
    "\tit('pointerdown inspects without touching the toolbar', async () => {\n"
    "\t\tconst firstItem = { tool: 'run' }\n"
    "\t\tconst secondItem = { tool: 'run' }\n"
    "\t\tconst toolbar = [firstItem, secondItem]\n"
    "\t\tconst track = [{ space: 0, toolbar }]\n"
    "\t\tconst border = [track]\n"
    "\t\tconst palette = testPalette()\n"
    "\t\tpalettes.editing = palette\n"
    "\t\trender(PaletteItemDragProbe, {\n"
    "\t\t\tprops: {\n"
    "\t\t\t\ttarget: {\n"
    "\t\t\t\t\tborder,\n"
    "\t\t\t\t\tdirection: 'horizontal',\n"
    "\t\t\t\t\titem: firstItem,\n"
    "\t\t\t\t\titemIndex: 0,\n"
    "\t\t\t\t\tpalette,\n"
    "\t\t\t\t\tregion: 'top',\n"
    "\t\t\t\t\ttoolbar,\n"
    "\t\t\t\t\ttrack,\n"
    "\t\t\t\t\ttrackIndex: 0,\n"
    "\t\t\t\t},\n"
    "\t\t\t},\n"
    "\t\t})\n"
    "\t\tconst guard = screen.getByTestId('item-guard')\n"
    "\t\tObject.defineProperties(guard, {\n"
    "\t\t\tsetPointerCapture: { configurable: true, value: vi.fn() },\n"
    "\t\t\treleasePointerCapture: { configurable: true, value: vi.fn() },\n"
    "\t\t\thasPointerCapture: { configurable: true, value: vi.fn(() => true) },\n"
    "\t\t})\n"
    "\t\tguard.dispatchEvent(\n"
    "\t\t\tnew PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, buttons: 1, pointerId: 1 }),\n"
    "\t\t)\n"
    "\t\texpect(toolbar).toHaveLength(2)\n"
    "\t\texpect(palettes.inspecting?.palette).toBe(palette)\n"
    "\t\texpect(palettes.inspecting?.item).toStrictEqual(firstItem)\n"
    "\t})\n"
    "})\n"
)
print('live-drag replaced')

# drag-invariants: keep headless relocation primitives, drop the pointer-session block
p = root / 'tests/palette/drag-invariants.test.ts'
t = p.read_text()
cut = t.index("describe('drag session lifecycle")
head = t[:cut]
head = head.replace(
    "import { fireEvent, render, screen } from '@testing-library/svelte'",
    "import { describe, expect, it } from 'vitest'",
)
head = head.replace(
    "import { afterEach, describe, expect, it, vi } from 'vitest'",
    "import { afterEach, describe, expect, it } from 'vitest'",
)
head = head.replace(
    "import PaletteItemDragProbe from './PaletteItemDragProbe.svelte'\n",
    "",
)
head = head.replace(
    "function stubPointerCapture(element: HTMLElement): void {\n\tObject.defineProperties(element, {\n\t\tsetPointerCapture: { configurable: true, value: vi.fn() },\n\t\treleasePointerCapture: { configurable: true, value: vi.fn() },\n\t\thasPointerCapture: { configurable: true, value: vi.fn(() => true) },\n\t})\n}\n\n",
    "",
)
head = head.replace(
    "function pointerInit(x: number, y: number, buttons: number, button: number) {\n\treturn {\n\t\tbubbles: true,\n\t\tcancelable: true,\n\t\tbutton,\n\t\tbuttons,\n\t\tclientX: x,\n\t\tclientY: y,\n\t\tpointerId: 1,\n\t}\n}\n\n",
    "",
)
head = head.replace(
    "describe('drag conservation invariants (headless relocation primitives)', () => {\n\tafterEach(() => {\n\t\tdocument.body.replaceChildren()\n\t\tpalettes.catalogDrag = undefined\n\t\tpalettes.dragging = undefined\n\t\tpalettes.editing = undefined\n\t\tpalettes.inspecting = undefined\n\t})",
    "describe('layout relocation invariants (headless primitives)', () => {\n\tafterEach(() => {\n\t\tdocument.body.replaceChildren()\n\t\tpalettes.editing = undefined\n\t\tpalettes.inspecting = undefined\n\t})",
)
p.write_text(head)
print('drag-invariants trimmed')
