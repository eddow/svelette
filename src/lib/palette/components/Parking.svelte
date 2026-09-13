<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements'
	import {
		commitDraggedToParkingGap,
		draggingEmptiesParkingRow,
		removeParkedToolbar
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
	// zero-size stack spaces. Hovering a row (including its toolbar/tools)
	// highlights the two gaps flanking it; hovering a gap directly highlights
	// only that one. Gated on edit mode AND active drag — no highlight (and
	// no hover-state tracking) when not dragging. Mirrors `ToolbarBorder`'s
	// `activeTrack`/`hoveredStack` pair.
	let activeRow = $state<number | undefined>(undefined)
	let hoveredGap = $state<number | undefined>(undefined)

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
			return
		}
		const target = event.target
		if (!(target instanceof HTMLElement)) return
		// Inside a toolbar → that toolbar owns the item-space DZs. Do NOT
		// clear the memo here: after a commit the fresh row sits under the
		// pointer, and clearing would re-arm the commit on the very next move.
		if (target.closest('.toolbar')) return
		const gapEl = target.closest('[data-parking-gap-index]')
		if (
			gapEl &&
			event.currentTarget instanceof HTMLElement &&
			event.currentTarget.contains(gapEl)
		) {
			const index = Number(gapEl.getAttribute('data-parking-gap-index'))
			const next = Number.isInteger(index) ? index : undefined
			const prev = hoveredGap
			hoveredGap = next
			activeRow = undefined
			// Commit on gap hover: create or relocate a row at this gap. The
			// commit itself rejects the gaps flanking the moved row. Record
			// the committed gap — not `undefined` — so a repeat move at the
			// same physical position is absorbed by `next === prev`.
			if (next !== undefined && next !== prev && commitDraggedToParkingGap(parking, next)) {
				hoveredGap = next
			} else {
				hoveredGap = next
			}
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
	}

	$effect(() => {
		if (!palette.editing || !isDragging) {
			activeRow = undefined
			hoveredGap = undefined
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
	{#if visibleRows(parking).length === 0}
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
		<span class="palette-parking-empty" data-testid="parking-empty-hint"
			>Parking is empty — drag tools here</span
		>
	{:else}
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
	{/if}
</div>
