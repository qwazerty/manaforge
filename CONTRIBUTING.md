# Contributing

## Frontend unit tests

1. Install dependencies (requires Node 18+):
   ```bash
   pnpm install
   ```
2. Run Vitest once, in watch mode, or with coverage:
   ```bash
   pnpm test:unit
   pnpm test:watch
   pnpm test:coverage
   ```
3. Place component tests next to their Svelte files (e.g., `app/static/js/svelte/DeckZone.test.ts`) or under `__tests__` directories. Utilities and stores in `app/static/js/ui` should follow the same `*.test.ts` convention.
4. Use `@testing-library/svelte` + `@testing-library/user-event` with behavior-driven assertions (query by role/text, avoid brittle snapshots).
5. Keep coverage above 80% for statements, branches, functions, and lines. CI runs `pnpm test:coverage` and fails under threshold.

When tests need shared context/stores, wrap components with helpers from `app/static/js/ui/testing/renderWithProviders.ts`. Add more provider hooks there as needed instead of per-test reimplementation.
