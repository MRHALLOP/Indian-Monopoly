import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Ignore built output and one-off scratch scripts that are not production code
  globalIgnores([
    'dist',
    'inspect_cut.js',
    'simulate-game.js',
    'test-full-mechanics.js',
    'test-gameplay.js',
  ]),
  // Source files — browser environment
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { caughtErrorsIgnorePattern: '^_' }],
    },
  },
  // Node.js test/script files — need process, __dirname, etc.
  {
    files: ['test-browser.js', 'test-units.test.jsx', 'vitest.config.js', 'vitest.setup.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
