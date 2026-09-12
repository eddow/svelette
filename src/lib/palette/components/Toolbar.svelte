<script lang="ts">
	import type { Component } from 'svelte'
	import type { SvelteHTMLElements } from 'svelte/elements'
	import {
		commitDraggedToItemSpace,
		isItemSpaceFree,
		nearestFreeItemSpaceAfter,
		nearestFreeItemSpaceBefore,
		paletteItemDrag,
		paletteItemShield,
		paletteToolbarDrag
	} from '../layout.svelte'
	import { hasPaletteItemTool, type Palette as PaletteRuntime, palettes } from '../palette.svelte'
	import type {
		PaletteBorder,
		PaletteEditorContext,
		PaletteRegion,
		PaletteScope,
		PaletteToolbar,
		PaletteToolbarItem,
		PaletteTrack
	} from '../types'
	import PaletteItem from './PaletteItem.svelte'

	type Props = {
		toolbar: PaletteToolbar
		direction: 'horizontal' | 'vertical'
		palette: PaletteRuntime
		scope: PaletteScope
		border?: PaletteBorder
		region?: PaletteRegion
		track?: PaletteTrack
		trackIndex?: number
		el?: SvelteHTMLElements['div']
	}

	let { toolbar, direction, palette, scope, border, region, track, trackIndex, el }: Props =
		$props()

	// Editors read `palette` + `region` off the scope; stamp `region` here so
	// left/right borders derive the vertical surface axis correctly.
	const editorScope = $derived<PaletteScope>(region !== undefined ? { ...scope, region } : scope)

	// Resolve defensively: an item without a matching editor (or an unknown
	// tool) renders nothing instead of throwing during render. Editor-only
	// items (drawer, commandBox) carry no tool — they still resolve through
	// the `item` registry, so only bail when a tool-backed lookup fails. The
	// `as unknown` casts collapse the editor generic parameters at the render
	// boundary.
	function resolveItem(item: PaletteToolbarItem): {
		Editor: Component<{ context: PaletteEditorContext }> | undefined
		context: PaletteEditorContext | undefined
	} {
		try {
			const tool = hasPaletteItemTool(item) ? palette.tool(item.tool) : undefined
			return {
				Editor: palette.renderEditor(item, tool, editorScope) as unknown as Component<{
					context: PaletteEditorContext
				}>,
				context: palette.resolveEditorContext(
					item,
					tool,
					editorScope
				) as unknown as PaletteEditorContext
			}
		} catch {
			return { Editor: undefined, context: undefined }
		}
	}

	function dragTarget() {
		return border !== undefined &&
			region !== undefined &&
			track !== undefined &&
			trackIndex !== undefined
			? { border, direction, palette, region, toolbar, track, trackIndex }
			: undefined
	}

	function shieldActive(): boolean {
		return (
			border !== undefined &&
			region !== undefined &&
			track !== undefined &&
			trackIndex !== undefined &&
			palette.editing
		)
	}

	const editing = $derived(palette.editing)
	const inspecting = $derived(
		palettes.inspecting?.palette === palette ? palettes.inspecting : undefined
	)
	function isInspecting(item: PaletteToolbarItem): boolean {
		return inspecting?.item === item
	}

	// Perpendicular DZs inside a toolbar: the "half-tool" separators between
	// tools (0.5, 1.5, …) plus the extremes before/after all tools. A DZ that
	// touches a dragged tool can never be selected: hovering a tool highlights
	// the nearest free separator scanning back past dragged tools, and the
	// nearest free one scanning forward (e.g. ABC with B dragged → hovering
	// A, B or C highlights before-A and after-C). When no free separator
	// exists on a side, the fallback is the gap-between-toolbars, which the
	// parent track highlights like a gap-between-tools.
	let hoveredItemSpace = $state<number | undefined>(undefined)
	let activeItem = $state<number | undefined>(undefined)

	// Reactive read so highlight recomputes when the drag selection changes.
	const draggingTools = $derived(palettes.dragging?.tools)
	const isDragging = $derived(palettes.dragging?.palette === palette)
	// The dragged toolbar keeps its handles exposed (padding) for the whole
	// session: `:hover` drops on grab (pointer capture retargets), so without
	// this the toolbar would collapse the moment the drag starts. Identity on
	// the session's origin — the same test for a whole-toolbar grab and for a
	// tool set promoted into its own toolbar.
	const isDraggedToolbar = $derived(
		editing && isDragging && palettes.dragging?.origin.toolbar === toolbar
	)

	function isSpaceFree(index: number): boolean {
		void draggingTools
		return isItemSpaceFree(toolbar, index)
	}

	function onToolbarPointerMove(event: PointerEvent): void {
		if (!palette.editing || !isDragging) {
			hoveredItemSpace = undefined
			activeItem = undefined
			return
		}
		const target = event.target
		if (!(target instanceof HTMLElement)) return
		const spaceEl = target.closest('[data-item-space-index]')
		if (
			spaceEl &&
			event.currentTarget instanceof HTMLElement &&
			event.currentTarget.contains(spaceEl)
		) {
			const index = Number(spaceEl.getAttribute('data-item-space-index'))
			const prev = hoveredItemSpace
			hoveredItemSpace = Number.isInteger(index) ? index : undefined
			activeItem = undefined
			// Commit on DZ hover: move dragged tools into this toolbar at this
			// position. The origin is pruned if emptied. Svelte re-renders the
			// DOM after this handler returns, so highlighting recomputes from
			// the updated toolbar state.
			if (
				hoveredItemSpace !== undefined &&
				hoveredItemSpace !== prev &&
				isSpaceFree(hoveredItemSpace) &&
				track &&
				border
			) {
				commitDraggedToItemSpace(toolbar, track, border, hoveredItemSpace)
			}
			return
		}
		hoveredItemSpace = undefined
		const itemEl = target.closest('[data-item-index]')
		if (
			!itemEl ||
			!(event.currentTarget instanceof HTMLElement) ||
			!event.currentTarget.contains(itemEl)
		) {
			activeItem = undefined
			return
		}
		const index = Number(itemEl.getAttribute('data-item-index'))
		activeItem = Number.isInteger(index) ? index : undefined
	}

	function onToolbarPointerLeave(): void {
		hoveredItemSpace = undefined
		activeItem = undefined
	}

	function isItemSpaceHighlighted(index: number): boolean {
		if (!palette.editing || !isDragging) return false
		// Touching a dragged tool → never selectable.
		if (!isSpaceFree(index)) return false
		if (hoveredItemSpace !== undefined) return index === hoveredItemSpace
		if (activeItem === undefined) return false
		// Nearest free DZ scanning back past dragged tools, and nearest free
		// one scanning forward (both extremes when the middle is dragged).
		const before = nearestFreeItemSpaceBefore(toolbar, activeItem)
		const after = nearestFreeItemSpaceAfter(toolbar, activeItem + 1)
		return index === before || index === after
	}

	$effect(() => {
		if (!palette.editing || !isDragging) {
			hoveredItemSpace = undefined
			activeItem = undefined
		}
	})
</script>

<div
	{...el}
	class={['toolbar', el?.class]}
	data-palette-id={palette.id}
	data-editing={editing ? 'true' : undefined}
	data-dragged={isDraggedToolbar ? 'true' : undefined}
	use:paletteToolbarDrag={dragTarget()}
	onpointermove={onToolbarPointerMove}
	onpointerleave={onToolbarPointerLeave}
>
	<div
		class={[
			'toolbar-item-space toolbar-drop-zone',
			isItemSpaceHighlighted(0) ? 'highlighted' : undefined
		]}
		data-palette-id={palette.id}
		data-item-space-index={0}
	></div>
	{#each toolbar as item, index (item)}
		{@const resolved = resolveItem(item)}
		<div
			class="toolbar-item"
			data-item-index={index}
			data-tool={'tool' in item ? (item.tool ?? undefined) : undefined}
			data-editor={'editor' in item ? (item.editor ?? undefined) : undefined}
			data-inspected={isInspecting(item) ? 'true' : undefined}
		>
			<div class="toolbar-item-content" use:paletteItemShield={shieldActive()}>
				{#if resolved.Editor && resolved.context}
					<PaletteItem Editor={resolved.Editor} context={resolved.context} />
				{/if}
			</div>
			{#if border !== undefined && region !== undefined && track !== undefined && trackIndex !== undefined && editing}
				<div
					class="toolbar-item-guard"
					data-palette-id={palette.id}
					aria-hidden="true"
					use:paletteItemDrag={{
						border,
						direction,
						item,
						palette,
						region,
						toolbar,
						track,
						trackIndex
					}}
				></div>
			{/if}
		</div>
		<div
			class={[
				'toolbar-item-space toolbar-drop-zone',
				isItemSpaceHighlighted(index + 1) ? 'highlighted' : undefined
			]}
			data-palette-id={palette.id}
			data-item-space-index={index + 1}
		></div>
	{/each}
</div>
