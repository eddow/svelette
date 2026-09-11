/**
 * Headless palette layout engine: track spacing, toolbar insert/remove, and
 * Svelte actions for the layout components.
 *
 * Movement (drag & drop, hit-testing, preview) was stripped for a restart
 * from scratch. This module keeps only the pure layout primitives plus
 * passive action stubs (space/drag actions register nothing; `paletteItemDrag`
 * only inspects on pointerdown). The next movement design will be built on
 * top of these primitives.
 */

import type { Action } from 'svelte/action'
import { startPaletteDragSession } from './drag-session'
import { isEditableTool, isRunTool, PaletteError, palettes } from './palette.svelte'
import type {
	Palette,
	PaletteBorder,
	PaletteRegion,
	PaletteToolbar,
	PaletteToolbarItem,
	PaletteTrack,
} from './types'

/** Orientation of a toolbar's item axis. */
export type PaletteOrientation = 'horizontal' | 'vertical'

export type PaletteTrackSpace = {
	border: PaletteBorder
	direction: PaletteOrientation
	index: number
	palette: Palette
	region: PaletteRegion
	track: PaletteTrack
	trackIndex: number
}

export type PaletteItemDragTarget = {
	border: PaletteBorder
	direction: PaletteOrientation
	item: PaletteToolbarItem
	itemIndex: number
	palette: Palette
	region: PaletteRegion
	toolbar: PaletteToolbar
	track: PaletteTrack
	trackIndex: number
}

export type PaletteStackSpace = {
	border: PaletteBorder
	direction: PaletteOrientation
	index: number
	palette: Palette
	region: PaletteRegion
}

export type PaletteToolbarSpace = {
	direction: PaletteOrientation
	index: number
	palette: Palette
	toolbar: PaletteToolbar
}

export type PaletteToolbarDrag = {
	border: PaletteBorder
	direction: PaletteOrientation
	palette: Palette
	region: PaletteRegion
	toolbar: PaletteToolbar
	track: PaletteTrack
	trackIndex: number
}

export function clampUnit(value: number): number {
	return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

export function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false
	if (target.isContentEditable) return true
	if (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	)
		return true
	return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function regionDirection(region: PaletteRegion): PaletteOrientation {
	return region === 'left' || region === 'right' ? 'vertical' : 'horizontal'
}

export function actualTrackSpaceAt(track: PaletteTrack, index: number): number {
	return index < track.length
		? clampUnit(track[index].space)
		: index === track.length
			? clampUnit(track.reduce((remaining, slot) => remaining - slot.space, 1))
			: 0
}

function actualTrackSpaces(track: PaletteTrack): number[] {
	const spaces = track.map((slot) => clampUnit(slot.space))
	const trailing = clampUnit(1 - spaces.reduce((sum, space) => sum + space, 0))
	return [...spaces, trailing]
}

function applyTrackSpaces(track: PaletteTrack, spaces: readonly number[]): void {
	for (let index = 0; index < track.length; index += 1)
		track[index].space = clampUnit(spaces[index] ?? 0)
}

/**
 * Removes a toolbar from a track and merges its surrounding spacing into a single gap.
 *
 * @returns The removed toolbar slot index, or `-1` when the toolbar is not in the track.
 */
export function removeToolbar(track: PaletteTrack, toolbar: PaletteToolbar): number {
	const index = track.findIndex((slot) => slot.toolbar === toolbar)
	if (index < 0) return -1
	const spaces = actualTrackSpaces(track)
	const merged = (spaces[index] ?? 0) + (spaces[index + 1] ?? 0)
	spaces.splice(index, 2, merged)
	track.splice(index, 1)
	applyTrackSpaces(track, spaces)
	return index
}

/**
 * Removes a track from a border when it no longer contains any toolbars.
 */
export function removeEmptyTrack(border: PaletteBorder, track: PaletteTrack): void {
	if (track.length > 0) return
	const trackIndex = border.indexOf(track)
	if (trackIndex < 0) return
	border.splice(trackIndex, 1)
}

/**
 * Headless item removal (G2, D2 item-level / D3 lives in layout).
 *
 * Removes `item` from `toolbar` by identity, then prunes the emptied toolbar
 * (and its track, when that empties too) via `removeToolbar`/`removeEmptyTrack`.
 * This is the single mutation behind both deletion paths: the editor edit
 * surface's delete button and parking's `×` button.
 *
 * @returns `true` when the item was present and removed.
 */
export function removePaletteItem(
	item: PaletteToolbarItem,
	toolbar: PaletteToolbar,
	track: PaletteTrack,
	border: PaletteBorder
): boolean {
	const index = toolbar.indexOf(item)
	if (index < 0) return false
	toolbar.splice(index, 1)
	if (toolbar.length === 0) {
		removeToolbar(track, toolbar)
		removeEmptyTrack(border, track)
	}
	return true
}

/**
 * Inserts a new single-toolbar track into a border at a clamped index.
 */
export function insertTrackWithToolbar(
	border: PaletteBorder,
	index: number,
	toolbar: PaletteToolbar
): { track: PaletteTrack; trackIndex: number } {
	const trackIndex = Math.min(Math.max(index, 0), border.length)
	const track: PaletteTrack = [{ space: 0, toolbar }]
	border.splice(trackIndex, 0, track)
	return { track, trackIndex }
}

/**
 * Inserts a toolbar into an existing track and splits the target gap according to `split`.
 */
export function insertToolbar(
	track: PaletteTrack,
	index: number,
	toolbar: PaletteToolbar,
	split: number
): void {
	const insertionIndex = Math.min(Math.max(index, 0), track.length)
	const spaces = actualTrackSpaces(track)
	const merged = spaces[insertionIndex] ?? 0
	const before = merged * clampUnit(split)
	const after = merged - before
	spaces.splice(insertionIndex, 1, before, after)
	track.splice(insertionIndex, 0, { space: 0, toolbar })
	applyTrackSpaces(track, spaces)
}

/**
 * Rebalances the spaces around an existing toolbar within a track.
 */
export function resizeToolbar(track: PaletteTrack, index: number, split: number): void {
	if (index < 0 || index >= track.length) return
	const spaces = actualTrackSpaces(track)
	const merged = (spaces[index] ?? 0) + (spaces[index + 1] ?? 0)
	const before = merged * clampUnit(split)
	const after = merged - before
	spaces.splice(index, 2, before, after)
	applyTrackSpaces(track, spaces)
}

// ── Svelte actions ──

function setPaletteRootClass(
	element: HTMLElement | null | undefined,
	name: string,
	enabled: boolean
): void {
	if (!element) return
	element.classList.toggle(name, enabled)
}

function setPaletteRootData(
	element: HTMLElement | null | undefined,
	name: string,
	enabled: boolean
): void {
	if (!element) return
	if (enabled) element.dataset[name] = 'true'
	else delete element.dataset[name]
}

function setPaletteRootId(element: HTMLElement | null | undefined, palette: Palette): void {
	if (!element) return
	element.dataset.paletteId = palette.id
}

/**
 * Palette root: keyboard shortcuts + editing highlight.
 *
 * Movement was stripped for a restart from scratch: this action no longer
 * tracks dragging state or catalogue drops. `paletteItemDrag` only inspects.
 */
export function paletteRoot(element: HTMLElement, palette: Palette): ReturnType<Action> {
	if (!element.hasAttribute('tabindex')) {
		element.tabIndex = 0
	}
	setPaletteRootId(element, palette)
	$effect(() => {
		const editing = palette.editing
		setPaletteRootClass(element, 'palette-editing', editing)
		setPaletteRootClass(element, 'editing', editing)
		setPaletteRootData(element, 'editing', editing)
		if (!editing && palettes.inspecting?.palette === palette) delete palettes.inspecting
	})
	$effect(() => {
		const dragging = palettes.dragging?.palette === palette
		setPaletteRootClass(element, 'palette-dragging', dragging)
		setPaletteRootClass(element, 'dragging', dragging)
		setPaletteRootData(element, 'dragging', dragging)
	})

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.defaultPrevented) return
		if (isEditableTarget(event.target)) return
		// While editing, tool key bindings are suppressed so the keys are free to
		// be re-bound (press-to-rebind for shortcuts). This mirrors the pointer
		// side, where the `inert` shield already blocks run/toggle/check clicks
		// in edit mode (`paletteItemShield`).
		if (palette.editing) return
		const toolId = palette.keys.resolve(event)
		if (!toolId) return
		event.preventDefault()
		event.stopPropagation()
		const tool = palette.tool(toolId)
		if (isRunTool(tool)) {
			if (tool.can) tool.run()
		} else if (isEditableTool(tool) && tool.type === 'boolean') tool.value = !tool.value
		else throw new PaletteError(`Palette binding "${toolId}" did not resolve to a runnable tool`)
	}

	element.addEventListener('keydown', onKeyDown)
	return {
		destroy() {
			element.removeEventListener('keydown', onKeyDown)
		},
	}
}

/**
 * Check whether a toolbar item is part of the simulated drag selection.
 */
export function isDraggingTool(item: PaletteToolbarItem): boolean {
	const dragging = palettes.dragging
	if (!dragging) return false
	return dragging.tools.includes(item)
}

/**
 * Check whether an item-space index is free: neither neighbouring tool (if
 * any) is part of the simulated drag selection. Space `index` sits between
 * `toolbar[index - 1]` and `toolbar[index]`.
 */
export function isItemSpaceFree(toolbar: PaletteToolbar, index: number): boolean {
	const before = toolbar[index - 1]
	const after = toolbar[index]
	if (before !== undefined && isDraggingTool(before)) return false
	if (after !== undefined && isDraggingTool(after)) return false
	return true
}

/**
 * Nearest free item-space at or before `from`. Scans `from` down to `0`;
 * returns `undefined` when every candidate touches a dragged tool (caller
 * falls back to the gap-between-toolbars).
 */
export function nearestFreeItemSpaceBefore(
	toolbar: PaletteToolbar,
	from: number
): number | undefined {
	const start = Math.min(from, toolbar.length)
	for (let index = start; index >= 0; index -= 1) {
		if (isItemSpaceFree(toolbar, index)) return index
	}
	return undefined
}

/**
 * Nearest free item-space at or after `from`. Scans `from` up to
 * `toolbar.length`; returns `undefined` when every candidate touches a
 * dragged tool (caller falls back to the gap-between-toolbars).
 */
export function nearestFreeItemSpaceAfter(
	toolbar: PaletteToolbar,
	from: number
): number | undefined {
	const start = Math.max(from, 0)
	for (let index = start; index <= toolbar.length; index += 1) {
		if (isItemSpaceFree(toolbar, index)) return index
	}
	return undefined
}

/**
 * Check whether the simulated drag selection covers a whole toolbar.
 */
export function isDraggingWholeToolbar(toolbar: PaletteToolbar): boolean {
	const dragging = palettes.dragging
	if (!dragging || dragging.tools.length === 0) return false
	if (dragging.tools.length !== toolbar.length) return false
	return dragging.tools.every((tool) => toolbar.includes(tool))
}

/**
 * Index of the track the drag would empty: the track holding a single toolbar
 * whose whole content is dragged (`dragged[0]`'s toolbar size = dragged size
 * and its track size = 1). Returns `undefined` when no such track exists in
 * `border` (partial drag, multi-toolbar track, or another border/region).
 */
export function draggingEmptiesTrackIndex(border: PaletteBorder): number | undefined {
	const dragging = palettes.dragging
	if (!dragging || dragging.tools.length === 0) return undefined
	for (let index = 0; index < border.length; index += 1) {
		const track = border[index]
		if (track.length !== 1) continue
		const sole = track[0]
		if (sole && isDraggingWholeToolbar(sole.toolbar)) return index
	}
	return undefined
}

/**
 * Pixel bounds for sliding a toolbar along its track. Toolbars have fixed
 * pixel widths, so the slide must be computed in pixels — a fraction-of-track
 * model drifts because the gaps absorb the toolbar widths (see
 * `plans/movement.md`). The toolbar's `.toolbar-track-slot` parent sits
 * between the leading gap (`space[slot]`) and trailing gap (`space[slot + 1]`)
 * elements; their edges are fixed during the slide, so the free span is the
 * trailing-gap end minus the leading-gap start minus the toolbar span.
 */
function toolbarSlideBounds(
	toolbarElement: HTMLElement,
	direction: PaletteOrientation
): { start: number; available: number } | undefined {
	const slot = toolbarElement.parentElement
	const before = slot?.previousElementSibling
	const after = slot?.nextElementSibling
	if (!(before instanceof HTMLElement) || !(after instanceof HTMLElement)) return undefined
	const horizontal = direction === 'horizontal'
	const start = horizontal
		? before.getBoundingClientRect().left
		: before.getBoundingClientRect().top
	const end = horizontal
		? after.getBoundingClientRect().right
		: after.getBoundingClientRect().bottom
	const rect = toolbarElement.getBoundingClientRect()
	const available = end - start - (horizontal ? rect.width : rect.height)
	return available > 0 ? { start, available } : undefined
}

/**
 * Grab offset of the cursor *within* the toolbar, in pixels. Captured once on
 * mousedown; `slideToolbarInTrack` keeps it fixed so the cursor stays at the
 * same point on the toolbar (natural grab).
 */
export function toolbarGrabOffset(options: {
	toolbarElement: HTMLElement
	clientX: number
	clientY: number
	direction: PaletteOrientation
}): number {
	const rect = options.toolbarElement.getBoundingClientRect()
	const horizontal = options.direction === 'horizontal'
	return (horizontal ? options.clientX : options.clientY) - (horizontal ? rect.left : rect.top)
}

/**
 * Slide a whole toolbar along its track so it follows the pointer.
 *
 * Only valid when the drag selection covers the whole toolbar
 * (`isDraggingWholeToolbar`). The cursor keeps its pixel grab offset on the
 * toolbar; the leading gap is clipped to the free span between the surrounding
 * gap elements, so `space[slot] + space[slot + 1]` stays constant and the
 * neighbours never move (see `plans/movement.md` "Toolbar slide"). The
 * implicit trailing gap is folded in by `resizeToolbar` when `slot` is the
 * last toolbar.
 */
export function slideToolbarInTrack(options: {
	track: PaletteTrack
	toolbar: PaletteToolbar
	toolbarElement: HTMLElement
	clientX: number
	clientY: number
	direction: PaletteOrientation
	grabOffset: number
}): void {
	const { track, toolbar, toolbarElement, clientX, clientY, direction, grabOffset } = options
	if (!isDraggingWholeToolbar(toolbar)) return
	const bounds = toolbarSlideBounds(toolbarElement, direction)
	if (!bounds) return
	const slot = track.findIndex((entry) => entry.toolbar === toolbar)
	if (slot < 0) return
	const horizontal = direction === 'horizontal'
	const offset = (horizontal ? clientX : clientY) - grabOffset - bounds.start
	resizeToolbar(track, slot, Math.min(Math.max(offset, 0), bounds.available) / bounds.available)
}

/**
 * Start a simulated drag session: `dragging` is set to the tool list and the
 * pointer is captured (no user interaction needed); on pointer-up (or
 * cancel/blur/hidden) `dragging` clears. The `dragging` class on the IDE root
 * follows via the `paletteRoot` mirror. When a whole toolbar is dragged, the
 * toolbar follows the pointer via `transform` (gaps untouched) and a single
 * `resizeToolbar` commit lands on release (see `slideToolbarInTrack`).
 *
 * Whole-toolbar slide state is measured once at grab time. During the drag
 * the gaps are never resized — the toolbar only follows the pointer via
 * `element.style.transform = translate3d(...)`; a single `resizeToolbar`
 * commit lands on release. Bounds must be measured once: after the transform
 * applies, `getBoundingClientRect()` includes the visual offset, so
 * re-measuring mid-drag would drift.
 */
function startSimulatedDrag(options: {
	event: PointerEvent
	palette: Palette
	tools: PaletteToolbarItem[]
	label: string
	track?: PaletteTrack
	toolbar?: PaletteToolbar
	toolbarElement?: HTMLElement
	direction?: PaletteOrientation
	grabOffset?: number
}): void {
	const { event, palette, tools, label } = options
	palettes.dragging = { palette, tools }
	console.log('[palette dragging]', label)
	const slide =
		options.track &&
		options.toolbar &&
		options.toolbarElement &&
		options.direction &&
		isDraggingWholeToolbar(options.toolbar)
			? (() => {
					const bounds = toolbarSlideBounds(options.toolbarElement!, options.direction!)
					const slot = options.track!.findIndex((entry) => entry.toolbar === options.toolbar)
					if (!bounds || slot < 0) return undefined
					const axis = options.direction === 'horizontal' ? event.clientX : event.clientY
					const offset0 = Math.min(
						Math.max(axis - (options.grabOffset ?? 0) - bounds.start, 0),
						bounds.available
					)
					return { bounds, slot, offset0 }
				})()
			: undefined
	// Batch the latest pointer coordinate to one transform per frame: capture
	// raw coordinates immediately on move, perform the compositor-only write
	// right before paint. Rapid pointermove bursts never queue multiple
	// read→write→layout cycles per frame.
	let latestX = event.clientX
	let latestY = event.clientY
	let ticking = false
	let frame = 0
	function flushTransform(): void {
		frame = 0
		ticking = false
		if (!slide || !options.toolbarElement || !options.direction) return
		const horizontal = options.direction === 'horizontal'
		const pointer = horizontal ? latestX : latestY
		const clamped = Math.min(
			Math.max(pointer - (options.grabOffset ?? 0) - slide.bounds.start, 0),
			slide.bounds.available
		)
		const delta = clamped - slide.offset0
		options.toolbarElement.style.transform =
			delta === 0
				? ''
				: horizontal
					? `translate3d(${delta}px, 0, 0)`
					: `translate3d(0, ${delta}px, 0)`
	}
	startPaletteDragSession({
		event,
		onMove: (_snapshot, moveEvent) => {
			latestX = moveEvent.clientX
			latestY = moveEvent.clientY
			if (!slide) return
			if (!ticking) {
				ticking = true
				if (typeof requestAnimationFrame === 'undefined') {
					flushTransform()
					return
				}
				frame = requestAnimationFrame(flushTransform)
			}
		},
		onStop: ({ reason }) => {
			if (frame !== 0 && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(frame)
			frame = 0
			ticking = false
			// Single commit on release: resize the gaps once, then clear the
			// visual transform so layout takes over at the committed position.
			if (slide && options.track && options.toolbarElement && options.direction) {
				const horizontal = options.direction === 'horizontal'
				const pointer = horizontal ? latestX : latestY
				const clamped = Math.min(
					Math.max(pointer - (options.grabOffset ?? 0) - slide.bounds.start, 0),
					slide.bounds.available
				)
				resizeToolbar(options.track, slide.slot, clamped / slide.bounds.available)
				options.toolbarElement.style.transform = ''
			}
			if (palettes.dragging?.palette === palette) palettes.dragging = undefined
			console.log('[palette dragging] stop:', reason)
		},
	})
}

/**
 * Passive drop-zone placeholder.
 *
 * Movement was stripped: space actions register nothing and clean up only
 * their highlight flags. They stay mounted so layout markup does not churn
 * while the next movement design lands.
 */
function palettePassiveSpace(element: HTMLElement): ReturnType<Action> {
	return {
		destroy() {
			delete element.dataset.active
			delete element.dataset.proximity
		},
	}
}

export function paletteTrackSpace(
	_element: HTMLElement,
	target: PaletteTrackSpace | undefined
): ReturnType<Action> {
	if (!target?.palette) return
	return palettePassiveSpace(_element)
}

export function paletteStackSpace(
	_element: HTMLElement,
	target: PaletteStackSpace | undefined
): ReturnType<Action> {
	if (!target?.palette) return
	return palettePassiveSpace(_element)
}

export function paletteToolbarSpace(
	_element: HTMLElement,
	target: PaletteToolbarSpace | undefined
): ReturnType<Action> {
	if (!target?.palette) return
	return palettePassiveSpace(_element)
}

export function paletteToolbarDrag(
	element: HTMLElement,
	target: PaletteToolbarDrag | undefined
): ReturnType<Action> {
	let current = target
	if (!current) return
	const onPointerDown = (event: PointerEvent) => {
		const live = current
		if (!live?.palette) return
		if (!live.palette.editing) return
		if (event.button !== 0) return
		if (isEditableTarget(event.target)) return
		// Whole-toolbar drag: mousedown on the toolbar (not on a tool)
		// selects its whole content; the toolbar then slides along its track
		// following the pointer until mouse-up clears `dragging`.
		if ((event.target as HTMLElement | null)?.closest?.('.toolbar-item')) return
		event.preventDefault()
		startSimulatedDrag({
			event,
			palette: live.palette,
			tools: [...live.toolbar],
			label: `toolbar: ${live.toolbar
				.map((item) => ('tool' in item && typeof item.tool === 'string' ? item.tool : item.editor))
				.join(', ')}`,
			track: live.track,
			toolbar: live.toolbar,
			toolbarElement: element,
			direction: live.direction,
			grabOffset: toolbarGrabOffset({
				toolbarElement: element,
				clientX: event.clientX,
				clientY: event.clientY,
				direction: live.direction,
			}),
		})
	}
	element.addEventListener('pointerdown', onPointerDown)
	return {
		update(next: PaletteToolbarDrag | undefined) {
			current = next
		},
		destroy() {
			element.removeEventListener('pointerdown', onPointerDown)
		},
	}
}

export function paletteItemDrag(
	element: HTMLElement,
	target: PaletteItemDragTarget | undefined
): ReturnType<Action> {
	let current = target
	if (!current) return
	const onPointerDown = (event: PointerEvent) => {
		const live = current
		if (!live) return
		if (!live.palette.editing) return
		if (event.button !== 0) return
		event.stopPropagation()
		palettes.inspecting = {
			item: live.item,
			palette: live.palette,
			region: live.region,
			toolbar: live.toolbar,
			track: live.track,
			border: live.border,
			trackIndex: live.trackIndex,
		}
		// Simulated drag: mousedown on a tool selects that single tool;
		// pointer capture holds until mouse-up, which clears `dragging`.
		// Nothing moves yet.
		startSimulatedDrag({
			event,
			palette: live.palette,
			tools: [live.item],
			label: `tool: ${'tool' in live.item && typeof live.item.tool === 'string' ? live.item.tool : live.item.editor}`,
		})
	}

	element.addEventListener('pointerdown', onPointerDown)
	return {
		update(next: PaletteItemDragTarget | undefined) {
			current = next
		},
		destroy() {
			element.removeEventListener('pointerdown', onPointerDown)
		},
	}
}

export function paletteItemShield(
	element: HTMLElement,
	active: boolean
): { update(next: boolean): void; destroy(): void } {
	element.inert = active
	return {
		update(next: boolean) {
			element.inert = next
		},
		destroy() {
			element.inert = false
		},
	}
}
