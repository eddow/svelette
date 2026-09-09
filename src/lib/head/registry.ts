/**
 * Standard minimal head for the svelette palette.
 *
 * A small standard set of variants per tool family (button/toggle/select+
 * segmented/slider+stepper/commandBox) plus the generic `BaseConfigurator`. The
 * core `DrawerEditor` trigger is reused from `palette/components/` — never
 * duplicated here.
 *
 * Heads are presentation-only: every component binds a headless presenter
 * from `$lib/palette/presenters.svelte` (all tool/config reads and mutations
 * live there). No `tool.value = …`, no `tool.run()`, no command-box entry
 * builders inside `.svelte` files.
 */
import DrawerEditor from '$lib/palette/components/DrawerEditor.svelte'
import type {
	PaletteAnyTool,
	PaletteEditorComponent,
	PaletteEditorSpec,
	PaletteSchema,
	PaletteToolbarItem,
} from '$lib/palette/types'
import BaseConfigurator from './editors/BaseConfigurator.svelte'
import ButtonEditor from './editors/ButtonEditor.svelte'
import CommandBoxEditor from './editors/CommandBoxEditor.svelte'
import SegmentedEditor from './editors/SegmentedEditor.svelte'
import SelectEditor from './editors/SelectEditor.svelte'
import SliderEditor from './editors/SliderEditor.svelte'
import StatusEditor from './editors/StatusEditor.svelte'
import StepperEditor from './editors/StepperEditor.svelte'
import ToggleEditor from './editors/ToggleEditor.svelte'

function spec<TTool extends PaletteAnyTool | undefined>(
	editor: PaletteEditorComponent<TTool, PaletteToolbarItem, PaletteSchema>,
	configure: PaletteEditorComponent<TTool, PaletteToolbarItem, PaletteSchema>,
	footprint?: 'square' | 'free' | 'horizontal' | 'vertical'
): PaletteEditorSpec<TTool, PaletteToolbarItem, PaletteSchema> {
	return { editor, configure, ...(footprint ? { flags: { footprint } } : {}) }
}

/**
 * Minimal family→variant map: a small standard set per family.
 *
 * - boolean: `toggle`
 * - enum: `select` (dropdown), `segmented` (joined buttons; the selected one
 *   reads as "pushed in")
 * - number: `slider`, `stepper` (± buttons)
 * - item: `commandBox` (+ core `drawer` trigger)
 * - run: `button`
 *
 * Extra variants live in the demo layer (`$lib/demo/editors/registry.ts`),
 * which proves custom heads can extend or replace this map.
 */
export const headEditors = {
	boolean: {
		toggle: spec(ToggleEditor, BaseConfigurator, 'square'),
	},
	enum: {
		select: spec(SelectEditor, BaseConfigurator, 'horizontal'),
		segmented: spec(SegmentedEditor, BaseConfigurator, 'free'),
	},
	number: {
		slider: spec(SliderEditor, BaseConfigurator, 'horizontal'),
		stepper: spec(StepperEditor, BaseConfigurator, 'free'),
	},
	item: {
		commandBox: spec(CommandBoxEditor, BaseConfigurator, 'horizontal'),
		drawer: spec(DrawerEditor, BaseConfigurator, 'horizontal'),
	},
	status: {
		status: spec(StatusEditor, BaseConfigurator, 'horizontal'),
	},
	run: {
		button: spec(ButtonEditor, BaseConfigurator, 'horizontal'),
	},
}

export {
	type ButtonPresenter,
	buttonPresenter,
	type CommandBoxPresenter,
	type ConfiguratorPresenter,
	commandBoxPresenter,
	configuratorPresenter,
	type HeadChoiceDisplay,
	type HeadEnumSubsetConfig,
	type HeadItemConfigBase,
	headLayoutFromSurface,
	headMeta,
	headRegionFromScope,
	headTooltip,
	type SelectOption,
	type SelectPresenter,
	type SliderPresenter,
	type StatusPresenter,
	selectPresenter,
	sliderPresenter,
	statusPresenter,
	type TogglePresenter,
	togglePresenter,
} from '$lib/palette/presenters.svelte'
export { default as Icon } from './Icon.svelte'
export { type IconFactory, icons } from './icons.svelte'
