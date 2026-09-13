<script lang="ts">
	import { tick } from 'svelte'
	import type { SvelteHTMLElements } from 'svelte/elements'
	import { configuration } from '$lib/configuration'
	import {
		commitDraggedToParkingRow,
		draggingEmptiesParkingRow,
		lastDragPointer,
		removeParkedToolbar,
		retargetToolbarSlide
	} from '../layout.svelte'
	import { type Palette as PaletteRuntime, palettes } from '../palette.svelte'
	import type { PaletteParking, PaletteScope, PaletteToolbar } from '../types'
	import Toolbar from './Toolbar.svelte'

	type Props = {
		/** Independent parking stack. Owns its toolbars outright — never a
		 * live border, never shared references (single ownership). */
		parking: PaletteParking
		palette: PaletteRuntime
		scope: PaletteScope
		el?: SvelteHTMLElements['div']
		space?: SvelteHTMLElements['div']
		toolbar?: SvelteHTMLElements['div']
		/** Console panel-background hover (the `Ide` mask analogue): while a
		 * drag is active and the pointer is over the console but outside the
		 * parking rows/gaps, keep the end gap lit so the stack reads as a
		 * drop target. */
		maskActive?: boolean
	}

	let { parking, palette, scope, el, space, toolbar, maskActive = false }: Props = $props()

	const isDragging = $derived(palettes.dragging?.palette === palette)

	// Stack DZs: the gaps between rows (gap0, gap1, …). They always exist as
	// zero-size stack spaces and are highlight-only: hovering a row
	// (including its toolbar/tools) highlights the two gaps flanking it;
	// hovering a gap directly highlights only that one. Gated on edit mode
	// AND active drag — no highlight (and no hover-state tracking) when not
	// dragging. Mirrors `ToolbarBorder`'s `activeTrack`/`hoveredStack` pair.
	// Parking is a plain `Stack<Toolbar>`: drops land via the toolbar
	// item-space DZs (`commitDraggedToParking`) or via the dwell-drop below —
	// never by hovering a gap alone.
	let activeRow = $state<number | undefined>(undefined)
	let hoveredGap = $state<number | undefined>(undefined)

	// Hover-dwell drop: mirrors `ToolbarBorder`'s stack-DZ timer. A directly-
	// hovered gap arms a one-shot timer (`configuration.stackDzHoverMs`); on
	// fire the dragged tools land in a new row at that gap
	// (`commitDraggedToParkingRow`). Row-hover flanking highlights and the
	// console-mask end gap never arm — direct hover only.
	// `committedGap` suppresses re-arming while the pointer stays put after
	// a fire; leaving the gap (or the drag ending) resets it so a fresh hover
	// arms again.
	let committedGap = $state<number | undefined>(undefined)
	let hoverTimer: ReturnType<typeof setTimeout> | undefined

	function clearGapTimer(): void {
		if (hoverTimer !== undefined) {
			clearTimeout(hoverTimer)
			hoverTimer = undefined
		}
	}

	// Parking rows show every toolbar except a command-box-only row (mirrors
	// the reference `popupParkingToolbars` filter): the stack itself is
	// untouched — only the *view* hides the launcher row.
	function visibleRows(stack: PaletteParking): { toolbar: PaletteToolbar; index: number }[] {
		return stack.flatMap((toolbarItems, index) => {
			const visible = toolbarItems.filter((item) => item.editor !== 'commandBox')
			return visible.length > 0 ? [{ toolbar: toolbarItems, index }] : []
		})
	}

	// Gap indices are real stack indices (`index + 1` after each visible row),
	// never filtered-view positions — hidden commandBox-only rows must not
	// collapse the numbering.
	function isParkingGapHighlighted(gapIndex: number): boolean {
		if (!palette.editing || !isDragging) return false
		// When the drag would empty the sole parking row, the two gaps
		// touching it are not candidates — dropping there would re-create the
		// same spot once the origin vanishes. Applies to direct hover too.
		const emptied = draggingEmptiesParkingRow(parking)
		if (emptied !== undefined && (gapIndex === emptied || gapIndex === emptied + 1)) return false
		// Console panel-background hover: show the end gap (gap 0 when empty,
		// else the gap after the last row) so the stack reads as a target.
		if (maskActive) return gapIndex === parking.length
		if (hoveredGap !== undefined) return gapIndex === hoveredGap
		if (activeRow === undefined) return false
		return gapIndex === activeRow || gapIndex === activeRow + 1
	}

	function isParkingGapHovered(gapIndex: number): boolean {
		if (!palette.editing || !isDragging) return false
		return hoveredGap === gapIndex
	}

	function onParkingPointerMove(event: PointerEvent): void {
		if (!palette.editing || !isDragging) {
			activeRow = undefined
			hoveredGap = undefined
			clearGapTimer()
			return
		}
		const target = event.target
		if (!(target instanceof HTMLElement)) return
		// Inside a toolbar → that toolbar owns the item-space DZs.
		if (target.closest('.toolbar')) return
		const gapEl = target.closest('[data-parking-gap-index]')
		if (
			gapEl &&
			event.currentTarget instanceof HTMLElement &&
			event.currentTarget.contains(gapEl)
		) {
			const index = Number(gapEl.getAttribute('data-parking-gap-index'))
			const next = Number.isInteger(index) ? index : undefined
			hoveredGap = next
			activeRow = undefined
			return
		}
		hoveredGap = undefined
		const rowEl = target.closest('[data-parking-row-index]')
		if (!rowEl || !(event.currentTarget instanceof HTMLElement)) {
			activeRow = undefined
			return
		}
		const index = Number(rowEl.getAttribute('data-parking-row-index'))
		activeRow = Number.isInteger(index) ? index : undefined
	}

	function onParkingPointerLeave(): void {
		activeRow = undefined
		hoveredGap = undefined
		clearGapTimer()
	}

	$effect(() => {
		if (!palette.editing || !isDragging) {
			activeRow = undefined
			hoveredGap = undefined
			clearGapTimer()
			committedGap = undefined
		}
	})

	// One-shot hover-dwell arming. Keyed on the direct-hover gap plus the
	// drag/mask state: retargeting to another gap restarts the timer (the
	// cleanup clears the previous one), leaving the gap or ending the drag
	// cancels it. The fire re-checks the hover is still on the arming gap
	// before committing.
	$effect(() => {
		const gap = hoveredGap
		const dragging = isDragging
		const editing = palette.editing
		const masked = maskActive
		if (
			!editing ||
			!dragging ||
			masked ||
			gap === undefined ||
			committedGap === gap ||
			!isParkingGapHighlighted(gap)
		) {
			clearGapTimer()
			// Leaving the gap resets the one-shot latch so a fresh hover
			// arms again — including returning to the just-committed gap.
			if (gap === undefined) committedGap = undefined
			return
		}
		// Retargeting to another gap is a fresh hover: drop the latch for
		// the previously committed gap so returning to it can arm again.
		if (committedGap !== undefined) committedGap = undefined
		clearGapTimer()
		const targetParking = parking
		const targetGap = gap
		hoverTimer = setTimeout(() => {
			void (async () => {
				hoverTimer = undefined
				committedGap = targetGap
				// Backstop: a gap change normally cancels this via the
				// cleanup first — only commit while the pointer is still on
				// the arming gap with a live drag.
				if (hoveredGap !== targetGap) return
				if (palettes.dragging?.palette !== palette) return
				if (!palette.editing) return
				const pointer = lastDragPointer()
				const committed = commitDraggedToParkingRow(targetParking, targetGap)
				if (!committed) return
				// The commit promotes a restructure into a slide over the
				// fresh row — arm slide-follow once it has flushed so the
				// row sticks under the cursor. `recenter` grabs the fresh
				// row by its middle when the drag has no mousedown grab
				// delta yet; a whole-toolbar slide keeps its grab delta.
				await tick()
				if (hoveredGap !== targetGap) return
				if (palettes.dragging?.palette !== palette) return
				const live = palettes.dragging
				if (live?.origin.kind !== 'parking') return
				const placed = live.origin.toolbar
				const at = live.origin.index
				const element = document.querySelector(
					`[data-palette-id="${palette.id}"][data-container="parking"] [data-parking-row-index="${at}"] .toolbar`
				)
				if (!(element instanceof HTMLElement)) return
				retargetToolbarSlide({
					track: [{ space: 0, toolbar: placed }],
					toolbar: placed,
					toolbarElement: element,
					direction: 'horizontal',
					clientX: pointer.x,
					clientY: pointer.y,
					recenter: live.grabOffset === undefined
				})
			})()
		}, configuration.stackDzHoverMs)
		return () => {
			clearGapTimer()
		}
	})
</script>

<div
	{...el}
	class={['palette-parking palette-horizontal stack-vertical', el?.class]}
	data-palette-id={palette.id}
	data-container="parking"
	onpointermove={onParkingPointerMove}
	onpointerleave={onParkingPointerLeave}
>
	<div
		{...space}
		class={[
			'toolbar-stack-space toolbar-drop-zone',
			isParkingGapHighlighted(0) ? 'highlighted' : undefined,
			isParkingGapHovered(0) ? 'hovered' : undefined,
			space?.class
		]}
		data-palette-id={palette.id}
		data-parking-gap-index={0}
	></div>
	{#each visibleRows(parking) as { toolbar: toolbarItems, index } (toolbarItems)}
		<div class="palette-parking-row" data-parking-row-index={index}>
			{#if palette.editing}
				<button
					type="button"
					class="palette-parking-remove"
					aria-label="Delete toolbar"
					title="Delete toolbar"
					onclick={(event) => {
						event.stopPropagation()
						if (toolbarItems.length === 0) return
						removeParkedToolbar(parking, toolbarItems)
					}}><span aria-hidden="true" class="palette-parking-remove-icon">🗑</span></button
				>
			{/if}
			<Toolbar
				toolbar={toolbarItems}
				direction="horizontal"
				{palette}
				{scope}
				region="top"
				{parking}
				parkingIndex={index}
				el={toolbar}
			/>
		</div>
		<div
			{...space}
			class={[
				'toolbar-stack-space toolbar-drop-zone',
				isParkingGapHighlighted(index + 1) ? 'highlighted' : undefined,
				isParkingGapHovered(index + 1) ? 'hovered' : undefined,
				space?.class
			]}
			data-palette-id={palette.id}
			data-parking-gap-index={index + 1}
		></div>
	{/each}
</div>
