import { describe, expect, it } from 'vitest'
import {
	expandStackSpaceRect,
	isIgnoredDropZone,
	isIgnoredStackSpace,
	isIgnoredToolbarSpace,
	type MeasuredTarget,
	PALETTE_PROXIMITY_HALO,
	type PaletteStackSpace,
	type PaletteToolbarSpace,
	type PaletteTrackSpace,
	rectContainsPoint,
	rectDistanceToPoint,
	resolveCandidate,
	resolveDragTarget,
	resolveStackSpaceTargetFromTargets,
	resolveToolbarSpaceTargetFromTargets,
	resolveTrackSpaceTargetFromTargets,
} from '$lib/palette/edition.svelte'

function rect(left: number, top: number, right: number, bottom: number): DOMRect {
	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
		x: left,
		y: top,
		toJSON: () => ({}),
	} as DOMRect
}

function measured<T>(target: T, r: DOMRect): MeasuredTarget<T> {
	return { target, rect: r, element: document.createElement('div') }
}

const trackSpace = (overrides: Partial<PaletteTrackSpace> = {}): PaletteTrackSpace =>
	({
		border: [],
		direction: 'horizontal',
		index: 0,
		palette: {} as never,
		region: 'top',
		track: [],
		trackIndex: 0,
		...overrides,
	}) as PaletteTrackSpace

const toolbarSpace = (overrides: Partial<PaletteToolbarSpace> = {}): PaletteToolbarSpace =>
	({
		direction: 'horizontal',
		index: 0,
		palette: {} as never,
		toolbar: [],
		...overrides,
	}) as PaletteToolbarSpace

const stackSpace = (overrides: Partial<PaletteStackSpace> = {}): PaletteStackSpace =>
	({
		border: [],
		direction: 'horizontal',
		index: 0,
		palette: {} as never,
		region: 'top',
		...overrides,
	}) as PaletteStackSpace

describe('rectContainsPoint', () => {
	it('contains interior points and inclusive edges', () => {
		const r = rect(10, 10, 20, 20)
		expect(rectContainsPoint(r, { x: 15, y: 15 })).toBe(true)
		expect(rectContainsPoint(r, { x: 10, y: 10 })).toBe(true)
		expect(rectContainsPoint(r, { x: 20, y: 20 })).toBe(true)
		expect(rectContainsPoint(r, { x: 9.9, y: 15 })).toBe(false)
		expect(rectContainsPoint(r, { x: 15, y: 20.1 })).toBe(false)
	})

	it('treats a zero-width gap edge as contained (inclusive)', () => {
		const gap = rect(50, 0, 50, 40)
		expect(rectContainsPoint(gap, { x: 50, y: 20 })).toBe(true)
		expect(rectContainsPoint(gap, { x: 50.1, y: 20 })).toBe(false)
	})
})

describe('rectDistanceToPoint', () => {
	it('is zero inside and axis-separated outside', () => {
		const r = rect(10, 10, 20, 20)
		expect(rectDistanceToPoint(r, { x: 15, y: 15 })).toBe(0)
		expect(rectDistanceToPoint(r, { x: 25, y: 15 })).toBe(5)
		expect(rectDistanceToPoint(r, { x: 15, y: 5 })).toBe(5)
		expect(rectDistanceToPoint(r, { x: 25, y: 25 })).toBeCloseTo(Math.hypot(5, 5))
	})
})

describe('expandStackSpaceRect', () => {
	it('pads a horizontal border slot vertically by the halo', () => {
		const expanded = expandStackSpaceRect(rect(0, 100, 200, 110), 'horizontal')
		expect(expanded.top).toBe(100 - PALETTE_PROXIMITY_HALO)
		expect(expanded.bottom).toBe(110 + PALETTE_PROXIMITY_HALO)
		expect(expanded.left).toBe(0)
		expect(expanded.right).toBe(200)
	})

	it('pads a vertical border slot horizontally by the halo', () => {
		const expanded = expandStackSpaceRect(rect(100, 0, 110, 200), 'vertical')
		expect(expanded.left).toBe(100 - PALETTE_PROXIMITY_HALO)
		expect(expanded.right).toBe(110 + PALETTE_PROXIMITY_HALO)
		expect(expanded.top).toBe(0)
		expect(expanded.bottom).toBe(200)
	})
})

describe('resolveCandidate', () => {
	it('prefers a contained target over a nearer proximity-only one', () => {
		const far = measured({ id: 'far' }, rect(0, 0, 10, 10))
		const near = measured({ id: 'near' }, rect(100, 100, 110, 110))
		const point = { x: 5, y: 5 }
		const best = resolveCandidate([near, far], point)
		expect(best?.target).toEqual({ id: 'far' })
		expect(best?.contained).toBe(true)
	})

	it('picks the nearest target when none contains the point', () => {
		const a = measured({ id: 'a' }, rect(0, 0, 10, 10))
		const b = measured({ id: 'b' }, rect(30, 0, 40, 10))
		const best = resolveCandidate([a, b], { x: 25, y: 5 })
		expect(best?.target).toEqual({ id: 'b' })
		expect(best?.contained).toBe(false)
	})

	it('returns undefined for an empty target list', () => {
		expect(resolveCandidate([], { x: 0, y: 0 })).toBeUndefined()
	})
})

describe('zero-width / zero-height gap resolution', () => {
	it('resolves a zero-width track gap when the pointer is exactly on its edge', () => {
		const space = trackSpace({ direction: 'horizontal', index: 2 })
		const targets = [measured(space, rect(50, 0, 50, 40))]
		const hit = resolveTrackSpaceTargetFromTargets(targets, { x: 50, y: 20 })
		expect(hit?.contained).toBe(true)
		expect(hit?.index).toBe(2)
		// Zero span cannot produce a meaningful split; it clamps to 0.
		expect(hit?.split).toBe(0)
	})

	it('resolves a zero-height stack gap edge as contained', () => {
		const space = stackSpace({ direction: 'horizontal', index: 1 })
		const targets = [measured(space, rect(0, 80, 200, 80))]
		const hit = resolveStackSpaceTargetFromTargets(targets, { x: 100, y: 80 })
		expect(hit?.contained).toBe(true)
		expect(hit?.index).toBe(1)
	})

	it('resolves a zero-width toolbar gap when the pointer is exactly on its edge', () => {
		const toolbar: never[] = []
		const space = toolbarSpace({ toolbar: toolbar as never, index: 3 })
		const targets = [measured(space, rect(70, 0, 70, 32))]
		const hit = resolveToolbarSpaceTargetFromTargets(targets, { x: 70, y: 16 })
		expect(hit?.contained).toBe(true)
		expect(hit?.index).toBe(3)
	})
})

describe('halo expansion threshold', () => {
	it('registers a stack slot just inside the halo as proximity-only', () => {
		const space = stackSpace({ direction: 'horizontal', index: 0 })
		const targets = [measured(space, rect(0, 100, 200, 110))]
		const near = resolveStackSpaceTargetFromTargets(targets, {
			x: 100,
			y: 110 + PALETTE_PROXIMITY_HALO - 1,
		})
		expect(near).toBeDefined()
		expect(near?.contained).toBe(false)
	})

	it('ignores a stack slot beyond the halo', () => {
		const space = stackSpace({ direction: 'horizontal', index: 0 })
		const targets = [measured(space, rect(0, 100, 200, 110))]
		const far = resolveStackSpaceTargetFromTargets(targets, {
			x: 100,
			y: 110 + PALETTE_PROXIMITY_HALO + 5,
		})
		expect(far).toBeUndefined()
	})

	// G1 — uniform halo (Phase 2): all three resolvers share the same
	// `withinProximityHalo` near-enough test, so near-misses register for
	// track/toolbar slots exactly like stack slots.
	it('registers a track slot just outside its rect (uniform halo)', () => {
		const space = trackSpace({ direction: 'horizontal', index: 0 })
		const targets = [measured(space, rect(0, 100, 200, 110))]
		const near = resolveTrackSpaceTargetFromTargets(targets, {
			x: 100,
			y: 110 + PALETTE_PROXIMITY_HALO - 1,
		})
		expect(near).toBeDefined()
		expect(near?.contained).toBe(false)
	})

	it('registers a toolbar slot just outside its rect (uniform halo)', () => {
		const space = toolbarSpace({ index: 0 })
		const targets = [measured(space, rect(0, 100, 40, 132))]
		const near = resolveToolbarSpaceTargetFromTargets(targets, {
			x: 41,
			y: 116,
		})
		expect(near).toBeDefined()
		expect(near?.contained).toBe(false)
	})
})

describe('resolveDragTarget decision table', () => {
	const el = () => document.createElement('div')

	it('a contained toolbar space always wins', () => {
		const toolbarTarget = {
			...toolbarSpace(),
			element: el(),
			kind: 'toolbar-space' as const,
			contained: true,
		}
		const trackTarget = {
			...trackSpace(),
			element: el(),
			kind: 'track-space' as const,
			contained: true,
			split: 0.5,
		}
		const stackTarget = {
			...stackSpace(),
			element: el(),
			kind: 'stack-space' as const,
			contained: true,
		}
		expect(resolveDragTarget({ toolbarTarget, trackTarget, stackTarget })).toBe(toolbarTarget)
	})

	it('falls back to the stack when no track candidate exists', () => {
		const stackTarget = {
			...stackSpace(),
			element: el(),
			kind: 'stack-space' as const,
			contained: false,
		}
		expect(
			resolveDragTarget({ toolbarTarget: undefined, trackTarget: undefined, stackTarget })
		).toBe(stackTarget)
	})

	it('falls back to the track when no stack candidate exists', () => {
		const trackTarget = {
			...trackSpace(),
			element: el(),
			kind: 'track-space' as const,
			contained: false,
			split: 0,
		}
		expect(
			resolveDragTarget({ toolbarTarget: undefined, trackTarget, stackTarget: undefined })
		).toBe(trackTarget)
	})

	it('a contained stack beats a proximity-only track', () => {
		const trackTarget = {
			...trackSpace(),
			element: el(),
			kind: 'track-space' as const,
			contained: false,
			split: 0,
		}
		const stackTarget = {
			...stackSpace(),
			element: el(),
			kind: 'stack-space' as const,
			contained: true,
		}
		expect(resolveDragTarget({ toolbarTarget: undefined, trackTarget, stackTarget })).toBe(
			stackTarget
		)
	})

	it('a contained track beats a proximity-only stack', () => {
		const trackTarget = {
			...trackSpace(),
			element: el(),
			kind: 'track-space' as const,
			contained: true,
			split: 0.5,
		}
		const stackTarget = {
			...stackSpace(),
			element: el(),
			kind: 'stack-space' as const,
			contained: false,
		}
		expect(resolveDragTarget({ toolbarTarget: undefined, trackTarget, stackTarget })).toBe(
			trackTarget
		)
	})

	it('between two proximity-only candidates the track wins', () => {
		const trackTarget = {
			...trackSpace(),
			element: el(),
			kind: 'track-space' as const,
			contained: false,
			split: 0,
		}
		const stackTarget = {
			...stackSpace(),
			element: el(),
			kind: 'stack-space' as const,
			contained: false,
		}
		expect(resolveDragTarget({ toolbarTarget: undefined, trackTarget, stackTarget })).toBe(
			trackTarget
		)
	})

	it('a proximity-only toolbar space never wins the decision table', () => {
		const toolbarTarget = {
			...toolbarSpace(),
			element: el(),
			kind: 'toolbar-space' as const,
			contained: false,
		}
		const trackTarget = {
			...trackSpace(),
			element: el(),
			kind: 'track-space' as const,
			contained: false,
			split: 0,
		}
		expect(resolveDragTarget({ toolbarTarget, trackTarget, stackTarget: undefined })).toBe(
			trackTarget
		)
	})
})

describe('ignored-zone rules', () => {
	it('ignores the dragged toolbar’s own gaps within its track', () => {
		const toolbar: never[] = []
		const track: { space: number; toolbar: never[] }[] = [
			{ space: 0, toolbar: [] as never[] },
			{ space: 0, toolbar },
		]
		const dragged = { track: track as never, index: 1 } as never
		expect(isIgnoredDropZone({ track, index: 1 } as never, dragged)).toBe(true)
		expect(isIgnoredDropZone({ track, index: 2 } as never, dragged)).toBe(true)
		expect(isIgnoredDropZone({ track, index: 0 } as never, dragged)).toBe(false)
	})

	it('never ignores gaps in a different track', () => {
		const dragged = { track: [], index: 0 } as never
		expect(isIgnoredDropZone({ track: [], index: 0 } as never, dragged)).toBe(false)
	})

	it('ignores toolbar spaces inside the dragged toolbar itself', () => {
		const toolbar: never[] = []
		const dragged = { toolbar: toolbar as never } as never
		expect(isIgnoredToolbarSpace({ toolbar, index: 0 } as never, dragged)).toBe(true)
	})

	it('ignores toolbar spaces inside the current preview span', () => {
		const toolbar: never[] = []
		const other: never[] = []
		const dragged = {
			toolbar: other as never,
			toolbarPreview: { toolbar: toolbar as never, index: 2, count: 1 },
		} as never
		expect(isIgnoredToolbarSpace({ toolbar, index: 2 } as never, dragged)).toBe(true)
		expect(isIgnoredToolbarSpace({ toolbar, index: 3 } as never, dragged)).toBe(true)
		expect(isIgnoredToolbarSpace({ toolbar, index: 4 } as never, dragged)).toBe(false)
		// Any gap in the dragged toolbar itself is ignored, even without a preview.
		expect(isIgnoredToolbarSpace({ toolbar: other, index: 0 } as never, dragged)).toBe(true)
	})

	it('ignores origin stack slots for a singleton source track regardless of distance', () => {
		const border: never[] = []
		const target = { border: border as never, region: 'top', index: 1 } as never
		const origin = {
			border: border as never,
			sourceTrackWasSingleton: true,
			start: { x: 0, y: 0 },
			region: 'top',
			trackIndex: 1,
		} as never
		expect(isIgnoredStackSpace(target, { x: 500, y: 500 }, origin)).toBe(true)
	})

	it('ignores origin stack slots for a multi-toolbar source only near the drag start', () => {
		const border: never[] = []
		const target = { border: border as never, region: 'top', index: 0 } as never
		const origin = {
			border: border as never,
			start: { x: 100, y: 100 },
			region: 'top',
			trackIndex: 0,
		} as never
		expect(isIgnoredStackSpace(target, { x: 105, y: 100 }, origin)).toBe(true)
		expect(isIgnoredStackSpace(target, { x: 200, y: 100 }, origin)).toBe(false)
	})

	it('never ignores stack slots in another border or region', () => {
		const border: never[] = []
		const other: never[] = []
		const origin = {
			border: border as never,
			start: { x: 0, y: 0 },
			region: 'top',
			trackIndex: 0,
		} as never
		expect(
			isIgnoredStackSpace(
				{ border: other, region: 'top', index: 0 } as never,
				{ x: 0, y: 0 },
				origin
			)
		).toBe(false)
		expect(
			isIgnoredStackSpace({ border, region: 'bottom', index: 0 } as never, { x: 0, y: 0 }, origin)
		).toBe(false)
	})
})
