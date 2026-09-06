# Using the default head

The default head (`src/lib/head/`) is the standard minimal presentation for the
palette: a small set of variants per tool family, dumb components bound to
headless core presenters. Use it as-is, then add custom variants only where you
need them.
The demo (`src/lib/demo/`, `src/routes/+page.svelte`) is the reference — it
renders **the default head verbatim for every family except `number`, where two
demo editors live**: `SliderEditor` (a same-key **override** of the head's
slider, adding a value badge) and `StarsEditor` (an **extension** the head
lacks — a play/rating row). Together they prove both replacement and extension.

## What's in the head

| Family | Editor | Presenter | Component |
| ------ | ------ | --------- | --------- |
| run | `button` | `buttonPresenter` | `head/editors/ButtonEditor.svelte` |
| boolean | `toggle` | `togglePresenter` | `head/editors/ToggleEditor.svelte` |
| enum | `select` | `selectPresenter` | `head/editors/SelectEditor.svelte` |
| enum | `segmented` | `selectPresenter` | `head/editors/SegmentedEditor.svelte` |
| number | `slider` | `sliderPresenter` | `head/editors/SliderEditor.svelte` |
| number | `stepper` | `sliderPresenter` | `head/editors/StepperEditor.svelte` |
| item | `commandBox` | `commandBoxPresenter` | `head/editors/CommandBoxEditor.svelte` |
| item | `drawer` | — (core portal) | `palette/components/DrawerEditor.svelte` (reused, not duplicated) |

Notes:

- `segmented` is the "radio-button" idiom: joined buttons where the selected one
  reads as pushed-in. `select` is the compact dropdown. Both are enum editors.
- `stepper` is a ± button pair for integer/stepped values; `slider` is the
  continuous range. Both are number editors (they share `sliderPresenter`).

Plus `BaseConfigurator.svelte` (generic label/icon/hint/editor/tone panel via
`configuratorPresenter`), `Icon.svelte` (`string | Component`, factory fallback to
`<span data-icon>`), `icons.svelte.ts` (module-level `$state` icon factory), and
`styles/head-default.css` (head-owned theme; `palette.css` stays core-owned).

## Minimal setup

```ts
// palette.ts
import { headEditors } from '$lib/head/registry'
import { Palette } from '$lib/palette/index.svelte'

export const palette = new Palette({
	tools: {
		notifications: { type: 'boolean', label: 'Notifications', value: true, default: true },
		theme: {
			type: 'enum', label: 'Theme', value: 'dark', default: 'dark',
			values: [{ value: 'light' }, { value: 'dark' }]
		},
		fontSize: {
			type: 'number', label: 'Font Size', value: 14, default: 14, min: 10, max: 20, step: 1
		},
		reset: { label: 'Reset', get can() { return true }, run() {} }
	},
	keys: { N: 'notifications', D: 'theme=dark', '+': 'fontSize:inc', R: 'reset' },
	editable: true,
	editors: headEditors as never,
	editorDefaults: { run: 'button' }
})
```

```svelte
<!-- +page.svelte -->
<script>
	import Ide from '$lib/palette/components/Ide.svelte'
	import { palette } from './palette'
	import '$lib/palette/styles/palette.css'
	import '$lib/head/styles/head-default.css'

	const top = $state([
		{ space: 0.1, toolbar: [{ editor: 'commandBox' }] },
		{
			space: 0.5,
			toolbar: [
				{ tool: 'notifications', editor: 'toggle' },
				{ tool: 'theme', editor: 'select' },
				{ tool: 'fontSize', editor: 'slider' },
				{ tool: 'reset', editor: 'button' }
			]
		}
	])
</script>

<Ide {palette} {top}>
	<div>center content</div>
</Ide>
```

Notes:

- `keys` accepts a raw map (`{ D: 'theme=dark' }`) — `Palette` normalizes it via
  `createPaletteKeys`. Setter specs use `toolId=value` (`|` is legacy); actions use
  `toolId:action` (`fontSize:inc`).
- `editorDefaults: { run: 'button' }` lets run items omit `editor`.
- Import **both** stylesheets once: `palette.css` (core layout + edit chrome) and
  `head-default.css` (head theme). Never inject CSS at runtime.
- Optional icon factory (maps string names to components; unset falls back to text):

```ts
import { icons } from '$lib/head/icons.svelte'
import Star from '$lib/icons/star.svelte'

icons.factory = (name) => (name === 'star' ? Star : undefined)
```

## Extending with custom variants (the demo pattern)

Keep the head as fallback; add extras per family (this is exactly what
`src/lib/demo/palette.svelte.ts` does). There are two mechanisms, both using the
same per-family spread with the demo layer spread **last** so it wins:

```ts
import { headEditors } from '$lib/head/registry'
import { demoEditors } from './editors/registry'

editors: {
	boolean: { ...headEditors.boolean, ...demoEditors.boolean },
	enum: { ...headEditors.enum, ...demoEditors.enum },
	number: { ...headEditors.number, ...demoEditors.number },
	item: { ...headEditors.item, ...demoEditors.item },
	run: { ...headEditors.run, ...demoEditors.run }
} as never,
```

Per-family spread (not a top-level `{ ...headEditors, ...demoEditors }`) matters:
a top-level spread would replace whole families and drop the head fallback.

- **Override (same key)** — register a variant under a key the head already owns,
  e.g. `number.slider`. The demo does exactly this: its `SliderEditor` binds
  `sliderPresenter` (no direct `tool.value` mutation) and adds a numeric value
  badge, so the demo's slider is visibly different from the head's.
- **Extend (new key)** — register a variant the head lacks. The demo's
  `StarsEditor` is a `number` editor rendering a play/rating row of `▶`/`▷`
  triangles (reusing `sliderPresenter`), referenced from a single toolbar item
  (`{ tool: 'gameSpeed', editor: 'stars' }`). Everything else keeps rendering
  through the default head.

The shipped demo keeps exactly **two** custom editors (`number.slider` override
+ `number.stars` extension); the rest of the demo resolves through the head
verbatim, so every run exercises the head. See `docs/creating-a-head.md` for the
component contract (bind a core presenter, never mutate tools directly).

## Item config

Heads read per-item `config`: `icon`, `label`, `hint`, `tone` (`neutral`/`accent`),
plus enum-subset `values`/`keywords`/`choiceDisplay` (honored by `selectPresenter`).
The inspector (`BaseConfigurator` via `renderConfigurator` +
`resolveConfiguratorContext`) edits these live, including the editor-variant
chooser (`editorChoices` from `describeItemConfiguration`).
