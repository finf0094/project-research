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
  // Module boundaries: other modules are reached only through their index.ts, never by a relative path
  // that climbs out of the module; shared code knows nothing about modules or the app.
  ...[
    { files: ['apps/web/src/modules/*/*.{ts,vue}'], climb: ['../*'] },
    // Modules are at most two folders deep (pages/, components/), so climbing two levels leaves the module.
    { files: ['apps/web/src/modules/*/*/**/*.{ts,vue}'], climb: ['../../*', '../../../*'] },
    { files: ['apps/web/src/app/**/*.{ts,vue}'], climb: null },
  ].map(({ files, climb }) => ({
    files,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/modules/*/*'], message: 'Import a module through its index.ts' },
            ...(climb
              ? [{ group: climb, message: 'Do not reach into another module by a relative path' }]
              : []),
          ],
        },
      ],
    },
  })),
  {
    files: ['apps/web/src/shared/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/modules/**', '@/app/**'], message: 'shared must not depend on modules or the app' },
          ],
        },
      ],
    },
  },
]
