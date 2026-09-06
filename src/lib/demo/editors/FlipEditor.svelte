<script lang="ts">
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolEnum
	} from '$lib/palette/types'
	import { enumChoiceText, resolveEnumValues, toolbarMeta, tooltip } from './meta'

	type Props = {
		context: PaletteEditorContext<PaletteToolEnum<string>, PaletteToolbarItem, PaletteSchema>
		onChange?: (value: string) => void
	}

	let { context, onChange }: Props = $props()
	const item = $derived(context.item)
	const tool = $derived(context.tool)
	const meta = $derived(toolbarMeta(item))
	const values = $derived(resolveEnumValues(item, tool))
	const currentIndex = $derived(values.findIndex((value) => value.value === tool.value))
	const next = $derived(
		values.length === 0 ? undefined : values[(currentIndex + 1 + values.length) % values.length]
	)
	const display = $derived(values[currentIndex >= 0 ? currentIndex : 0])
</script>

<button
	type="button"
	class={[
		'palette-default-tool',
		'palette-default-tool-compact',
		`palette-default-tone-${meta.tone}`,
		tool.value !== tool.default ? 'is-selected' : undefined
	]}
	disabled={!next || next.can === false}
	title={tooltip(item, display ? enumChoiceText(display, 'both') : meta.hint)}
	onclick={() => {
		if (!next) return
		tool.value = next.value
		onChange?.(next.value)
	}}
>
	<span class="palette-default-icon">
		{display && typeof display.icon === 'string' ? display.icon : (meta.icon ?? tool.value)}
	</span>
</button>
