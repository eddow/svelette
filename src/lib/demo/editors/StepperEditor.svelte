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
		onChange?: (value: number) => void
	}

	let { context, onChange }: Props = $props()
	const item = $derived(context.item)
	const tool = $derived(context.tool)
	const meta = $derived(toolbarMeta(item))
	const direction = $derived(layoutFromSurface(context.scope, context.surface))
	const step = $derived(tool.step ?? 1)
	const min = $derived(tool.min ?? Number.NEGATIVE_INFINITY)
	const max = $derived(tool.max ?? Number.POSITIVE_INFINITY)
</script>

<div
	class={[
		'palette-default-stepper',
		`palette-default-tone-${meta.tone}`,
		`palette-default-layout-${direction}`
	]}
	title={tooltip(item, `${meta.label} ${tool.value}`)}
>
	<button
		type="button"
		class={['palette-default-tool', 'palette-default-tool-compact']}
		disabled={tool.value - step < min}
		onclick={() => {
			tool.value = Math.max(min, tool.value - step)
			onChange?.(tool.value)
		}}
	>
		−
	</button>
	<span class="palette-default-stepper-value">
		<span class="palette-default-icon">{meta.icon ?? 'A'}</span>
		{tool.value}
	</span>
	<button
		type="button"
		class={['palette-default-tool', 'palette-default-tool-compact']}
		disabled={tool.value + step > max}
		onclick={() => {
			tool.value = Math.min(max, tool.value + step)
			onChange?.(tool.value)
		}}
	>
		+
	</button>
</div>
