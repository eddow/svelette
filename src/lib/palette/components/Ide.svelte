<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { SvelteHTMLElements } from 'svelte/elements'
	import { paletteRoot } from '../layout.svelte'
	import type { Palette as PaletteRuntime } from '../palette.svelte'
	import type { PaletteBorder, PaletteScope } from '../types'
	import ToolbarBorder from './ToolbarBorder.svelte'

	type Props = {
		palette: PaletteRuntime
		top?: PaletteBorder
		right?: PaletteBorder
		bottom?: PaletteBorder
		left?: PaletteBorder
		el?: SvelteHTMLElements['div']
		center?: SvelteHTMLElements['div']
		border?: SvelteHTMLElements['div']
		track?: SvelteHTMLElements['div']
		space?: SvelteHTMLElements['div']
		toolbar?: SvelteHTMLElements['div']
		children?: Snippet
	}

	let {
		palette,
		top,
		right,
		bottom,
		left,
		el,
		center,
		border,
		track,
		space,
		toolbar,
		children
	}: Props = $props()

	// The scope record is the serializable payload editors read (`palette` +
	// `region`); children stamp `region` at the border level. `$derived` keeps
	// it reactive if the `palette` prop changes without recreating it per render.
	const scope = $derived<PaletteScope>({ palette })
</script>

<div
	{...el}
	class={['palette-ide', el?.class]}
	data-palette-id={palette.id}
	use:paletteRoot={palette}
>
	{#if top !== undefined}
		<ToolbarBorder
			border={top}
			direction="horizontal"
			region="top"
			{palette}
			{scope}
			el={border}
			{track}
			{space}
			{toolbar}
		/>
	{/if}
	<div class="palette-ide-middle">
		{#if left !== undefined}
			<ToolbarBorder
				border={left}
				direction="vertical"
				region="left"
				{palette}
				{scope}
				el={border}
				{track}
				{space}
				{toolbar}
			/>
		{/if}
		<div {...center} class={['palette-ide-center', center?.class]}>
			{@render children?.()}
		</div>
		{#if right !== undefined}
			<ToolbarBorder
				border={right}
				inverse={true}
				direction="vertical"
				region="right"
				{palette}
				{scope}
				el={border}
				{track}
				{space}
				{toolbar}
			/>
		{/if}
	</div>
	{#if bottom !== undefined}
		<ToolbarBorder
			border={bottom}
			inverse={true}
			direction="horizontal"
			region="bottom"
			{palette}
			{scope}
			el={border}
			{track}
			{space}
			{toolbar}
		/>
	{/if}
</div>
