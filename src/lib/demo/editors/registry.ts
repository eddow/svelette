import DrawerEditor from '$lib/palette/components/DrawerEditor.svelte'
import type {
	PaletteAnyTool,
	PaletteEditorComponent,
	PaletteEditorSpec,
	PaletteSchema,
	PaletteToolbarItem,
} from '$lib/palette/types'
import BaseConfigurator from './BaseConfigurator.svelte'
import ButtonEditor from './ButtonEditor.svelte'
import CommandBoxEditor from './CommandBoxEditor.svelte'
import EnumSubsetConfigurator from './EnumSubsetConfigurator.svelte'
import FlipEditor from './FlipEditor.svelte'
import RadioEditor from './RadioEditor.svelte'
import SegmentedEditor from './SegmentedEditor.svelte'
import SelectEditor from './SelectEditor.svelte'
import SliderEditor from './SliderEditor.svelte'
import SplitButtonEditor from './SplitButtonEditor.svelte'
import SplitRadioEditor from './SplitRadioEditor.svelte'
import StarsEditor from './StarsEditor.svelte'
import StepperEditor from './StepperEditor.svelte'
import ToggleEditor from './ToggleEditor.svelte'

/**
 * Build a demo editor spec, preserving the editor's tool-family type.
 *
 * Svelte `Component` props are **contravariant**, so the broad configurators
 * (`BaseConfigurator` over `PaletteTool | undefined`, `EnumSubsetConfigurator`
 * over `PaletteToolEnum<string>`) are assignable to any narrower `TTool` — no
 * cast is needed here. The family-specific `TTool` is inferred from `editor`,
 * so `context.tool` stays narrow in each editor component.
 */
function spec<TTool extends PaletteAnyTool | undefined>(
	editor: PaletteEditorComponent<TTool, PaletteToolbarItem, PaletteSchema>,
	configure: PaletteEditorComponent<TTool, PaletteToolbarItem, PaletteSchema>,
	footprint?: 'square' | 'free' | 'horizontal' | 'vertical'
): PaletteEditorSpec<TTool, PaletteToolbarItem, PaletteSchema> {
	return { editor, configure, ...(footprint ? { flags: { footprint } } : {}) }
}

export const demoEditors = {
	boolean: {
		toggle: spec(ToggleEditor, BaseConfigurator, 'square'),
	},
	enum: {
		flip: spec(FlipEditor, EnumSubsetConfigurator, 'square'),
		radio: spec(RadioEditor, EnumSubsetConfigurator, 'free'),
		select: spec(SelectEditor, EnumSubsetConfigurator, 'horizontal'),
		segmented: spec(SegmentedEditor, EnumSubsetConfigurator, 'free'),
		splitRadio: spec(SplitRadioEditor, EnumSubsetConfigurator, 'free'),
	},
	number: {
		slider: spec(SliderEditor, BaseConfigurator, 'horizontal'),
		stepper: spec(StepperEditor, BaseConfigurator, 'free'),
		stars: spec(StarsEditor, BaseConfigurator, 'free'),
	},
	item: {
		commandBox: spec(CommandBoxEditor, BaseConfigurator, 'horizontal'),
		drawer: spec(DrawerEditor, BaseConfigurator, 'horizontal'),
	},
	run: {
		button: spec(ButtonEditor, BaseConfigurator, 'horizontal'),
		splitButton: spec(SplitButtonEditor, BaseConfigurator, 'free'),
	},
}
