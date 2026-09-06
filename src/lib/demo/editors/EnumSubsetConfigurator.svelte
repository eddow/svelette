<script lang="ts">
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolEnum
	} from '$lib/palette/types'
	import BaseConfigurator from './BaseConfigurator.svelte'
	import { enumChoiceDisplay, enumSubsetConfig } from './meta'

	type Props = {
		context: PaletteEditorContext<PaletteToolEnum<string>, PaletteToolbarItem, PaletteSchema>
	}

	let { context }: Props = $props()
	const item = $derived(context.item)
	const tool = $derived(context.tool)
	const config = $derived(enumSubsetConfig(item))
	const choiceDisplay = $derived(enumChoiceDisplay(item))

	function setChoiceDisplay(value: string) {
		if (!item.config || typeof item.config !== 'object') item.config = {}
		;(item.config as Record<string, unknown>).choiceDisplay =
			value === 'icon' || value === 'text' || value === 'both' ? value : 'both'
	}

	function setList(key: 'values' | 'keywords', value: string) {
		if (!item.config || typeof item.config !== 'object') item.config = {}
		const values = value
			.split(',')
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0)
		;(item.config as Record<string, unknown>)[key] = values.length > 0 ? values : undefined
	}
</script>

<div class="palette-default-config-stack">
	<BaseConfigurator {context} />
	<div class="palette-default-config-row">
		<div class="palette-default-config-key">
			<strong>Choice display</strong>
			<span>Choose whether enum values show their icon, text label, or both.</span>
		</div>
		<div class="palette-default-config-value">
			<select value={choiceDisplay} onchange={(e) => setChoiceDisplay(e.currentTarget.value)}>
				<option value="both">Icon + text</option>
				<option value="icon">Icon only</option>
				<option value="text">Text only</option>
			</select>
		</div>
	</div>
	<div class="palette-default-config-row">
		<div class="palette-default-config-key">
			<strong>Allowed values</strong>
			<span>Comma-separated subset of tool values to keep visible.</span>
		</div>
		<div class="palette-default-config-value">
			<input
				value={config?.values?.join(', ') ?? ''}
				placeholder={tool.values.map((value) => value.value).join(', ')}
				oninput={(e) => setList('values', e.currentTarget.value)}
			/>
		</div>
	</div>
	<div class="palette-default-config-row">
		<div class="palette-default-config-key">
			<strong>Keyword filter</strong>
			<span>Extra terms that make this item easier to find in the chooser.</span>
		</div>
		<div class="palette-default-config-value">
			<input
				value={config?.keywords?.join(', ') ?? ''}
				placeholder="row, column"
				oninput={(e) => setList('keywords', e.currentTarget.value)}
			/>
		</div>
	</div>
</div>
