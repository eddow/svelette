<script lang="ts">
	import type { Component } from 'svelte'
	import type { SvelteHTMLElements } from 'svelte/elements'
	import {
		paletteItemDrag,
		paletteItemShield,
		paletteToolbarDrag,
		paletteToolbarSpace
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

	const draggingToolbar = $derived(
		palettes.dragging?.palette === palette ? palettes.dragging.toolbar : undefined
	)

	// Editors read `palette` + `region` off the scope; stamp `region` here so
	// left/right borders derive the vertical surface axis correctly.
	const editorScope = $derived<PaletteScope>(region !== undefined ? { ...scope, region } : scope)

	// Resolve defensively: an item without a matching editor (or an unknown
	// tool) renders nothing instead of throwing during render. The `as unknown`
	// casts collapse the editor generic parameters at the render boundary.
	function resolveItem(item: PaletteToolbarItem): {
		Editor: Component<{ context: PaletteEditorContext }> | undefined
		context: PaletteEditorContext | undefined
	} {
		try {
			const tool = hasPaletteItemTool(item) ? palette.tool(item.tool) : undefined
			if (tool === undefined) return { Editor: undefined, context: undefined }
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

	function isInactiveSpace(index: number): boolean {
		const dragging = palettes.dragging?.palette === palette ? palettes.dragging : undefined
		if (!dragging) return false
		if (toolbar === dragging.toolbar) return true
		const preview = dragging.toolbarPreview
		if (!preview || toolbar !== preview.toolbar) return false
		return index >= preview.index && index <= preview.index + preview.count
	}

	function spaceTarget(index: number) {
		return isInactiveSpace(index) ? undefined : { direction, index, palette, toolbar }
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
	const dragging = $derived(draggingToolbar === toolbar)
</script>

<div
	{...el}
	class={['toolbar', el?.class]}
	data-palette-id={palette.id}
	data-editing={editing ? 'true' : undefined}
	data-dragging={dragging ? 'true' : undefined}
	use:paletteToolbarDrag={dragTarget()}
>
	<div
		class={['toolbar-item-space toolbar-drop-zone', isInactiveSpace(0) ? 'inactive' : undefined]
			.filter(Boolean)
			.join(' ')}
		data-inactive={isInactiveSpace(0) ? 'true' : undefined}
		use:paletteToolbarSpace={spaceTarget(0)}
	></div>
	{#each toolbar as item, index (item)}
		{@const resolved = resolveItem(item)}
		<div class="toolbar-item">
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
						itemIndex: index,
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
				isInactiveSpace(index + 1) ? 'inactive' : undefined
			]
				.filter(Boolean)
				.join(' ')}
			data-inactive={isInactiveSpace(index + 1) ? 'true' : undefined}
			use:paletteToolbarSpace={spaceTarget(index + 1)}
		></div>
	{/each}
</div>
