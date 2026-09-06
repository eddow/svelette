import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	beginPaletteCatalogInsertDrag,
	Palette,
	paletteItemDrag,
	paletteRoot,
	palettes,
} from '$lib/palette/index.svelte'
import type { PaletteConfig } from '$lib/palette/types'
import IdeProbe from './IdeProbe.svelte'
import PaletteItemDragProbe from './PaletteItemDragProbe.svelte'
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

describe('catalogue insert session', () => {
	afterEach(() => {
		palettes.catalogDrag = undefined
		palettes.dragging = undefined
	})

	it('tags the ephemeral shell so drop-after-move skips a second insert', () => {
		const palette = testPalette(() => {})
		const item = { tool: 'run' as const, editor: 'button' as const, config: {} }
		beginPaletteCatalogInsertDrag(palette, item as never)
		const session = palettes.dragging
		expect(session?.catalogInsert).toBe(true)
		// `$state` deep-proxies the session, so the seed border and `border`
		// are equal proxies of the same array, not `===` identical.
		expect(session?.catalogInsertSeedBorder).toStrictEqual(session?.border)
	})
})

describe('paletteRoot', () => {
	afterEach(() => {
		document.body.replaceChildren()
		palettes.catalogDrag = undefined
		palettes.editing = undefined
		palettes.dragging = undefined
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

	it('reflects editing and dragging state on the root element', async () => {
		const run = vi.fn()
		const palette = testPalette(run)
		render(PaletteRootProbe, { props: { palette } })
		const root = screen.getByTestId('palette-root')

		palettes.editing = palette
		await Promise.resolve()
		expect(root.dataset.editing).toBe('true')
		expect(root.classList.contains('palette-editing')).toBe(true)

		palettes.dragging = {
			border: [],
			createdTracks: [],
			index: 0,
			palette,
			region: 'top',
			sourceItems: [],
			sourceBorder: [],
			sourceRegion: 'top',
			sourceTrack: [],
			sourceTrackIndex: 0,
			sourceTrackWasSingleton: false,
			toolbar: [],
			track: [],
			trackIndex: 0,
		}
		await Promise.resolve()
		expect(root.dataset.dragging).toBe('true')
		expect(root.classList.contains('palette-dragging')).toBe(true)
	})

	it('clicks an item to inspect it without entering dragging state', async () => {
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

		expect(palettes.dragging).toBeUndefined()
		// `$state` proxies `inspecting.item`, so identity is structural.
		expect(palettes.inspecting?.palette).toBe(palette)
		expect(palettes.inspecting?.item).toStrictEqual(firstItem)
	})

	it('keeps an item inspected when drag activates without moving it elsewhere', async () => {
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

		expect(palettes.dragging).toBeUndefined()
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

	it('exposes paletteRoot and paletteItemDrag as actions', () => {
		expect(typeof paletteRoot).toBe('function')
		expect(typeof paletteItemDrag).toBe('function')
	})
})
