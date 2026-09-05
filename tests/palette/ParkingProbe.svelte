<script lang="ts">
	import Parking from '$lib/palette/components/Parking.svelte'
	import type { Palette as PaletteRuntime } from '$lib/palette/palette.svelte'
	import type { PaletteScope, PaletteToolbar } from '$lib/palette/types'

	let { palette, toolbars }: { palette: PaletteRuntime; toolbars: PaletteToolbar[] } = $props()
	const scope = $derived<PaletteScope>({ palette })
</script>

<Parking {toolbars} {palette} {scope} />
