<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements'
	import { paletteStackSpace, removeEmptyTrack, removeToolbar } from '../layout.svelte'
	import type { Palette as PaletteRuntime } from '../palette.svelte'
	import type { PaletteBorder, PaletteScope, PaletteToolbar } from '../types'
	import Toolbar from './Toolbar.svelte'

	type Props = {
		toolbars: readonly PaletteToolbar[]
		palette: PaletteRuntime
		scope: PaletteScope
		el?: SvelteHTMLElements['div']
		space?: SvelteHTMLElements['div']
		toolbar?: SvelteHTMLElements['div']
	}

	let { toolbars, palette, scope, el, space, toolbar }: Props = $props()

	// Parking owns its border: the `toolbars` prop seeds initial state once,
	// then removal/insertion mutate the local border (mirrors sursaut's
	// `parkingBorder` memo). Seeding is deliberate, so `toolbars` is read once
	// by design and `state_referenced_locally` is suppressed.
	// svelte-ignore state_referenced_locally
	const border: PaletteBorder = $state(
		toolbars.map((toolbarItems) => [{ space: 0, toolbar: toolbarItems as PaletteToolbar }])
	)

	function stackTarget(index: number) {
		return { border, direction: 'horizontal' as const, index, palette, region: 'top' as const }
	}
</script>

<div
	{...el}
	class={['palette-parking palette-horizontal stack-vertical', el?.class]}
	data-palette-id={palette.id}
>
	<div
		{...space}
		class={['toolbar-stack-space toolbar-drop-zone', space?.class]}
		data-palette-id={palette.id}
		use:paletteStackSpace={stackTarget(0)}
	></div>
	{#each border as track, position (track)}
		<div class="palette-parking-row">
			{#if palette.editing}
				<button
					type="button"
					class="palette-parking-remove"
					aria-label="Delete toolbar"
					onclick={(event) => {
						event.stopPropagation()
						const toolbarItems = track[0]?.toolbar
						if (!toolbarItems) return
						removeToolbar(track, toolbarItems)
						removeEmptyTrack(border, track)
					}}>×</button
				>
			{/if}
			<Toolbar
				toolbar={track[0]?.toolbar ?? []}
				direction="horizontal"
				{palette}
				{scope}
				{border}
				region="top"
				{track}
				trackIndex={position}
				el={toolbar}
			/>
		</div>
		<div
			{...space}
			class={['toolbar-stack-space toolbar-drop-zone', space?.class]}
			data-palette-id={palette.id}
			use:paletteStackSpace={stackTarget(position + 1)}
		></div>
	{/each}
</div>
