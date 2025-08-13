import js from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import unusedImports from 'eslint-plugin-unused-imports';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        ecmaVersion: 'latest',
        project: './tsconfig.json',
        tsconfigRootDir: __dirname
      }
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
        project: './tsconfig.json',
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      // Rules requiring type information - only for TS files
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off'
    }
  },
  {
    files: ['**/*.js'],
    rules: {
      // Disable TypeScript rules for JS files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
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
        'error',  // Strict mode - all unused vars are errors
        {
          'vars': 'all',
          'varsIgnorePattern': '^_UNUSED_',
          'args': 'after-used', 
          'argsIgnorePattern': '^_UNUSED_',
          'ignoreRestSiblings': true,
          'destructuredArrayIgnorePattern': '^_'
        }
      ],
      
      // TypeScript rules - STRICT
      '@typescript-eslint/no-explicit-any': 'warn', // Changed to warn for now
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