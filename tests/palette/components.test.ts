import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	Palette,
	paletteItemDrag,
	paletteItemShield,
	paletteRoot,
	palettes,
} from '$lib/palette/edition.svelte'
import type { PaletteConfig } from '$lib/palette/types'
import IdeProbe from './IdeProbe.svelte'
import PaletteItemDragProbe from './PaletteItemDragProbe.svelte'
import PaletteItemShieldToggleProbe from './PaletteItemShieldToggleProbe.svelte'
import PaletteRootProbe from './PaletteRootProbe.svelte'
import ParkingEditorStub from './ParkingEditorStub.svelte'
import ParkingProbe from './ParkingProbe.svelte'

function testPalette(run: () => void): Palette {
	return new Palette({
		tools: {
			run: {
				get can() {
					return true
				},
				run,
			},
		},
		keys: {
			N: 'run',
		},
	})
}

describe('paletteRoot', () => {
	afterEach(() => {
		document.body.replaceChildren()
		palettes.editing = undefined
		palettes.inspecting = undefined
	})

	it('ignores shortcuts triggered from editable descendants', async () => {
		const run = vi.fn()
		render(PaletteRootProbe, { props: { palette: testPalette(run) } })
		const root = screen.getByTestId('palette-root')
		const input = document.createElement('input')
		root.appendChild(input)
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true }))
		expect(run).not.toHaveBeenCalled()
	})

	it('ignores shortcuts when a child already consumed the event', async () => {
		const run = vi.fn()
		render(PaletteRootProbe, { props: { palette: testPalette(run) } })
		const root = screen.getByTestId('palette-root')
		const child = document.createElement('button')
		root.appendChild(child)
		child.addEventListener('keydown', (event) => {
			event.preventDefault()
		})
		child.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true }))
		expect(run).not.toHaveBeenCalled()
	})

	it('runs bound command shortcuts from the palette root', async () => {
		const run = vi.fn()
		render(PaletteRootProbe, { props: { palette: testPalette(run) } })
		const root = screen.getByTestId('palette-root')
		const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true })
		const stopPropagation = vi.spyOn(event, 'stopPropagation')
		root.dispatchEvent(event)
		expect(run).toHaveBeenCalledTimes(1)
		expect(event.defaultPrevented).toBe(true)
		expect(stopPropagation).toHaveBeenCalledTimes(1)
	})

	it('does not run disabled command shortcuts but still consumes the event', async () => {
		const run = vi.fn()
		const palette = new Palette({
			tools: {
				run: {
					get can() {
						return false
					},
					run,
				},
			},
			keys: {
				N: 'run',
			},
		} satisfies PaletteConfig)
		render(PaletteRootProbe, { props: { palette } })
		const root = screen.getByTestId('palette-root')
		const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true })
		root.dispatchEvent(event)
		expect(run).not.toHaveBeenCalled()
		expect(event.defaultPrevented).toBe(true)
	})

	it('toggles boolean tools from keyboard shortcuts', async () => {
		const notifications = {
			type: 'boolean' as const,
			value: false,
			default: false,
		}
		const palette = new Palette({
			tools: {
				notifications,
			},
			keys: {
				N: 'notifications',
			},
		} satisfies PaletteConfig)
		render(PaletteRootProbe, { props: { palette } })
		const root = screen.getByTestId('palette-root')
		root.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true }))
		expect(notifications.value).toBe(true)
		root.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true }))
		expect(notifications.value).toBe(false)
	})

	it('suppresses tool shortcuts while editing (keys are free for re-binding)', async () => {
		const run = vi.fn()
		const palette = testPalette(run)
		render(PaletteRootProbe, { props: { palette } })
		const root = screen.getByTestId('palette-root')
		palettes.editing = palette
		const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true })
		root.dispatchEvent(event)
		expect(run).not.toHaveBeenCalled()
		expect(event.defaultPrevented).toBe(false)
	})

	it('reflects editing state on the root element', async () => {
		const run = vi.fn()
		const palette = testPalette(run)
		render(PaletteRootProbe, { props: { palette } })
		const root = screen.getByTestId('palette-root')

		palettes.editing = palette
		await Promise.resolve()
		expect(root.dataset.editing).toBe('true')
		expect(root.classList.contains('palette-editing')).toBe(true)
	})

	it('clicks an item to inspect it (no movement yet)', async () => {
		const firstItem = { tool: 'run' }
		const secondItem = { tool: 'run' }
		const toolbar = [firstItem, secondItem]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		const palette = testPalette(() => {})
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
		Object.defineProperties(guard, {
			setPointerCapture: { configurable: true, value: vi.fn() },
			releasePointerCapture: { configurable: true, value: vi.fn() },
			hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
		})
		guard.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				button: 0,
				buttons: 1,
				pointerId: 1,
			})
		)
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				cancelable: true,
				button: 0,
				buttons: 0,
				pointerId: 1,
			})
		)

		// `$state` proxies `inspecting.item`, so identity is structural.
		expect(palettes.inspecting?.palette).toBe(palette)
		expect(palettes.inspecting?.item).toStrictEqual(firstItem)
	})

	it('keeps an item inspected on pointer moves (no movement yet)', async () => {
		const firstItem = { tool: 'run' }
		const secondItem = { tool: 'run' }
		const toolbar = [firstItem, secondItem]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		const palette = testPalette(() => {})
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
		Object.defineProperties(guard, {
			setPointerCapture: { configurable: true, value: vi.fn() },
			releasePointerCapture: { configurable: true, value: vi.fn() },
			hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
		})
		guard.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				button: 0,
				buttons: 1,
				clientX: 10,
				clientY: 10,
				pointerId: 1,
			})
		)
		window.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				cancelable: true,
				buttons: 1,
				clientX: 20,
				clientY: 10,
				pointerId: 1,
			})
		)
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				cancelable: true,
				button: 0,
				buttons: 0,
				clientX: 20,
				clientY: 10,
				pointerId: 1,
			})
		)

		expect(palettes.inspecting?.palette).toBe(palette)
		expect(palettes.inspecting?.item).toStrictEqual(firstItem)
	})

	it('renders an Ide with borders and center content', async () => {
		const palette = testPalette(() => {})
		const top = [[{ space: 0, toolbar: [] }]]
		render(IdeProbe, { props: { palette, top } })
		expect(screen.getByTestId('ide-center')).toBeTruthy()
		expect(document.querySelector('.palette-ide')).toBeTruthy()
		expect(document.querySelector('.toolbar-border')).toBeTruthy()
	})

	it('keeps parked toolbar content interactive while editing', async () => {
		const run = vi.fn()
		const palette = new Palette({
			tools: {
				run: {
					get can() {
						return true
					},
					run,
				},
			},
			keys: {
				N: 'run',
			},
			editor: () => ParkingEditorStub as never,
		} satisfies PaletteConfig)
		palettes.editing = palette
		render(ParkingProbe, { props: { palette, toolbars: [[{ tool: 'run' }]] } })
		const button = document.querySelector<HTMLButtonElement>('#parked-run')
		expect(button).toBeTruthy()
		await fireEvent.click(button!)
		expect(run).toHaveBeenCalledTimes(1)
	})

	it('deletes a parked toolbar from parking while editing', async () => {
		const palette = new Palette({
			tools: {
				run: {
					get can() {
						return true
					},
					run() {},
				},
			},
			keys: {
				N: 'run',
			},
			editor: () => ParkingEditorStub as never,
		} satisfies PaletteConfig)
		palettes.editing = palette
		render(ParkingProbe, { props: { palette, toolbars: [[{ tool: 'run' }]] } })
		const removeButton = document.querySelector<HTMLButtonElement>('.palette-parking-remove')
		expect(removeButton).toBeTruthy()
		expect(document.querySelector('#parked-run')).toBeTruthy()
		await fireEvent.click(removeButton!)
		expect(document.querySelector('.palette-parking-remove')).toBeNull()
		expect(document.querySelector('#parked-run')).toBeNull()
	})

	it('G3: parking bound to a live border removes from the real border', async () => {
		const palette = new Palette({
			tools: {
				run: {
					get can() {
						return true
					},
					run() {},
				},
			},
			keys: {
				N: 'run',
			},
			editor: () => ParkingEditorStub as never,
		} satisfies PaletteConfig)
		palettes.editing = palette
		const liveToolbar = [{ tool: 'run' }]
		const liveTrack = [{ space: 0, toolbar: liveToolbar }]
		const liveBorder = [liveTrack]
		render(ParkingProbe, { props: { palette, toolbars: [], border: liveBorder } })
		expect(document.querySelector('#parked-run')).toBeTruthy()
		await fireEvent.click(document.querySelector<HTMLButtonElement>('.palette-parking-remove')!)
		// The live border — not a local copy — is pruned. (The plain test
		// array is not `$state`-reactive, so the DOM row lingers here; in the
		// app `top` is `$state` and the row disappears with the splice.)
		expect(liveBorder).toHaveLength(0)
	})

	it('exposes paletteRoot and paletteItemDrag as actions', () => {
		expect(typeof paletteRoot).toBe('function')
		expect(typeof paletteItemDrag).toBe('function')
	})
})

describe('paletteItemShield', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('sets inert on mount and toggles it when the active flag updates', async () => {
		render(PaletteItemShieldToggleProbe, { props: { initial: false } })
		const el = screen.getByTestId('shielded')
		const toggle = screen.getByTestId('toggle-btn')
		expect(el.inert).toBe(false)

		await fireEvent.click(toggle)
		expect(el.inert).toBe(true)

		await fireEvent.click(toggle)
		expect(el.inert).toBe(false)
	})

	it('exposes paletteItemShield as an action', () => {
		expect(typeof paletteItemShield).toBe('function')
	})
})
