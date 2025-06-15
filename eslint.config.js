import js from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

export default typescriptEslint.config(
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptEslint.parser,
        sourceType: 'module',
        ecmaVersion: 'latest'
      }
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest'
      }
    }
  },
  {
    ignores: [
      'dist/**',
      'release/**',
      'node_modules/**',
      'workers-dist/**',
      '*.config.js',
      '*.config.ts'
    ]
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'off',
      'no-console': 'off',
      'no-control-regex': 'off',
      'no-undef': 'off'
    }
  }
);