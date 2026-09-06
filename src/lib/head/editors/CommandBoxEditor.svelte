<script lang="ts">
	import {
		commandBoxPresenter,
		handlePaletteCommandBoxInputKeydown,
		handlePaletteCommandChipKeydown,
		setPaletteCommandBoxInput
	} from '$lib/palette/presenters.svelte'
	import type { PaletteEditorContext, PaletteSchema, PaletteToolbarItem } from '$lib/palette/types'

	type Props = {
		context: PaletteEditorContext<undefined, PaletteToolbarItem, PaletteSchema>
		onEscapeOrExecute?: () => void
	}

	let { context, onEscapeOrExecute }: Props = $props()
	// Init-time: presenter creates the headless command-box model once.
	// svelte-ignore state_referenced_locally
	const view = commandBoxPresenter({ context })
	const commandBox = view.box
	const expanded = $derived(view.expanded)

	let root: HTMLDivElement | undefined
</script>

<div bind:this={root}>
	<div class={['palette-default-command-box', expanded ? 'is-expanded' : undefined, 'is-floating']}>
		<div class="palette-default-command-shell" title={view.title}>
			<span class="palette-default-icon">{view.icon}</span>
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
					onfocus={() => view.setFocused(true)}
					onblur={(event) => {
						const next = event.relatedTarget instanceof Node ? event.relatedTarget : undefined
						if (next && root?.contains(next)) return
						view.setFocused(false)
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
