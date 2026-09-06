<script lang="ts">
	import { sliderPresenter } from '$lib/palette/presenters.svelte'
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolNumber
	} from '$lib/palette/types'

	type Props = {
		context: PaletteEditorContext<PaletteToolNumber, PaletteToolbarItem, PaletteSchema>
		onChange?: (value: number) => void
	}

	let { context, onChange }: Props = $props()
	const view = $derived(sliderPresenter(context))
</script>

<div
	class={[
		'palette-default-stepper',
		`palette-default-tone-${view.tone}`,
		`palette-default-layout-${view.direction}`
	]}
	title={view.title}
>
	<button
		type="button"
		class={['palette-default-tool', 'palette-default-tool-compact']}
		disabled={view.value - view.step < view.min}
		onclick={() => {
			view.set(Math.max(view.min, view.value - view.step))
			onChange?.(view.value)
		}}
	>
		−
	</button>
	<span class="palette-default-stepper-value">
		<span class="palette-default-icon">{view.icon}</span>
		{view.value}
	</span>
	<button
		type="button"
		class={['palette-default-tool', 'palette-default-tool-compact']}
		disabled={view.value + view.step > view.max}
		onclick={() => {
			view.set(Math.min(view.max, view.value + view.step))
			onChange?.(view.value)
		}}
	>
		+
	</button>
</div>
