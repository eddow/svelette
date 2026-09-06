<script lang="ts">
	import { buttonPresenter } from '$lib/palette/presenters.svelte'
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolRun
	} from '$lib/palette/types'

	type Props = {
		context: PaletteEditorContext<PaletteToolRun, PaletteToolbarItem, PaletteSchema>
	}

	let { context }: Props = $props()
	const view = $derived(buttonPresenter(context))
</script>

<button
	type="button"
	class={['palette-default-tool', `palette-default-tone-${view.tone}`]}
	disabled={!view.can}
	title={view.title}
	onclick={() => view.run()}
>
	{#if view.icon}
		<span class="palette-default-icon">{view.icon}</span>
	{/if}
	<span>{view.label}</span>
</button>
