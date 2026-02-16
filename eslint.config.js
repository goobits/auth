import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: ['.svelte-kit/**', 'build/**', 'dist/**', 'node_modules/**']
	},
	js.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.js', 'svelte.config.js']
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte']
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser
			}
		}
	},
	{
		rules: {
			'no-undef': 'off',
			'@typescript-eslint/no-deprecated': 'off',
			'@typescript-eslint/consistent-type-definitions': ['error', 'type'],
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{ prefer: 'type-imports', disallowTypeAnnotations: false }
			],
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
			'svelte/no-navigation-without-resolve': 'off'
		}
	}
);
