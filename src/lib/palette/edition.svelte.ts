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
	configuration,
	type PaletteConfiguration,
} from '$lib/configuration'
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
	activeToolbarSlideElement,
	actualTrackSpaceAt,
	canonicalItemTool,
	clearToolbarSlide,
	commitDraggedToItemSpace,
	commitDraggedToParking,
	commitDraggedToParkingRow,
	commitDraggedToStackSpace,
	commitDraggedToTrackSpace,
	draggingEmptiesParkingRow,
	draggingEmptiesTrackIndex,
	findOwnershipViolations,
	insertToolbar,
	insertTrackWithToolbar,
	isDraggedToolbarAt,
	isDraggingTool,
	isDraggingWholeToolbar,
	itemFingerprint,
	type PaletteItemDragTarget,
	type PaletteParkingItemDragTarget,
	type PaletteParkingToolbarDrag,
	type PaletteToolbarDrag,
	paletteItemDrag,
	paletteItemShield,
	paletteParkingItemDrag,
	paletteParkingToolbarDrag,
	paletteToolbarDrag,
	refreshDragMode,
	removeEmptyTrack,
	removePaletteItem,
	removeParkedToolbar,
	removeToolbar,
	resizeToolbar,
	resolveDragMode,
	retargetToolbarSlide,
} from './layout.svelte'
export {
	hydratePaletteBorders,
	isEditing,
	palettes,
	renderPaletteConfigurator,
	resolveItemPlacementTarget,
} from './palette.svelte'
