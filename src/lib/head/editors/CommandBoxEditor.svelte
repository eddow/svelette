<script lang="ts">
	import {
		handlePaletteCommandBoxInputKeydown,
		handlePaletteCommandChipKeydown,
		setPaletteCommandBoxInput
	} from '$lib/palette/core.svelte'
	import { commandBoxPresenter } from '$lib/palette/presenters.svelte'
	import type { PaletteEditorContext, PaletteSchema, PaletteToolbarItem } from '$lib/palette/types'

	type Props = {
		context: PaletteEditorContext<undefined, PaletteToolbarItem, PaletteSchema>
	}

	let { context }: Props = $props()
	// Created once at init (the model holds `$state`); `context` is a stable prop.
	// svelte-ignore state_referenced_locally
	const view = commandBoxPresenter({ context })
	const model = view.model

	let open = $state(false)
	let inputEl: HTMLInputElement | undefined = $state(undefined)

	function toggleChip(category: string) {
		model.categories.toggle(category)
	}
	function removeKeyword(token: string) {
		model.keywords.removeToken(token)
	}
	function acceptSuggestion(keyword: string) {
		model.keywords.addToken(keyword)
		model.input.value = ''
		inputEl?.focus()
	}
	function execute(entryId: string) {
		model.execute(entryId)
		open = false
		inputEl?.blur()
	}
</script>

<div class="palette-default-command-box is-floating" data-testid="command-box-combobox">
	<div class="palette-default-command-shell" title={view.title}>
		<span class="palette-default-icon">{view.icon}</span>
		<div class="palette-default-command-tokens">
			{#each model.categories.active as category (category)}
				<button
					type="button"
					class="palette-default-command-chip"
					onclick={() => toggleChip(category)}
					onkeydown={(event) =>
						handlePaletteCommandChipKeydown({
							commandBox: model as never,
							event,
							token: category,
							type: 'category'
						})}
				>
					#{category}
				</button>
			{/each}
			{#each model.keywords.tokens as token (token.keyword)}
				<button
					type="button"
					class="palette-default-command-chip"
					onclick={() => removeKeyword(token.keyword)}
					onkeydown={(event) =>
						handlePaletteCommandChipKeydown({
							commandBox: model as never,
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
				data-testid="command-box-input"
				value={model.input.value}
				placeholder={model.input.placeholder}
				onfocus={() => (open = true)}
				onblur={() => (open = false)}
				oninput={(event) => setPaletteCommandBoxInput(model as never, event)}
				onkeydown={(event) => {
					handlePaletteCommandBoxInputKeydown({
						commandBox: model as never,
						event,
						onAfterExecute: () => {
							open = false
							inputEl?.blur()
						}
					})
					if (event.key === 'Escape') {
						open = false
						inputEl?.blur()
					}
				}}
			/>
		</div>
	</div>
	{#if open}
		<div class="palette-default-command-popover">
			{#if model.suggestions.length > 0}
				<div class="palette-default-command-suggestions">
					{#each model.suggestions as suggestion (suggestion.keyword)}
						<button
							type="button"
							class="palette-default-command-suggestion"
							onmousedown={(event) => event.preventDefault()}
							onclick={() => acceptSuggestion(suggestion.keyword)}
						>
							{suggestion.keyword}
						</button>
					{/each}
				</div>
			{/if}
			<div class="palette-default-command-results">
				{#if model.results.length === 0}
					<div class="palette-default-command-empty">No matching commands</div>
				{:else}
					{#each model.results.slice(0, 8) as entry (entry.id)}
						<button
							type="button"
							class={[
								'palette-default-command-result',
								model.selection.item?.id === entry.id ? 'is-selected' : undefined
							]}
							disabled={entry.can === false}
							onmousedown={(event) => event.preventDefault()}
							onclick={() => execute(entry.id)}
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
