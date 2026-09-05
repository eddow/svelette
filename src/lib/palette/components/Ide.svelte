<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { SvelteHTMLElements } from 'svelte/elements'
	import { paletteRoot } from '../layout.svelte'
	import { type Palette as PaletteRuntime, setPaletteScope } from '../palette.svelte'
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
	// Published into Svelte context for drawer portals (Phase 7); layout
	// children additionally receive it via the `scope` prop. The init-time read
	// of `palette` is deliberate: the scope seeds once, then stays reactive via
	// `$derived` (svelte-check `state_referenced_locally` is a false positive
	// here — the reference is inside the `$derived` expression).
	const scope = $derived<PaletteScope>({ palette })
	// svelte-ignore state_referenced_locally
	setPaletteScope(scope)
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
