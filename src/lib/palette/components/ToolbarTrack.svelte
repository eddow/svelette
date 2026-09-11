<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements'
	import { actualTrackSpaceAt, paletteTrackSpace } from '../layout.svelte'
	import type { Palette as PaletteRuntime } from '../palette.svelte'
	import { palettes } from '../palette.svelte'
	import type {
		PaletteBorder,
		PaletteRegion,
		PaletteScope,
		PaletteToolbar,
		PaletteTrack
	} from '../types'
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

	// Perpendicular DZs: the gaps between toolbars along the track axis
	// (track spaces). When inside the track but not inside a toolbar, only
	// the hovered gap highlights. Gated on edit mode AND active drag.
	let hoveredTrackSpace = $state<number | undefined>(undefined)
	// Track-gap fallback, driven by the toolbar's own pointer events (not a
	// document query): the hovered toolbar reports its slot index + side via
	// `requestTrackGap`. Scoped by construction — only this track's child can
	// call it, so no cross-track/stack leak is possible.
	let trackGapFallback = $state<{ slot: number; side: 'before' | 'after' } | undefined>(undefined)

	const isDragging = $derived(palettes.dragging?.palette === palette)

	function requestTrackGap(
		slot: number,
		side: 'before' | 'after' | undefined,
		slotToolbar: PaletteToolbar
	): void {
		// Identity check: only a toolbar actually in THIS track's `track`
		// array may trigger this track's gaps. Index alone is not enough —
		// another track/stack can hold a toolbar at the same slot index.
		const slotEntry = track[slot]
		if (!slotEntry || slotEntry.toolbar !== slotToolbar) {
			trackGapFallback = undefined
			return
		}
		trackGapFallback = side === undefined ? undefined : { slot, side }
	}

	function onTrackPointerMove(event: PointerEvent): void {
		if (!palette.editing || !isDragging) {
			hoveredTrackSpace = undefined
			return
		}
		const target = event.target
		if (!(target instanceof HTMLElement)) return
		// Inside a toolbar → the toolbar owns the perpendicular DZs.
		if (target.closest('.toolbar')) {
			hoveredTrackSpace = undefined
			return
		}
		const spaceEl = target.closest('[data-track-space-index]')
		if (
			!spaceEl ||
			!(event.currentTarget instanceof HTMLElement) ||
			!event.currentTarget.contains(spaceEl)
		) {
			hoveredTrackSpace = undefined
			return
		}
		const index = Number(spaceEl.getAttribute('data-track-space-index'))
		hoveredTrackSpace = Number.isInteger(index) ? index : undefined
	}

	function onTrackPointerLeave(): void {
		hoveredTrackSpace = undefined
		trackGapFallback = undefined
	}

	function isTrackSpaceHighlighted(index: number): boolean {
		if (!palette.editing || !isDragging) return false
		if (hoveredTrackSpace !== undefined) return hoveredTrackSpace === index
		if (trackGapFallback === undefined) return false
		const gap =
			trackGapFallback.side === 'before' ? trackGapFallback.slot : trackGapFallback.slot + 1
		return index === gap
	}

	$effect(() => {
		if (!palette.editing || !isDragging) {
			hoveredTrackSpace = undefined
			trackGapFallback = undefined
		}
	})
</script>

<div
	{...el}
	class={['toolbar-track', el?.class]}
	data-track-index={trackIndex}
	data-palette-id={palette.id}
	onpointermove={onTrackPointerMove}
	onpointerleave={onTrackPointerLeave}
>
	<div
		{...space}
		class={[
			'toolbar-track-space toolbar-drop-zone',
			isTrackSpaceHighlighted(0) ? 'highlighted' : undefined,
			space?.class
		]}
		data-palette-id={palette.id}
		data-track-space-index={0}
		use:paletteTrackSpace={dropTarget(0)}
		style:flex-basis={`${actualTrackSpaceAt(track, 0) * 100}%`}
		style:flex-grow={Math.max(actualTrackSpaceAt(track, 0), 0.0001)}
	></div>
	{#each track as slot, index (slot)}
		<div class="toolbar-track-slot" data-toolbar-slot-index={index}>
			<Toolbar
				toolbar={slot.toolbar}
				{direction}
				{palette}
				{scope}
				{border}
				{region}
				{track}
				{trackIndex}
				slotIndex={index}
				onTrackGap={(side) => requestTrackGap(index, side, slot.toolbar)}
				el={toolbar}
			/>
		</div>
		<div
			{...space}
			class={[
				'toolbar-track-space toolbar-drop-zone',
				isTrackSpaceHighlighted(index + 1) ? 'highlighted' : undefined,
				space?.class
			]}
			data-palette-id={palette.id}
			data-track-space-index={index + 1}
			use:paletteTrackSpace={dropTarget(index + 1)}
			style:flex-basis={`${actualTrackSpaceAt(track, index + 1) * 100}%`}
			style:flex-grow={Math.max(actualTrackSpaceAt(track, index + 1), 0.0001)}
		></div>
	{/each}
</div>
