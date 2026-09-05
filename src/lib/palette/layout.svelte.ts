/**
 * Headless palette layout engine: track spacing, toolbar moves, drag hit-testing,
 * catalogue-insert sessions, and Svelte actions for the layout components.
 *
 * Ported from `@sursaut/ui/palette` (`ui/src/palette/components.tsx`), with the
 * Sursaut-specific runtime replaced by Svelte 5 equivalents:
 *
 * - `mutts.reactive(x)` → plain arrays (callers wrap with `$state`; deep
 *   reactivity comes from the caller's proxy, so helpers stay a pure `.ts`)
 * - `mutts.unwrap(x)` → direct reads (Svelte never proxies class instances)
 * - `mutts.effect` in `paletteRoot` → `$effect` inside the action body
 *   (actions run in component init context, so effects are legal there)
 * - `startLocalDragSession` → `startPaletteDragSession` (`drag-session.ts`)
 * - `arranged()` scope classes → dropped (no `orientation-*` / `density-*`
 *   selectors exist in the ported CSS; direction flows through
 *   `palette-horizontal` / `palette-vertical` + `stack-*` classes)
 * - `use:toolbarsContainer` → dropped (no definition exists in the reference
 *   source or its dependencies; layout is fully described by CSS classes)
 * - `reactive()` shells in `beginPaletteCatalogInsertDrag` / `createItemDragging`
 *   → plain arrays (the session object itself is assigned into the `$state`
 *   `palettes` store, which makes the whole graph reactive)
 *
 * Pure helpers (`clampUnit`, spacing, insert/remove, placement guards) are
 * verbatim ports. Hit-testing reads live `getBoundingClientRect()` geometry
 * from registered space elements, exactly like the reference.
 */

import type { Action } from 'svelte/action'
import {
	PALETTE_CATALOG_DRAG_MIME,
	paletteToolbarItemFromCatalogPayload,
	parsePaletteCatalogDragPayload,
} from './command-box.svelte'
import { startPaletteDragSession } from './drag-session'
import { isEditableTool, isRunTool, PaletteError, palettes } from './palette.svelte'
import type {
	Palette,
	PaletteBase,
	PaletteBorder,
	PaletteDragging,
	PaletteItem,
	PaletteRegion,
	PaletteSchema,
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

export type PaletteDragOrigin = {
	border: PaletteBorder
	index: number
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

export type PaletteTrackDragTarget = PaletteTrackSpace & {
	contained: boolean
	element: HTMLElement
	kind: 'track-space'
	split: number
}

export type PaletteStackDragTarget = PaletteStackSpace & {
	contained: boolean
	element: HTMLElement
	kind: 'stack-space'
}

export type PaletteToolbarDragTarget = PaletteToolbarSpace & {
	contained: boolean
	element: HTMLElement
	kind: 'toolbar-space'
}

export type PaletteDragTarget =
	| PaletteTrackDragTarget
	| PaletteStackDragTarget
	| PaletteToolbarDragTarget

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

function axisValue(direction: PaletteOrientation, point: { x: number; y: number }): number {
	return direction === 'vertical' ? point.y : point.x
}

function rectAxisStart(
	rect: Pick<DOMRectReadOnly, 'left' | 'top'>,
	direction: PaletteOrientation
): number {
	return direction === 'vertical' ? rect.top : rect.left
}

function rectAxisSpan(
	rect: Pick<DOMRectReadOnly, 'width' | 'height'>,
	direction: PaletteOrientation
): number {
	return direction === 'vertical' ? rect.height : rect.width
}

export function regionDirection(region: PaletteRegion): PaletteOrientation {
	return region === 'left' || region === 'right' ? 'vertical' : 'horizontal'
}

function pointDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
	return Math.hypot(a.x - b.x, a.y - b.y)
}

function rectContainsPoint(
	rect: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>,
	point: { x: number; y: number }
): boolean {
	return (
		point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
	)
}

function rectDistanceToPoint(
	rect: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>,
	point: { x: number; y: number }
): number {
	const dx =
		point.x < rect.left ? rect.left - point.x : point.x > rect.right ? point.x - rect.right : 0
	const dy =
		point.y < rect.top ? rect.top - point.y : point.y > rect.bottom ? point.y - rect.bottom : 0
	return Math.hypot(dx, dy)
}

function expandStackSpaceRect(
	rect: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>,
	direction: PaletteOrientation
): Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'> {
	const halo = 12
	return direction === 'horizontal'
		? {
				left: rect.left,
				right: rect.right,
				top: rect.top - halo,
				bottom: rect.bottom + halo,
				width: rect.width,
				height: rect.height + halo * 2,
			}
		: {
				left: rect.left - halo,
				right: rect.right + halo,
				top: rect.top,
				bottom: rect.bottom,
				width: rect.width + halo * 2,
				height: rect.height,
			}
}

function draggingToolbarRect(dragging: PaletteDragging): DOMRectReadOnly | undefined {
	for (const element of document.querySelectorAll<HTMLElement>('.toolbar[data-dragging="true"]')) {
		if (element.dataset.paletteId !== dragging.palette.id) continue
		if (!element.isConnected) continue
		return element.getBoundingClientRect()
	}
	return undefined
}

function resizeDraggedToolbarFromPointer(
	dragging: PaletteDragging,
	direction: PaletteOrientation,
	point: { x: number; y: number },
	anchor: number,
	fallbackRect: DOMRectReadOnly | undefined,
	fallbackDirection: PaletteOrientation
): void {
	const rect =
		draggingToolbarRect(dragging) ?? (direction === fallbackDirection ? fallbackRect : undefined)
	if (!rect) return
	const span = rectAxisSpan(rect, direction)
	if (span <= 0) return
	resizeToolbarFromPointer(
		dragging.track,
		dragging.index,
		direction,
		point,
		Math.min(Math.max(anchor, 0), span),
		span
	)
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
 * Removes the dragged toolbar from its current track and drops the whole track if it becomes empty.
 */
function removeToolbarFromDragTrack(
	dragging: PaletteDragging,
	toolbar: PaletteToolbar
): { index: number; removedTrack: boolean; trackIndex: number } | undefined {
	const trackIndex = dragging.border.indexOf(dragging.track)
	if (trackIndex < 0) return undefined
	const index = removeToolbar(dragging.track, toolbar)
	if (index < 0) return undefined
	if (dragging.track.length > 0) return { index, removedTrack: false, trackIndex }
	const isSessionCreated = dragging.createdTracks.includes(dragging.track)
	dragging.border.splice(trackIndex, 1)
	if (isSessionCreated) {
		const createdIndex = dragging.createdTracks.indexOf(dragging.track)
		if (createdIndex >= 0) dragging.createdTracks.splice(createdIndex, 1)
	}
	return { index, removedTrack: true, trackIndex }
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
 * Collapses the original source track after a drag session when it started as a singleton.
 */
function collapseDeferredSourceTrack(dragging: PaletteDragging | undefined): void {
	if (!dragging?.sourceTrackWasSingleton) return
	removeEmptyTrack(dragging.sourceBorder, dragging.sourceTrack)
	for (const track of [...dragging.createdTracks]) removeEmptyTrack(dragging.border, track)
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

/**
 * Computes a toolbar split from the pointer position using the surrounding track spaces.
 */
function resizeToolbarFromPointer(
	track: PaletteTrack,
	index: number,
	direction: PaletteOrientation,
	point: { x: number; y: number },
	grabOffset: number,
	toolbarSpan: number
): void {
	const beforeSpace = trackSpaceElement(track, index)
	const afterSpace = trackSpaceElement(track, index + 1)
	if (!beforeSpace || !afterSpace) return
	if (direction === 'vertical') {
		const start = beforeSpace.getBoundingClientRect().top
		const end = afterSpace.getBoundingClientRect().bottom
		if (end <= start) return
		const available = end - start - toolbarSpan
		if (available <= 0) return
		const toolbarStart = Math.min(Math.max(point.y - grabOffset, start), end - toolbarSpan)
		const split = clampUnit((toolbarStart - start) / available)
		resizeToolbar(track, index, split)
		return
	}
	const start = beforeSpace.getBoundingClientRect().left
	const end = afterSpace.getBoundingClientRect().right
	if (end <= start) return
	const available = end - start - toolbarSpan
	if (available <= 0) return
	const toolbarStart = Math.min(Math.max(point.x - grabOffset, start), end - toolbarSpan)
	const split = clampUnit((toolbarStart - start) / available)
	resizeToolbar(track, index, split)
}

/**
 * Clears the transient toolbar-in-toolbar preview and restores the source track snapshot.
 */
function clearToolbarPreview(dragging: PaletteDragging): void {
	const preview = dragging.toolbarPreview
	if (!preview) return
	preview.toolbar.splice(preview.index, preview.count)
	const sourceTrack = preview.source.track
	sourceTrack.splice(0, sourceTrack.length, ...preview.source.snapshot)
	if (preview.source.removedTrack) {
		preview.source.border.splice(preview.source.trackIndex, 0, sourceTrack)
	} else applyTrackSpaces(sourceTrack, actualTrackSpaces(sourceTrack))
	delete dragging.toolbarPreview
}

/**
 * Applies or updates the transient preview that splices the dragged toolbar items into another toolbar.
 */
function previewToolbarItems(
	dragging: PaletteDragging,
	toolbar: PaletteToolbar,
	index: number
): void {
	const activePreview =
		dragging.toolbarPreview?.toolbar === toolbar ? dragging.toolbarPreview : undefined
	const insertionIndex = Math.min(
		Math.max(
			activePreview && index > activePreview.index + activePreview.count
				? index - activePreview.count
				: index,
			0
		),
		activePreview ? toolbar.length - activePreview.count : toolbar.length
	)
	if (
		dragging.toolbarPreview?.toolbar === toolbar &&
		dragging.toolbarPreview.index === insertionIndex
	) {
		return
	}
	clearToolbarPreview(dragging)
	const sourceTrack = dragging.track
	const sourceBorder = dragging.border
	const sourceTrackIndex = sourceBorder.indexOf(sourceTrack)
	if (sourceTrackIndex < 0) return
	const sourceSnapshot = sourceTrack.map((slot) => ({ space: slot.space, toolbar: slot.toolbar }))
	const removal = removeToolbarFromDragTrack(dragging, dragging.toolbar)
	if (!removal) return
	toolbar.splice(insertionIndex, 0, ...dragging.sourceItems)
	dragging.toolbarPreview = {
		count: dragging.sourceItems.length,
		index: insertionIndex,
		source: {
			border: sourceBorder,
			removedTrack: removal.removedTrack,
			track: sourceTrack,
			trackIndex: sourceTrackIndex,
			snapshot: sourceSnapshot,
		},
		toolbar,
	}
}

/**
 * Commits a toolbar preview by keeping the previewed insertion and only cleaning empty session tracks.
 */
function finalizeToolbarPreview(dragging: PaletteDragging): void {
	if (!dragging.toolbarPreview) return
	delete dragging.toolbarPreview
	for (const track of [...dragging.createdTracks]) removeEmptyTrack(dragging.border, track)
}

const trackSpaces = new Set<HTMLElement>()
const trackSpaceMeta = new WeakMap<HTMLElement, PaletteTrackSpace>()
const stackSpaces = new Set<HTMLElement>()
const stackSpaceMeta = new WeakMap<HTMLElement, PaletteStackSpace>()
const toolbarSpaces = new Set<HTMLElement>()
const toolbarSpaceMeta = new WeakMap<HTMLElement, PaletteToolbarSpace>()

type MeasuredTarget<T> = { target: T; rect: DOMRect; element: HTMLElement }

function measureTargets<T>(entries: Set<HTMLElement>, meta: WeakMap<HTMLElement, T>) {
	return Array.from(entries).flatMap((element): MeasuredTarget<T>[] => {
		if (!element.isConnected) {
			entries.delete(element)
			return []
		}
		const target = meta.get(element)
		if (!target) return []
		return [{ target, rect: element.getBoundingClientRect(), element }]
	})
}

function resolveCandidate<T>(
	targets: readonly MeasuredTarget<T>[],
	point: { x: number; y: number }
): (MeasuredTarget<T> & { contained: boolean }) | undefined {
	let best: (MeasuredTarget<T> & { contained: boolean }) | undefined
	for (const entry of targets) {
		const contained = rectContainsPoint(entry.rect, point)
		const distance = contained ? 0 : rectDistanceToPoint(entry.rect, point)
		if (
			!best ||
			(contained && !best.contained) ||
			(contained === best.contained &&
				distance < (best.contained ? 0 : rectDistanceToPoint(best.rect, point)))
		) {
			best = { ...entry, contained }
		}
	}
	return best
}

function trackSpaceTargets() {
	return measureTargets(trackSpaces, trackSpaceMeta)
}

function stackSpaceTargets() {
	return measureTargets(stackSpaces, stackSpaceMeta)
}

function toolbarSpaceTargets() {
	return measureTargets(toolbarSpaces, toolbarSpaceMeta)
}

function trackSpaceElement(track: PaletteTrack, index: number): HTMLElement | undefined {
	for (const element of trackSpaces) {
		if (!element.isConnected) continue
		const target = trackSpaceMeta.get(element)
		if (!target) continue
		if (target.track !== track) continue
		if (target.index !== index) continue
		return element
	}
	return undefined
}

function resolveTrackSpaceTarget(point: {
	x: number
	y: number
}): PaletteTrackDragTarget | undefined {
	const candidate = resolveCandidate(trackSpaceTargets(), point)
	if (!candidate) return undefined
	const { target, rect, element, contained } = candidate
	const axis = target.direction === 'horizontal' ? 'horizontal' : 'vertical'
	const start = axis === 'horizontal' ? rect.left : rect.top
	const end = axis === 'horizontal' ? rect.right : rect.bottom
	const position = axis === 'horizontal' ? point.x : point.y
	const split =
		Number.isFinite(start) && Number.isFinite(end) && end > start
			? Math.min(1, Math.max(0, (position - start) / (end - start)))
			: 0
	return { ...target, element, kind: 'track-space' as const, contained, split }
}

function resolveToolbarSpaceTarget(point: {
	x: number
	y: number
}): PaletteToolbarDragTarget | undefined {
	const candidate = resolveCandidate(toolbarSpaceTargets(), point)
	if (!candidate) return undefined
	return {
		...candidate.target,
		element: candidate.element,
		kind: 'toolbar-space' as const,
		contained: candidate.contained,
	}
}

function resolveStackSpaceTarget(point: {
	x: number
	y: number
}): PaletteStackDragTarget | undefined {
	let best: { distance: number; value: PaletteStackDragTarget } | undefined
	for (const { target, rect, element } of stackSpaceTargets()) {
		const proximityRect = expandStackSpaceRect(rect, target.direction)
		const proximityDistance = rectDistanceToPoint(proximityRect, point)
		if (!rectContainsPoint(proximityRect, point) && proximityDistance > 0) continue
		const candidate: PaletteStackDragTarget = {
			...target,
			element,
			kind: 'stack-space' as const,
			contained: rectContainsPoint(rect, point),
		}
		if (!best || proximityDistance < best.distance)
			best = { distance: proximityDistance, value: candidate }
	}
	return best?.value
}

function setTargetState(
	target: PaletteDragTarget | undefined,
	state: { active?: boolean; proximity?: boolean }
): void {
	if (!target) return
	if (state.active) target.element.dataset.active = 'true'
	else delete target.element.dataset.active
	if (state.proximity) target.element.dataset.proximity = 'true'
	else delete target.element.dataset.proximity
}

function isIgnoredDropZone(target: PaletteTrackSpace, dragged: PaletteDragging): boolean {
	if (target.track !== dragged.track) return false
	const { index } = dragged
	if (index < 0) return false
	return target.index === index || target.index === index + 1
}

function isIgnoredToolbarSpace(
	target: Pick<PaletteToolbarSpace, 'direction' | 'index' | 'toolbar'>,
	dragged: PaletteDragging
): boolean {
	if (target.toolbar === dragged.toolbar) return true
	const preview = dragged.toolbarPreview
	if (!preview || target.toolbar !== preview.toolbar) return false
	return target.index >= preview.index && target.index <= preview.index + preview.count
}

function isIgnoredStackSpace(
	target: PaletteStackSpace,
	point: { x: number; y: number },
	origin: {
		border: PaletteBorder
		sourceRegion?: PaletteRegion
		sourceTrackWasSingleton?: boolean
		start: { x: number; y: number }
		region: PaletteRegion
		trackIndex: number
	}
): boolean {
	const originRegion = origin.sourceRegion ?? origin.region
	if (target.border !== origin.border || target.region !== originRegion) return false
	if (origin.sourceTrackWasSingleton)
		return target.index === origin.trackIndex || target.index === origin.trackIndex + 1
	if (pointDistance(origin.start, point) > 12) return false
	return target.index === origin.trackIndex || target.index === origin.trackIndex + 1
}

function moveToolbarToTrack(
	dragging: PaletteDragging,
	target: PaletteToolbarDrag,
	reorderTarget: PaletteTrackDragTarget
): PaletteDragging | undefined {
	const removal = removeToolbarFromDragTrack(dragging, target.toolbar)
	if (!removal) return undefined
	const targetTrackIndex =
		dragging.border === reorderTarget.border &&
		dragging.track === reorderTarget.track &&
		reorderTarget.trackIndex === removal.trackIndex &&
		reorderTarget.index > removal.index
			? reorderTarget.index - 1
			: reorderTarget.index
	insertToolbar(reorderTarget.track, targetTrackIndex, target.toolbar, reorderTarget.split)
	return {
		border: reorderTarget.border,
		createdTracks: dragging.createdTracks,
		index: targetTrackIndex,
		palette: target.palette,
		region: reorderTarget.region,
		sourceItems: dragging.sourceItems,
		sourceBorder: reorderTarget.border,
		sourceRegion: reorderTarget.region,
		sourceTrack: reorderTarget.track,
		sourceTrackIndex: reorderTarget.trackIndex,
		sourceTrackWasSingleton: reorderTarget.track.length === 1,
		toolbar: target.toolbar,
		track: reorderTarget.track,
		trackIndex: reorderTarget.trackIndex,
	}
}

function moveToolbarToStack(
	dragging: PaletteDragging,
	target: PaletteToolbarDrag,
	stackTarget: PaletteStackDragTarget
): PaletteDragging | undefined {
	const removal = removeToolbarFromDragTrack(dragging, target.toolbar)
	if (!removal) return undefined
	const targetTrackIndex =
		dragging.border === stackTarget.border &&
		stackTarget.index > removal.trackIndex &&
		removal.removedTrack
			? stackTarget.index - 1
			: stackTarget.index
	const insertion = insertTrackWithToolbar(stackTarget.border, targetTrackIndex, target.toolbar)
	dragging.createdTracks.push(insertion.track)
	return {
		border: stackTarget.border,
		createdTracks: dragging.createdTracks,
		index: 0,
		palette: target.palette,
		region: stackTarget.region,
		sourceItems: dragging.sourceItems,
		sourceBorder: stackTarget.border,
		sourceRegion: stackTarget.region,
		sourceTrack: insertion.track,
		sourceTrackIndex: insertion.trackIndex,
		sourceTrackWasSingleton: true,
		toolbar: target.toolbar,
		track: insertion.track,
		trackIndex: insertion.trackIndex,
	}
}

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

function createToolbarDragging(target: PaletteToolbarDrag): PaletteDragging | undefined {
	const index = target.track.findIndex((slot) => slot.toolbar === target.toolbar)
	if (index < 0) return undefined
	return {
		border: target.border,
		createdTracks: [],
		index,
		palette: target.palette,
		region: target.region,
		sourceItems: [...target.toolbar],
		sourceBorder: target.border,
		sourceRegion: target.region,
		sourceTrack: target.track,
		sourceTrackIndex: target.trackIndex,
		sourceTrackWasSingleton: target.track.length === 1,
		toolbar: target.toolbar,
		track: target.track,
		trackIndex: target.trackIndex,
	}
}

function createItemDragging(
	target: PaletteItemDragTarget
): { dragging: PaletteDragging; target: PaletteToolbarDrag } | undefined {
	if (target.toolbar.length === 1) {
		const dragging = createToolbarDragging({
			border: target.border,
			direction: target.direction,
			palette: target.palette,
			region: target.region,
			toolbar: target.toolbar,
			track: target.track,
			trackIndex: target.trackIndex,
		})
		if (!dragging) return undefined
		return {
			dragging,
			target: {
				border: target.border,
				direction: target.direction,
				palette: target.palette,
				region: target.region,
				toolbar: target.toolbar,
				track: target.track,
				trackIndex: target.trackIndex,
			},
		}
	}
	if (target.toolbar[target.itemIndex] !== target.item) return undefined
	target.toolbar.splice(target.itemIndex, 1)
	const toolbar: PaletteToolbar = [target.item]
	const track: PaletteTrack = [{ space: 0, toolbar }]
	const border: PaletteBorder = [track]
	const dragging: PaletteDragging = {
		border,
		createdTracks: [],
		index: 0,
		palette: target.palette,
		region: target.region,
		sourceItems: [target.item],
		sourceBorder: border,
		sourceRegion: target.region,
		sourceTrack: track,
		sourceTrackIndex: 0,
		sourceTrackWasSingleton: true,
		toolbar,
		track,
		trackIndex: 0,
	}
	previewToolbarItems(dragging, target.toolbar, target.itemIndex)
	return {
		dragging,
		target: {
			border,
			direction: target.direction,
			palette: target.palette,
			region: target.region,
			toolbar,
			track,
			trackIndex: 0,
		},
	}
}

function hasPaletteDragMoved(dragging: PaletteDragging, origin: PaletteDragOrigin): boolean {
	const preview = dragging.toolbarPreview
	if (preview) return preview.toolbar !== origin.toolbar || preview.index !== origin.index
	return (
		dragging.border !== origin.border ||
		dragging.region !== origin.region ||
		dragging.toolbar !== origin.toolbar ||
		dragging.track !== origin.track ||
		dragging.trackIndex !== origin.trackIndex ||
		dragging.index !== origin.index
	)
}

/**
 * Shared hit-testing, proximity chrome, toolbar preview, and track/stack moves for palette toolbar drags.
 * Used by pointer sessions and HTML5 catalogue insert so behaviour stays aligned.
 */
function paletteToolbarDragApplyMove(
	point: { x: number; y: number },
	ctx: {
		paletteToolbarDrag: PaletteToolbarDrag
		anchor: number
		originRect: DOMRectReadOnly | undefined
		dragStart: { x: number; y: number }
		fallbackDirection: PaletteOrientation
	},
	state: {
		proximityTargets: PaletteDragTarget[]
		activeTarget: PaletteDragTarget | undefined
	}
): PaletteDragTarget | undefined {
	if (!palettes.dragging) return state.activeTarget
	let dragging = palettes.dragging
	const target = ctx.paletteToolbarDrag
	const currentTrack = dragging.track
	const currentIndex = dragging.index
	const currentDirection = regionDirection(dragging.region)
	if (currentIndex < 0) return state.activeTarget
	const nextToolbarTarget = resolveToolbarSpaceTarget(point)
	const toolbarTarget =
		nextToolbarTarget && !isIgnoredToolbarSpace(nextToolbarTarget, dragging)
			? nextToolbarTarget
			: undefined
	const nextTrackTarget = resolveTrackSpaceTarget(point)
	const trackTarget =
		nextTrackTarget && !isIgnoredDropZone(nextTrackTarget, dragging) ? nextTrackTarget : undefined
	const nextStackTarget = resolveStackSpaceTarget(point)
	const stackTarget =
		nextStackTarget &&
		!(
			ctx.originRect &&
			isIgnoredStackSpace(nextStackTarget, point, {
				border: dragging.sourceBorder,
				sourceRegion: dragging.sourceRegion,
				sourceTrackWasSingleton: dragging.sourceTrackWasSingleton,
				start: ctx.dragStart,
				region: dragging.sourceRegion,
				trackIndex: dragging.sourceTrackIndex,
			})
		)
			? nextStackTarget
			: undefined
	const resolvedTarget = toolbarTarget?.contained
		? toolbarTarget
		: !trackTarget
			? stackTarget
			: !stackTarget
				? trackTarget
				: stackTarget.contained
					? stackTarget
					: trackTarget.contained
						? trackTarget
						: trackTarget
	for (const proximityTarget of state.proximityTargets) {
		if (proximityTarget.element === resolvedTarget?.element) continue
		if (proximityTarget.element === toolbarTarget?.element) continue
		if (proximityTarget.element === trackTarget?.element) continue
		if (proximityTarget.element === stackTarget?.element) continue
		setTargetState(proximityTarget, {})
	}
	state.proximityTargets = [toolbarTarget, trackTarget, stackTarget].filter(
		(candidate): candidate is PaletteDragTarget => Boolean(candidate)
	)
	let activeTarget = state.activeTarget
	if (activeTarget?.element !== resolvedTarget?.element) {
		setTargetState(activeTarget, {})
		activeTarget = resolvedTarget
	}
	state.activeTarget = activeTarget
	for (const proximityTarget of state.proximityTargets) {
		setTargetState(proximityTarget, {
			active: proximityTarget.element === resolvedTarget?.element && proximityTarget.contained,
			proximity: true,
		})
	}
	if (resolvedTarget?.kind === 'toolbar-space') {
		previewToolbarItems(dragging, resolvedTarget.toolbar, resolvedTarget.index)
		return state.activeTarget
	}
	const competingTarget = resolvedTarget?.contained ? resolvedTarget : undefined
	if (dragging.toolbarPreview && competingTarget) clearToolbarPreview(dragging)
	dragging = palettes.dragging
	if (!dragging) return state.activeTarget
	if (dragging.toolbarPreview && !competingTarget) return state.activeTarget
	if (!resolvedTarget?.contained) {
		resizeDraggedToolbarFromPointer(
			dragging,
			currentDirection,
			point,
			ctx.anchor,
			ctx.originRect,
			ctx.fallbackDirection
		)
		return state.activeTarget
	}
	if (
		resolvedTarget.kind === 'track-space' &&
		resolvedTarget.track === currentTrack &&
		(resolvedTarget.index === currentIndex || resolvedTarget.index === currentIndex + 1)
	) {
		resizeDraggedToolbarFromPointer(
			dragging,
			resolvedTarget.direction,
			point,
			ctx.anchor,
			ctx.originRect,
			ctx.fallbackDirection
		)
		return state.activeTarget
	}
	const nextDragging =
		resolvedTarget.kind === 'track-space'
			? moveToolbarToTrack(dragging, target, resolvedTarget)
			: moveToolbarToStack(dragging, target, resolvedTarget)
	if (!nextDragging) return state.activeTarget
	const catalogCarry = dragging.catalogInsert
		? ({
				catalogInsert: true as const,
				catalogInsertPointer: dragging.catalogInsertPointer,
				catalogInsertSeedBorder: dragging.catalogInsertSeedBorder,
			} satisfies Pick<
				PaletteDragging,
				'catalogInsert' | 'catalogInsertPointer' | 'catalogInsertSeedBorder'
			>)
		: undefined
	const merged = catalogCarry
		? ({ ...nextDragging, ...catalogCarry } as unknown as PaletteDragging)
		: nextDragging
	palettes.dragging = merged
	dragging = merged
	if (
		resolvedTarget.kind === 'track-space' &&
		(resolvedTarget.direction === currentDirection || draggingToolbarRect(merged))
	) {
		resizeDraggedToolbarFromPointer(
			merged,
			resolvedTarget.direction,
			point,
			ctx.anchor,
			ctx.originRect,
			ctx.fallbackDirection
		)
	}
	return state.activeTarget
}

function startPaletteToolbarDragSession(
	element: HTMLElement,
	target: PaletteToolbarDrag,
	event: PointerEvent,
	dragging: PaletteDragging,
	options?: {
		origin?: PaletteDragOrigin
		onClick?: () => void
		onMoved?: () => void
	}
): void {
	let originRect: DOMRectReadOnly | undefined
	let dragStart: { x: number; y: number } | undefined
	const moveState: {
		proximityTargets: PaletteDragTarget[]
		activeTarget: PaletteDragTarget | undefined
	} = { proximityTargets: [], activeTarget: undefined }
	let activated = false

	event.preventDefault()
	const rect = element.getBoundingClientRect()
	originRect = rect
	dragStart = { x: event.clientX, y: event.clientY }
	const anchor = axisValue(target.direction, dragStart) - rectAxisStart(rect, target.direction)
	startPaletteDragSession({
		event,
		onMove(snapshot) {
			if (!activated) {
				if (pointDistance(snapshot.start, snapshot.current) < 4) return
				activated = true
				palettes.dragging = dragging
			}
			paletteToolbarDragApplyMove(
				snapshot.current,
				{
					paletteToolbarDrag: target,
					anchor,
					originRect,
					dragStart: dragStart ?? snapshot.current,
					fallbackDirection: target.direction,
				},
				moveState
			)
		},
		onStop(snapshot) {
			setTargetState(moveState.activeTarget, {})
			for (const proximityTarget of moveState.proximityTargets) setTargetState(proximityTarget, {})
			moveState.proximityTargets = []
			moveState.activeTarget = undefined
			dragStart = undefined
			if (!activated) {
				if (snapshot.reason === 'up' || snapshot.reason === 'buttons') options?.onClick?.()
				return
			}
			const activeDragging = palettes.dragging
			if (activeDragging?.palette === target.palette && activeDragging) {
				if (!options?.origin || hasPaletteDragMoved(activeDragging, options.origin))
					options?.onMoved?.()
				if (activeDragging.toolbarPreview) finalizeToolbarPreview(activeDragging)
				else collapseDeferredSourceTrack(activeDragging)
				delete palettes.dragging
			}
		},
	})
}

/**
 * Start a catalogue-insert session: same `PaletteDragging` / `previewToolbarItems` path as pointer drag.
 * Call from `dragstart` after the payload is resolved to a toolbar item.
 */
export function beginPaletteCatalogInsertDrag<TSchema extends PaletteSchema>(
	palette: Palette<TSchema>,
	item: PaletteItem<TSchema>,
	pointer?: { x: number; y: number }
): void {
	if (palettes.dragging) return
	const toolbar: PaletteToolbar<PaletteItem<TSchema>> = [item]
	const track: PaletteTrack<PaletteItem<TSchema>> = [{ space: 0, toolbar }]
	const border: PaletteBorder<PaletteItem<TSchema>> = [track]
	// The module-level `palettes.dragging` store is typed at the default
	// `PaletteDragging` generic, so the `TSchema`-specific layout is collapsed
	// through an `unknown` cast here (the store is the only consumer).
	const dragging = {
		border,
		createdTracks: [],
		index: 0,
		palette,
		region: 'top' as const,
		sourceItems: [item],
		sourceBorder: border,
		sourceRegion: 'top' as const,
		sourceTrack: track,
		sourceTrackIndex: 0,
		sourceTrackWasSingleton: true,
		toolbar,
		track,
		trackIndex: 0,
		catalogInsert: true as const,
		catalogInsertPointer: pointer ? { dragStart: { x: pointer.x, y: pointer.y } } : undefined,
		catalogInsertSeedBorder: border,
	} as unknown as PaletteDragging
	palettes.dragging = dragging
	palettes.catalogDrag = { palette: palette as unknown as PaletteBase }
}

/** Coalesced native catalogue-insert moves: one layout pass per animation frame. */
let catalogNativeMoveRaf = 0
const catalogNativePendingPoint = { x: 0, y: 0 }
const catalogNativeMoveState: {
	proximityTargets: PaletteDragTarget[]
	activeTarget: PaletteDragTarget | undefined
} = { proximityTargets: [], activeTarget: undefined }

function catalogInsertPaletteToolbarDrag(dragging: PaletteDragging): PaletteToolbarDrag {
	return {
		border: dragging.border,
		direction: regionDirection(dragging.region),
		palette: dragging.palette,
		region: dragging.region,
		toolbar: dragging.toolbar,
		track: dragging.track,
		trackIndex: dragging.trackIndex,
	}
}

function resetCatalogNativeMoveUi(): void {
	if (catalogNativeMoveRaf) {
		cancelAnimationFrame(catalogNativeMoveRaf)
		catalogNativeMoveRaf = 0
	}
	setTargetState(catalogNativeMoveState.activeTarget, {})
	for (const proximityTarget of catalogNativeMoveState.proximityTargets)
		setTargetState(proximityTarget, {})
	catalogNativeMoveState.proximityTargets = []
	catalogNativeMoveState.activeTarget = undefined
}

function flushCatalogNativeToolbarMove(): void {
	const dragging = palettes.dragging
	if (!dragging?.catalogInsert) return
	const point = catalogNativePendingPoint
	if (!dragging.catalogInsertPointer)
		dragging.catalogInsertPointer = { dragStart: { x: point.x, y: point.y } }
	const ip = dragging.catalogInsertPointer
	const rect = draggingToolbarRect(dragging)
	const dir = regionDirection(dragging.region)
	if (ip.grabAnchor === undefined && rect) {
		ip.grabAnchor = axisValue(dir, ip.dragStart) - rectAxisStart(rect, dir)
	}
	paletteToolbarDragApplyMove(
		point,
		{
			paletteToolbarDrag: catalogInsertPaletteToolbarDrag(dragging),
			anchor: ip.grabAnchor ?? 0,
			originRect: rect,
			dragStart: ip.dragStart,
			fallbackDirection: dir,
		},
		catalogNativeMoveState
	)
}

function cancelPaletteCatalogInsertDrag(): void {
	resetCatalogNativeMoveUi()
	const dragging = palettes.dragging
	if (!dragging?.catalogInsert) return
	clearToolbarPreview(dragging)
	collapseDeferredSourceTrack(dragging)
	delete palettes.dragging
	if (palettes.catalogDrag) delete palettes.catalogDrag
}

function splitCatalogDropClient(
	event: DragEvent,
	element: HTMLElement,
	direction: PaletteOrientation
): number {
	const rect = element.getBoundingClientRect()
	if (direction === 'horizontal') {
		const x = event.clientX - rect.left
		return clampUnit(rect.width > 0 ? x / rect.width : 0.5)
	}
	const y = event.clientY - rect.top
	return clampUnit(rect.height > 0 ? y / rect.height : 0.5)
}

function catalogMimeAvailable(types: readonly string[]): boolean {
	return types.includes(PALETTE_CATALOG_DRAG_MIME)
}

function bindPaletteCatalogDrop(
	element: HTMLElement,
	palette: Palette,
	insert: (item: PaletteToolbarItem, event: DragEvent) => void
): () => void {
	const onDragOver = (event: DragEvent) => {
		if (!palette.editing) return
		const session = palettes.dragging
		if (session?.catalogInsert && session.palette === palette) {
			event.preventDefault()
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
			return
		}
		if (!event.dataTransfer || !catalogMimeAvailable(Array.from(event.dataTransfer.types))) return
		event.preventDefault()
		event.dataTransfer.dropEffect = 'copy'
	}
	const onDrop = (event: DragEvent) => {
		if (!palette.editing) return
		const session = palettes.dragging
		if (session?.catalogInsert && session.palette === palette) {
			event.preventDefault()
			if (session.toolbarPreview) {
				finalizeToolbarPreview(session)
				collapseDeferredSourceTrack(session)
			} else {
				const item = session.sourceItems[0]
				const stillOnCatalogSeed =
					session.catalogInsertSeedBorder !== undefined &&
					session.border === session.catalogInsertSeedBorder
				if (item && stillOnCatalogSeed) insert(item as PaletteToolbarItem, event)
				collapseDeferredSourceTrack(session)
			}
			delete palettes.dragging
			if (palettes.catalogDrag) delete palettes.catalogDrag
			return
		}
		const raw = event.dataTransfer?.getData(PALETTE_CATALOG_DRAG_MIME)
		if (!raw) return
		event.preventDefault()
		const payload = parsePaletteCatalogDragPayload(raw)
		if (!payload) return
		const item = paletteToolbarItemFromCatalogPayload(palette as Palette<PaletteSchema>, payload)
		if (!item) return
		insert(item as PaletteToolbarItem, event)
	}
	element.addEventListener('dragover', onDragOver)
	element.addEventListener('drop', onDrop)
	return () => {
		element.removeEventListener('dragover', onDragOver)
		element.removeEventListener('drop', onDrop)
	}
}

/** Elements last highlighted during native catalogue drag (pointer path does not run). */
const catalogNativeHighlightElements: HTMLElement[] = []

function clearPaletteCatalogDropHighlights(): void {
	for (const el of catalogNativeHighlightElements) {
		delete el.dataset.active
		delete el.dataset.proximity
	}
	catalogNativeHighlightElements.length = 0
}

function updatePaletteCatalogNativeDropHighlight(point: { x: number; y: number }): void {
	clearPaletteCatalogDropHighlights()
	const toolbarTarget = resolveToolbarSpaceTarget(point)
	const trackTarget = resolveTrackSpaceTarget(point)
	const stackTarget = resolveStackSpaceTarget(point)
	const resolvedTarget = toolbarTarget?.contained
		? toolbarTarget
		: !trackTarget
			? stackTarget
			: !stackTarget
				? trackTarget
				: stackTarget.contained
					? stackTarget
					: trackTarget.contained
						? trackTarget
						: trackTarget
	const candidates = [toolbarTarget, trackTarget, stackTarget].filter(
		(candidate): candidate is PaletteDragTarget => Boolean(candidate)
	)
	for (const candidate of candidates) {
		setTargetState(candidate, {
			proximity: true,
			active:
				resolvedTarget !== undefined &&
				candidate.element === resolvedTarget.element &&
				Boolean(resolvedTarget.contained),
		})
		catalogNativeHighlightElements.push(candidate.element)
	}
}

function onWindowPaletteCatalogDragOver(event: DragEvent): void {
	const dragging = palettes.dragging
	const mimeOk = event.dataTransfer && catalogMimeAvailable(Array.from(event.dataTransfer.types))
	const activeNativeCatalog = Boolean(dragging?.catalogInsert || (palettes.catalogDrag && mimeOk))
	if (!activeNativeCatalog) return
	event.preventDefault()
	if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
	const point = { x: event.clientX, y: event.clientY }
	if (dragging?.catalogInsert) {
		catalogNativePendingPoint.x = point.x
		catalogNativePendingPoint.y = point.y
		if (!catalogNativeMoveRaf) {
			catalogNativeMoveRaf = requestAnimationFrame(() => {
				catalogNativeMoveRaf = 0
				flushCatalogNativeToolbarMove()
			})
		}
		return
	}
	updatePaletteCatalogNativeDropHighlight(point)
}

function onWindowPaletteCatalogDragEnd(): void {
	if (palettes.dragging?.catalogInsert) cancelPaletteCatalogInsertDrag()
	else resetCatalogNativeMoveUi()
	clearPaletteCatalogDropHighlights()
}

let catalogWindowListenersRegistered = false

function ensureCatalogWindowListeners(): void {
	if (typeof window === 'undefined' || catalogWindowListenersRegistered) return
	catalogWindowListenersRegistered = true
	window.addEventListener('dragover', onWindowPaletteCatalogDragOver, true)
	window.addEventListener('dragend', onWindowPaletteCatalogDragEnd, true)
}

// ── Svelte actions ──

/**
 * Palette root: keyboard shortcuts + editing/dragging classes and data flags.
 *
 * `palette` is read once for identity/shortcuts; `editing` / `dragging` /
 * `catalogDragging` flags are reactive via `$effect` (the action runs in
 * component init context, so effects are legal). Returns a cleanup that
 * removes the keydown listener; `$effect` cleanups are owned by the component.
 */
export function paletteRoot(element: HTMLElement, palette: Palette): ReturnType<Action> {
	if (!element.hasAttribute('tabindex')) {
		element.tabIndex = 0
	}
	setPaletteRootId(element, palette)
	ensureCatalogWindowListeners()
	$effect(() => {
		const editing = palette.editing
		setPaletteRootClass(element, 'palette-editing', editing)
		setPaletteRootClass(element, 'editing', editing)
		setPaletteRootData(element, 'editing', editing)
		if (!editing && palettes.inspecting?.palette === palette) delete palettes.inspecting
	})
	$effect(() => {
		const pointerDrag = palettes.dragging?.palette === palette
		const catalogDrag = palettes.catalogDrag?.palette === palette
		setPaletteRootClass(element, 'palette-dragging', pointerDrag)
		setPaletteRootClass(element, 'dragging', pointerDrag)
		setPaletteRootData(element, 'dragging', pointerDrag)
		setPaletteRootClass(element, 'palette-catalog-dragging', catalogDrag)
		setPaletteRootData(element, 'catalogDragging', catalogDrag)
	})

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.defaultPrevented) return
		if (isEditableTarget(event.target)) return
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

export function paletteTrackSpace(
	element: HTMLElement,
	target: PaletteTrackSpace | undefined
): ReturnType<Action> {
	if (!target?.palette) return
	ensureCatalogWindowListeners()
	trackSpaces.add(element)
	trackSpaceMeta.set(element, target)
	const stopCatalog = bindPaletteCatalogDrop(element, target.palette, (item, event) => {
		const split = splitCatalogDropClient(event, element, target.direction)
		const toolbar: PaletteToolbar = [item]
		insertToolbar(target.track, target.index, toolbar, split)
	})
	return {
		destroy() {
			stopCatalog()
			delete element.dataset.active
			delete element.dataset.proximity
			trackSpaces.delete(element)
		},
	}
}

export function paletteStackSpace(
	element: HTMLElement,
	target: PaletteStackSpace | undefined
): ReturnType<Action> {
	if (!target?.palette) return
	ensureCatalogWindowListeners()
	stackSpaces.add(element)
	stackSpaceMeta.set(element, target)
	const stopCatalog = bindPaletteCatalogDrop(element, target.palette, (item) => {
		const toolbar: PaletteToolbar = [item]
		insertTrackWithToolbar(target.border, target.index, toolbar)
	})
	return {
		destroy() {
			stopCatalog()
			delete element.dataset.active
			delete element.dataset.proximity
			stackSpaces.delete(element)
		},
	}
}

export function paletteToolbarSpace(
	element: HTMLElement,
	target: PaletteToolbarSpace | undefined
): ReturnType<Action> {
	if (!target?.palette) return
	ensureCatalogWindowListeners()
	toolbarSpaces.add(element)
	toolbarSpaceMeta.set(element, target)
	const stopCatalog = bindPaletteCatalogDrop(element, target.palette, (item) => {
		target.toolbar.splice(target.index, 0, item)
	})
	return {
		destroy() {
			stopCatalog()
			delete element.dataset.active
			delete element.dataset.proximity
			toolbarSpaces.delete(element)
		},
	}
}

export function paletteToolbarDrag(
	element: HTMLElement,
	target: PaletteToolbarDrag | undefined
): ReturnType<Action> {
	if (!target) return
	const onPointerDown = (event: PointerEvent) => {
		if (!target?.palette) return
		if (!target.palette.editing) return
		if (event.button !== 0) return
		if (isEditableTarget(event.target)) return
		const dragging = createToolbarDragging(target)
		if (!dragging) return
		startPaletteToolbarDragSession(element, target, event, dragging)
	}
	element.addEventListener('pointerdown', onPointerDown)
	return {
		destroy() {
			element.removeEventListener('pointerdown', onPointerDown)
		},
	}
}

export function paletteItemDrag(
	element: HTMLElement,
	target: PaletteItemDragTarget | undefined
): ReturnType<Action> {
	if (!target) return
	const onPointerDown = (event: PointerEvent) => {
		if (!target.palette.editing) return
		if (event.button !== 0) return
		event.stopPropagation()
		palettes.inspecting = {
			item: target.item,
			palette: target.palette,
			region: target.region,
		}
		const origin = {
			border: target.border,
			index: target.itemIndex,
			region: target.region,
			toolbar: target.toolbar,
			track: target.track,
			trackIndex: target.trackIndex,
		} satisfies PaletteDragOrigin
		const drag = createItemDragging(target)
		if (!drag) return
		const sessionElement =
			drag.dragging.toolbar === target.toolbar
				? (element.closest<HTMLElement>('.toolbar') ?? element)
				: element
		startPaletteToolbarDragSession(sessionElement, drag.target, event, drag.dragging, {
			origin,
			onMoved: () => {
				if (
					palettes.inspecting?.palette === target.palette &&
					palettes.inspecting?.item === target.item
				)
					delete palettes.inspecting
			},
		})
	}

	element.addEventListener('pointerdown', onPointerDown)
	return {
		destroy() {
			element.removeEventListener('pointerdown', onPointerDown)
		},
	}
}

export function paletteItemShield(element: HTMLElement, active: boolean): ReturnType<Action> {
	element.inert = active
	return {
		destroy() {
			element.inert = false
		},
	}
}
