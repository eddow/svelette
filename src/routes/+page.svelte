<script lang="ts">
	import type { Component } from 'svelte'
	import { demoPalette, demoState, initialIdeConfig } from '$lib/demo/palette.svelte'
	import Ide from '$lib/palette/components/Ide.svelte'
	import { palettes } from '$lib/palette/index.svelte'
	import type { PaletteEditorContext } from '$lib/palette/types'
	import '$lib/palette/styles/palette.css'
	import '$lib/palette/styles/palette-default.css'

	const top = $state(initialIdeConfig.top)
	const left = $state(initialIdeConfig.left)
	const right = $state(initialIdeConfig.right)
	const bottom = $state(initialIdeConfig.bottom)

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
</script>

<main>
	<div class="demo-bar">
		<h1>svelette palette demo</h1>
		<button
			type="button"
			onclick={() => {
				palettes.editing = palettes.editing === demoPalette ? undefined : demoPalette
			}}
		>
			{palettes.editing === demoPalette ? 'Done' : 'Edit palette'}
		</button>
		<span class="demo-state">Last action: {demoState.lastAction}</span>
	</div>
	<Ide palette={demoPalette} {top} {left} {right} {bottom}>
		<div class="demo-center">
			<p>Center content. Toggle edit mode, then click a toolbar item to configure it.</p>
			{#if inspectingItem && Configurator && configuratorContext}
				<div class="demo-inspector">
					<strong>Item configuration</strong>
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
		padding: 1rem;
		display: grid;
		gap: 1rem;
		align-content: start;
	}
	.demo-inspector {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid #cbd5e1;
		border-radius: 12px;
		max-width: 32rem;
	}
</style>
