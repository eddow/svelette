<script lang="ts">
	import { configuratorPresenter } from '$lib/palette/presenters.svelte'
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteTool,
		PaletteToolbarItem
	} from '$lib/palette/types'

	type Props = {
		context: PaletteEditorContext<PaletteTool | undefined, PaletteToolbarItem, PaletteSchema>
	}

	let { context }: Props = $props()
	const view = $derived(configuratorPresenter(context))
</script>

<div class="palette-default-config-table">
	<div class="palette-default-config-row">
		<div class="palette-default-config-key"><strong>Label</strong></div>
		<div class="palette-default-config-value">
			<input value={view.label} oninput={(e) => view.setText('label', e.currentTarget.value)} />
		</div>
	</div>
	<div class="palette-default-config-row">
		<div class="palette-default-config-key"><strong>Icon</strong></div>
		<div class="palette-default-config-value">
			<input value={view.icon} oninput={(e) => view.setText('icon', e.currentTarget.value)} />
		</div>
	</div>
	<div class="palette-default-config-row">
		<div class="palette-default-config-key"><strong>Hint</strong></div>
		<div class="palette-default-config-value">
			<input value={view.hint} oninput={(e) => view.setText('hint', e.currentTarget.value)} />
		</div>
	</div>
	<div class="palette-default-config-row">
		<div class="palette-default-config-key">
			<strong>Editor</strong>
			<span>Choose how this item renders inside the toolbar.</span>
		</div>
		<div class="palette-default-config-value">
			<select value={view.editor} onchange={(e) => view.setEditor(e.currentTarget.value)}>
				{#each view.editorChoices as option (option.id)}
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
			<select value={view.tone} onchange={(e) => view.setTone(e.currentTarget.value)}>
				<option value="neutral">Neutral</option>
				<option value="accent">Accent</option>
			</select>
		</div>
	</div>
</div>
