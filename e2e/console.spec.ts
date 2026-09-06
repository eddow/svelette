import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
	await page.goto('/')
	await page.evaluate(() => localStorage.clear())
	await page.reload()
	await expect(page.getByRole('heading', { name: 'svelette' })).toBeVisible()
})

async function openConsole(page: import('@playwright/test').Page) {
	// The bottom track hosts a `terminal` button that opens the console.
	await page.getByRole('button', { name: /Terminal/ }).click()
	await expect(page.getByTestId('console-overlay')).toBeVisible()
}

test('console opens via backtick and executes a state command', async ({ page }) => {
	// `paletteRoot` listens on the Ide root (tabindex=0), so focus it first —
	// a bare `press('`')` on body never reaches the palette keydown handler.
	await page.locator('.palette-ide').first().click()
	await page.keyboard.press('`')
	await expect(page.getByTestId('console-overlay')).toBeVisible()
	const input = page.getByTestId('console-input')
	await input.fill('Set Theme to Dark')
	const result = page.getByTestId('console-results').locator('.palette-default-command-result', {
		hasText: 'Set Theme to Dark',
	})
	await expect(result.first()).toBeVisible()
	await result.first().click()
	await expect(page.getByTestId('console-overlay')).toHaveCount(0)
	await expect(page.getByText('🎨 dark')).toBeVisible()
})

test('console opens via Terminal button and closes on Escape', async ({ page }) => {
	await openConsole(page)
	await page.keyboard.press('Escape')
	await expect(page.getByTestId('console-overlay')).toHaveCount(0)
})

test('checkbutton switches command ↔ add-to-toolbar modes', async ({ page }) => {
	await openConsole(page)
	const toggle = page.getByTestId('console-mode-toggle')
	const input = page.getByTestId('console-input')
	// Command mode by default.
	await expect(input).toHaveAttribute('placeholder', 'Command…')
	await toggle.check()
	await expect(input).toHaveAttribute('placeholder', 'Add to toolbar…')
	await expect(page.getByTestId('console-catalogue')).toBeVisible()
	await expect(page.getByTestId('console-add-panel')).toBeVisible()
	await toggle.uncheck()
	await expect(input).toHaveAttribute('placeholder', 'Command…')
})

test('add-to-toolbar flow selects entry + variant', async ({ page }) => {
	await openConsole(page)
	await page.getByTestId('console-mode-toggle').check()
	const addInput = page.getByTestId('console-input')
	await addInput.fill('Notifications')
	await page
		.getByTestId('console-results')
		.locator('.palette-default-command-result', { hasText: 'Notifications' })
		.first()
		.click()
	const panel = page.getByTestId('console-add-panel')
	await expect(panel).toContainText('Notifications')
	await panel
		.locator('.palette-default-add-variant-trigger', { hasText: 'Notifications (editor)' })
		.click()
	await expect(panel.locator('select').first()).toBeVisible()
})

test('catalogue lists draggable entries', async ({ page }) => {
	await openConsole(page)
	await page.getByTestId('console-mode-toggle').check()
	const catalogue = page.getByTestId('console-catalogue')
	await expect(catalogue.locator('.palette-default-command-result').first()).toBeVisible()
	const draggable = await catalogue
		.locator('.palette-default-command-result[draggable="true"]')
		.count()
	expect(draggable).toBeGreaterThan(0)
})

test('catalogue drop lands an item in a toolbar gap', async ({ page }) => {
	await openConsole(page)
	await page.getByTestId('console-mode-toggle').check()
	const catalogue = page.getByTestId('console-catalogue')
	const source = catalogue.locator('.palette-default-command-result[draggable="true"]').first()
	await expect(source).toBeVisible()
	// `dispatchEvent('dragstart', { dataTransfer: {} })` cannot construct a
	// real `DataTransfer` (Chromium rejects the init dict), so drive the real
	// `ondragstart` handler with a synthetic `DragEvent` carrying a stub
	// transfer: the handler sets the catalogue MIME + starts the
	// `catalogInsert` session, then the gap's `dragover`/`drop` handlers run
	// the same session path a native drag would.
	const topBorder = page.locator('.toolbar-border[data-region="top"]').first()
	const before = await topBorder.locator('.toolbar-item').count()
	const dropped = await topBorder
		.locator('.toolbar-item-space')
		.first()
		.evaluate((gap) => {
			const catalogueRow = document.querySelector(
				'[data-testid="console-catalogue"] .palette-default-command-result[draggable="true"]'
			) as HTMLElement | null
			if (!catalogueRow) return 'no-source'
			// `new DragEvent(..., { dataTransfer })` rejects non-native
			// transfers, so build plain `Event`s and shadow `dataTransfer`
			// with a stub: the handlers only touch `effectAllowed`,
			// `dropEffect`, `types`, `setData`, `getData`.
			const store = new Map<string, string>()
			const transfer = {
				effectAllowed: 'none',
				dropEffect: 'none',
				types: [] as string[],
				setData: (type: string, value: string) => {
					store.set(type, value)
					if (!(transfer.types as string[]).includes(type)) (transfer.types as string[]).push(type)
				},
				getData: (type: string) => store.get(type) ?? '',
			}
			const fire = (target: Element, type: string) => {
				const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
					dataTransfer?: unknown
				}
				event.dataTransfer = transfer
				target.dispatchEvent(event)
			}
			fire(catalogueRow, 'dragstart')
			fire(gap, 'dragover')
			fire(gap, 'drop')
			return 'dropped'
		})
	expect(dropped).toBe('dropped')
	await expect(topBorder.locator('.toolbar-item')).toHaveCount(before + 1)
})
