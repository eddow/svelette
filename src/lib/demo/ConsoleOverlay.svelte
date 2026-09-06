<script lang="ts">
	import Parking from '$lib/palette/components/Parking.svelte'
	import Toolbar from '$lib/palette/components/Toolbar.svelte'
	import type {
		PaletteAddItemCommandEntry,
		PaletteCatalogDragPayload,
		PaletteCommandBoxEntry,
		PaletteDerivedVariant
	} from '$lib/palette/index.svelte'
	import {
		beginPaletteCatalogInsertDrag,
		handlePaletteCommandBoxInputKeydown,
		handlePaletteCommandChipKeydown,
		notifyPaletteCatalogNativeDragStarted,
		PALETTE_CATALOG_DRAG_MIME,
		paletteAddItemEntries,
		paletteCatalogEntries,
		paletteCommandBoxModel,
		paletteCommandEntries,
		paletteDerivedVariants,
		palettes,
		paletteToolbarItemFromCatalogPayload,
		serializePaletteCatalogDragPayload,
		setPaletteCommandBoxInput
	} from '$lib/palette/index.svelte'
	import type { PaletteBorder, PaletteToolbar } from '$lib/palette/types'
	import { closeConsole, consoleUi, popupAddList } from './console.svelte'
	import { demoPalette } from './palette.svelte'

	type Props = {
		top: PaletteBorder
	}

	let { top }: Props = $props()

	// Models must be created during component init (rune init-time constraint).
	// `terminal` is a demo meta-tool (opens this console); exclude it from
	// run/add/catalogue so it isn't listed — or re-executed — inside the console.
	const runEntries = paletteCommandEntries({
		palette: demoPalette as never,
		excludeTools: ['terminal']
	})
	const addEntries = paletteAddItemEntries({
		palette: demoPalette as never,
		excludeTools: ['terminal']
	})
	const catalogEntries = paletteCatalogEntries({
		palette: demoPalette as never,
		excludeTools: ['terminal']
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

	const isEditing = $derived(palettes.editing === (demoPalette as never))
	const activeBox = $derived(isEditing ? popupAddCommandBox : popupCommandBox)

	// Parking seeds from the live top border, excluding the toolbar command box
	// (mirrors the reference `popupParkingToolbars`).
	const parkingToolbars = $derived<PaletteToolbar[]>(
		top
			.flatMap((track) => track.map((slot) => slot.toolbar))
			.map((toolbar) => toolbar.filter((item) => item.editor !== 'commandBox'))
			.filter((toolbar) => toolbar.length > 0)
	)
	const parkingScope = $derived({ palette: demoPalette as never })

	const selectedEntry = $derived<PaletteAddItemCommandEntry | undefined>(
		consoleUi.selectedEntryId
			? (addEntries.find((entry) => entry.id === consoleUi.selectedEntryId) as unknown as
					| PaletteAddItemCommandEntry
					| undefined)
			: undefined
	)
	const variants = $derived<readonly PaletteDerivedVariant[]>(
		selectedEntry
			? paletteDerivedVariants({ palette: demoPalette as never, entry: selectedEntry as never })
			: []
	)
	const selectedVariant = $derived<PaletteDerivedVariant | undefined>(
		variants.find((variant) => variant.id === consoleUi.selectedVariantId)
	)

	function defaultEditorForToolId(toolId: string): string {
		try {
			const tool = (demoPalette as never as { tool: (spec: string) => unknown }).tool(toolId) as {
				run?: unknown
				type?: string
			}
			if (tool && 'run' in tool) return 'button'
			if (tool?.type === 'boolean') return 'toggle'
			if (tool?.type === 'enum') return 'select'
			if (tool?.type === 'number') return 'slider'
		} catch {
			// fall through to button
		}
		return 'button'
	}

	function buildAddItem(variant: PaletteDerivedVariant) {
		if (variant.kind === 'item') {
			return {
				editor: variant.editor,
				config: { icon: variant.icon ?? '⌘', label: variant.label, hint: variant.meta }
			}
		}
		const toolId = variant.toolId as string | undefined
		if (!toolId) return undefined
		const tool = (demoPalette as { tools: Record<string, { icon?: string; label?: string }> })
			.tools[toolId]
		if (!tool) return undefined
		if (variant.kind === 'tool') {
			const item: Record<string, unknown> = {
				tool: toolId,
				editor: defaultEditorForToolId(toolId),
				config: {
					icon: tool.icon,
					label: tool.label ?? toolId,
					hint: variant.meta
				}
			}
			if (consoleUi.enumValues || consoleUi.enumKeywords) {
				;(item.config as Record<string, unknown>).values =
					popupAddList(consoleUi.enumValues).length > 0
						? popupAddList(consoleUi.enumValues)
						: undefined
				;(item.config as Record<string, unknown>).keywords =
					popupAddList(consoleUi.enumKeywords).length > 0
						? popupAddList(consoleUi.enumKeywords)
						: undefined
			}
			return item
		}
		if (variant.kind !== 'set') return undefined
		if (variant.valueType === 'boolean') {
			const spec = `${toolId}=${consoleUi.booleanValue === 'true'}`
			return {
				tool: spec,
				editor: defaultEditorForToolId(spec),
				config: { icon: variant.icon ?? tool.icon, label: variant.label, hint: variant.meta }
			}
		}
		const rawValue = consoleUi.setValue.trim()
		if (!rawValue) return undefined
		if (variant.valueType === 'number') {
			const numeric = Number(rawValue)
			if (!Number.isFinite(numeric)) return undefined
			const spec = `${toolId}=${numeric}`
			return {
				tool: spec,
				editor: defaultEditorForToolId(spec),
				config: { icon: variant.icon ?? tool.icon, label: variant.label, hint: variant.meta }
			}
		}
		if (variant.valueType === 'enum') {
			const allowed = new Set((variant.values ?? []).map((value) => value.value))
			if (!allowed.has(rawValue)) return undefined
			const spec = `${toolId}=${rawValue}`
			return {
				tool: spec,
				editor: defaultEditorForToolId(spec),
				config: { icon: variant.icon ?? tool.icon, label: variant.label, hint: variant.meta }
			}
		}
		return undefined
	}

	const selectedItem = $derived(selectedVariant ? buildAddItem(selectedVariant) : undefined)
	const previewToolbar = $derived<PaletteToolbar>(selectedItem ? [selectedItem as never] : [])
	const previewTrack = $derived([{ space: 0, toolbar: previewToolbar }])
	const previewBorder = $derived([previewTrack])

	function catalogPayloadForEntry(
		entry: PaletteCommandBoxEntry
	): PaletteCatalogDragPayload | undefined {
		if (entry.catalogDrag) return entry.catalogDrag as PaletteCatalogDragPayload
		return { kind: 'spec', spec: entry.id }
	}

	function startCatalogDrag(event: DragEvent, payload: PaletteCatalogDragPayload) {
		const item = paletteToolbarItemFromCatalogPayload(demoPalette as never, payload as never)
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
			beginPaletteCatalogInsertDrag(demoPalette as never, item as never, {
				x: event.clientX,
				y: event.clientY
			})
		} catch {
			// already dragging — native MIME path still drops
		}
		notifyPaletteCatalogNativeDragStarted(demoPalette)
	}

	function startVariantDrag(event: DragEvent) {
		if (!selectedVariant || !selectedItem) return
		const payload: PaletteCatalogDragPayload = {
			kind: 'variant',
			variant: selectedVariant as never
		}
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'copy'
			try {
				event.dataTransfer.setData(
					PALETTE_CATALOG_DRAG_MIME,
					serializePaletteCatalogDragPayload(payload as never)
				)
			} catch {
				// ignore
			}
		}
		try {
			beginPaletteCatalogInsertDrag(demoPalette as never, selectedItem as never, {
				x: event.clientX,
				y: event.clientY
			})
		} catch {
			// ignore
		}
		notifyPaletteCatalogNativeDragStarted(demoPalette)
	}

	let inputEl: HTMLInputElement | undefined = $state(undefined)
	$effect(() => {
		inputEl?.focus()
	})

	function close() {
		closeConsole()
		if (palettes.inspecting?.palette === (demoPalette as never)) delete palettes.inspecting
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
					palette={demoPalette as never}
					scope={parkingScope}
					el={{ class: 'palette-default-command-parking' }}
				/>
			{/if}
			<div class="palette-default-command-bottom">
				<div class="palette-default-command-main">
					<label class="palette-default-command-mode">
						<input
							type="checkbox"
							data-testid="console-mode-toggle"
							checked={isEditing}
							onchange={(event) => {
								palettes.editing = event.currentTarget.checked ? (demoPalette as never) : undefined
							}}
						/>
						<span>Toolbar edition ({isEditing ? 'add-to-toolbar' : 'command'})</span>
					</label>
					<div class="palette-default-command-box is-expanded is-floating">
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
												consoleUi.selectedEntryId = entry.id
												consoleUi.selectedVariantId = undefined
											}
										}
										if (event.key === 'Escape') close()
									}}
								/>
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
											ondragstart={(event) => {
												if (payload) startCatalogDrag(event, payload as never)
											}}
											onclick={() => {
												if (isEditing) {
													activeBox.select(entry.id)
													consoleUi.selectedEntryId = entry.id
													consoleUi.selectedVariantId = undefined
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
					{#if isEditing}
						<div class="palette-default-panel">
							<div class="palette-default-panel-title">
								Catalogue ({catalogEntries.length} entries — drag into a toolbar)
							</div>
							<div class="palette-default-command-results" data-testid="console-catalogue">
								{#each catalogEntries.slice(0, 12) as entry (entry.id)}
									{@const payload = catalogPayloadForEntry(entry as never)}
									<button
										type="button"
										class="palette-default-command-result"
										disabled={false}
										draggable={payload !== undefined ? 'true' : undefined}
										ondragstart={(event) => {
											if (payload) startCatalogDrag(event, payload as never)
										}}
										title="Drag into a toolbar (native HTML5 catalogue drag)"
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
							</div>
						</div>
					{/if}
				</div>
				{#if isEditing}
					<div
						class="palette-default-panel palette-default-add-panel"
						data-testid="console-add-panel"
					>
						<div class="palette-default-panel-title">Add to toolbar</div>
						{#if !selectedEntry}
							<div class="palette-default-config-empty">
								Select a tool or editor on the left, then choose one of its derived variants here.
							</div>
						{:else}
							<div class="palette-default-config-stack">
								<div class="palette-default-config-header">
									<strong>{selectedEntry.label}</strong>
									<span>{selectedEntry.meta}</span>
								</div>
								{#each variants as variant (variant.id)}
									{@const isSelected = consoleUi.selectedVariantId === variant.id}
									{@const dragItem =
										isSelected && selectedItem ? (selectedItem as never) : undefined}
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
												consoleUi.selectedVariantId = variant.id
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
														value={consoleUi.booleanValue}
														onchange={(e) => {
															consoleUi.booleanValue =
																e.currentTarget.value === 'false' ? 'false' : 'true'
														}}
													>
														<option value="true">true</option>
														<option value="false">false</option>
													</select>
												{:else if variant.valueType === 'number'}
													<input
														value={consoleUi.setValue}
														placeholder="14"
														oninput={(e) => {
															consoleUi.setValue = e.currentTarget.value
														}}
													/>
												{:else if variant.valueType === 'enum'}
													<select
														value={consoleUi.setValue}
														onchange={(e) => {
															consoleUi.setValue = e.currentTarget.value
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
													value={consoleUi.enumValues}
													placeholder="comma-separated subset"
													oninput={(e) => {
														consoleUi.enumValues = e.currentTarget.value
													}}
												/>
											</label>
											<label class="palette-default-add-inline-value">
												<strong>Keyword filter</strong>
												<input
													value={consoleUi.enumKeywords}
													placeholder="row, column"
													oninput={(e) => {
														consoleUi.enumKeywords = e.currentTarget.value
													}}
												/>
											</label>
										{/if}
										{#if isSelected && !dragItem}
											<div class="palette-default-add-drag-note">
												Complete this variant to drag it into a toolbar.
											</div>
										{/if}
										{#if isSelected && dragItem}
											<div class="palette-default-add-drag-source">
												<div class="palette-default-add-drag-note">Drag into a toolbar</div>
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<div
													draggable="true"
													ondragstart={(event) => startVariantDrag(event)}
													title="Native HTML5 drag — drop on any toolbar gap"
												>
													<Toolbar
														toolbar={previewToolbar}
														direction="horizontal"
														palette={demoPalette as never}
														scope={parkingScope}
														el={{ class: 'palette-default-add-drag-toolbar' }}
													/>
												</div>
											</div>
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
</div>

<style>
	.palette-default-command-mode {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.82rem;
		color: #94a3b8;
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
