import { createPaletteKeys } from '$lib/palette/keys'
import { Palette } from '$lib/palette/palette.svelte'
import type { PaletteBorders } from '$lib/palette/types'
import { demoEditors } from './editors/registry'

export type DemoState = {
	notifications: boolean
	layout: 'horizontal' | 'vertical'
	mode: 'inspect' | 'command'
	theme: 'light' | 'dark' | 'system'
	fontSize: number
	gameSpeed: number
	lastAction: string
}

export const demoState = $state<DemoState>({
	notifications: true,
	layout: 'horizontal',
	mode: 'command',
	theme: 'system',
	fontSize: 14,
	gameSpeed: 3,
	lastAction: 'Ready',
})

export function resetDefaults() {
	demoState.notifications = true
	demoState.layout = 'horizontal'
	demoState.mode = 'command'
	demoState.theme = 'system'
	demoState.fontSize = 14
	demoState.gameSpeed = 3
	demoState.lastAction = 'Reset to defaults'
}

export function applyPresentationMode() {
	demoState.notifications = false
	demoState.layout = 'horizontal'
	demoState.mode = 'command'
	demoState.theme = 'dark'
	demoState.fontSize = 16
	demoState.gameSpeed = 2
	demoState.lastAction = 'Applied presentation preset'
}

export function applyInspectorMode() {
	demoState.notifications = true
	demoState.layout = 'vertical'
	demoState.mode = 'inspect'
	demoState.theme = 'system'
	demoState.fontSize = 13
	demoState.gameSpeed = 4
	demoState.lastAction = 'Applied inspector preset'
}

export const demoPalette = new Palette({
	tools: {
		notifications: {
			type: 'boolean',
			label: 'Notifications',
			icon: '🔔',
			categories: ['settings'],
			keywords: ['alerts', 'sound', 'mute'],
			get value() {
				return demoState.notifications
			},
			set value(value) {
				demoState.notifications = value
			},
			default: true,
		},
		layout: {
			type: 'enum',
			label: 'Layout',
			icon: '▤',
			categories: ['layout'],
			keywords: ['arrangement'],
			get value() {
				return demoState.layout
			},
			set value(value) {
				demoState.layout = value
			},
			default: 'horizontal',
			values: [
				{ value: 'horizontal', icon: '▤', label: 'Horizontal', keywords: ['row'] },
				{ value: 'vertical', icon: '▥', label: 'Vertical', keywords: ['column'] },
			],
		},
		mode: {
			type: 'enum',
			label: 'Mode',
			icon: '⌘',
			categories: ['mode'],
			keywords: ['focus'],
			get value() {
				return demoState.mode
			},
			set value(value) {
				demoState.mode = value
			},
			default: 'command',
			values: [
				{ value: 'inspect', icon: '⌕', label: 'Inspect', keywords: ['debug'] },
				{ value: 'command', icon: '⌘', label: 'Command', keywords: ['keyboard'] },
			],
		},
		theme: {
			type: 'enum',
			label: 'Theme',
			icon: '🎨',
			categories: ['appearance'],
			keywords: ['color'],
			get value() {
				return demoState.theme
			},
			set value(value) {
				demoState.theme = value
			},
			default: 'system',
			values: [
				{ value: 'light', icon: '☀️', label: 'Light' },
				{ value: 'dark', icon: '🌙', label: 'Dark' },
				{ value: 'system', icon: '💻', label: 'System' },
			],
		},
		fontSize: {
			type: 'number',
			label: 'Font Size',
			icon: 'A',
			categories: ['appearance'],
			keywords: ['font', 'text', 'type'],
			get value() {
				return demoState.fontSize
			},
			set value(value) {
				demoState.fontSize = value
			},
			default: 14,
			min: 10,
			max: 20,
			step: 1,
		},
		gameSpeed: {
			type: 'number',
			label: 'Playback Speed',
			icon: '▶',
			categories: ['playback'],
			keywords: ['speed', 'game', 'animation'],
			get value() {
				return demoState.gameSpeed
			},
			set value(value) {
				demoState.gameSpeed = value
			},
			default: 3,
			min: 1,
			max: 5,
			step: 1,
		},
		terminal: {
			label: 'Terminal',
			icon: '`',
			categories: ['run'],
			keywords: ['terminal', 'magic', 'popup'],
			get can() {
				return true
			},
			run() {
				demoState.lastAction = 'Terminal opened'
			},
		},
		reset: {
			label: 'Reset Defaults',
			icon: '↺',
			categories: ['presets'],
			keywords: ['restore', 'defaults'],
			get can() {
				return (
					demoState.notifications !== true ||
					demoState.layout !== 'horizontal' ||
					demoState.mode !== 'command' ||
					demoState.theme !== 'system' ||
					demoState.fontSize !== 14 ||
					demoState.gameSpeed !== 3
				)
			},
			run() {
				resetDefaults()
			},
		},
		presentation: {
			label: 'Apply Presentation Preset',
			icon: '🎬',
			categories: ['presets'],
			keywords: ['presentation', 'present'],
			get can() {
				return true
			},
			run() {
				applyPresentationMode()
			},
		},
		inspectPreset: {
			label: 'Apply Inspector Preset',
			icon: '🧭',
			categories: ['presets'],
			keywords: ['inspect', 'inspector'],
			get can() {
				return true
			},
			run() {
				applyInspectorMode()
			},
		},
	},
	keys: createPaletteKeys({
		'`': 'terminal',
		N: 'notifications',
		L: 'layout|vertical',
		H: 'layout|horizontal',
		T: 'theme|light',
		D: 'theme|dark',
		S: 'theme|system',
		'+': 'fontSize:inc',
		'-': 'fontSize:dec',
		']': 'gameSpeed:inc',
		'[': 'gameSpeed:dec',
		M: 'mode|command',
		I: 'mode|inspect',
		R: 'reset',
	}),
	get editable() {
		return true
	},
	editors: demoEditors as never,
	editorDefaults: {
		run: 'button',
	},
})

export const initialIdeConfig: PaletteBorders = {
	top: [
		[
			{
				space: 0.1,
				toolbar: [
					{
						editor: 'commandBox',
						config: { icon: '⌘', label: 'Command', hint: 'Search and run palette actions' },
					},
					{
						tool: 'notifications',
						editor: 'toggle',
						config: { icon: '🔔', label: 'Notifications', hint: 'Compact icon toggle' },
					},
					{
						tool: 'layout',
						editor: 'splitRadio',
						config: { icon: '▤', label: 'Layout', hint: 'Split radio with quick apply + chooser' },
					},
					{
						tool: 'theme',
						editor: 'select',
						config: { icon: '🎨', label: 'Theme', hint: 'Compact text editor' },
					},
				],
			},
			{
				space: 0.5,
				toolbar: [
					{
						tool: 'mode',
						editor: 'splitRadio',
						config: { icon: '⌘', label: 'Mode', hint: 'Split radio with icon labels' },
					},
					{
						tool: 'fontSize',
						editor: 'slider',
						config: { icon: 'A', label: 'Font size', hint: 'Toolbar slider' },
					},
					{
						editor: 'drawer',
						toolbar: [
							{
								tool: 'notifications',
								editor: 'toggle',
								config: { icon: '🔔', label: 'Notifications', hint: 'Drawer toggle' },
							},
							{
								tool: 'gameSpeed',
								editor: 'stars',
								config: { icon: '★', label: 'Speed', hint: 'Drawer stars' },
							},
						],
						config: { icon: '▤', label: 'Tools', hint: 'Drawer popup (vertical)' },
					},
					{
						tool: 'reset',
						editor: 'splitButton',
						config: { icon: '↺', label: 'Reset', hint: 'Split action menu', tone: 'accent' },
					},
				],
			},
		],
	],
	left: [
		[
			{
				space: 1,
				toolbar: [
					{
						tool: 'theme',
						editor: 'flip',
						config: {
							icon: '🌓',
							label: 'Theme',
							hint: 'Single-button light/dark toggle',
							keywords: ['light', 'dark'],
						},
					},
					{
						tool: 'mode',
						editor: 'splitRadio',
						config: { icon: '🎯', label: 'Mode', hint: 'Compact focus mode chooser' },
					},
					{
						editor: 'drawer',
						toolbar: [
							{
								tool: 'theme',
								editor: 'segmented',
								config: { icon: '🌓', label: 'Theme', hint: 'Nested drawer theme pills' },
							},
							{
								tool: 'fontSize',
								editor: 'stepper',
								config: { icon: 'A', label: 'Font size', hint: 'Nested drawer stepper' },
							},
						],
						config: { icon: '🗂', label: 'More', hint: 'Nested drawer (axis inversion)' },
					},
				],
			},
		],
	],
	right: [
		[
			{
				space: 0,
				toolbar: [
					{
						tool: 'fontSize',
						editor: 'slider',
						config: { icon: 'A', label: 'Font size', hint: 'Right rail slider' },
					},
					{
						tool: 'gameSpeed',
						editor: 'stars',
						config: { icon: '★', label: 'Speed', hint: 'Stars editor' },
					},
				],
			},
		],
	],
	bottom: [
		[
			{
				space: 0.58,
				toolbar: [
					{
						tool: 'gameSpeed',
						editor: 'stars',
						config: { icon: '▶', label: 'Playback speed', hint: 'Dense stars editor' },
					},
					{
						tool: 'theme',
						editor: 'segmented',
						config: {
							icon: '🌓',
							label: 'Theme',
							hint: 'Theme pills',
							values: ['light', 'dark', 'system'],
						},
					},
				],
			},
			{
				space: 0.42,
				toolbar: [
					{
						tool: 'layout',
						editor: 'segmented',
						config: {
							icon: '▤',
							label: 'Layout',
							hint: 'Horizontal/vertical chips',
							keywords: ['row', 'column'],
						},
					},
					{
						tool: 'fontSize',
						editor: 'slider',
						config: { icon: 'A', label: 'Type scale', hint: 'Small range editor' },
					},
				],
			},
		],
	],
}
