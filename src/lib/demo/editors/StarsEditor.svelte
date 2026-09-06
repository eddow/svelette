<script lang="ts">
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolNumber
	} from '$lib/palette/types'
	import { layoutFromSurface, toolbarMeta, tooltip } from './meta'

	type Props = {
		context: PaletteEditorContext<PaletteToolNumber, PaletteToolbarItem, PaletteSchema>
		maximum?: number
		onChange?: (value: number) => void
	}

	let { context, maximum = 5, onChange }: Props = $props()
	const item = $derived(context.item)
	const tool = $derived(context.tool)
	const meta = $derived(toolbarMeta(item))
	const direction = $derived(layoutFromSurface(context.scope, context.surface))
	const stars = $derived(Array.from({ length: maximum }, (_, index) => index + 1))
</script>

<div
	class={[
		'palette-default-stars',
		`palette-default-tone-${meta.tone}`,
		`palette-default-layout-${direction}`
	]}
	title={tooltip(item, meta.hint)}
>
	<span class="palette-default-icon">{meta.icon ?? '★'}</span>
	<span
		class={['palette-default-stars-row', `palette-default-layout-${direction}`]}
		role="radiogroup"
	>
		{#each stars as index (index)}
			<button
				type="button"
				class={['palette-default-arrow', index <= tool.value ? 'is-selected' : undefined]}
				role="radio"
				aria-checked={index === tool.value}
				title={`${meta.label} ${index}`}
				onclick={() => {
					tool.value = index
					onChange?.(index)
				}}
			>
				{index <= tool.value ? '▶' : '▷'}
			</button>
		{/each}
	</span>
</div>
