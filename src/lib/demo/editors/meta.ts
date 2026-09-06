import type {
	PaletteScope,
	PaletteSurfaceContext,
	PaletteToolbarItem,
	PaletteToolEnumValue,
} from '$lib/palette/types'

export type DemoItemConfigBase = {
	icon?: string
	label?: string
	hint?: string
	tone?: 'neutral' | 'accent'
}

export type DemoChoiceDisplay = 'icon' | 'text' | 'both'

export type DemoEnumSubsetConfig = DemoItemConfigBase & {
	choiceDisplay?: DemoChoiceDisplay
	values?: readonly string[]
	keywords?: readonly string[]
}

export type DemoItemConfig = DemoItemConfigBase | DemoEnumSubsetConfig

type AnyItem = PaletteToolbarItem<string, string, unknown>

export function toolbarMeta(item: AnyItem) {
	const config = ((item as { config?: unknown }).config ?? {}) as DemoItemConfigBase
	return {
		config,
		editor: item.editor,
		icon: typeof config.icon === 'string' ? config.icon : undefined,
		label: typeof config.label === 'string' ? config.label : (item.tool ?? item.editor ?? 'Item'),
		hint: typeof config.hint === 'string' ? config.hint : undefined,
		tone: config.tone === 'accent' ? 'accent' : 'neutral',
	} as const
}

export function tooltip(item: AnyItem, suffix?: string): string {
	const meta = toolbarMeta(item)
	return suffix ? `${meta.label} · ${suffix}` : meta.label
}

export function layoutFromSurface(
	scope: PaletteScope,
	surface?: PaletteSurfaceContext
): 'horizontal' | 'vertical' {
	if (surface) return surface.axis === 'vertical' ? 'vertical' : 'horizontal'
	const region = (scope.region as string | undefined) ?? undefined
	return region === 'left' || region === 'right' ? 'vertical' : 'horizontal'
}

export function regionFromScope(scope: PaletteScope): string {
	return (scope.region as string | undefined) ?? 'top'
}

export function menuChevron(scope: PaletteScope): string {
	switch (regionFromScope(scope)) {
		case 'bottom':
			return '▴'
		case 'left':
			return '▸'
		case 'right':
			return '◂'
		default:
			return '▾'
	}
}

export function enumSubsetConfig(item: AnyItem): DemoEnumSubsetConfig | undefined {
	const config = (item as { config?: unknown }).config
	if (!config || typeof config !== 'object') return undefined
	return config as DemoEnumSubsetConfig
}

export function enumChoiceDisplay(item: AnyItem): DemoChoiceDisplay {
	const value = enumSubsetConfig(item)?.choiceDisplay
	return value === 'icon' || value === 'text' || value === 'both' ? value : 'both'
}

function normalizeSubsetToken(value: string): string {
	return value.trim().toLowerCase()
}

export function resolveEnumValues<T extends string>(
	item: AnyItem,
	tool: { readonly values: readonly PaletteToolEnumValue<T>[] }
): readonly PaletteToolEnumValue<T>[] {
	const config = enumSubsetConfig(item)
	const explicitValues = config?.values
	if (explicitValues?.length) {
		const allowed = new Set(explicitValues.map(normalizeSubsetToken))
		return tool.values.filter((value) => allowed.has(normalizeSubsetToken(value.value)))
	}
	const keywords = config?.keywords
	if (!keywords?.length) return tool.values
	const wanted = new Set(keywords.map(normalizeSubsetToken))
	return tool.values.filter((value) => {
		const haystack = [value.value, value.label ?? '', ...(value.keywords ?? [])]
			.join(' ')
			.toLowerCase()
		for (const keyword of wanted) if (haystack.includes(keyword)) return true
		return false
	})
}

export function enumChoiceText<T extends string>(
	value: PaletteToolEnumValue<T>,
	display: DemoChoiceDisplay
): string {
	const label = value.label ?? value.value
	const icon = typeof value.icon === 'string' ? value.icon : undefined
	if (display === 'icon') return icon ?? label
	if (display === 'text') return label
	return icon ? `${icon} ${label}` : label
}
