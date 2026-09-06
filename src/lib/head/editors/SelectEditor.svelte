<script lang="ts">
	import { selectPresenter } from '$lib/palette/presenters.svelte'
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolEnum
	} from '$lib/palette/types'

	type Props = {
		context: PaletteEditorContext<PaletteToolEnum<string>, PaletteToolbarItem, PaletteSchema>
		onChange?: (value: string) => void
	}

	let { context, onChange }: Props = $props()
	const view = $derived(selectPresenter(context))
</script>

<label class={['palette-default-select', `palette-default-tone-${view.tone}`]} title={view.title}>
	<span class="palette-default-icon">{view.icon}</span>
	<select
		value={view.value}
		onchange={(event) => {
			const next = (event.currentTarget as HTMLSelectElement).value
			view.select(next)
			onChange?.(next)
		}}
	>
		{#each view.options as option (option.value)}
			<option value={option.value}>{option.text}</option>
		{/each}
	</select>
</label>
