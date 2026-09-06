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
		layoutFromSurface,
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
	const direction = $derived(layoutFromSurface(context.scope, context.surface))
	const values = $derived(resolveEnumValues(item, tool))
	const display = $derived(enumChoiceDisplay(item))
</script>

<div
	class={[
		'palette-default-radio-group',
		`palette-default-tone-${meta.tone}`,
		`palette-default-layout-${direction}`
	]}
	title={tooltip(item, meta.hint)}
>
	{#if meta.icon}
		<span class="palette-default-radio-label">
			<span class="palette-default-icon">{meta.icon}</span>
			<span>{meta.label}</span>
		</span>
	{/if}
	{#each values as value (value.value)}
		<button
			type="button"
			class={['palette-default-radio-item', tool.value === value.value ? 'is-selected' : undefined]}
			disabled={value.can === false || tool.value === value.value}
			title={enumChoiceText(value, 'both')}
			onclick={() => {
				tool.value = value.value
				onChange?.(value.value)
			}}
		>
			<span class="palette-default-icon">{tool.value === value.value ? '◉' : '○'}</span>
			<span class="palette-default-choice">{enumChoiceText(value, display)}</span>
		</button>
	{/each}
</div>
