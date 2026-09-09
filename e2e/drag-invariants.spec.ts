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

type Page = import('@playwright/test').Page

async function topBorderOrder(page: Page): Promise<string[]> {
	return page
		.locator('.toolbar-border[data-region="top"]')
		.first()
		.locator('.toolbar')
		.first()
		.locator('.toolbar-item')
		.evaluateAll((items) =>
			items.map(
				(item) => (item as HTMLElement).dataset.tool ?? (item as HTMLElement).dataset.editor ?? '?'
			)
		)
}

async function topBorderItemCount(page: Page): Promise<number> {
	return page.locator('.toolbar-border[data-region="top"]').first().locator('.toolbar-item').count()
}

async function emptyToolbarOrTrackCount(page: Page): Promise<number> {
	return page.evaluate(() => {
		const emptyToolbars = Array.from(document.querySelectorAll('.toolbar')).filter(
			(toolbar) => toolbar.querySelectorAll('.toolbar-item').length === 0
		).length
		const emptyTracks = Array.from(document.querySelectorAll('.toolbar-track')).filter(
			(track) => track.querySelectorAll('.toolbar-track-slot').length === 0
		).length
		return emptyToolbars + emptyTracks
	})
}

async function dragGuardToGap(page: Page, guardIndex: number, gapIndex: number): Promise<string> {
	const guard = page
		.locator('.toolbar-border[data-region="top"]')
		.first()
		.locator('.toolbar-item-guard')
		.nth(guardIndex)
	return guard.evaluate((guardEl, gapIdx) => {
		const toolbar = (guardEl as HTMLElement).closest('.toolbar')
		const spaces = toolbar ? Array.from(toolbar.querySelectorAll('.toolbar-item-space')) : []
		const target = spaces[gapIdx as number] as HTMLElement | undefined
		const guardRect = (guardEl as HTMLElement).getBoundingClientRect()
		const start = {
			x: guardRect.left + guardRect.width / 2,
			y: guardRect.top + guardRect.height / 2,
		}
		const targetRect = target?.getBoundingClientRect()
		// Zero-width gap: its rect has left==right, and
		// `rectContainsPoint` is inclusive (>= / <=), so the exact edge
		// counts as contained. Aim at the edge itself — any nudge
		// lands OUTSIDE the gap and resolves to a track/stack move.
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
		;(guardEl as HTMLElement).dispatchEvent(
			new PointerEvent('pointerdown', init(start.x, start.y, 1, 0))
		)
		window.dispatchEvent(new PointerEvent('pointermove', init(end.x, end.y, 1, -1)))
		window.dispatchEvent(new PointerEvent('pointerup', init(end.x, end.y, 0, 0)))
		return 'dispatched'
	}, gapIndex)
}

test('drag invariants: conservation, no empties, repeat-move', async ({ page }) => {
	await openConsole(page)
	await expect(page.locator('.palette-ide.editing').first()).toBeVisible()
	const topBorder = page.locator('.toolbar-border[data-region="top"]').first()
	await expect(topBorder.locator('.toolbar-item-guard')).toHaveCount(5)

	// Baseline invariants before any drag.
	const countBefore = await topBorderItemCount(page)
	expect(countBefore).toBe(5)
	expect(await emptyToolbarOrTrackCount(page)).toBe(0)

	// First move: autoOxygen (guard 2) onto the gap after alertLevel (gap 5).
	expect(await dragGuardToGap(page, 2, 5)).toBe('dispatched')
	await expect
		.poll(() => topBorderOrder(page))
		.toEqual(['commandBox', 'emergencyProtocol', 'shieldGenerator', 'alertLevel', 'autoOxygen'])

	// Conservation: no item lost; no empty toolbar/track left behind.
	expect(await topBorderItemCount(page)).toBe(countBefore)
	expect(await emptyToolbarOrTrackCount(page)).toBe(0)

	// Repeat-move: a second move after the first commits still resolves +
	// commits (guards against stale registration / `$state` proxy re-link
	// regressions). Move the trailing autoOxygen back to the front gap.
	// After the first move the guards re-render in the new order, so
	// autoOxygen is now guard 4; gap 0 is before commandBox.
	expect(await dragGuardToGap(page, 4, 0)).toBe('dispatched')
	await expect
		.poll(() => topBorderOrder(page))
		.toEqual(['autoOxygen', 'commandBox', 'emergencyProtocol', 'shieldGenerator', 'alertLevel'])
	expect(await topBorderItemCount(page)).toBe(countBefore)
	expect(await emptyToolbarOrTrackCount(page)).toBe(0)
})
