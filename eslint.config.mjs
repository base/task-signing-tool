import { defineConfig } from 'eslint/config';
import eslintPlugin from '@eslint/js';
import { configs as tseslintConfigs } from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';

// Global ignores configuration
const ignoresConfig = defineConfig([
  {
    name: 'project/ignores',
    ignores: ['.next/', 'node_modules/', 'public/', '.vscode/', 'next-env.d.ts', 'out/', 'build/'],
  },
]);

// ESLint recommended rules for JavaScript/TypeScript
const eslintConfig = defineConfig([
  {
    name: 'project/javascript-recommended',
    files: ['**/*.{js,mjs,ts,tsx}'],
    ...eslintPlugin.configs.recommended,
  },
]);

// TypeScript configuration
const typescriptConfig = defineConfig([
  {
    name: 'project/typescript',
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslintConfigs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    name: 'project/javascript-disable-type-check',
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslintConfigs.disableTypeChecked,
  },
]);

// React and Next.js configuration
const reactConfig = defineConfig([
  {
    name: 'project/react-next',
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Disable stricter rules that flag existing patterns
      'react-hooks/set-state-in-effect': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
]);

export default defineConfig([...ignoresConfig, ...eslintConfig, ...typescriptConfig, ...reactConfig]);
