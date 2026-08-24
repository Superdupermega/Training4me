import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals'),
  {
    // The program logic must stay pure: no React, no database, no framework.
    // If this rule ever fires, the fix is to move the code, not to relax the rule.
    files: ['src/core/**/*.ts'],
    ignores: ['src/core/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['react', 'react-*', 'next', 'next/*', '@mui/*', '@supabase/*', '@/server/*', 'server-only'],
            message: 'src/core must stay pure: no React, no Next, no MUI, no database.',
          },
        ],
      }],
    },
  },
];

export default config;
