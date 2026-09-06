<script lang="ts">
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolEnum
	} from '$lib/palette/types'
	import {
		enumChoiceDisplay,
		enumChoiceText,
		layoutFromSurface,
		menuChevron,
		regionFromScope,
		resolveEnumValues,
		toolbarMeta,
		tooltip
	} from './meta'

	type Props = {
		context: PaletteEditorContext<PaletteToolEnum<string>, PaletteToolbarItem, PaletteSchema>
		onChange?: (value: string) => void
	}

	let { context, onChange }: Props = $props()
	const item = $derived(context.item)
	const tool = $derived(context.tool)
	const meta = $derived(toolbarMeta(item))
	const direction = $derived(layoutFromSurface(context.scope, context.surface))
	const region = $derived(regionFromScope(context.scope))
	const values = $derived(resolveEnumValues(item, tool))
	const display = $derived(enumChoiceDisplay(item))

	let open = $state(false)
	const currentIcon = $derived(
		(() => {
			const current = values.find((value) => value.value === tool.value)
			if (current && typeof current.icon === 'string') return current.icon
			return meta.icon ?? tool.value
		})()
	)

	function pick(value: string) {
		tool.value = value
		open = false
		onChange?.(value)
	}
</script>

<div
	class={[
		'palette-default-split',
		'palette-default-split-radio',
		`palette-default-tone-${meta.tone}`,
		`palette-default-layout-${direction}`
	]}
>
	<button
		type="button"
		class={['palette-default-tool', tool.value !== tool.default ? 'is-selected' : undefined]}
		title={tooltip(item, tool.value)}
		onclick={() => {
			const index = values.findIndex((value) => value.value === tool.value)
			const next = values[(index + 1 + values.length) % values.length]
			if (next && next.can !== false) pick(next.value)
		}}
	>
		<span class="palette-default-icon">{currentIcon}</span>
	</button>
	<button
		type="button"
		class="palette-default-trigger"
		title={tooltip(item, 'Open choices')}
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
			{#each values as value (value.value)}
				<button
					type="button"
					class={[
						'palette-default-menu-item',
						tool.value === value.value ? 'is-selected' : undefined
					]}
					role="menuitemradio"
					aria-checked={tool.value === value.value}
					disabled={value.can === false}
					title={enumChoiceText(value, 'both')}
					onclick={() => pick(value.value)}
				>
					<span class="palette-default-choice">{enumChoiceText(value, display)}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
