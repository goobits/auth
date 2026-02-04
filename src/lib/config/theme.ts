import { createThemeConfig } from '@goobits/themes/core'

export const themeConfig = createThemeConfig({
	schemes: {
		default: {
			name: 'default',
			displayName: 'Default',
			description: 'Default theme',
			preview: {
				primary: '#0b0b0b',
				accent: '#e07a3f',
				background: '#f6f1ea'
			}
		},
		dark: {
			name: 'dark',
			displayName: 'Dark Mode',
			description: 'Dark theme',
			preview: {
				primary: '#f2f2f2',
				accent: '#7fb2ff',
				background: '#111111'
			}
		}
	}
})
