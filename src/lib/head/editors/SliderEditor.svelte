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

<label
	class={[
		'palette-default-slider',
		`palette-default-tone-${view.tone}`,
		`palette-default-layout-${view.direction}`,
		`palette-default-region-${view.region}`
	]}
	title={view.title}
>
	<span class="palette-default-icon">{view.icon}</span>
	<input
		type="range"
		min={String(view.min)}
		max={String(view.max)}
		step={String(view.step)}
		value={String(view.value)}
		oninput={(event) => {
			const next = Number((event.currentTarget as HTMLInputElement).value)
			view.set(next)
			onChange?.(next)
		}}
	/>
</label>
