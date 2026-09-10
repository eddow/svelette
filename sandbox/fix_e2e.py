from pathlib import Path
root = Path('/home/fmdm/dev/svelette')

# drag-invariants.spec.ts: movement stripped -> keep static layout invariants only
(root / 'e2e/drag-invariants.spec.ts').write_text(
    "import { expect, test } from '@playwright/test'\n"
    "\n"
    "test.beforeEach(async ({ page }) => {\n"
    "\tawait page.goto('/')\n"
    "\tawait page.evaluate(() => localStorage.clear())\n"
    "\tawait page.reload()\n"
    "\tawait expect(page.getByRole('heading', { name: 'Stellar Outpost' })).toBeVisible()\n"
    "})\n"
    "\n"
    "// The demo displays a `commandBox` combobox on the top toolbar, so the console\n"
    "// opens in edit mode (running commands happens inline in the combobox).\n"
    "async function openConsole(page: import('@playwright/test').Page) {\n"
    "\tawait page.getByRole('button', { name: /Terminal/ }).click()\n"
    "\tawait expect(page.getByTestId('console-overlay')).toBeVisible()\n"
    "}\n"
    "\n"
    "// Movement was stripped for a restart from scratch: no drag sessions run.\n"
    "// This locks the static edit-mode layout (5 tools, no empty containers).\n"
    "test('edit mode shows the full toolbar with no empty containers', async ({ page }) => {\n"
    "\tawait openConsole(page)\n"
    "\tawait expect(page.locator('.palette-ide.editing').first()).toBeVisible()\n"
    "\tconst topBorder = page.locator('.toolbar-border[data-region=\"top\"]').first()\n"
    "\tawait expect(topBorder.locator('.toolbar-item-guard')).toHaveCount(5)\n"
    "\tawait expect(topBorder.locator('.toolbar-item')).toHaveCount(5)\n"
    "\tconst empties = await page.evaluate(() => {\n"
    "\t\tconst emptyToolbars = Array.from(document.querySelectorAll('.toolbar')).filter(\n"
    "\t\t\t(toolbar) => toolbar.querySelectorAll('.toolbar-item').length === 0\n"
    "\t\t).length\n"
    "\t\tconst emptyTracks = Array.from(document.querySelectorAll('.toolbar-track')).filter(\n"
    "\t\t\t(track) => track.querySelectorAll('.toolbar-track-slot').length === 0\n"
    "\t\t).length\n"
    "\t\treturn emptyToolbars + emptyTracks\n"
    "\t})\n"
    "\texpect(empties).toBe(0)\n"
    "})\n"
)
print('drag-invariants spec replaced')

# palette.spec.ts: drop the pointer-drag reorder test, fix the inspector comment
p = root / 'e2e/palette.spec.ts'
t = p.read_text()
cut = t.index("test('pointer drag reorders items within a toolbar'")
t = t[:cut].rstrip() + "\n"
t = t.replace(
    "\t// `paletteItemDrag` inspects on `pointerdown` (click alone never reaches it\n"
    "\t// in some drivers), so dispatch a real pointerdown + pointerup on the\n"
    "\t// edit-mode guard. `pointerdown` detaches the item; a matching `pointerup`\n"
    "\t// (no activation) restores it at its origin, after which the `data-inspected`\n"
    "\t// highlight reflects the inspecting item. Keep the whole session in one\n"
    "\t// evaluate (same pointerId) — mirroring the reorder test below.",
    "\t// `paletteItemDrag` inspects on `pointerdown`, so dispatch a real\n"
    "\t// pointerdown + pointerup on the edit-mode guard, after which the\n"
    "\t// `data-inspected` highlight reflects the inspecting item.",
)
p.write_text(t)
print('palette spec trimmed')
