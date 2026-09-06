import BaseConfigurator from '$lib/head/editors/BaseConfigurator.svelte'
import type {
	PaletteAnyTool,
	PaletteEditorComponent,
	PaletteEditorSpec,
	PaletteSchema,
	PaletteToolbarItem,
} from '$lib/palette/types'
import SliderEditor from './SliderEditor.svelte'
import StarsEditor from './StarsEditor.svelte'

/**
 * Build a demo editor spec, preserving the editor's tool-family type.
 *
 * Svelte `Component` props are **contravariant**, so the broad configurator
 * (`BaseConfigurator` over `PaletteTool | undefined`) is assignable to any
 * narrower `TTool` — no cast is needed. The family-specific `TTool` is inferred
 * from `editor`, so `context.tool` stays narrow in each editor component.
 */
function spec<TTool extends PaletteAnyTool | undefined>(
	editor: PaletteEditorComponent<TTool, PaletteToolbarItem, PaletteSchema>,
	configure: PaletteEditorComponent<TTool, PaletteToolbarItem, PaletteSchema>,
	footprint?: 'square' | 'free' | 'horizontal' | 'vertical'
): PaletteEditorSpec<TTool, PaletteToolbarItem, PaletteSchema> {
	return { editor, configure, ...(footprint ? { flags: { footprint } } : {}) }
}

/**
 * The demo layer proves both extension mechanisms (see
 * `docs/using-the-default-head.md`):
 *
 * - **Override (same key)** — `SliderEditor` replaces the head's `number.slider`
 *   (adds a numeric value badge) because the demo spread comes last.
 * - **Extend (new key)** — `StarsEditor` is a `number` variant the head lacks:
 *   a play/rating row of "▶"/"▷" triangles.
 *
 * The other families are empty objects so the per-family spread keeps its shape
 * (a top-level spread would be equivalent here, but the empty entries make
 * "demo only touches `number`" explicit).
 */
export const demoEditors = {
	boolean: {},
	enum: {},
	number: {
		slider: spec(SliderEditor, BaseConfigurator, 'horizontal'),
		stars: spec(StarsEditor, BaseConfigurator, 'free'),
	},
	item: {},
	run: {},
}
