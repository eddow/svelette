# Getting started

## Prerequisites

Node 24.x, npm 11.x. Install once:

```sh
npm install
```

## Commands

| Command            | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `npm run dev`      | Vite dev server (default SvelteKit port)        |
| `npm run check`    | `svelte-kit sync && svelte-check`               |
| `npm run test`     | Vitest unit suite (jsdom)                       |
| `npm run test:e2e` | Playwright (builds + previews on port 4173)     |
| `npm run lint`     | Biome check (tabs, single quotes, width 100)    |
| `npm run build` / `npm run preview` | Production build / local preview |

Scratch files go in `sandbox/` (git-ignored), never `/tmp`.

## Demo tour (`src/routes/+page.svelte`)

The demo is a **Stellar Outpost** space-colony sim (`src/lib/demo/palette.svelte.ts`)
rendering an `Ide` with all four borders plus center content:

- **Top**: command box, icon-only edit-mode toggle, lockdown button, life-support
  + shields toggles, threat-level segmented
- **Left**: sim-speed slider, atmosphere select, power-focus segmented, nested
  drawer (atmosphere select + sim-speed stepper)
- **Right**: tax-rate slider, solar stepper, satisfaction stars
- **Bottom**: developer terminal, save, reset, hyper-tick toggle

The work-zone shows every colony variable as pills plus a colony-status panel
and an `mm:ss` elapsed-since-launch chip. Opening the console dims + disables
the work-zone (quake-style modal).

Interactions to try:

1. **Edit toolbars** toggle (top bar, ✏️) → hover a toolbar (blue chrome),
   `pointerdown` on an item opens the inspector (shortcut, move back/forward,
   remove, configurator).
2. **Command box**: type `Set Threat Level to Red`, run it — the `⚠️` pill updates.
3. **Drawers**: `More` (left) opens a horizontal popup (axis inversion).
4. **Console**: `` ` `` key or `Terminal` button opens the overlay (toggles — the
   same shortcut closes it); the checkbutton swaps *Command* ↔ *Toolbar edition*
   (add-to-toolbar + catalogue + parking).
5. **Save/Reset layout**: round-trips through `localStorage` (`svelette-demo-layout-v1`).

Theme control: the `theme` tool (`light`/`dark`/`system`) resolves via
`prefers-color-scheme` and syncs `.palette-default-theme-light` + `data-theme` +
`color-scheme` onto `<html>` (see `docs/theming.md`).

## Your first palette

```ts
import { headEditors } from '$lib/head/registry'
import { Palette } from '$lib/palette/index.svelte'

const palette = new Palette({
	tools: {
		theme: {
			type: 'enum',
			label: 'Theme',
			value: 'dark',
			default: 'dark',
			values: [{ value: 'light' }, { value: 'dark' }]
		}
	},
	keys: { E: 'alertLevel=red' },
	editable: true,
	editors: headEditors as never,
	editorDefaults: { enum: 'select' }
})
```

Full walkthrough: `docs/using-the-default-head.md`. Custom heads:
`docs/creating-a-head.md`.

```svelte
<script>
	import Ide from '$lib/palette/components/Ide.svelte'
	import '$lib/palette/styles/palette.css'
	import '$lib/head/styles/head-default.css'
	const top = $state([{ space: 0, toolbar: [{ tool: 'theme', editor: 'select' }] }])
</script>

<Ide {palette} {top}>
	<div>center content</div>
</Ide>
```

Rules that bite newcomers (see `docs/core-concepts.md` for why):

- Runes only compile in `.svelte.ts` / `.svelte` — pure logic stays in `.ts`.
- `paletteCommandBoxModel(...)` and `hydratePaletteLayout(...)` must run during
  component/module init, never in handlers or after `await`.
- Tools are plain `$state` objects you supply; mutate `tool.value` directly.
- `Palette` instances are never `$state`-proxied — identity is plain `===`.
