<script lang="ts">
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolRun
	} from '$lib/palette/types'
	import { toolbarMeta, tooltip } from './meta'

	type Props = {
		context: PaletteEditorContext<PaletteToolRun, PaletteToolbarItem, PaletteSchema>
	}

	let { context }: Props = $props()
	const item = $derived(context.item)
	const tool = $derived(context.tool)
	const meta = $derived(toolbarMeta(item))
</script>

<button
	type="button"
	class={['palette-default-tool', `palette-default-tone-${meta.tone}`]}
	disabled={!tool.can}
	title={tooltip(item, meta.hint)}
	onclick={() => tool.run()}
>
	{#if meta.icon}
		<span class="palette-default-icon">{meta.icon}</span>
	{/if}
	<span>{meta.label}</span>
</button>
