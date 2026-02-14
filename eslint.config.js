import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'

export default tseslint.config(
	{
		ignores: [
			'node_modules/**',
			'.svelte-kit/**',
			'build/**',
			'dist/**',
			'static/**',
			'software/**',
			'coverage/**',
			'test-results/**',
			'repos/auth/__tests__/**'
		]
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		files: ['**/*.{js,mjs,cjs}'],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.browser
			}
		},
		rules: {
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.browser
			}
		},
		rules: {
			'no-undef': 'off',
			'no-empty': ['error', { allowEmptyCatch: true }],
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'error'
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			},
			parserOptions: {
				parser: tseslint.parser
			}
		},
		rules: {
			'no-undef': 'off',
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/require-each-key': 'off',
			'svelte/prefer-svelte-reactivity': 'off',
			'svelte/no-at-html-tags': 'off'
		}
	}
)
