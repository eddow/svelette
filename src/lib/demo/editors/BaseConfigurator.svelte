<script lang="ts">
	import type {
		PaletteEditorChoice,
		PaletteEditorContext,
		PaletteSchema,
		PaletteTool,
		PaletteToolbarItem
	} from '$lib/palette/types'
	import { toolbarMeta } from '../editors/meta'

	type Props = {
		context: PaletteEditorContext<PaletteTool | undefined, PaletteToolbarItem, PaletteSchema>
	}

	let { context }: Props = $props()
	const item = $derived(context.item)
	const meta = $derived(toolbarMeta(item))
	const editorChoices = $derived(
		(context.scope.editorChoices as readonly PaletteEditorChoice[] | undefined) ?? []
	)

	function setText(key: 'icon' | 'label' | 'hint', value: string) {
		if (!item.config || typeof item.config !== 'object') item.config = {}
		;(item.config as Record<string, unknown>)[key] = value
	}

	function setTone(value: string) {
		if (!item.config || typeof item.config !== 'object') item.config = {}
		;(item.config as Record<string, unknown>).tone = value === 'accent' ? 'accent' : 'neutral'
	}

	function setEditor(value: string) {
		item.editor = value
		const config = item.config as Record<string, unknown> | undefined
		if (
			value !== 'flip' &&
			value !== 'radio' &&
			value !== 'select' &&
			value !== 'segmented' &&
			value !== 'splitRadio' &&
			config
		) {
			delete config.values
			delete config.keywords
			delete config.choiceDisplay
		}
	}
</script>

<div class="palette-default-config-table">
	<div class="palette-default-config-row">
		<div class="palette-default-config-key"><strong>Label</strong></div>
		<div class="palette-default-config-value">
			<input value={meta.label} oninput={(e) => setText('label', e.currentTarget.value)} />
		</div>
	</div>
	<div class="palette-default-config-row">
		<div class="palette-default-config-key"><strong>Icon</strong></div>
		<div class="palette-default-config-value">
			<input value={meta.icon ?? ''} oninput={(e) => setText('icon', e.currentTarget.value)} />
		</div>
	</div>
	<div class="palette-default-config-row">
		<div class="palette-default-config-key"><strong>Hint</strong></div>
		<div class="palette-default-config-value">
			<input value={meta.hint ?? ''} oninput={(e) => setText('hint', e.currentTarget.value)} />
		</div>
	</div>
	<div class="palette-default-config-row">
		<div class="palette-default-config-key">
			<strong>Editor</strong>
			<span>Choose how this item renders inside the toolbar.</span>
		</div>
		<div class="palette-default-config-value">
			<select value={meta.editor} onchange={(e) => setEditor(e.currentTarget.value)}>
				{#each editorChoices as option (option.id)}
					<option value={option.id}>{option.label}</option>
				{/each}
			</select>
		</div>
	</div>
	<div class="palette-default-config-row">
		<div class="palette-default-config-key">
			<strong>Tone</strong>
			<span>Accent gives button-like controls brighter chrome.</span>
		</div>
		<div class="palette-default-config-value">
			<select value={meta.tone} onchange={(e) => setTone(e.currentTarget.value)}>
				<option value="neutral">Neutral</option>
				<option value="accent">Accent</option>
			</select>
		</div>
	</div>
</div>
