import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import BaseConfigurator from '$lib/demo/editors/BaseConfigurator.svelte'
import SelectEditor from '$lib/demo/editors/SelectEditor.svelte'
import ToggleEditor from '$lib/demo/editors/ToggleEditor.svelte'
import type {
	PaletteEditorContext,
	PaletteSchema,
	PaletteToolBool,
	PaletteToolbarItem,
	PaletteToolEnum,
} from '$lib/palette/types'

describe('demo editors', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('ToggleEditor toggles a boolean tool and renders its configured icon', async () => {
		const tool: PaletteToolBool = { type: 'boolean', value: false, default: false, label: 'Mute' }
		const item: PaletteToolbarItem = { tool: 'mute', editor: 'toggle', config: { icon: '🔔' } }
		const context = {
			item,
			tool,
			scope: {},
			flags: {},
			surface: { axis: 'horizontal' as const },
		} as PaletteEditorContext<PaletteToolBool, PaletteToolbarItem, PaletteSchema>

		render(ToggleEditor, { props: { context } })
		const button = screen.getByRole('button')
		expect(button).toHaveTextContent('🔔')
		await fireEvent.click(button)
		expect(tool.value).toBe(true)
	})

	it('SelectEditor reflects and changes an enum value', async () => {
		const tool: PaletteToolEnum = {
			type: 'enum',
			value: 'dark',
			default: 'dark',
			label: 'Theme',
			values: [
				{ value: 'light', label: 'Light' },
				{ value: 'dark', label: 'Dark' },
			],
		}
		const item: PaletteToolbarItem = { tool: 'theme', editor: 'select' }
		const context = {
			item,
			tool,
			scope: {},
			flags: {},
			surface: { axis: 'horizontal' as const },
		} as PaletteEditorContext<PaletteToolEnum, PaletteToolbarItem, PaletteSchema>

		render(SelectEditor, { props: { context } })
		const select = screen.getByRole('combobox') as HTMLSelectElement
		expect(select.value).toBe('dark')
		await fireEvent.change(select, { target: { value: 'light' } })
		expect(tool.value).toBe('light')
	})

	it('BaseConfigurator renders editor choices injected through the scope', () => {
		const item: PaletteToolbarItem = {
			tool: 'theme',
			editor: 'select',
			config: { label: 'Theme' },
		}
		const context = {
			item,
			tool: undefined,
			scope: {
				editorChoices: [
					{ id: 'flip', label: 'Flip', selected: false },
					{ id: 'select', label: 'Select', selected: true },
				],
			},
			flags: {},
		} as PaletteEditorContext

		const { container } = render(BaseConfigurator, { props: { context } })
		expect(screen.getByDisplayValue('Theme')).toBeTruthy()

		// First `<select>` is the editor-variant chooser (second is tone).
		const editorSelect = container.querySelector('select') as HTMLSelectElement
		expect(editorSelect.value).toBe('select')
		expect(Array.from(editorSelect.options).map((option) => option.value)).toEqual([
			'flip',
			'select',
		])
	})
})
