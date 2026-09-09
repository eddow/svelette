<script lang="ts">
	import Parking from '$lib/palette/components/Parking.svelte'
	import type { Palette as PaletteRuntime } from '$lib/palette/palette.svelte'
	import type { PaletteBorder, PaletteScope, PaletteToolbar } from '$lib/palette/types'

	let {
		palette,
		toolbars,
		border,
	}: {
		palette: PaletteRuntime
		toolbars: PaletteToolbar[]
		border?: PaletteBorder
	} = $props()
	const scope = $derived<PaletteScope>({ palette })
</script>

<Parking {toolbars} {palette} {scope} {border} />
