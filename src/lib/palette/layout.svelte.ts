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
		// Simulated drag: clicking the toolbar selects its whole content.
		// No preview/commit yet — just centralise on `palettes.dragging`.
		if ((event.target as HTMLElement | null)?.closest?.('.toolbar-item')) return
		event.preventDefault()
		palettes.dragging = { palette: live.palette, tools: [...live.toolbar] }
		console.log(
			'[palette dragging] toolbar:',
			live.toolbar.map((item) =>
				'tool' in item && typeof item.tool === 'string' ? item.tool : item.editor
			)
		)
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
		// Simulated drag: clicking a tool selects that single tool.
		// No preview/commit yet — just centralise on `palettes.dragging`.
		palettes.dragging = { palette: live.palette, tools: [live.item] }
		console.log(
			'[palette dragging] tool:',
			'tool' in live.item && typeof live.item.tool === 'string' ? live.item.tool : live.item.editor
		)
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
