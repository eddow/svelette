<script lang="ts">
	import type { PaletteItemDragTarget } from '$lib/palette/index.svelte'
	import { paletteItemDrag } from '$lib/palette/index.svelte'

	let { target }: { target: PaletteItemDragTarget } = $props()
</script>

<div data-testid="item-guard" use:paletteItemDrag={target}></div>
