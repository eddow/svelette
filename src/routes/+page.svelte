<script lang="ts">
	import type { Component } from 'svelte'
	import { onMount } from 'svelte'
	import ConsoleOverlay from '$lib/demo/ConsoleOverlay.svelte'
	import { consoleUi } from '$lib/demo/console.svelte'
	import { demoPalette, demoState, initialIdeConfig } from '$lib/demo/palette.svelte'
	import Ide from '$lib/palette/components/Ide.svelte'
	import {
		palettes,
		serializePaletteLayout,
		validatePaletteLayout
	} from '$lib/palette/index.svelte'
	import type {
		PaletteBorder,
		PaletteEditorContext,
		SerializedPaletteLayout
	} from '$lib/palette/types'
	import '$lib/palette/styles/palette.css'
	import '$lib/head/styles/head-default.css'

	const LAYOUT_STORAGE_KEY = 'svelette-demo-layout-v1'

	function readStoredLayout(): SerializedPaletteLayout | undefined {
		try {
			const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
			if (!raw) return undefined
			const parsed: unknown = JSON.parse(raw)
			if (!validatePaletteLayout(parsed)) return undefined
			return parsed
		} catch {
			return undefined
		}
	}

	// Seed fresh clones so edits never mutate the shared `initialIdeConfig`
	// module object, and so server + client first render are identical.
	const top = $state(structuredClone(initialIdeConfig.top))
	const left = $state(structuredClone(initialIdeConfig.left))
	const right = $state(structuredClone(initialIdeConfig.right))
	const bottom = $state(structuredClone(initialIdeConfig.bottom))
	let layoutRestored = $state(false)

	// Theme resolution: `demoState.theme` is the setting (`light`/`dark`/`system`);
	// `resolvedTheme` is what actually renders. `system` follows the OS via
	// `prefers-color-scheme`. The `palette-default-theme-light` CSS class (the
	// only theme override in the head theme `head-default.css`; the base is
	// dark) is synced onto `<html>` so it also covers body-portaled drawer
	// popups, which live outside `<main>`.
	let systemPrefersLight = $state(false)
	$effect(() => {
		const query = window.matchMedia('(prefers-color-scheme: light)')
		systemPrefersLight = query.matches
		const onChange = (event: MediaQueryListEvent) => {
			systemPrefersLight = event.matches
		}
		query.addEventListener('change', onChange)
		return () => query.removeEventListener('change', onChange)
	})
	const resolvedTheme = $derived<'light' | 'dark'>(
		demoState.theme === 'system' ? (systemPrefersLight ? 'light' : 'dark') : demoState.theme
	)
	$effect(() => {
		const root = document.documentElement
		root.classList.toggle('palette-default-theme-light', resolvedTheme === 'light')
		root.dataset.theme = resolvedTheme
		root.style.colorScheme = resolvedTheme
	})

	// Restore a saved layout client-side after mount: SSR always renders the
	// initial layout (no hydration mismatch), then the stored borders are
	// spliced into the existing `$state` proxies. `hydratePaletteLayout` can't
	// run here (its `$state` is init-only), so the plain stored data is spliced
	// directly — the deep proxies make the inserted data reactive.
	onMount(() => {
		const stored = readStoredLayout()
		if (!stored) return
		applyStoredLayout(stored)
		layoutRestored = true
	})

	function applyStoredLayout(stored: SerializedPaletteLayout): void {
		// Serialized borders share the runtime shape of `PaletteBorder`; the
		// `readonly`/union friction is compile-time only, so cast once.
		const borders = stored.borders as unknown as Record<string, PaletteBorder>
		top.splice(0, top.length, ...borders.top)
		left.splice(0, left.length, ...borders.left)
		right.splice(0, right.length, ...borders.right)
		bottom.splice(0, bottom.length, ...borders.bottom)
	}

	function persistLayout() {
		try {
			const serialized = serializePaletteLayout({ top, left, right, bottom })
			localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(serialized))
			demoState.lastAction = 'Layout saved'
		} catch {
			demoState.lastAction = 'Layout save failed'
		}
	}

	function resetLayout() {
		try {
			localStorage.removeItem(LAYOUT_STORAGE_KEY)
		} catch {
			// ignore
		}
		top.splice(0, top.length, ...structuredClone(initialIdeConfig.top))
		left.splice(0, left.length, ...structuredClone(initialIdeConfig.left))
		right.splice(0, right.length, ...structuredClone(initialIdeConfig.right))
		bottom.splice(0, bottom.length, ...structuredClone(initialIdeConfig.bottom))
		demoState.lastAction = 'Layout reset'
	}

	const inspecting = $derived(palettes.inspecting)
	const inspectingItem = $derived(
		inspecting?.item as { tool?: string; editor?: string } | undefined
	)
	const inspectingTool = $derived(
		inspectingItem?.tool ? demoPalette.tool(inspectingItem.tool) : undefined
	)
	const Configurator = $derived.by(() => {
		if (!inspectingItem) return undefined
		try {
			return demoPalette.renderConfigurator(inspectingItem as never, inspectingTool as never, {
				palette: demoPalette,
				region: inspecting?.region
			}) as unknown as Component<{ context: PaletteEditorContext }>
		} catch {
			return undefined
		}
	})
	const configuratorContext = $derived.by(() => {
		if (!inspectingItem || !Configurator) return undefined
		try {
			return demoPalette.resolveConfiguratorContext(
				inspectingItem as never,
				inspectingTool as never,
				{ palette: demoPalette, region: inspecting?.region }
			) as unknown as PaletteEditorContext
		} catch {
			return undefined
		}
	})
	const inspectingDescriptor = $derived.by(() => {
		if (!inspectingItem) return undefined
		try {
			const entry = palettes.inspecting
			if (!entry) return undefined
			// Locate the live toolbar/index so structural actions act on the
			// real layout (not the singleton probe used for editorChoices).
			// `palettes.inspecting` carries no toolbar/index; resolve by identity.
			const borders = { top, left, right, bottom } as Record<string, unknown[]>
			for (const candidateRegion of ['top', 'left', 'right', 'bottom'] as const) {
				const candidateBorder = borders[candidateRegion] as
					| { toolbar?: unknown; track?: unknown[]; trackIndex?: number }[][]
					| undefined
				if (!candidateBorder) continue
				for (const track of candidateBorder) {
					for (const slot of track as unknown as {
						toolbar: unknown[]
					}[]) {
						const index = slot.toolbar.indexOf(entry.item as never)
						if (index < 0) continue
						return demoPalette.describeItemConfiguration(
							{
								item: entry.item as never,
								toolbar: slot.toolbar as never,
								index,
								region: candidateRegion
							},
							{
								axis:
									candidateRegion === 'left' || candidateRegion === 'right'
										? 'vertical'
										: 'horizontal',
								region: candidateRegion
							}
						)
					}
				}
			}
			return undefined
		} catch {
			return undefined
		}
	})
	function moveInspectingItem(direction: 'forward' | 'backward') {
		const descriptor = inspectingDescriptor
		const entry = palettes.inspecting
		if (!descriptor || !entry) return
		const { toolbar, index } = descriptor.target as unknown as {
			toolbar: unknown[]
			index: number
		}
		const next = direction === 'forward' ? index + 1 : index - 1
		if (next < 0 || next >= toolbar.length) return
		const [item] = toolbar.splice(index, 1)
		toolbar.splice(next, 0, item)
		demoState.lastAction = `Item moved ${direction}`
	}
	function removeInspectingItem() {
		const descriptor = inspectingDescriptor
		const entry = palettes.inspecting
		if (!descriptor || !entry) return
		const { toolbar, index } = descriptor.target as unknown as {
			toolbar: unknown[]
			index: number
		}
		toolbar.splice(index, 1)
		delete palettes.inspecting
		demoState.lastAction = 'Item removed'
	}
</script>

<main>
	<div class="demo-bar">
		<h1>svelette palette demo</h1>
		<button
			type="button"
			data-testid="edit-toggle"
			onclick={() => {
				palettes.editing = palettes.editing === demoPalette ? undefined : demoPalette
			}}
		>
			{palettes.editing === demoPalette ? 'Done' : 'Edit palette'}
		</button>
		<button type="button" data-testid="save-layout" onclick={persistLayout}>Save layout</button>
		<button type="button" data-testid="reset-layout" onclick={resetLayout}>Reset layout</button>
		{#if layoutRestored}
			<span class="demo-state" data-testid="layout-restored">Layout restored from localStorage</span
			>
		{/if}
		<span class="demo-state" data-testid="last-action">Last action: {demoState.lastAction}</span>
	</div>
	<Ide palette={demoPalette} {top} {left} {right} {bottom}>
		{#if consoleUi.open}
			<ConsoleOverlay {top} />
		{/if}
		<div class="demo-center">
			<div class="demo-hero">
				<div>
					<strong>Compact palette playground</strong>
					<span
						>Toolbar-first examples: icons, tooltips, select, button, toggle, and a slider override.</span
					>
				</div>
				<div class="demo-chip">{demoState.notifications ? '◉ Enabled' : '○ Muted'}</div>
			</div>
			<div class="demo-strip">
				<span class="demo-pill"
					>{demoState.layout === 'horizontal' ? '▤' : '▥'} {demoState.layout}</span
				>
				<span class="demo-pill">{demoState.mode === 'inspect' ? '⌕' : '⌘'} {demoState.mode}</span>
				<span class="demo-pill">🎨 {demoState.theme}</span>
				<span class="demo-pill">A {demoState.fontSize}px</span>
				<span class="demo-pill">★ x{demoState.gameSpeed}</span>
			</div>
			<div class="demo-panel">
				<div class="demo-panel-title">Live state</div>
				<div class="demo-state-grid">
					<div class="demo-state-row">
						<span class="demo-state-key">Last action</span>
						<span class="demo-state-value">{demoState.lastAction}</span>
					</div>
					<div class="demo-state-row">
						<span class="demo-state-key">Theme</span>
						<span class="demo-state-value">{demoState.theme}</span>
					</div>
					<div class="demo-state-row">
						<span class="demo-state-key">Mode</span>
						<span class="demo-state-value">{demoState.mode}</span>
					</div>
					<div class="demo-state-row">
						<span class="demo-state-key">Layout</span>
						<span class="demo-state-value">{demoState.layout}</span>
					</div>
				</div>
			</div>
			<p>Toggle edit mode, then click a toolbar item to configure it.</p>
			{#if inspectingItem && Configurator && configuratorContext}
				<div class="demo-inspector" data-testid="inspector">
					<strong>Item configuration</strong>
					{#if inspectingDescriptor}
						<div class="demo-inspector-row">
							<span class="demo-state-key">Shortcut</span>
							<span class="demo-state-value" data-testid="inspector-shortcut"
								>{inspectingDescriptor.bindings?.shortcut ?? '—'}</span
							>
						</div>
						<div class="demo-inspector-actions">
							<button
								type="button"
								data-testid="inspector-move-back"
								disabled={!inspectingDescriptor.structure.moveBackward?.enabled}
								onclick={() => moveInspectingItem('backward')}>← Move back</button
							>
							<button
								type="button"
								data-testid="inspector-move-forward"
								disabled={!inspectingDescriptor.structure.moveForward?.enabled}
								onclick={() => moveInspectingItem('forward')}>Move forward →</button
							>
							<button
								type="button"
								data-testid="inspector-remove"
								disabled={!inspectingDescriptor.structure.removable}
								onclick={removeInspectingItem}>Remove</button
							>
						</div>
					{/if}
					<Configurator context={configuratorContext} />
				</div>
			{:else if inspectingItem}
				<div class="demo-inspector">
					<strong>Item configuration</strong>
					<p>No configurator for {inspectingItem.tool ?? inspectingItem.editor}.</p>
				</div>
			{/if}
		</div>
	</Ide>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 100vh;
		font-family: system-ui, sans-serif;
		background: #020617;
		color: #e2e8f0;
	}
	/* Light mode follows the resolved theme on `<html data-theme>` (see script). */
	:global(html[data-theme='light']) main {
		background: #f1f5f9;
		color: #0f172a;
	}
	.demo-bar {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
	}
	.demo-bar h1 {
		font-size: 1.1rem;
		margin: 0;
	}
	.demo-center {
		position: relative;
		padding: 1rem;
		display: grid;
		gap: 1rem;
		align-content: start;
	}
	.demo-inspector {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid rgba(71, 85, 105, 0.65);
		border-radius: 12px;
		max-width: 32rem;
		background: rgba(15, 23, 42, 0.64);
	}
	:global(html[data-theme='light']) .demo-inspector {
		border-color: #cbd5e1;
		background: #ffffff;
	}
	.demo-inspector-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.demo-inspector-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	:global(.palette-ide-center) {
		position: relative;
	}
	.demo-hero,
	.demo-panel {
		display: grid;
		gap: 10px;
		padding: 14px;
		border: 1px solid rgba(51, 65, 85, 0.9);
		border-radius: 16px;
		background: rgba(15, 23, 42, 0.82);
		box-shadow: 0 16px 36px rgba(2, 6, 23, 0.28);
		color: #e2e8f0;
	}
	.demo-hero {
		grid-template-columns: 1fr auto;
		align-items: center;
	}
	:global(html[data-theme='light']) .demo-hero,
	:global(html[data-theme='light']) .demo-panel {
		border-color: rgba(148, 163, 184, 0.9);
		background: #ffffff;
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
		color: #0f172a;
	}
	.demo-hero span {
		color: #94a3b8;
	}
	:global(html[data-theme='light']) .demo-hero span {
		color: #475569;
	}
	.demo-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0.42rem 0.8rem;
		border-radius: 999px;
		background: rgba(30, 41, 59, 0.96);
		border: 1px solid rgba(96, 165, 250, 0.24);
		color: #bfdbfe;
	}
	:global(html[data-theme='light']) .demo-chip {
		background: rgba(241, 245, 249, 0.96);
		border-color: rgba(148, 163, 184, 0.9);
		color: #0f172a;
	}
	.demo-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 10px 12px;
		border: 1px dashed rgba(71, 85, 105, 0.9);
		border-radius: 14px;
		background: rgba(15, 23, 42, 0.56);
	}
	:global(html[data-theme='light']) .demo-strip {
		border-color: rgba(148, 163, 184, 0.9);
		background: rgba(241, 245, 249, 0.96);
	}
	.demo-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0.34rem 0.7rem;
		border-radius: 999px;
		background: linear-gradient(180deg, #2563eb, #1d4ed8);
		color: #eff6ff;
		font-size: 0.78rem;
		font-weight: 600;
	}
	.demo-panel-title {
		font-size: 0.82rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #94a3b8;
	}
	:global(html[data-theme='light']) .demo-panel-title {
		color: #475569;
	}
	.demo-state-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 8px;
	}
	.demo-state-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0.52rem 0.82rem;
		border: 1px solid rgba(71, 85, 105, 0.65);
		border-radius: 11px;
		background: rgba(15, 23, 42, 0.64);
	}
	:global(html[data-theme='light']) .demo-state-row {
		border-color: rgba(148, 163, 184, 0.9);
		background: rgba(241, 245, 249, 0.96);
	}
	.demo-state-key {
		font-size: 0.74rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #94a3b8;
	}
	:global(html[data-theme='light']) .demo-state-key {
		color: #475569;
	}
	.demo-state-value {
		font-weight: 600;
	}
</style>
