<script lang="ts">
	import { tick } from 'svelte'
	import type { SvelteHTMLElements } from 'svelte/elements'
	import { configuration } from '$lib/configuration'
	import {
		commitDraggedToStackSpace,
		draggingEmptiesTrackIndex,
		lastDragPointer,
		retargetToolbarSlide
	} from '../layout.svelte'
	import type { Palette as PaletteRuntime } from '../palette.svelte'
	import { palettes } from '../palette.svelte'
	import type { PaletteBorder, PaletteRegion, PaletteScope } from '../types'
	import ToolbarTrack from './ToolbarTrack.svelte'

	type Props = {
		border: PaletteBorder
		direction: 'horizontal' | 'vertical'
		region: PaletteRegion
		palette: PaletteRuntime
		scope: PaletteScope
		inverse?: boolean
		maskActive?: boolean
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
		maskActive = false,
		el,
		track,
		space,
		toolbar
	}: Props = $props()

	const ordered = $derived(inverse ? [...border].reverse() : border)

	// Parallel DZs: the virtual tracks between real tracks (track0.5, track1.5…).
	// They always exist as zero-size stack spaces. Hovering a track (including
	// its toolbars/tools) highlights the two surrounding it; hovering a DZ
	// directly highlights only that one. Gated on edit mode AND active drag —
	// no highlight (and no hover-state tracking) when not dragging.
	let activeTrack = $state<number | undefined>(undefined)
	let hoveredStack = $state<number | undefined>(undefined)

	// Hover-dwell drop: a directly-hovered stack DZ arms a one-shot timer
	// (`configuration.stackDzHoverMs`); on fire the dragged tools land in a
	// new track at that stack (`commitDraggedToStackSpace`). Track-hover flanking
	// highlights and the modal-mask inner DZ never arm — direct hover only.
	// `committedStack` suppresses re-arming while the pointer stays put after
	// a fire; leaving the DZ (or the drag ending) resets it so a fresh hover
	// arms again.
	let committedStack = $state<number | undefined>(undefined)
	let hoverTimer: ReturnType<typeof setTimeout> | undefined

	function clearStackTimer(): void {
		if (hoverTimer !== undefined) {
			clearTimeout(hoverTimer)
			hoverTimer = undefined
		}
	}

	const isDragging = $derived(palettes.dragging?.palette === palette)

	function onBorderPointerMove(event: PointerEvent): void {
		if (!palette.editing || !isDragging) {
			activeTrack = undefined
			hoveredStack = undefined
			clearStackTimer()
			return
		}
		const target = event.target
		if (!(target instanceof HTMLElement)) return
		const stackEl = target.closest('[data-stack-index]')
		if (stackEl) {
			const index = Number(stackEl.getAttribute('data-stack-index'))
			hoveredStack = Number.isInteger(index) ? index : undefined
			activeTrack = undefined
			return
		}
		hoveredStack = undefined
		const trackEl = target.closest('[data-track-index]')
		if (!trackEl) {
			activeTrack = undefined
			return
		}
		const index = Number(trackEl.getAttribute('data-track-index'))
		activeTrack = Number.isInteger(index) ? index : undefined
	}

	function onBorderPointerLeave(): void {
		activeTrack = undefined
		hoveredStack = undefined
		clearStackTimer()
	}

	function isStackHighlighted(stackIndex: number): boolean {
		if (!palette.editing || !isDragging) return false
		// When the drag would empty its origin track (whole content of a
		// single-toolbar track), the two stacks touching that track are not
		// candidates — dropping there would re-create the same spot once the
		// origin vanishes. Only a stack after another (surviving) track
		// highlights. Applies to direct hover too.
		const emptied = draggingEmptiesTrackIndex(border)
		if (emptied !== undefined && (stackIndex === emptied || stackIndex === emptied + 1))
			return false
		// Modal-mask hover (driven by `Ide`): show the single most-inner DZ —
		// the stack end closest to the center (`border.length` in every
		// region: bottom-most of top, top-most of bottom, right-most of left,
		// left-most of right — `inverse` borders render that stack first).
		if (maskActive) return stackIndex === border.length
		if (hoveredStack !== undefined) return stackIndex === hoveredStack
		if (activeTrack === undefined) return false
		return stackIndex === activeTrack || stackIndex === activeTrack + 1
	}

	function isStackHovered(stackIndex: number): boolean {
		if (!palette.editing || !isDragging) return false
		return hoveredStack === stackIndex
	}

	$effect(() => {
		if (!palette.editing || !isDragging) {
			activeTrack = undefined
			hoveredStack = undefined
			clearStackTimer()
			committedStack = undefined
		}
	})

	// One-shot hover-dwell arming. Keyed on the direct-hover stack plus the
	// drag/mask state: retargeting to another DZ restarts the timer (the
	// cleanup clears the previous one), leaving the DZ or ending the drag
	// cancels it. The fire re-checks the hover is still on the arming DZ
	// before committing.
	$effect(() => {
		const stack = hoveredStack
		const dragging = isDragging
		const editing = palette.editing
		const masked = maskActive
		if (
			!editing ||
			!dragging ||
			masked ||
			stack === undefined ||
			committedStack === stack ||
			!isStackHighlighted(stack)
		) {
			clearStackTimer()
			// Leaving the DZ resets the one-shot latch so a fresh hover
			// arms again — including returning to the just-committed DZ.
			if (stack === undefined) committedStack = undefined
			return
		}
		// Retargeting to another DZ is a fresh hover: drop the latch for
		// the previously committed stack so returning to it can arm again.
		if (committedStack !== undefined) committedStack = undefined
		clearStackTimer()
		const targetBorder = border
		const targetStack = stack
		const targetDirection = direction
		hoverTimer = setTimeout(() => {
			void (async () => {
				hoverTimer = undefined
				committedStack = targetStack
				// Backstop: a stack change normally cancels this via the
				// cleanup first — only commit while the pointer is still on
				// the arming DZ with a live drag.
				if (hoveredStack !== targetStack) return
				if (palettes.dragging?.palette !== palette) return
				if (!palette.editing) return
				const pointer = lastDragPointer()
				const committed = commitDraggedToStackSpace(targetBorder, targetStack)
				if (!committed) return
				// The commit promotes a restructure into a slide over the fresh
				// toolbar — arm slide-follow once the new track has flushed so
				// the toolbar sticks under the cursor and moves along the track
				// gaps. `recenter` grabs the fresh toolbar by its middle when
				// the drag has no mousedown grab delta yet; a whole-toolbar
				// slide keeps its grab delta (no recenter). The track's
				// declarative `$effect` takes over from there.
				await tick()
				if (hoveredStack !== targetStack) return
				if (palettes.dragging?.palette !== palette) return
				const dragging = palettes.dragging
				if (dragging?.origin.kind !== 'border') return
				const placed = dragging.origin.track
				const placedToolbar = dragging.origin.toolbar
				const slot = placed.findIndex((entry) => entry.toolbar === placedToolbar)
				if (slot < 0) return
				const element = document.querySelector(
					`[data-palette-id="${palette.id}"][data-region="${region}"] [data-track-index="${dragging.origin.border.indexOf(placed)}"] [data-toolbar-slot-index="${slot}"] .toolbar`
				)
				if (!(element instanceof HTMLElement)) return
				retargetToolbarSlide({
					track: placed,
					toolbar: placedToolbar,
					toolbarElement: element,
					direction: targetDirection,
					clientX: pointer.x,
					clientY: pointer.y,
					recenter: dragging.grabOffset === undefined
				})
			})()
		}, configuration.stackDzHoverMs)
		return () => {
			clearStackTimer()
		}
	})
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
	onpointermove={onBorderPointerMove}
	onpointerleave={onBorderPointerLeave}
>
	{#if !inverse}
		<div
			{...space}
			class={[
				'toolbar-stack-space toolbar-drop-zone',
				isStackHighlighted(0) ? 'highlighted' : undefined,
				isStackHovered(0) ? 'hovered' : undefined,
				space?.class
			]}
			data-palette-id={palette.id}
			data-stack-index={0}
		></div>
	{/if}
	{#each ordered as trackItem, position (trackItem)}
		{@const trackIndex = inverse ? border.length - 1 - position : position}
		{#if inverse}
			<div
				{...space}
				class={[
					'toolbar-stack-space toolbar-drop-zone',
					isStackHighlighted(trackIndex + 1) ? 'highlighted' : undefined,
					isStackHovered(trackIndex + 1) ? 'hovered' : undefined,
					space?.class
				]}
				data-palette-id={palette.id}
				data-stack-index={trackIndex + 1}
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
				class={[
					'toolbar-stack-space toolbar-drop-zone',
					isStackHighlighted(trackIndex + 1) ? 'highlighted' : undefined,
					isStackHovered(trackIndex + 1) ? 'hovered' : undefined,
					space?.class
				]}
				data-palette-id={palette.id}
				data-stack-index={trackIndex + 1}
			></div>
		{/if}
	{/each}
	{#if inverse}
		<div
			{...space}
			class={[
				'toolbar-stack-space toolbar-drop-zone',
				isStackHighlighted(0) ? 'highlighted' : undefined,
				isStackHovered(0) ? 'hovered' : undefined,
				space?.class
			]}
			data-palette-id={palette.id}
			data-stack-index={0}
		></div>
	{/if}
</div>
