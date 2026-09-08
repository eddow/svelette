import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
	await page.goto('/')
	await page.evaluate(() => localStorage.clear())
	await page.reload()
	await expect(page.getByRole('heading', { name: 'Stellar Outpost' })).toBeVisible()
})

// The demo displays a `commandBox` combobox on the top toolbar, so the console
// opens in edit mode (running commands happens inline in the combobox).
async function openConsole(page: import('@playwright/test').Page) {
	await page.getByRole('button', { name: /Terminal/ }).click()
	await expect(page.getByTestId('console-overlay')).toBeVisible()
}

test('command-box combobox runs commands inline', async ({ page }) => {
	// The toolbar command box is a real combobox (text input + results popup),
	// not a launcher button: it runs commands inline on the toolbar.
	await expect(page.getByTestId('command-box-combobox')).toBeVisible()
	await expect(page.getByTestId('console-overlay')).toHaveCount(0)
})

test('console opens in edit mode (commandBox is displayed)', async ({ page }) => {
	// Since a `commandBox` tool is displayed, the console is edit-only: no mode
	// button, add box active.
	await openConsole(page)
	await expect(page.getByTestId('console-mode-toggle')).toHaveCount(0)
	await expect(page.getByTestId('console-input')).toHaveAttribute('placeholder', 'Add to toolbar…')
	// Editing chrome on the underlying toolbars.
	await expect(page.locator('.palette-ide.editing').first()).toBeVisible()
})

test('drawer opens with axis inversion and closes on Escape', async ({ page }) => {
	await page.getByRole('button', { name: 'More' }).click()
	const popup = page.locator('.svelette-palette-drawer__popup')
	await expect(popup).toBeVisible()
	// Left drawer inverts to a horizontal popup.
	await expect(popup.first()).toHaveClass(/is-horizontal/)
	await page.keyboard.press('Escape')
	await expect(popup).toHaveCount(0)
})

test('inspector shows presentation-only configurator for the selected item', async ({ page }) => {
	await openConsole(page)
	await expect(page.locator('.palette-ide.editing').first()).toBeVisible()
	// `paletteItemDrag` inspects on `pointerdown` (click alone never reaches it
	// in some drivers), so dispatch a real pointerdown + pointerup on the
	// edit-mode guard. `pointerdown` detaches the item; a matching `pointerup`
	// (no activation) restores it at its origin, after which the `data-inspected`
	// highlight reflects the inspecting item. Keep the whole session in one
	// evaluate (same pointerId) — mirroring the reorder test below.
	await page
		.locator('.toolbar-item-guard')
		.first()
		.evaluate((guard) => {
			const rect = guard.getBoundingClientRect()
			const x = rect.left + rect.width / 2
			const y = rect.top + rect.height / 2
			const init = (buttons: number, button: number) => ({
				bubbles: true,
				cancelable: true,
				button,
				buttons,
				clientX: x,
				clientY: y,
				pointerId: 7,
				isPrimary: true,
			})
			guard.dispatchEvent(new PointerEvent('pointerdown', init(1, 0)))
			window.dispatchEvent(new PointerEvent('pointerup', init(0, 0)))
		})
	// The selected item is highlighted on the toolbar (not re-rendered).
	await expect(page.locator('.toolbar-item[data-inspected="true"]').first()).toBeVisible()
	// The console hosts a presentation-only configurator (no move/remove).
	const panel = page.getByTestId('console-details-panel')
	await expect(panel).toBeVisible()
	await expect(panel.locator('.palette-default-config-table')).toBeVisible()
})

test('layout persist + restore round-trips through localStorage', async ({ page }) => {
	await page.getByTestId('save-layout').click()
	await expect(page.getByTestId('last-action')).toContainText('Layout saved')
	await page.reload()
	await expect(page.getByTestId('layout-restored')).toBeVisible()
	await page.getByTestId('reset-layout').click()
	await expect(page.getByTestId('last-action')).toContainText('Layout reset')
})

test('pointer drag reorders items within a toolbar', async ({ page }) => {
	await openConsole(page)
	await expect(page.locator('.palette-ide.editing').first()).toBeVisible()
	// Top border, single toolbar: [commandBox, emergencyProtocol, autoOxygen,
	// shieldGenerator, alertLevel]. Drag the autoOxygen guard onto the gap after
	// the alertLevel item and assert the order flipped to [commandBox,
	// emergencyProtocol, shieldGenerator, alertLevel, autoOxygen]. Order is
	// scoped to the first toolbar (the border holds one) and polled — the commit
	// flushes through Svelte reactivity after mouse.up. Gaps are zero-width until
	// proximity chrome expands them, so the drop point is computed from the
	// neighbouring item rects (right edge of the alertLevel item) rather than the
	// gap's own bounding box. Playwright dispatches trusted `pointerdown` with
	// `isPrimary: false`, which the session ignores — assert via `dispatchEvent`
	// instead. The item session detaches the dragged item into an ephemeral
	// single-item toolbar on pointerdown, so the drop target is the gap *inside
	// the source toolbar* (index 5 in the pre-drag layout, i.e. after
	// alertLevel). NOTE: the detached item's own gap (index 2) is ignored by
	// hit-testing (`isIgnoredToolbarSpace`), so the move must land on a
	// *different* gap — here index 5, which the preview resolves to insertion
	// index 4 after the detach shifts indices.
	const topBorder = page.locator('.toolbar-border[data-region="top"]').first()
	const firstToolbar = topBorder.locator('.toolbar').first()
	const order = () =>
		firstToolbar
			.locator('.toolbar-item')
			.evaluateAll((items) =>
				items.map(
					(item) =>
						(item as HTMLElement).dataset.tool ?? (item as HTMLElement).dataset.editor ?? '?'
				)
			)
	await expect(topBorder.locator('.toolbar-item-guard')).toHaveCount(5)
	await expect
		.poll(order)
		.toEqual(['commandBox', 'emergencyProtocol', 'autoOxygen', 'shieldGenerator', 'alertLevel'])
	// Drive the real `paletteItemDrag` pointer session with synthetic events:
	// `pointerdown` on the autoOxygen guard (the action's element),
	// `pointermove` on window past the 4px threshold onto the gap after the
	// alertLevel item, then `pointerup`. Same pointerId throughout so the session
	// accepts the moves. The session element is the source `.toolbar`
	// (single-item detach only happens for multi-item toolbars — here the
	// toolbar has 5 items, so the item detaches and the preview re-inserts it
	// at the hovered gap).
	const moved = await topBorder
		.locator('.toolbar-item-guard')
		.nth(2)
		.evaluate((guard) => {
			const toolbar = guard.closest('.toolbar')
			const spaces = toolbar ? Array.from(toolbar.querySelectorAll('.toolbar-item-space')) : []
			// Gap after alertLevel in the pre-drag layout (index 5: commandBox |
			// emergencyProtocol | autoOxygen | shieldGenerator | alertLevel |).
			const target = spaces[5] as HTMLElement | undefined
			const guardRect = (guard as HTMLElement).getBoundingClientRect()
			const start = {
				x: guardRect.left + guardRect.width / 2,
				y: guardRect.top + guardRect.height / 2,
			}
			const targetRect = target?.getBoundingClientRect()
			// Zero-width gap: its rect has left==right, and
			// `rectContainsPoint` is inclusive (>= / <=), so the exact edge
			// counts as contained. Aim at the edge itself — any nudge (+2)
			// lands OUTSIDE the gap and resolves to a track/stack move
			// (which clears the preview and loses the item).
			const end = targetRect
				? { x: targetRect.left, y: targetRect.top + targetRect.height / 2 }
				: { x: start.x + 60, y: start.y }
			const init = (x: number, y: number, buttons: number, button: number) => ({
				bubbles: true,
				cancelable: true,
				button,
				buttons,
				clientX: x,
				clientY: y,
				pointerId: 7,
				isPrimary: true,
			})
			guard.dispatchEvent(new PointerEvent('pointerdown', init(start.x, start.y, 1, 0)))
			// Single move straight to the drop gap: it already exceeds the 4px
			// activation threshold, and intermediate steps risk landing on a
			// track/stack target (which would move the ephemeral single-item
			// toolbar out of the source toolbar and lose the reorder).
			window.dispatchEvent(new PointerEvent('pointermove', init(end.x, end.y, 1, -1)))
			window.dispatchEvent(new PointerEvent('pointerup', init(end.x, end.y, 0, 0)))
			return 'dispatched'
		})
	expect(moved).toBe('dispatched')
	await expect
		.poll(order)
		.toEqual(['commandBox', 'emergencyProtocol', 'shieldGenerator', 'alertLevel', 'autoOxygen'])
})
