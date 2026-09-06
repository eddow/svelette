<script lang="ts">
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolRun
	} from '$lib/palette/types'
	import { layoutFromSurface, menuChevron, regionFromScope, toolbarMeta, tooltip } from './meta'

	type Props = {
		context: PaletteEditorContext<PaletteToolRun, PaletteToolbarItem, PaletteSchema>
		onAction?: (action: string) => void
	}

	let { context, onAction }: Props = $props()
	const item = $derived(context.item)
	const tool = $derived(context.tool)
	const meta = $derived(toolbarMeta(item))
	const direction = $derived(layoutFromSurface(context.scope, context.surface))
	const region = $derived(regionFromScope(context.scope))

	let open = $state(false)
	let selected = $state('reset')

	function pick(action: string) {
		selected = action
		open = false
		onAction?.(action)
		if (action === 'reset') tool.run()
	}
</script>

<div
	class={[
		'palette-default-split',
		'palette-default-split-button',
		`palette-default-tone-${meta.tone}`,
		`palette-default-layout-${direction}`
	]}
>
	<button
		type="button"
		class={['palette-default-tool', 'palette-default-tool-accent']}
		disabled={!tool.can}
		title={tooltip(item, 'Run selected action')}
		onclick={() => pick(selected)}
	>
		{#if meta.icon}
			<span class="palette-default-icon">{meta.icon}</span>
		{:else}
			<span class="palette-default-icon">↺</span>
		{/if}
	</button>
	<button
		type="button"
		class="palette-default-trigger"
		title={tooltip(item, 'Open action presets')}
		aria-haspopup="menu"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		{menuChevron(context.scope)}
	</button>
	{#if open}
		<div
			class={[
				'palette-default-menu',
				`palette-default-layout-${direction}`,
				`palette-default-region-${region}`
			]}
			role="menu"
		>
			<button
				type="button"
				class="palette-default-menu-item"
				role="menuitem"
				onclick={() => pick('reset')}
			>
				Reset
			</button>
			<button
				type="button"
				class="palette-default-menu-item"
				role="menuitem"
				onclick={() => pick('presentation')}
			>
				Present
			</button>
			<button
				type="button"
				class="palette-default-menu-item"
				role="menuitem"
				onclick={() => pick('inspect')}
			>
				Inspect
			</button>
		</div>
	{/if}
</div>
