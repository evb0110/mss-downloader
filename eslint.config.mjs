import js from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import unusedImports from 'eslint-plugin-unused-imports';

export default typescriptEslint.config(
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    plugins: {
      'unused-imports': unusedImports
    }
  },
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
      // Disable TypeScript's no-unused-vars in favor of unused-imports plugin
      '@typescript-eslint/no-unused-vars': 'off',
      
      // Enable unused-imports plugin rules (auto-fixable!)
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',  // Change to warn so we can still see them but not block
        {
          'vars': 'all',
          'varsIgnorePattern': '^_',
          'args': 'after-used', 
          'argsIgnorePattern': '^_',
          'ignoreRestSiblings': true,
          'destructuredArrayIgnorePattern': '^_'
        }
      ],
      
      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', {
        'prefer': 'type-imports',
        'fixStyle': 'inline-type-imports'
      }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      
      // Vue rules
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'error',
      
      // General rules
      'no-console': 'off',
      'no-control-regex': 'off',
      'no-undef': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-unused-expressions': 'error',
      'no-unreachable': 'error',
      'no-duplicate-imports': 'off' // Let unused-imports handle this
    }
  }
);