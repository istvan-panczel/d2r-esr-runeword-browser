import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactCompiler from 'eslint-plugin-react-compiler'
import reactRefresh from 'eslint-plugin-react-refresh'
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', '**/*.test.ts', '**/*.test.tsx', '**/*.mock.ts', '**/*.mock.tsx', 'src/test/**', 'vitest.config.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      reactX.configs['recommended-typescript'],
      reactDom.configs.recommended,
      eslintConfigPrettier,
    ],
    plugins: {
      'react-compiler': reactCompiler,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // React hooks - ensure all dependencies are specified
      'react-hooks/exhaustive-deps': 'error',

      // React Compiler - warn when code can't be optimized
      'react-compiler/react-compiler': 'error',

      // Prefer readonly for class members that are never reassigned
      '@typescript-eslint/prefer-readonly': 'error',

      // Allow constant exports alongside components (needed for shadcn/ui)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
])
