/**
 * Shared headless state for the drawer editor, split out of
 * `drawer-editor.svelte.ts` to break a circular import:
 *
 * `drawer-editor.svelte.ts` imports `components/DrawerEditor.svelte` (the spec's
 * `editor`), and `DrawerEditor.svelte` imports the collapse signal + portal
 * container from here. Keeping that shared state in its own module means neither
 * file imports the other through a cycle.
 */

/**
 * Shared collapse signal: bump `version` to close all open drawer popups.
 *
 * Drawers subscribe via `$effect` and close on change. Module-level `$state`
 * (same pattern as `palettes`), so any importer reacts to bumps.
 */
export const paletteDrawerCollapse = $state({ version: 0 })

let defaultDrawerPortalContainer: HTMLElement | undefined

/**
 * Resolve the portal container for drawer popups.
 */
export function getDrawerPortalContainer(): HTMLElement | undefined {
	return defaultDrawerPortalContainer
}

/**
 * Set the portal container for drawer popups (defaults to `document.body`).
 */
export function setDrawerPortalContainer(container: HTMLElement | undefined): void {
	defaultDrawerPortalContainer = container
}
