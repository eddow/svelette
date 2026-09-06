import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import DemoSliderEditor from '$lib/demo/editors/SliderEditor.svelte'
import StarsEditor from '$lib/demo/editors/StarsEditor.svelte'
import BaseConfigurator from '$lib/head/editors/BaseConfigurator.svelte'
import SegmentedEditor from '$lib/head/editors/SegmentedEditor.svelte'
import SelectEditor from '$lib/head/editors/SelectEditor.svelte'
import StepperEditor from '$lib/head/editors/StepperEditor.svelte'
import ToggleEditor from '$lib/head/editors/ToggleEditor.svelte'
import type {
	PaletteEditorContext,
	PaletteSchema,
	PaletteToolBool,
	PaletteToolbarItem,
	PaletteToolEnum,
	PaletteToolNumber,
} from '$lib/palette/types'

describe('head editors', () => {
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

	it('SegmentedEditor selects an enum value and marks the selected button', async () => {
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
		const item: PaletteToolbarItem = { tool: 'theme', editor: 'segmented' }
		const context = {
			item,
			tool,
			scope: {},
			flags: {},
			surface: { axis: 'horizontal' as const },
		} as PaletteEditorContext<PaletteToolEnum, PaletteToolbarItem, PaletteSchema>

		const { container } = render(SegmentedEditor, { props: { context } })
		const buttons = Array.from(container.querySelectorAll('button'))
		expect(buttons).toHaveLength(2)
		// The selected value renders as the pushed-in button.
		const selected = buttons.find((button) => button.classList.contains('is-selected'))
		expect(selected).toHaveTextContent('Dark')

		const light = buttons.find((button) => button.textContent?.includes('Light'))
		await fireEvent.click(light as HTMLElement)
		expect(tool.value).toBe('light')
	})

	it('StepperEditor increments and decrements within bounds via the presenter', async () => {
		const tool: PaletteToolNumber = {
			type: 'number',
			value: 2,
			default: 2,
			label: 'Speed',
			min: 1,
			max: 5,
			step: 1,
		}
		const item: PaletteToolbarItem = { tool: 'gameSpeed', editor: 'stepper' }
		const context = {
			item,
			tool,
			scope: {},
			flags: {},
			surface: { axis: 'horizontal' as const },
		} as PaletteEditorContext<PaletteToolNumber, PaletteToolbarItem, PaletteSchema>

		const { container } = render(StepperEditor, { props: { context } })
		const [dec, inc] = Array.from(container.querySelectorAll('button'))
		await fireEvent.click(inc as HTMLElement)
		expect(tool.value).toBe(3)
		await fireEvent.click(dec as HTMLElement)
		expect(tool.value).toBe(2)
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

	it('Demo SliderEditor overrides the head slider and mutates via the presenter', async () => {
		const tool: PaletteToolNumber = {
			type: 'number',
			value: 14,
			default: 14,
			label: 'Font Size',
			min: 10,
			max: 20,
			step: 1,
		}
		const item: PaletteToolbarItem = {
			tool: 'fontSize',
			editor: 'slider',
			config: { icon: 'A', label: 'Font size' },
		}
		const context = {
			item,
			tool,
			scope: {},
			flags: {},
			surface: { axis: 'horizontal' as const },
		} as PaletteEditorContext<PaletteToolNumber, PaletteToolbarItem, PaletteSchema>

		const { container } = render(DemoSliderEditor, { props: { context } })
		// The override carries a distinct badged value element (the head slider
		// has none), proving the demo component is the one rendered.
		const badge = container.querySelector('.palette-default-slider-badge')
		expect(badge).toBeTruthy()
		expect(badge).toHaveTextContent('14')

		// Mutation routes through `sliderPresenter.set` (no `tool.value = …` in
		// the component), so the tool updates even though the badge DOM text
		// needs a reactive `$state` tool to re-render (out of scope here).
		const input = container.querySelector('input[type="range"]') as HTMLInputElement
		await fireEvent.input(input, { target: { value: '16' } })
		expect(tool.value).toBe(16)
	})

	it('Demo StarsEditor renders a rating row and sets a discrete value', async () => {
		const tool: PaletteToolNumber = {
			type: 'number',
			value: 2,
			default: 2,
			label: 'Speed',
			min: 1,
			max: 5,
			step: 1,
		}
		const item: PaletteToolbarItem = { tool: 'gameSpeed', editor: 'stars' }
		const context = {
			item,
			tool,
			scope: {},
			flags: {},
			surface: { axis: 'horizontal' as const },
		} as PaletteEditorContext<PaletteToolNumber, PaletteToolbarItem, PaletteSchema>

		const { container } = render(StarsEditor, { props: { context } })
		const buttons = Array.from(container.querySelectorAll('button[role="radio"]'))
		expect(buttons).toHaveLength(5)
		// The first `value` buttons render the filled "▶" glyph.
		const filled = buttons.filter((button) => button.textContent === '▶')
		expect(filled).toHaveLength(2)

		await fireEvent.click(buttons[4] as HTMLElement)
		expect(tool.value).toBe(5)
	})
})
