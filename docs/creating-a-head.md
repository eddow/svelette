# Creating a head — tutorial

A **head** is presentation only: markup + CSS bound to headless core presenters.
The palette core owns logic + functioning, **including HTML structure** (layout
components, drawer portal, drag/drop, a11y). Your head never reimplements those —
it only renders tool values and forwards user gestures to presenter callbacks.

## 1. The contract

- A head component receives exactly one prop: `context: PaletteEditorContext`
  (`{ item, tool, scope, flags, surface }`). The layout (`Toolbar` → `PaletteItem`)
  builds it via `palette.resolveEditorContext(item, tool, scope)` and renders
  `<Editor context={...} />`.
- All reads/mutations go through a **presenter** from
  `$lib/palette/presenters.svelte` (or `palette/index.svelte.ts` re-exports).
  Never write `tool.value = …` or `tool.run()` in `.svelte` — call the presenter
  callback (`view.select(next)`, `view.set(n)`, `view.toggle()`, `view.run()`).
- No command-box entry builders in heads (`paletteCommandEntries`,
  `paletteAddItemEntries`, …). `commandBoxPresenter` builds the model for you.
- Configurators receive the same `context` shape with an augmented scope
  (`editorChoices` injected). Use `configuratorPresenter` for the generic panel;
  read enum-subset fields via your own presenter or `headMeta`.
- Drawer trigger: reuse core `palette/components/DrawerEditor.svelte` — never
  duplicate the portal (`mount`/`unmount`, axis inversion, collapse signal).

Presenter cheat-sheet:

| Family | Presenter | View-model |
| ------ | --------- | ---------- |
| run | `buttonPresenter(context)` | `{ label, icon, title, tone, can, run }` |
| boolean | `togglePresenter(context)` | `{ icon, title, tone, pressed, toggle() }` |
| enum | `selectPresenter(context)` | `{ title, tone, icon, value, options[{value,text}], select }` |
| number | `sliderPresenter(context)` | `{ title, tone, icon, direction, region, min, max, step, value, set }` |
| item | `commandBoxPresenter({ context, placeholder? })` | `{ title, icon, box, expanded, setFocused }` |
| any | `configuratorPresenter(context)` | `{ label, icon, hint, tone, editor, editorChoices, setText, setTone, setEditor }` |

Helpers: `headMeta(item)` (config defaults), `headTooltip(item, suffix)`,
`headLayoutFromSurface(scope, surface)`, `headRegionFromScope(scope)`.

## 2. Minimal custom editor (boolean `led`)

```svelte
<script lang="ts">
	import { togglePresenter } from '$lib/palette/index.svelte'
	import type {
		PaletteEditorContext,
		PaletteSchema,
		PaletteToolbarItem,
		PaletteToolBool
	} from '$lib/palette/types'

	type Props = {
		context: PaletteEditorContext<PaletteToolBool, PaletteToolbarItem, PaletteSchema>
	}

	let { context }: Props = $props()
	const view = $derived(togglePresenter(context))
</script>

<button
	type="button"
	class={['my-led', view.pressed ? 'is-on' : 'is-off']}
	title={view.title}
	onclick={() => view.toggle()}
>
	<span class="my-led-dot"></span>
</button>
```

Key points: `$derived(togglePresenter(context))` keeps `pressed`/`icon` reactive;
`title` carries the a11y tooltip (`label · hint`); the click only calls
`view.toggle()` — the presenter mutates the tool. Style with your own classes;
never depend on the head theme's `palette-default-*` class names (head-owned,
not part of the public contract).

## 3. Command-box editor (init-time!)

`commandBoxPresenter` creates `$state` — call it **once during component init**,
never in a handler:

```svelte
<script lang="ts">
	import {
		commandBoxPresenter,
		handlePresenterCommandBoxInputKeydown,
		handlePresenterCommandChipKeydown,
		setPresenterCommandBoxInput
	} from '$lib/palette/index.svelte'

	let { context }: Props = $props()
	// svelte-ignore state_referenced_locally
	const view = commandBoxPresenter({ context, placeholder: 'Search…' })
	const box = view.box
	const expanded = $derived(view.expanded)
</script>
```

Then bind `box.input.value`, `box.results`, `box.selection`, `box.categories`,
`box.keywords`, `box.suggestions` in markup; focus/blur go through
`view.setFocused(true/false)`. Copy `head/editors/CommandBoxEditor.svelte` as
the reference layout.

## 4. Configurator

```svelte
<script lang="ts">
	import { configuratorPresenter } from '$lib/palette/index.svelte'
	let { context }: Props = $props()
	const view = $derived(configuratorPresenter(context))
</script>

<input value={view.label} oninput={(e) => view.setText('label', e.currentTarget.value)} />
<select value={view.editor} onchange={(e) => view.setEditor(e.currentTarget.value)}>
	{#each view.editorChoices as option (option.id)}
		<option value={option.id}>{option.label}</option>
	{/each}
</select>
```

`editorChoices` are computed by `describeItemConfiguration` (capability-filtered
for the current surface) — render them as-is; `setEditor` handles enum-subset
config cleanup (`values`/`keywords`/`choiceDisplay`).

## 5. Registry + wiring

```ts
// my-head/registry.ts
import DrawerEditor from '$lib/palette/components/DrawerEditor.svelte'
import BaseConfigurator from './BaseConfigurator.svelte'
import LedEditor from './LedEditor.svelte'
// … default head editors for the rest

export const myHeadEditors = {
	boolean: {
		toggle: spec(ToggleEditor, BaseConfigurator, 'square'),
		led: spec(LedEditor, BaseConfigurator, 'square')
	},
	// … spread headEditors per family, override what you replace
}
```

```ts
new Palette({
	tools: { /* … */ },
	keys: { /* … */ },
	editable: true,
	editors: {
		boolean: { ...headEditors.boolean, ...myHeadEditors.boolean },
		// … per family, so the default head stays the fallback
	} as never,
	editorDefaults: { boolean: 'toggle' }
})
```

Per-family spread keeps the default fallback; top-level spread would drop whole
families. `editorDefaults` picks the variant when an item omits `editor`.
Capability descriptors (`paletteDefaultEditorCapabilities`, overridable via
`PaletteConfig.editorCapabilities`) control inspector choices and surface
fallback (wrong axis → first compact fallback).

## 6. Styles

- Import once per app: `$lib/palette/styles/palette.css` (core layout + edit
  chrome, always required) + your head theme (default:
  `$lib/head/styles/head-default.css`). Never inject CSS at runtime; keep
  selectors global and specific (`.palette-ide.editing .toolbar…`), never bare.
- Drawer popup shell classes (`.svelette-palette-drawer__*`) live in core
  `palette.css`; theme them from your head stylesheet.
- Light theme: if you add a dark base rule, add its
  `.palette-default-theme-light` (or your own theme class) counterpart in the
  same block — see `docs/theming.md`.

## 7. Checklist

- [ ] One `context` prop, typed per family (`PaletteToolBool`, `PaletteToolEnum<string>`, …).
- [ ] All tool/config access through a core presenter; no direct mutation in `.svelte`.
- [ ] `commandBoxPresenter` called once at init (with `svelte-ignore state_referenced_locally`).
- [ ] Drawer reused from core, not reimplemented.
- [ ] Registered per family with `BaseConfigurator` (or custom) + footprint flags.
- [ ] `check` / `lint` / `test` / `build` green; demo renders the new variant in one
      region while the rest stays on the default head.
