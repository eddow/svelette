<script lang="ts">
	import type { Component } from 'svelte'
	import Parking from '$lib/palette/components/Parking.svelte'
	import { closeConsole, consoleState } from '$lib/palette/console.svelte'
	import type {
		PaletteAddItemCommandEntry,
		PaletteCatalogDragPayload,
		PaletteDerivedVariant
	} from '$lib/palette/edition.svelte'
	import {
		beginPaletteCatalogInsertDrag,
		handlePaletteCommandBoxInputKeydown,
		handlePaletteCommandChipKeydown,
		notifyPaletteCatalogNativeDragStarted,
		PALETTE_CATALOG_DRAG_MIME,
		paletteAddItemEntries,
		paletteCommandBoxModel,
		paletteCommandEntries,
		paletteDerivedVariants,
		palettes,
		paletteToolbarItemFromCatalogPayload,
		serializePaletteCatalogDragPayload,
		setPaletteCommandBoxInput
	} from '$lib/palette/edition.svelte'
	import type { Palette as PaletteRuntime } from '$lib/palette/palette.svelte'
	import type { PaletteBorder, PaletteEditorContext, PaletteToolbar } from '$lib/palette/types'

	type Props = {
		palette: PaletteRuntime
		top: PaletteBorder
		left?: PaletteBorder
		right?: PaletteBorder
		bottom?: PaletteBorder
	}

	let { palette, top, left, right, bottom }: Props = $props()

	// Auto-detect whether a `commandBox` item is displayed in any border. If it
	// is, the console is edit-only (the toolbar launcher is the edit entry
	// point); if not, the console is command-first with optional edit. Adding
	// or removing the `commandBox` item from a toolbar changes this behaviour
	// live, since the borders are reactive.
	const hasCommandBoxTool = $derived(
		[top, left, right, bottom].some((border) =>
			border?.some((track) =>
				track.some((slot) => slot.toolbar.some((item) => item.editor === 'commandBox'))
			)
		)
	)

	// Models must be created during component init (rune init-time constraint).
	// `console` is the core meta-tool that opens this console; exclude it from
	// run/add so it isn't listed — or re-executed — inside the console.
	// Entries are seeded once from the (stable) palette prop.
	// svelte-ignore state_referenced_locally
	const runEntries = paletteCommandEntries({
		palette: palette as never,
		excludeTools: ['console']
	})
	// svelte-ignore state_referenced_locally
	const addEntries = paletteAddItemEntries({
		palette: palette as never,
		excludeTools: ['console']
	})
	const popupCommandBox = paletteCommandBoxModel({
		entries: runEntries,
		placeholder: 'Command…'
	})
	const popupAddCommandBox = paletteCommandBoxModel({
		entries: addEntries,
		placeholder: 'Add to toolbar…',
		enterAction: 'select'
	})

	// Edit-only when a `commandBox` tool is displayed (the launcher is the
	// edit entry point); command-first with optional edit otherwise.
	// Read-only palettes (`editable: false`) never edit: no toggle, run box
	// only — otherwise the toggle would flip `consoleState.mode` to `edit`
	// while `palette.editing` stays `false` (the getter guards on
	// `editable !== false`), leaving a dead add box/catalogue.
	const canEdit = $derived(palette.config.editable !== false)
	const editOnly = $derived(hasCommandBoxTool)
	const isEditing = $derived(canEdit && (editOnly || consoleState.mode === 'edit'))
	const activeBox = $derived(isEditing ? popupAddCommandBox : popupCommandBox)

	// The inspected item (selected on the toolbar via `pointerdown`) drives a
	// presentation-only configurator: label/icon/hint/editor/tone. Structural
	// edits (move/remove) are out of scope here — the console renders the
	// configurator "snippet" for the current selection, while the live editor is
	// highlighted (not re-rendered) in the toolbar.
	const inspecting = $derived(
		palettes.inspecting?.palette === (palette as never) ? palettes.inspecting : undefined
	)
	const inspectingItem = $derived(
		inspecting?.item as { tool?: string; editor?: string } | undefined
	)
	const inspectingTool = $derived(
		inspectingItem?.tool ? palette.tool(inspectingItem.tool) : undefined
	)
	const Configurator = $derived.by<Component<{ context: PaletteEditorContext }> | undefined>(() => {
		if (!inspectingItem) return undefined
		try {
			return palette.renderConfigurator(inspectingItem as never, inspectingTool as never, {
				palette: palette as never,
				region: inspecting?.region
			}) as unknown as Component<{ context: PaletteEditorContext }>
		} catch {
			return undefined
		}
	})
	const configuratorContext = $derived.by<PaletteEditorContext | undefined>(() => {
		if (!inspectingItem || !Configurator) return undefined
		try {
			return palette.resolveConfiguratorContext(inspectingItem as never, inspectingTool as never, {
				palette: palette as never,
				region: inspecting?.region
			}) as unknown as PaletteEditorContext
		} catch {
			return undefined
		}
	})

	// Editing state is mirrored onto `palettes.editing` so the underlying
	// toolbar chrome + inert shield engage while the console is in edit mode.
	// The cleanup clears the mirror on teardown (unmount), so closing the
	// console while editing never leaves the toolbars inert.
	$effect(() => {
		const target = isEditing ? (palette as never) : undefined
		palettes.editing = target
		return () => {
			if (palettes.editing === (palette as never)) palettes.editing = undefined
		}
	})

	// Parking seeds from the live top border, excluding the toolbar command box
	// (mirrors the reference `popupParkingToolbars`).
	const parkingToolbars = $derived<PaletteToolbar[]>(
		top
			.flatMap((track) => track.map((slot) => slot.toolbar))
			.map((toolbar) => toolbar.filter((item) => item.editor !== 'commandBox'))
			.filter((toolbar) => toolbar.length > 0)
	)
	const parkingScope = $derived({ palette: palette as never })

	const selectedEntry = $derived<PaletteAddItemCommandEntry | undefined>(
		consoleState.selectedEntryId
			? (addEntries.find((entry) => entry.id === consoleState.selectedEntryId) as unknown as
					| PaletteAddItemCommandEntry
					| undefined)
			: undefined
	)
	const variants = $derived<readonly PaletteDerivedVariant[]>(
		selectedEntry
			? paletteDerivedVariants({ palette: palette as never, entry: selectedEntry as never })
			: []
	)

	function catalogPayloadForEntry(
		entry: PaletteAddItemCommandEntry | { catalogDrag?: unknown; id: string }
	): PaletteCatalogDragPayload | undefined {
		// Run-mode entries carry `catalogDrag` (command presets); add entries
		// carry `source` (tool/item to insert). Only add entries are draggable,
		// and only in edit mode — run mode never drags.
		if (!isEditing) return undefined
		if ('catalogDrag' in entry && entry.catalogDrag)
			return entry.catalogDrag as PaletteCatalogDragPayload
		if (!('source' in entry) || !entry.source) return undefined
		const source = entry.source
		if (source.kind === 'item' && source.editor) {
			return {
				kind: 'variant',
				variant: {
					id: `${source.id}:item`,
					kind: 'item',
					editor: source.editor,
					label: source.label,
					meta: source.meta,
					icon: source.icon,
					keywords: source.keywords,
					categories: source.categories
				} as PaletteDerivedVariant
			}
		}
		if (source.kind === 'tool' && source.toolId) {
			return { kind: 'spec', spec: source.toolId as string }
		}
		return undefined
	}

	function startCatalogDrag(event: DragEvent, payload: PaletteCatalogDragPayload) {
		const item = paletteToolbarItemFromCatalogPayload(palette as never, payload as never)
		if (!item) return
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'copy'
			try {
				event.dataTransfer.setData(
					PALETTE_CATALOG_DRAG_MIME,
					serializePaletteCatalogDragPayload(payload as never)
				)
			} catch {
				// jsdom / restricted dataTransfer — session path still works
			}
		}
		try {
			beginPaletteCatalogInsertDrag(palette as never, item as never, {
				x: event.clientX,
				y: event.clientY
			})
		} catch {
			// already dragging — native MIME path still drops
		}
		notifyPaletteCatalogNativeDragStarted(palette)
	}

	let inputEl: HTMLInputElement | undefined = $state(undefined)
	$effect(() => {
		inputEl?.focus()
	})

	function close() {
		closeConsole()
		// Explicitly clear the edit-mode mirror + inspector so the toolbars
		// are never left inert when the console closes while editing.
		if (palettes.editing === (palette as never)) palettes.editing = undefined
		if (palettes.inspecting?.palette === (palette as never)) delete palettes.inspecting
	}
</script>

<div
	class="palette-default-command-overlay"
	role="dialog"
	aria-label="Palette console"
	data-testid="console-overlay"
	tabindex={-1}
	onmousedown={(event) => {
		if (event.target === event.currentTarget) close()
	}}
>
	<div class="palette-default-command-panel">
		<button
			type="button"
			class="palette-default-command-close"
			aria-label="Close console"
			onclick={close}
		>
			×
		</button>
		<div class="palette-default-command-top">
			{#if parkingToolbars.length > 0}
				<Parking
					toolbars={parkingToolbars}
					palette={palette as never}
					scope={parkingScope}
					el={{ class: 'palette-default-command-parking' }}
				/>
			{/if}
			<div class="palette-default-command-bottom">
				<div class="palette-default-command-main">
					<div class="palette-default-command-box is-expanded">
						<div class="palette-default-command-shell" title="Console command box">
							<span class="palette-default-icon">⌘</span>
							<div class="palette-default-command-tokens">
								{#each activeBox.categories.active as category (category)}
									<button
										type="button"
										class="palette-default-command-chip"
										onclick={() => activeBox.categories.toggle(category)}
										onkeydown={(event) =>
											handlePaletteCommandChipKeydown({
												commandBox: activeBox as never,
												event,
												token: category,
												type: 'category'
											})}
									>
										#{category}
									</button>
								{/each}
								{#each activeBox.keywords.tokens as token (token.keyword)}
									<button
										type="button"
										class="palette-default-command-chip"
										onclick={() => activeBox.keywords.removeToken(token.keyword)}
										onkeydown={(event) =>
											handlePaletteCommandChipKeydown({
												commandBox: activeBox as never,
												event,
												token: token.keyword
											})}
									>
										{token.keyword}
									</button>
								{/each}
								<input
									bind:this={inputEl}
									class="palette-default-command-input"
									data-testid="console-input"
									value={activeBox.input.value}
									placeholder={activeBox.input.placeholder}
									oninput={(event) => setPaletteCommandBoxInput(activeBox as never, event)}
									onkeydown={(event) => {
										const handled = handlePaletteCommandBoxInputKeydown({
											commandBox: activeBox as never,
											event,
											onAfterExecute: () => {
												if (!isEditing) close()
											}
										})
										if (handled && event.key === 'Enter' && isEditing) {
											const entry = activeBox.selection.item
											if (entry) {
												consoleState.selectedEntryId = entry.id
												consoleState.selectedVariantId = undefined
											}
										}
										if (event.key === 'Escape') close()
									}}
								/>
								{#if canEdit && !editOnly}
									<button
										type="button"
										class="palette-default-command-mode"
										data-testid="console-mode-toggle"
										aria-pressed={isEditing ? 'true' : 'false'}
										aria-label={isEditing ? 'Done editing' : 'Edit toolbars'}
										title={isEditing ? 'Done editing' : 'Edit toolbars'}
										onclick={() => {
											consoleState.mode = isEditing ? 'run' : 'edit'
										}}
									>
										{isEditing ? '✓' : '✎'}
									</button>
								{/if}
							</div>
						</div>
						<div class="palette-default-command-popover">
							{#if activeBox.suggestions.length > 0}
								<div class="palette-default-command-suggestions">
									{#each activeBox.suggestions as suggestion (suggestion.keyword)}
										<button
											type="button"
											class="palette-default-command-suggestion"
											onclick={() => {
												activeBox.keywords.addToken(suggestion.keyword)
												activeBox.input.value = ''
												inputEl?.focus()
											}}
										>
											{suggestion.keyword}
										</button>
									{/each}
								</div>
							{/if}
							<div class="palette-default-command-results" data-testid="console-results">
								{#if activeBox.results.length === 0}
									<div class="palette-default-command-empty">No matching commands</div>
								{:else}
									{#each activeBox.results.slice(0, 8) as entry (entry.id)}
										{@const payload = catalogPayloadForEntry(entry as never)}
										<button
											type="button"
											data-testid={`console-result-${entry.id}`}
											class={[
												'palette-default-command-result',
												activeBox.selection.item?.id === entry.id ? 'is-selected' : undefined
											]}
											disabled={entry.can === false}
											draggable={payload !== undefined && isEditing ? 'true' : undefined}
											title={isEditing
												? 'Drag into a toolbar (native HTML5 catalogue drag)'
												: undefined}
											ondragstart={(event) => {
												if (payload) startCatalogDrag(event, payload as never)
											}}
											onclick={() => {
												if (isEditing) {
													activeBox.select(entry.id)
													consoleState.selectedEntryId = entry.id
													consoleState.selectedVariantId = undefined
												} else {
													activeBox.execute(entry.id)
													close()
												}
											}}
										>
											<span class="palette-default-command-result-copy">
												<span class="palette-default-command-result-label">
													{#if entry.icon && typeof entry.icon === 'string'}
														<span class="palette-default-icon">{entry.icon}</span>
													{/if}
													{entry.label}
												</span>
												<span class="palette-default-command-result-meta">{entry.meta}</span>
											</span>
										</button>
									{/each}
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>
			{#if isEditing}
				<div
					class="palette-default-panel palette-default-details-panel"
					data-testid="console-details-panel"
				>
					{#if inspectingItem}
						<div class="palette-default-panel-title">Inspect</div>
						{#if Configurator && configuratorContext}
							<Configurator context={configuratorContext} />
						{:else}
							<div class="palette-default-config-empty">
								No configurator for {inspectingItem.tool ?? inspectingItem.editor}.
							</div>
						{/if}
					{:else if selectedEntry}
						<div class="palette-default-panel-title">Add to toolbar</div>
					{:else}
						<div class="palette-default-panel-title">Details</div>
						<div class="palette-default-config-empty">
							Click a toolbar item to inspect its presentation, or select a tool or editor on the
							left to add it to a toolbar.
						</div>
					{/if}
					{#if selectedEntry && !inspectingItem}
						<div class="palette-default-config-stack" data-testid="console-add-panel">
							<div class="palette-default-config-header">
								<strong>{selectedEntry.label}</strong>
								<span>{selectedEntry.meta}</span>
							</div>
							{#each variants as variant (variant.id)}
								{@const isSelected = consoleState.selectedVariantId === variant.id}
								<div
									class={[
										'palette-default-add-variant',
										variant.kind === 'set' ? 'is-set' : undefined
									]}
								>
									<button
										type="button"
										class={[
											'palette-default-config-header',
											'palette-default-add-variant-trigger',
											isSelected ? 'is-selected' : undefined
										]}
										aria-pressed={isSelected ? 'true' : 'false'}
										onclick={() => {
											consoleState.selectedVariantId = variant.id
										}}
									>
										<strong>
											{#if variant.icon && typeof variant.icon === 'string'}
												<span class="palette-default-icon">{variant.icon}</span>
											{/if}
											{variant.label}
										</strong>
										<span>{variant.meta}</span>
									</button>
									{#if variant.kind === 'set'}
										<div class="palette-default-add-inline-value">
											<strong>Value</strong>
											{#if variant.valueType === 'boolean'}
												<select
													value={consoleState.booleanValue}
													onchange={(e) => {
														consoleState.booleanValue =
															e.currentTarget.value === 'false' ? 'false' : 'true'
													}}
												>
													<option value="true">true</option>
													<option value="false">false</option>
												</select>
											{:else if variant.valueType === 'number'}
												<input
													value={consoleState.setValue}
													placeholder="14"
													oninput={(e) => {
														consoleState.setValue = e.currentTarget.value
													}}
												/>
											{:else if variant.valueType === 'enum'}
												<select
													value={consoleState.setValue}
													onchange={(e) => {
														consoleState.setValue = e.currentTarget.value
													}}
												>
													<option value="">Choose value…</option>
													{#each variant.values ?? [] as value (value.value)}
														<option value={value.value}>{value.label ?? value.value}</option>
													{/each}
												</select>
											{/if}
										</div>
									{/if}
									{#if variant.kind === 'tool'}
										<label class="palette-default-add-inline-value">
											<strong>Allowed values</strong>
											<input
												value={consoleState.enumValues}
												placeholder="comma-separated subset"
												oninput={(e) => {
													consoleState.enumValues = e.currentTarget.value
												}}
											/>
										</label>
										<label class="palette-default-add-inline-value">
											<strong>Keyword filter</strong>
											<input
												value={consoleState.enumKeywords}
												placeholder="row, column"
												oninput={(e) => {
													consoleState.enumKeywords = e.currentTarget.value
												}}
											/>
										</label>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.palette-default-command-mode {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: 2rem;
		block-size: 2rem;
		flex: 0 0 auto;
		margin: -4px;
		padding: 0;
		border: 1px solid rgba(71, 85, 105, 0.95);
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.88);
		color: #94a3b8;
		cursor: pointer;
		font-size: 0.95rem;
		line-height: 1;
		transition:
			border-color 120ms ease,
			background 120ms ease,
			color 120ms ease;
	}
	.palette-default-command-mode:hover,
	.palette-default-command-mode[aria-pressed='true'] {
		border-color: #60a5fa;
		background: #1d4ed8;
		color: #eff6ff;
	}
	:global(.palette-default-theme-light) .palette-default-command-mode {
		border-color: rgba(148, 163, 184, 0.9);
		background: #ffffff;
		color: #475569;
	}
	:global(.palette-default-theme-light) .palette-default-command-mode:hover,
	:global(.palette-default-theme-light) .palette-default-command-mode[aria-pressed='true'] {
		border-color: #60a5fa;
		background: #1d4ed8;
		color: #eff6ff;
	}
	.palette-default-config-stack {
		display: grid;
		gap: 10px;
	}
	.palette-default-config-header {
		display: grid;
		gap: 2px;
	}
	.palette-default-config-empty {
		color: #94a3b8;
		font-size: 0.85rem;
	}
</style>
