// @ts-check
// Flat ESLint config (ESLint 10 + typescript-eslint 8). Pragmatic ruleset:
// the goal of this config is a WORKING, green lint gate on the current code —
// real problems are errors, framework-boundary `any` and empty catches are
// surfaced as warnings (visible backlog, non-blocking). A stricter pass
// (eliminating `any` on API shapes per CLAUDE.md §0.6) is deliberately left
// as its own later piece.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Never lint build output, deps, or coverage.
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Deliberate `any` at framework seams (req augmentation, decoded JWTs,
      // Mongoose subdocs). Surface it, don't fail the build on it.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Genuine dead bindings are an error; `_`-prefixed are intentional,
      // and caught errors may be legitimately unused (fail-open catches).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      // Empty catch blocks are a real pattern here (guest-fallback, best-effort
      // cleanup) — allow when the catch is intentionally empty.
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  {
    // Tests lean on `any` for fixtures/mocks — don't nag there.
    files: ['**/*.test.ts', '**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
