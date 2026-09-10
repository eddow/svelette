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

async function topBorderToolbarCount(page: Page): Promise<number> {
	return page.locator('.toolbar-border[data-region="top"]').first().locator('.toolbar').count()
}

async function dragGuardToStackSpace(page: Page, guardIndex: number, stackIndex: number) {
	const border = page.locator('.toolbar-border[data-region="top"]').first()
	const guard = border.locator('.toolbar-item-guard').nth(guardIndex)
	return guard.evaluate((guardEl, stackIdx) => {
		const borderEl = (guardEl as HTMLElement).closest('.toolbar-border')!
		const stacks = Array.from(borderEl.querySelectorAll('.toolbar-stack-space'))
		const target = stacks[stackIdx as number] as HTMLElement | undefined
		const guardRect = (guardEl as HTMLElement).getBoundingClientRect()
		const start = {
			x: guardRect.left + guardRect.width / 2,
			y: guardRect.top + guardRect.height / 2,
		}
		const targetRect = target?.getBoundingClientRect()
		// Zero-height stack bar: aim just inside its band. The 12px halo must
		// register a proximity hit and commit the singleton move — the previous
		// bug required exact containment and silently lost the tool.
		const end = targetRect
			? { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 }
			: { x: start.x, y: start.y + 40 }
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
	}, stackIndex)
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

test('drag invariants: proximity stack drop creates a singleton toolbar (no lost tool)', async ({
	page,
}) => {
	await openConsole(page)
	await expect(page.locator('.palette-ide.editing').first()).toBeVisible()
	const topBorder = page.locator('.toolbar-border[data-region="top"]').first()
	await expect(topBorder.locator('.toolbar-item-guard')).toHaveCount(5)

	const countBefore = await topBorderItemCount(page)
	const toolbarsBefore = await topBorderToolbarCount(page)
	expect(toolbarsBefore).toBe(1)

	// Drop autoOxygen (guard 2) onto the top stack space (index 0, the bar
	// above the single toolbar, within the vertical stack). This must spawn a
	// second single-item toolbar — not lose the tool.
	expect(await dragGuardToStackSpace(page, 2, 0)).toBe('dispatched')

	// A singleton toolbar was created, and the tool count is conserved.
	await expect.poll(() => topBorderToolbarCount(page)).toBe(2)
	expect(await topBorderItemCount(page)).toBe(countBefore)
	expect(await emptyToolbarOrTrackCount(page)).toBe(0)
})

test('real mouse: slow drag across the void never loses the tool', async ({ page }) => {
	await openConsole(page)
	await expect(page.locator('.palette-ide.editing').first()).toBeVisible()
	const border = page.locator('.toolbar-border[data-region="top"]').first()
	await expect(border.locator('.toolbar-item-guard')).toHaveCount(5)

	const baseline = await topBorderItemCount(page)

	// Real trusted mouse input — NOT synthetic dispatchEvent. A real cursor
	// emits many pointermove events through intermediate positions between the
	// zero-width drop zones (the "void"). The tool must never vanish at any
	// intermediate frame, nor at release.
	const guard = border.locator('.toolbar-item-guard').nth(2) // autoOxygen
	const box = await guard.boundingBox()!
	const sx = box.x + box.width / 2
	const sy = box.y + box.height / 2

	await page.mouse.move(sx, sy)
	await page.mouse.down()
	// Activate (past the 4px threshold).
	await page.mouse.move(sx + 5, sy, { steps: 3 })

	let minItems = baseline
	// Drift gradually, sampling the live DOM at every step (intermediate frames).
	for (let i = 1; i <= 24; i++) {
		await page.mouse.move(sx + i * 6, sy + i * 1.5, { steps: 1 })
		await page.waitForTimeout(8)
		const items = await topBorderItemCount(page)
		minItems = Math.min(minItems, items)
	}

	await page.mouse.up()
	await page.waitForTimeout(100)

	// The tool never disappeared mid-gesture, and none was permanently lost.
	expect(minItems).toBe(baseline)
	expect(await topBorderItemCount(page)).toBeGreaterThanOrEqual(baseline - 1)
	expect(await emptyToolbarOrTrackCount(page)).toBe(0)
})

test('real mouse: nearest drop zones open far from the pointer (no dead zone)', async ({
	page,
}) => {
	await openConsole(page)
	await expect(page.locator('.palette-ide.editing').first()).toBeVisible()
	const border = page.locator('.toolbar-border[data-region="top"]').first()
	await expect(border.locator('.toolbar-item-guard')).toHaveCount(5)

	// Drag autoOxygen a little (activation only), staying far from every gap.
	// The nearest zones in each direction must already be marked `data-proximity`
	// — the drop zones open before the pointer reaches them.
	const guard = border.locator('.toolbar-item-guard').nth(2) // autoOxygen
	const box = await guard.boundingBox()!
	const sx = box.x + box.width / 2
	const sy = box.y + box.height / 2

	await page.mouse.move(sx, sy)
	await page.mouse.down()
	await page.mouse.move(sx + 6, sy, { steps: 3 })

	// Sample the open zones right after activation, far from any gap edge.
	const openCount = await page.evaluate(() => {
		const b = document.querySelector('.toolbar-border[data-region="top"]')
		return b ? b.querySelectorAll('[data-proximity="true"]').length : 0
	})

	await page.mouse.up()

	// At least one directional drop zone is already open far from the pointer.
	expect(openCount).toBeGreaterThan(0)
})

test('repeat move: a tool dragged once can be dragged back to its original spot', async ({
	page,
}) => {
	await openConsole(page)
	await expect(page.locator('.palette-ide.editing').first()).toBeVisible()
	const border = page.locator('.toolbar-border[data-region="top"]').first()
	await expect(border.locator('.toolbar-item-guard')).toHaveCount(5)

	const order = () => topBorderOrder(page)

	// First move: autoOxygen (guard 2) after alertLevel (gap 5).
	const guard1 = border.locator('.toolbar-item-guard').nth(2)
	const b1 = (await guard1.boundingBox())!
	const s1 = { x: b1.x + b1.width / 2, y: b1.y + b1.height / 2 }
	const gap1 = await border.locator('.toolbar-item-space').nth(5).boundingBox()
	await page.mouse.move(s1.x, s1.y)
	await page.mouse.down()
	await page.mouse.move(s1.x + 5, s1.y, { steps: 3 })
	await page.mouse.move(gap1!.x, gap1!.y + gap1!.height / 2, { steps: 8 })
	await page.mouse.up()
	await expect
		.poll(order)
		.toEqual(['commandBox', 'emergencyProtocol', 'shieldGenerator', 'alertLevel', 'autoOxygen'])

	// Second move: drag autoOxygen (now guard 4) back to its ORIGINAL gap
	// (index 2, between emergencyProtocol and shieldGenerator). The second
	// drag session must open drop-zones again.
	const guard2 = border.locator('.toolbar-item-guard').nth(4)
	const b2 = (await guard2.boundingBox())!
	const s2 = { x: b2.x + b2.width / 2, y: b2.y + b2.height / 2 }
	const gap2 = await border.locator('.toolbar-item-space').nth(2).boundingBox()
	await page.mouse.move(s2.x, s2.y)
	await page.mouse.down()
	await page.mouse.move(s2.x + 5, s2.y, { steps: 3 })
	// Drop-zones must be open mid-drag on the second session.
	const openCount = await page.evaluate(() => {
		const b = document.querySelector('.toolbar-border[data-region="top"]')
		return b ? b.querySelectorAll('[data-proximity="true"]').length : 0
	})
	expect(openCount).toBeGreaterThan(0)
	await page.mouse.move(gap2!.x, gap2!.y + gap2!.height / 2, { steps: 8 })
	await page.mouse.up()
	await expect
		.poll(order)
		.toEqual(['commandBox', 'emergencyProtocol', 'autoOxygen', 'shieldGenerator', 'alertLevel'])
})
