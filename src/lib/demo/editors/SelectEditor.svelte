<script lang="ts">
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolEnum
	} from '$lib/palette/types'
	import {
		enumChoiceDisplay,
		enumChoiceText,
		resolveEnumValues,
		toolbarMeta,
		tooltip
	} from './meta'

	type Props = {
		context: PaletteEditorContext<PaletteToolEnum<string>, PaletteToolbarItem, PaletteSchema>
		onChange?: (value: string) => void
	}

	let { context, onChange }: Props = $props()
	const item = $derived(context.item)
	const tool = $derived(context.tool)
	const meta = $derived(toolbarMeta(item))
	const values = $derived(resolveEnumValues(item, tool))
	const display = $derived(enumChoiceDisplay(item))
	const current = $derived(values.find((value) => value.value === tool.value))
	const currentIcon = $derived(
		current && typeof current.icon === 'string' ? current.icon : (meta.icon ?? tool.value)
	)
</script>

<label
	class={['palette-default-select', `palette-default-tone-${meta.tone}`]}
	title={tooltip(item, meta.hint)}
>
	<span class="palette-default-icon">{currentIcon}</span>
	<select
		value={tool.value}
		onchange={(event) => {
			const next = (event.currentTarget as HTMLSelectElement).value
			tool.value = next
			onChange?.(next)
		}}
	>
		{#each values as value (value.value)}
			<option value={value.value}>{enumChoiceText(value, display)}</option>
		{/each}
	</select>
</label>
