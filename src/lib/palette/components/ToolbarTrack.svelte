<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements'
	import { actualTrackSpaceAt, paletteTrackSpace } from '../layout.svelte'
	import type { Palette as PaletteRuntime } from '../palette.svelte'
	import type { PaletteBorder, PaletteRegion, PaletteScope, PaletteTrack } from '../types'
	import Toolbar from './Toolbar.svelte'

	type Props = {
		border: PaletteBorder
		region: PaletteRegion
		track: PaletteTrack
		trackIndex: number
		direction: 'horizontal' | 'vertical'
		palette: PaletteRuntime
		scope: PaletteScope
		el?: SvelteHTMLElements['div']
		space?: SvelteHTMLElements['div']
		toolbar?: SvelteHTMLElements['div']
	}

	let { border, region, track, trackIndex, direction, palette, scope, el, space, toolbar }: Props =
		$props()

	function dropTarget(index: number) {
		return { border, direction, index, palette, region, track, trackIndex }
	}
</script>

<div {...el} class={['toolbar-track', el?.class]} data-track-index={trackIndex}>
	<div
		{...space}
		class={['toolbar-track-space', space?.class]}
		data-palette-id={palette.id}
		use:paletteTrackSpace={dropTarget(0)}
		style:flex-basis={`${actualTrackSpaceAt(track, 0) * 100}%`}
		style:flex-grow={Math.max(actualTrackSpaceAt(track, 0), 0.0001)}
	></div>
	{#each track as slot, index (slot)}
		<div class="toolbar-track-slot">
			<Toolbar
				toolbar={slot.toolbar}
				{direction}
				{palette}
				{scope}
				{border}
				{region}
				{track}
				{trackIndex}
				el={toolbar}
			/>
		</div>
		<div
			{...space}
			class={['toolbar-track-space', space?.class]}
			data-palette-id={palette.id}
			use:paletteTrackSpace={dropTarget(index + 1)}
			style:flex-basis={`${actualTrackSpaceAt(track, index + 1) * 100}%`}
			style:flex-grow={Math.max(actualTrackSpaceAt(track, index + 1), 0.0001)}
		></div>
	{/each}
</div>
