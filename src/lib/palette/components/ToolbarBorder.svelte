<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements'
	import { paletteStackSpace } from '../layout.svelte'
	import type { Palette as PaletteRuntime } from '../palette.svelte'
	import type { PaletteBorder, PaletteRegion, PaletteScope } from '../types'
	import ToolbarTrack from './ToolbarTrack.svelte'

	type Props = {
		border: PaletteBorder
		direction: 'horizontal' | 'vertical'
		region: PaletteRegion
		palette: PaletteRuntime
		scope: PaletteScope
		inverse?: boolean
		el?: SvelteHTMLElements['div']
		track?: SvelteHTMLElements['div']
		space?: SvelteHTMLElements['div']
		toolbar?: SvelteHTMLElements['div']
	}

	let {
		border,
		direction,
		region,
		palette,
		scope,
		inverse = false,
		el,
		track,
		space,
		toolbar
	}: Props = $props()

	const ordered = $derived(inverse ? [...border].reverse() : border)

	function stackTarget(index: number) {
		return { border, direction, index, palette, region }
	}
</script>

<div
	{...el}
	class={[
		'toolbar-border',
		`palette-${direction}`,
		direction === 'horizontal' ? 'stack-vertical' : 'stack-horizontal',
		el?.class
	]}
	data-palette-id={palette.id}
	data-region={region}
>
	{#if !inverse}
		<div
			{...space}
			class={['toolbar-stack-space toolbar-drop-zone', space?.class]}
			data-palette-id={palette.id}
			use:paletteStackSpace={stackTarget(0)}
		></div>
	{/if}
	{#each ordered as trackItem, position (trackItem)}
		{@const trackIndex = inverse ? border.length - 1 - position : position}
		{#if inverse}
			<div
				{...space}
				class={['toolbar-stack-space toolbar-drop-zone', space?.class]}
				data-palette-id={palette.id}
				use:paletteStackSpace={stackTarget(trackIndex + 1)}
			></div>
		{/if}
		<ToolbarTrack
			{border}
			{region}
			track={trackItem}
			{trackIndex}
			{direction}
			{palette}
			{scope}
			el={track}
			{space}
			{toolbar}
		/>
		{#if !inverse}
			<div
				{...space}
				class={['toolbar-stack-space toolbar-drop-zone', space?.class]}
				data-palette-id={palette.id}
				use:paletteStackSpace={stackTarget(trackIndex + 1)}
			></div>
		{/if}
	{/each}
	{#if inverse}
		<div
			{...space}
			class={['toolbar-stack-space toolbar-drop-zone', space?.class]}
			data-palette-id={palette.id}
			use:paletteStackSpace={stackTarget(0)}
		></div>
	{/if}
</div>
