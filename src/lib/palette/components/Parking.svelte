<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements'
	import {
		paletteStackSpace,
		removeEmptyTrack,
		removePaletteItem,
		removeToolbar,
	} from '../layout.svelte'
	import type { Palette as PaletteRuntime } from '../palette.svelte'
	import type {
		PaletteBorder,
		PaletteScope,
		PaletteToolbar,
		PaletteToolbarItem,
		PaletteTrack,
	} from '../types'
	import Toolbar from './Toolbar.svelte'

	type Props = {
		toolbars: readonly PaletteToolbar[]
		palette: PaletteRuntime
		scope: PaletteScope
		el?: SvelteHTMLElements['div']
		space?: SvelteHTMLElements['div']
		toolbar?: SvelteHTMLElements['div']
		/** Live border the parking rows bind to (G3). When omitted, parking
		 * seeds a local border from `toolbars` (legacy probe path). */
		border?: PaletteBorder
		/** Live region for the bound border (defaults to `'top'`). */
		region?: 'top' | 'right' | 'bottom' | 'left'
	}

	let { toolbars, palette, scope, el, space, toolbar, border: liveBorder, region }: Props =
		$props()

	// G3 — parking binds the LIVE border when the caller passes one (the
	// console passes the real top border): rows render live toolbars, the `×`
	// button removes the item from the real toolbar via `removePaletteItem`,
	// and every row is a real drag-engine drop target (stack + toolbar
	// spaces bound to the live border/track). Without `border` (unit probes),
	// fall back to the legacy seeded local copy.
	// svelte-ignore state_referenced_locally
	const localBorder: PaletteBorder = $state(
		toolbars.map((toolbarItems) => [{ space: 0, toolbar: toolbarItems as PaletteToolbar }])
	)
	const border: PaletteBorder = $derived(liveBorder ?? localBorder)
	const liveRegion = $derived(region ?? 'top')

	function stackTarget(index: number) {
		return {
			border,
			direction: 'horizontal' as const,
			index,
			palette,
			region: liveRegion,
		}
	}

	function removeParkedItem(
		item: PaletteToolbarItem,
		toolbarItems: PaletteToolbar,
		track: PaletteTrack
	) {
		removePaletteItem(item, toolbarItems, track, border)
	}

	// Parking rows show every toolbar except a command-box-only row (mirrors
	// the reference `popupParkingToolbars` filter): the live border itself is
	// untouched — only the *view* hides the launcher row.
	function visibleTracks(tracks: PaletteBorder): { track: PaletteTrack; position: number }[] {
		return tracks.flatMap((track, position) => {
			const items = track[0]?.toolbar ?? []
			const visible = items.filter((item) => item.editor !== 'commandBox')
			return visible.length > 0 ? [{ track, position }] : []
		})
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
	{#each visibleTracks(border) as { track, position } (track)}
		{@const toolbarItems = track[0]?.toolbar ?? []}
		<div class="palette-parking-row">
			{#if palette.editing}
				<button
					type="button"
					class="palette-parking-remove"
					aria-label="Delete toolbar"
					onclick={(event) => {
						event.stopPropagation()
						if (toolbarItems.length === 0) return
						removeToolbar(track, toolbarItems)
						removeEmptyTrack(border, track)
					}}>×</button
				>
			{/if}
			<Toolbar
				toolbar={toolbarItems}
				direction="horizontal"
				{palette}
				{scope}
				{border}
				region={liveRegion}
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
