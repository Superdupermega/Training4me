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
  {
    // The MUI barrel re-exports every component from one module, so a named
    // import from it (`import { Button } from '@mui/material'`) pulls the
    // whole library into the module graph for tree-shaking to sort out later.
    // A deep default import (`import Button from '@mui/material/Button'`)
    // never has that problem. Every import in this repo is already written
    // the safe way — this rule is what keeps it that way.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: '@mui/material', message: 'Import each component from its own path: `@mui/material/Button`, not the barrel.' },
          { name: '@mui/icons-material', message: 'Import each icon from its own path: `@mui/icons-material/Add`, not the barrel.' },
        ],
      }],
    },
  },
];

export default config;
