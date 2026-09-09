import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	insertToolbar,
	insertTrackWithToolbar,
	Palette,
	palettes,
	removeEmptyTrack,
	removeToolbar,
} from '$lib/palette/edition.svelte'
import type { PaletteBorder, PaletteToolbar, PaletteTrack } from '$lib/palette/types'
import PaletteItemDragProbe from './PaletteItemDragProbe.svelte'

function testPalette(run: () => void = () => {}): Palette {
	return new Palette({
		tools: {
			run: {
				get can() {
					return true
				},
				run,
			},
		},
		keys: { N: 'run' },
	})
}

function countItems(borders: PaletteBorder[]): number {
	return borders.reduce(
		(sum, border) =>
			sum +
			border.reduce(
				(trackSum, track) => trackSum + track.reduce((s, slot) => s + slot.toolbar.length, 0),
				0
			),
		0
	)
}

function stubPointerCapture(element: HTMLElement): void {
	Object.defineProperties(element, {
		setPointerCapture: { configurable: true, value: vi.fn() },
		releasePointerCapture: { configurable: true, value: vi.fn() },
		hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
	})
}

function pointerInit(x: number, y: number, buttons: number, button: number) {
	return {
		bubbles: true,
		cancelable: true,
		button,
		buttons,
		clientX: x,
		clientY: y,
		pointerId: 1,
	}
}

describe('drag conservation invariants (headless relocation primitives)', () => {
	afterEach(() => {
		document.body.replaceChildren()
		palettes.catalogDrag = undefined
		palettes.dragging = undefined
		palettes.editing = undefined
		palettes.inspecting = undefined
	})

	it('conserves items when a toolbar moves between tracks', () => {
		const a: PaletteToolbar = [{ tool: 'a' }, { tool: 'b' }]
		const b: PaletteToolbar = [{ tool: 'c' }]
		const trackA: PaletteTrack = [{ space: 0.2, toolbar: a }]
		const trackB: PaletteTrack = [{ space: 0.3, toolbar: b }]
		const border: PaletteBorder = [trackA, trackB]
		const before = countItems([border])

		// Relocation = remove from origin + insert at destination (the coupled
		// primitive `moveToolbarToTrack`/`moveToolbarToStack` build on).
		const removed = removeToolbar(trackA, a)
		expect(removed).toBe(0)
		removeEmptyTrack(border, trackA)
		insertToolbar(trackB, 1, a, 0.5)

		expect(countItems([border])).toBe(before)
		expect(border).toHaveLength(1)
		expect(trackB.map((slot) => slot.toolbar)).toContain(a)
	})

	it('conserves items when a toolbar moves to a new stack track', () => {
		const a: PaletteToolbar = [{ tool: 'a' }]
		const track: PaletteTrack = [{ space: 0, toolbar: a }]
		const border: PaletteBorder = [track]
		const before = countItems([border])

		removeToolbar(track, a)
		removeEmptyTrack(border, track)
		insertTrackWithToolbar(border, 0, a)

		expect(countItems([border])).toBe(before)
		expect(border).toHaveLength(1)
	})

	it('prunes empty toolbars/tracks without losing sibling items', () => {
		const keep: PaletteToolbar = [{ tool: 'keep' }]
		const doomed: PaletteToolbar = [{ tool: 'doomed' }]
		const track: PaletteTrack = [
			{ space: 0.4, toolbar: keep },
			{ space: 0, toolbar: doomed },
		]
		const border: PaletteBorder = [track]
		const before = countItems([border])

		removeToolbar(track, doomed)
		removeEmptyTrack(border, track)

		expect(countItems([border])).toBe(before - 1)
		expect(track).toHaveLength(1)
		expect(track[0].toolbar).toBe(keep)
		// The surviving track stays (it is not empty), so the border is intact.
		expect(border).toHaveLength(1)
	})

	it('drops an emptied track from its border', () => {
		const solo: PaletteToolbar = [{ tool: 'solo' }]
		const track: PaletteTrack = [{ space: 0, toolbar: solo }]
		const border: PaletteBorder = [track]
		removeToolbar(track, solo)
		removeEmptyTrack(border, track)
		expect(border).toHaveLength(0)
	})
})

describe('drag session lifecycle (jsdom + synthetic pointer events)', () => {
	afterEach(() => {
		document.body.replaceChildren()
		palettes.catalogDrag = undefined
		palettes.dragging = undefined
		palettes.editing = undefined
		palettes.inspecting = undefined
	})

	it('conserves the item across an abandoned (buttons === 0) drag', async () => {
		const firstItem = { tool: 'run' }
		const secondItem = { tool: 'run' }
		const toolbar = [firstItem, secondItem]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		const palette = testPalette()
		palettes.editing = palette
		render(PaletteItemDragProbe, {
			props: {
				target: {
					border,
					direction: 'horizontal',
					item: firstItem,
					itemIndex: 0,
					palette,
					region: 'top',
					toolbar,
					track,
					trackIndex: 0,
				},
			},
		})
		const guard = screen.getByTestId('item-guard')
		stubPointerCapture(guard)

		guard.dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit(10, 10, 1, 0) }))
		// Detach-on-activate: pointerdown alone never removes the item — the
		// tool stays visible until the pointer passes the 4px threshold.
		expect(toolbar).toHaveLength(2)
		// Abandon the drag mid-gesture (buttons === 0): the session stops and
		// commits whatever is on screen. The gesture never activated, so the
		// toolbar was never touched — conservation means the toolbar is whole
		// and no session lingers.
		window.dispatchEvent(new PointerEvent('pointermove', { ...pointerInit(60, 10, 0, -1) }))
		await Promise.resolve()

		expect(toolbar).toHaveLength(2)
		expect(toolbar[0]).toStrictEqual(firstItem)
		expect(palettes.dragging).toBeUndefined()
	})

	it('restores a clicked (never activated) item at its origin', async () => {
		const firstItem = { tool: 'run' }
		const secondItem = { tool: 'run' }
		const toolbar = [firstItem, secondItem]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		const palette = testPalette()
		palettes.editing = palette
		render(PaletteItemDragProbe, {
			props: {
				target: {
					border,
					direction: 'horizontal',
					item: firstItem,
					itemIndex: 0,
					palette,
					region: 'top',
					toolbar,
					track,
					trackIndex: 0,
				},
			},
		})
		const guard = screen.getByTestId('item-guard')
		stubPointerCapture(guard)

		guard.dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit(10, 10, 1, 0) }))
		window.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(10, 10, 0, 0) }))
		await Promise.resolve()

		// Click path never detached, so the item is exactly where it was.
		expect(toolbar).toHaveLength(2)
		expect(toolbar[0]).toStrictEqual(firstItem)
		expect(palettes.dragging).toBeUndefined()
	})

	it('supports a repeat move after the first session commits (no stale registration)', async () => {
		const firstItem = { tool: 'run' }
		const secondItem = { tool: 'run' }
		const toolbar = [firstItem, secondItem]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		const palette = testPalette()
		palettes.editing = palette
		render(PaletteItemDragProbe, {
			props: {
				target: {
					border,
					direction: 'horizontal',
					item: firstItem,
					itemIndex: 0,
					palette,
					region: 'top',
					toolbar,
					track,
					trackIndex: 0,
				},
			},
		})
		const guard = screen.getByTestId('item-guard')
		stubPointerCapture(guard)

		// First session: click (no activation) → toolbar untouched throughout.
		guard.dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit(10, 10, 1, 0) }))
		expect(toolbar).toHaveLength(2)
		window.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(10, 10, 0, 0) }))
		await Promise.resolve()
		expect(toolbar).toHaveLength(2)
		expect(palettes.dragging).toBeUndefined()

		// Second session on the same guard: the action listener must still be
		// wired (no stale registration), so pointerdown inspects again — and
		// still detaches nothing before activation.
		guard.dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit(10, 10, 1, 0) }))
		expect(palettes.inspecting?.palette).toBe(palette)
		expect(toolbar).toHaveLength(2)
		window.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(10, 10, 0, 0) }))
		await Promise.resolve()
		expect(toolbar).toHaveLength(2)
		expect(palettes.dragging).toBeUndefined()
	})

	it('keeps the session committable with fireEvent pointer sequences', async () => {
		const firstItem = { tool: 'run' }
		const secondItem = { tool: 'run' }
		const toolbar = [firstItem, secondItem]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		const palette = testPalette()
		palettes.editing = palette
		render(PaletteItemDragProbe, {
			props: {
				target: {
					border,
					direction: 'horizontal',
					item: firstItem,
					itemIndex: 0,
					palette,
					region: 'top',
					toolbar,
					track,
					trackIndex: 0,
				},
			},
		})
		const guard = screen.getByTestId('item-guard')
		stubPointerCapture(guard)
		await fireEvent.pointerDown(guard, { button: 0, buttons: 1, clientX: 10, clientY: 10 })
		// Detach-on-activate: pointerdown alone leaves the toolbar whole;
		// pointerup without activation commits nothing.
		expect(toolbar).toHaveLength(2)
		await fireEvent.pointerUp(window, { button: 0, buttons: 0, clientX: 10, clientY: 10 })
		expect(palettes.dragging).toBeUndefined()
		expect(toolbar).toHaveLength(2)
	})
})
