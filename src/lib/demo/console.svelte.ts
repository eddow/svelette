/**
 * Console overlay UI state for the Phase 9 demo.
 *
 * Mirrors `popupCommandBoxUi` from the reference `PaletteDemo.tsx`: the
 * `terminal` tool opens the overlay, which hosts a command box (search/run)
 * plus an add-to-toolbar panel when the palette is editing.
 *
 * Pure `$state` — no palette import here so `palette.svelte.ts` can import
 * this module without a cycle (`ConsoleOverlay.svelte` wires both together).
 */
export const consoleUi = $state<{
	open: boolean
	selectedEntryId: string | undefined
	selectedVariantId: string | undefined
	booleanValue: string
	setValue: string
	enumValues: string
	enumKeywords: string
}>({
	open: false,
	selectedEntryId: undefined,
	selectedVariantId: undefined,
	booleanValue: 'true',
	setValue: '',
	enumValues: '',
	enumKeywords: '',
})

export function resetConsoleAddState() {
	consoleUi.selectedEntryId = undefined
	consoleUi.selectedVariantId = undefined
	consoleUi.booleanValue = 'true'
	consoleUi.setValue = ''
	consoleUi.enumValues = ''
	consoleUi.enumKeywords = ''
}

export function openConsole() {
	resetConsoleAddState()
	consoleUi.open = true
}

export function closeConsole() {
	consoleUi.open = false
	resetConsoleAddState()
}

export function popupAddList(value: string): string[] {
	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
}
