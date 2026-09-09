/**
 * Palette edition surface: everything that can mutate a layout.
 *
 * Imports `core` (`./core.svelte`) and adds the mutation surface on top:
 * editing state, drag/drop + insertion, the add/catalogue builders, the
 * console, and the drawer editor. The dependency direction is `edition →
 * core`, never the reverse.
 *
 * A read-only consumer imports only `core`; an editable app imports `edition`
 * (which re-exports `core`, so a single import suffices).
 */

export {
	PALETTE_CATALOG_DRAG_MIME,
	type PaletteAddItemCommandEntry,
	type PaletteAddItemSource,
	type PaletteCatalogDragPayload,
	type PaletteCatalogDragSpecPayload,
	type PaletteCatalogDragVariantPayload,
	type PaletteDerivedVariant,
	paletteAddItemEntries,
	paletteCatalogEntries,
	paletteDerivedVariants,
	paletteToolbarItemFromCatalogPayload,
	parsePaletteCatalogDragPayload,
	serializePaletteCatalogDragPayload,
} from './command-box.svelte'
export {
	popupAddList,
	resetConsoleAddState,
} from './console.svelte'
export * from './core.svelte'
export {
	createPaletteDrawerEditor,
	getDrawerPortalContainer,
	type PaletteDrawerEditorOptions,
	paletteDefaultDrawerEditor,
	paletteDrawerCollapse,
} from './drawer-editor.svelte'
export {
	getDrawerPortalContainer as getDrawerPortalContainerFromState,
	paletteDrawerCollapse as paletteDrawerCollapseFromState,
	setDrawerPortalContainer,
} from './drawer-state.svelte'
export {
	actualTrackSpaceAt,
	beginPaletteCatalogInsertDrag,
	expandStackSpaceRect,
	insertToolbar,
	insertTrackWithToolbar,
	isIgnoredDropZone,
	isIgnoredStackSpace,
	isIgnoredToolbarSpace,
	type MeasuredTarget,
	PALETTE_PROXIMITY_HALO,
	type PaletteDragOrigin,
	type PaletteDragTarget,
	type PaletteItemDragTarget,
	type PaletteStackSpace,
	type PaletteToolbarDrag,
	type PaletteToolbarSpace,
	type PaletteTrackSpace,
	paletteItemDrag,
	paletteItemShield,
	paletteStackSpace,
	paletteToolbarDrag,
	paletteToolbarSpace,
	paletteTrackSpace,
	pointDistance,
	rectContainsPoint,
	rectDistanceToPoint,
	removeEmptyTrack,
	removePaletteItem,
	removeToolbar,
	resizeToolbar,
	resolveCandidate,
	resolveDragTarget,
	resolveStackSpaceTarget,
	resolveStackSpaceTargetFromTargets,
	resolveToolbarSpaceTarget,
	resolveToolbarSpaceTargetFromTargets,
	resolveTrackSpaceTarget,
	resolveTrackSpaceTargetFromTargets,
	withinProximityHalo,
} from './layout.svelte'
export {
	clearPaletteCatalogDragOnNativeDragEnd,
	isEditing,
	notifyPaletteCatalogNativeDragStarted,
	palettes,
	renderPaletteConfigurator,
	resolveItemPlacementTarget,
} from './palette.svelte'
