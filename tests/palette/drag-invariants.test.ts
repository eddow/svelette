import { afterEach, describe, expect, it } from 'vitest'
import {
	insertToolbar,
	insertTrackWithToolbar,
	palettes,
	removeEmptyTrack,
	removeToolbar,
} from '$lib/palette/edition.svelte'
import type { PaletteBorder, PaletteToolbar, PaletteTrack } from '$lib/palette/types'

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

describe('layout relocation invariants (headless primitives)', () => {
	afterEach(() => {
		document.body.replaceChildren()
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
