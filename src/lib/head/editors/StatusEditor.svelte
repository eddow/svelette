<script lang="ts">
	import { statusPresenter } from '$lib/palette/presenters.svelte'
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteStatusTool,
		PaletteToolbarItem
	} from '$lib/palette/types'

	type Props = {
		context: PaletteEditorContext<PaletteStatusTool, PaletteToolbarItem, PaletteSchema>
	}

	let { context }: Props = $props()
	const view = $derived(statusPresenter(context))
</script>

<!--
	Passive status editor: a read-only label/gauge. It runs nothing and has no
	interaction — the demo's mission clock renders here (launch elapsed time).
-->
<span
	class={['palette-default-status', `palette-default-tone-${view.tone}`]}
	title={view.title}
>
	{#if view.icon}
		<span class="palette-default-icon">{view.icon}</span>
	{/if}
	<span class="palette-default-status-value">{view.value}</span>
</span>