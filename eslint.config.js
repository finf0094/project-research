import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueTs from '@vue/eslint-config-typescript'

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', 'docs/**', 'apps/api/src/db/migrations/**'] },
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  ...vueTs(),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
      // Optional props without defaults are simply undefined; defaults would only add noise.
      'vue/require-default-prop': 'off',
      // Formatting belongs to Prettier.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
    },
  },
  {
    // Module boundaries: other modules are reached only through their index.ts.
    files: ['apps/web/src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/modules/*/*'], message: 'Import a module through its index.ts' }] },
      ],
    },
  },
]
