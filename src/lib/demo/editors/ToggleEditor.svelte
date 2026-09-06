<script lang="ts">
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolBool,
		PaletteToolbarItem
	} from '$lib/palette/types'
	import { toolbarMeta, tooltip } from './meta'

	type Props = {
		context: PaletteEditorContext<PaletteToolBool, PaletteToolbarItem, PaletteSchema>
		onToggle?: (value: boolean) => void
	}

	let { context, onToggle }: Props = $props()
	const item = $derived(context.item)
	const tool = $derived(context.tool)
	const meta = $derived(toolbarMeta(item))

	// Prefer the configured icon, then the tool's own icon; fall back to a
	// neutral state glyph so any boolean tool renders (not just notifications).
	const icon = $derived(
		meta.icon ?? (typeof tool.icon === 'string' ? tool.icon : tool.value ? '●' : '○')
	)
</script>

<button
	type="button"
	class={[
		'palette-default-tool',
		'palette-default-tool-compact',
		`palette-default-tone-${meta.tone}`,
		tool.value ? 'is-selected' : undefined
	]}
	title={tooltip(item, meta.hint)}
	onclick={() => {
		tool.value = !tool.value
		onToggle?.(tool.value)
	}}
>
	<span class="palette-default-icon">{icon}</span>
</button>
