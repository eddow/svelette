<script lang="ts">
	import {
		handlePaletteCommandBoxInputKeydown,
		handlePaletteCommandChipKeydown,
		paletteCommandBoxModel,
		paletteCommandEntries,
		setPaletteCommandBoxInput
	} from '$lib/palette/index.svelte'
	import type { PaletteEditorContext, PaletteSchema, PaletteToolbarItem } from '$lib/palette/types'
	import { toolbarMeta, tooltip } from './meta'

	type Props = {
		context: PaletteEditorContext<undefined, PaletteToolbarItem, PaletteSchema>
		onEscapeOrExecute?: () => void
	}

	let { context, onEscapeOrExecute }: Props = $props()
	const item = $derived(context.item)
	const meta = $derived(toolbarMeta(item))

	// Self-contained: build entries from the scope palette at init (editors only
	// receive `context`, so the command box cannot be injected as a prop).
	// Seeding from `context` once is deliberate; `state_referenced_locally` is suppressed.
	// svelte-ignore state_referenced_locally
	const scopePalette = context.scope.palette as
		| {
				tools: Record<string, never>
				keys: { findByTool: (spec: string) => readonly string[] }
		  }
		| undefined
	const commandBox = paletteCommandBoxModel({
		entries: scopePalette ? paletteCommandEntries({ palette: scopePalette as never }) : [],
		placeholder: 'Command…'
	})

	let focused = $state(false)
	let root: HTMLDivElement | undefined
	const expanded = $derived(
		focused ||
			commandBox.input.value.length > 0 ||
			commandBox.keywords.tokens.length > 0 ||
			commandBox.categories.active.length > 0
	)
</script>

<div bind:this={root}>
	<div class={['palette-default-command-box', expanded ? 'is-expanded' : undefined, 'is-floating']}>
		<div class="palette-default-command-shell" title={tooltip(item, meta.hint)}>
			<span class="palette-default-icon">{meta.icon ?? '⌘'}</span>
			<div class="palette-default-command-tokens">
				{#each commandBox.categories.active as category (category)}
					<button
						type="button"
						class="palette-default-command-chip"
						onclick={() => commandBox.categories.toggle(category)}
						onkeydown={(event) =>
							handlePaletteCommandChipKeydown({
								commandBox,
								event,
								token: category,
								type: 'category'
							})}
					>
						#{category}
					</button>
				{/each}
				{#each commandBox.keywords.tokens as token (token.keyword)}
					<button
						type="button"
						class="palette-default-command-chip"
						onclick={() => commandBox.keywords.removeToken(token.keyword)}
						onkeydown={(event) =>
							handlePaletteCommandChipKeydown({ commandBox, event, token: token.keyword })}
					>
						{token.keyword}
					</button>
				{/each}
				<input
					class="palette-default-command-input"
					value={commandBox.input.value}
					placeholder={commandBox.input.placeholder}
					oninput={(event) => setPaletteCommandBoxInput(commandBox, event)}
					onfocus={() => (focused = true)}
					onblur={(event) => {
						const next = event.relatedTarget instanceof Node ? event.relatedTarget : undefined
						if (next && root?.contains(next)) return
						focused = false
					}}
					onkeydown={(event) => {
						handlePaletteCommandBoxInputKeydown({
							commandBox,
							event,
							onAfterExecute: onEscapeOrExecute
						})
						if (event.key === 'Escape') onEscapeOrExecute?.()
					}}
				/>
			</div>
		</div>
		{#if expanded}
			<div class="palette-default-command-popover">
				{#if commandBox.suggestions.length > 0}
					<div class="palette-default-command-suggestions">
						{#each commandBox.suggestions as suggestion (suggestion.keyword)}
							<button
								type="button"
								class="palette-default-command-suggestion"
								onclick={() => {
									commandBox.keywords.addToken(suggestion.keyword)
									commandBox.input.value = ''
								}}
							>
								{suggestion.keyword}
							</button>
						{/each}
					</div>
				{/if}
				<div class="palette-default-command-results">
					{#if commandBox.results.length === 0}
						<div class="palette-default-command-empty">No matching commands</div>
					{:else}
						{#each commandBox.results.slice(0, 6) as entry (entry.id)}
							<button
								type="button"
								class={[
									'palette-default-command-result',
									commandBox.selection.item?.id === entry.id ? 'is-selected' : undefined
								]}
								disabled={entry.can === false}
								onclick={() => {
									commandBox.execute(entry.id)
									onEscapeOrExecute?.()
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
		{/if}
	</div>
</div>
