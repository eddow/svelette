<script lang="ts">
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolNumber
	} from '$lib/palette/types'
	import { layoutFromSurface, regionFromScope, toolbarMeta, tooltip } from './meta'

	type Props = {
		context: PaletteEditorContext<PaletteToolNumber, PaletteToolbarItem, PaletteSchema>
		onChange?: (value: number) => void
	}

	let { context, onChange }: Props = $props()
	const item = $derived(context.item)
	const tool = $derived(context.tool)
	const meta = $derived(toolbarMeta(item))
	const direction = $derived(layoutFromSurface(context.scope, context.surface))
	const region = $derived(regionFromScope(context.scope))
	const min = $derived(tool.min ?? 0)
	const max = $derived(tool.max ?? 100)
	const step = $derived(tool.step ?? 1)
</script>

<label
	class={[
		'palette-default-slider',
		`palette-default-tone-${meta.tone}`,
		`palette-default-layout-${direction}`,
		`palette-default-region-${region}`
	]}
	title={tooltip(item, `${meta.label} ${tool.value}`)}
>
	<span class="palette-default-icon">{meta.icon ?? 'A'}</span>
	<input
		type="range"
		min={String(min)}
		max={String(max)}
		step={String(step)}
		value={String(tool.value)}
		oninput={(event) => {
			const next = Number((event.currentTarget as HTMLInputElement).value)
			tool.value = next
			onChange?.(next)
		}}
	/>
</label>
