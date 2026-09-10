import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Palette, palettes } from '$lib/palette/edition.svelte'
import DragIdeProbe from './DragIdeProbe.svelte'
import ParkingEditorStub from './ParkingEditorStub.svelte'
import VerticalIdeProbe from './VerticalIdeProbe.svelte'

function testPalette(): Palette {
	return new Palette({
		tools: {
			run: {
				get can() {
					return true
				},
				run() {},
			},
		},
		keys: { N: 'run' },
		editor: () => ParkingEditorStub as never,
	})
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

const ideItemCount = () => document.querySelectorAll('.toolbar-border .toolbar-item').length

const liveItemSpaceCount = () =>
	document.querySelectorAll('.toolbar-border .toolbar-item-space:not([data-inactive])').length

describe('live item-drag chrome + conservation (Ide)', () => {
	afterEach(() => {
		document.body.replaceChildren()
		palettes.catalogDrag = undefined
		palettes.dragging = undefined
		palettes.editing = undefined
		palettes.inspecting = undefined
	})

	it('click (no activation) never removes the tool', async () => {
		const firstItem = { tool: 'run' }
		const secondItem = { tool: 'run' }
		const toolbar = [firstItem, secondItem]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		const palette = testPalette()
		palettes.editing = palette
		render(DragIdeProbe, { props: { palette, top: border } })
		const guard = document.querySelectorAll('.toolbar-item-guard')[0] as HTMLElement
		stubPointerCapture(guard)

		guard.dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit(10, 10, 1, 0) }))
		await Promise.resolve()
		// Detach-on-activate: pointerdown alone never removes the item.
		expect(toolbar).toHaveLength(2)
		expect(ideItemCount()).toBe(2)

		window.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(10, 10, 0, 0) }))
		await Promise.resolve()
		expect(toolbar).toHaveLength(2)
		expect(ideItemCount()).toBe(2)
		expect(palettes.dragging).toBeUndefined()
	})

	it('activated drag over void keeps the tool alive and committed', async () => {
		const firstItem = { tool: 'run' }
		const secondItem = { tool: 'run' }
		const toolbar = [firstItem, secondItem]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		const palette = testPalette()
		palettes.editing = palette
		render(DragIdeProbe, { props: { palette, top: border } })
		const guard = document.querySelectorAll('.toolbar-item-guard')[0] as HTMLElement
		stubPointerCapture(guard)

		guard.dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit(10, 10, 1, 0) }))
		window.dispatchEvent(new PointerEvent('pointermove', { ...pointerInit(60, 10, 1, -1) }))
		await Promise.resolve()

		// Activation detaches + immediately re-inserts as the origin preview:
		// net length unchanged, the tool stays visible mid-drag.
		expect(toolbar).toHaveLength(2)
		expect(ideItemCount()).toBe(2)
		expect(palettes.dragging?.toolbarPreview).toBeDefined()

		window.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(60, 10, 0, 0) }))
		await Promise.resolve()
		expect(toolbar).toHaveLength(2)
		expect(ideItemCount()).toBe(2)
		expect(palettes.dragging).toBeUndefined()
	})

	it('mid-drag chrome marks the origin toolbar dragging with its gaps inactive', async () => {
		const firstItem = { tool: 'run' }
		const secondItem = { tool: 'run' }
		const toolbar = [firstItem, secondItem]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		const palette = testPalette()
		palettes.editing = palette
		render(DragIdeProbe, { props: { palette, top: border } })
		const guard = document.querySelectorAll('.toolbar-item-guard')[0] as HTMLElement
		stubPointerCapture(guard)

		guard.dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit(10, 10, 1, 0) }))
		window.dispatchEvent(new PointerEvent('pointermove', { ...pointerInit(60, 10, 1, -1) }))
		await Promise.resolve()

		// The origin toolbar carries the live preview, so it renders the
		// dragging affordance and its own preview span goes inactive (the
		// dragged tool is shown, the in-toolbar drop zones collapse).
		expect(document.querySelector('.toolbar[data-dragging="true"]')).not.toBeNull()
		expect(liveItemSpaceCount()).toBeLessThan(3)

		window.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(60, 10, 0, 0) }))
		await Promise.resolve()
		expect(document.querySelector('.toolbar[data-dragging="true"]')).toBeNull()
		expect(toolbar).toHaveLength(2)
		expect(palettes.dragging).toBeUndefined()
	})

	it('re-opens drop zones on a second drag after a committed move', async () => {
		// Regression: after one move commits, the second drag session must still
		// discover and mark drop-zones (the report "second drag does not open
		// DZs" = stale space registration).
		const a = { tool: 'a' }
		const b = { tool: 'b' }
		const c = { tool: 'c' }
		const toolbar = [a, b, c]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		const palette = testPalette()
		palettes.editing = palette
		render(DragIdeProbe, { props: { palette, top: border } })

		const guards = () => document.querySelectorAll('.toolbar-item-guard') as NodeListOf<HTMLElement>
		guards().forEach(stubPointerCapture)

		const dragToGap = async (guardIndex: number) => {
			const guard = guards()[guardIndex]
			guard.dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit(10, 10, 1, 0) }))
			// Activate past threshold; jsdom rects are all-zero so the pointer
			// "move" just needs to exceed the activation distance.
			window.dispatchEvent(new PointerEvent('pointermove', { ...pointerInit(60, 10, 1, -1) }))
			await Promise.resolve()
			window.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(60, 10, 0, 0) }))
			await Promise.resolve()
		}

		// First drag: activate + commit (item b), then assert clean state.
		await dragToGap(1)
		expect(palettes.dragging).toBeUndefined()
		expect(toolbar).toHaveLength(3)

		// Second drag on the same guard: drop-zones must open (data-proximity).
		const guard = guards()[1]
		guard.dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit(10, 10, 1, 0) }))
		window.dispatchEvent(new PointerEvent('pointermove', { ...pointerInit(60, 10, 1, -1) }))
		await Promise.resolve()

		// At least one drop-zone is discovered/marked during the second drag.
		const openCount = document.querySelectorAll('.toolbar-border [data-proximity="true"]').length
		expect(openCount).toBeGreaterThan(0)

		window.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(60, 10, 0, 0) }))
		await Promise.resolve()
		expect(palettes.dragging).toBeUndefined()
		expect(toolbar).toHaveLength(3)
	})

	it('re-dragging a moved tool in a vertical toolbar still highlights the up/down (toolbar-space) drop-zones', async () => {
		// Regression: in a *vertical* (left/right) toolbar, re-dragging a tool
		// that has already been moved fails to highlight the begin/end (up/down)
		// reorder drop-zones. jsdom rects are all-zero, so the toolbar-item gaps
		// are mocked as horizontal bars stacked along the main (Y) axis — the
		// layout `nearestDragTargetsByDirection` sees for a left-border toolbar.
		const toolbar = [{ tool: 'a' }, { tool: 'b' }, { tool: 'c' }]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		const palette = testPalette()
		palettes.editing = palette
		render(VerticalIdeProbe, { props: { palette, left: border } })
		await Promise.resolve()

		const mockVerticalGaps = () => {
			const spaces = Array.from(
				document.querySelectorAll('.toolbar-border[data-region="left"] .toolbar-item-space')
			) as HTMLElement[]
			spaces.forEach((el, i) => {
				const top = i * 50
				el.getBoundingClientRect = () =>
					({
						left: 0,
						top,
						right: 20,
						bottom: top + 8,
						width: 20,
						height: 8,
						x: 0,
						y: top,
						toJSON: () => ({}),
					}) as DOMRect
			})
		}
		const guards = () =>
			document.querySelectorAll(
				'.toolbar-border[data-region="left"] .toolbar-item-guard'
			) as NodeListOf<HTMLElement>

		mockVerticalGaps()
		guards().forEach(stubPointerCapture)

		// First drag: move item `b` (guard 1) onto the end gap (gap 3 at y≈154).
		guards()[1].dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit(10, 60, 1, 0) }))
		window.dispatchEvent(new PointerEvent('pointermove', { ...pointerInit(10, 154, 1, -1) }))
		await tick()
		window.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(10, 154, 0, 0) }))
		await tick()
		expect(palettes.dragging).toBeUndefined()
		expect(toolbar).toHaveLength(3)

		// Re-mock: the DOM re-rendered after the commit.
		mockVerticalGaps()
		guards().forEach(stubPointerCapture)

		// Second drag: re-grab the moved tool and hover a toolbar gap. The
		// up/down (begin/end) reorder drop-zones must be marked data-proximity.
		guards()[2].dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit(10, 110, 1, 0) }))
		window.dispatchEvent(new PointerEvent('pointermove', { ...pointerInit(10, 54, 1, -1) }))
		await tick()

		const toolbarZones = document.querySelectorAll(
			'.toolbar-border[data-region="left"] .toolbar-item-space[data-proximity="true"]'
		)
		expect(toolbarZones.length).toBeGreaterThan(0)

		window.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(10, 54, 0, 0) }))
		await tick()
		expect(palettes.dragging).toBeUndefined()
		expect(toolbar).toHaveLength(3)
	})
})
