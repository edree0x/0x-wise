import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default tseslint.config(
  { ignores: ['.next/', 'node_modules/', 'data/', 'models/', '*.config.*', '*.lock', 'public/extension/', 'tests/'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooksPlugin },
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      'react/no-unescaped-entities': 'off',
      // Downgrade to warn for existing codebase - can be tightened later
      '@typescript-eslint/consistent-type-definitions': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/prefer-regexp-exec': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/array-type': 'warn',
      '@next/next/no-img-element': 'warn',
      'no-useless-escape': 'warn',
      'no-restricted-syntax': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
    },
  },
  {
    files: ['src/dashboard/**/*.tsx', 'src/app/**/*.tsx'],
    rules: {
      'react/display-name': 'off',
      'react/prop-types': 'off',
    },
  },
)