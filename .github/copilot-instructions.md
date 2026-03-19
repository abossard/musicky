# Copilot Instructions for Musicky

## Build, Test, and Lint

```bash
npm run dev              # Start dev server (Fastify + Vite HMR on port 3000)
npm run build            # Production build (vike build)
npm run preview          # Preview production build
npm run lint             # ESLint (flat config, TypeScript)
npm run sqlite:migrate   # Create/update SQLite tables
```

### Testing (Playwright E2E)

```bash
npm run test:e2e                          # Headless, all 5 browser projects
npm run test:e2e:headed                   # With browser UI
npm run test:e2e:ui                       # Playwright interactive UI
npx playwright test tests/some.spec.ts    # Single test file
npx playwright test -g "test name"        # Single test by name
npx playwright test --project=chromium    # Single browser
```

Tests run against `http://localhost:3000` (auto-started via `npm run dev`). The CI pipeline only runs `tsc` type-checking — no test execution.

## Architecture

**Stack:** Vike (SSR framework) + React 19 + Fastify 5 + Telefunc (RPC) + SQLite (better-sqlite3) + Mantine v8

### Request Flow

```
Browser → Fastify server (fastify-entry.ts)
  ├─ POST /_telefunc  → telefunc-handler.ts → *.telefunc.ts functions → SQLite queries
  ├─ GET /audio/*     → HTTP Range streaming (supports seeking)
  └─ GET /*           → vike-handler.ts → SSR page rendering
```

The server entry (`fastify-entry.ts`) wires up Vite dev middleware, static file serving, audio streaming with Range request support, Telefunc RPC, and Vike SSR as a catch-all.

### Database Layer

- **Singleton:** `database/sqlite/db.ts` creates one `better-sqlite3` instance
- **Schemas:** `database/sqlite/schema/*.ts` — run via `npm run sqlite:migrate`
- **Queries:** `database/sqlite/queries/*.ts` — typed functions using prepared statements
- **Transactions:** Use `client.transaction()` for batch operations (see `reorderSetItems` in dj-sets queries)
- Requires `DATABASE_URL` in `.env`

### Telefunc RPC

Client-server calls go through colocated `.telefunc.ts` files — no REST API layer.

```
components/DJSets.telefunc.ts      → RPC for DJSets.tsx
components/MP3Library.telefunc.ts  → RPC for MP3Library.tsx
api/file-browser.telefunc.ts       → Shared file browser RPCs
```

Telefunc functions are called directly from React components (typically in `useEffect` on mount).

### State Management

- **Simple state:** `useState` + `useEffect` with Telefunc calls
- **Complex state:** Custom reducers (`lib/mp3-library-state.ts` pattern — typed actions + reducer + `useReducer`)
- **Shared state:** React Context (`contexts/StatusContext.tsx`, `contexts/DJSetContext.tsx`)
- **Async helpers:** `hooks/useAsyncState.ts` provides `execute`/`loading`/`error` pattern

## Conventions

### Telefunc Functions

- **Always prefix with `on`:** `onGetDJSets`, `onCreateDJSet`, `onSetBaseFolder`
- **Always `async`** even for synchronous DB calls
- **Colocate** with the component that uses them: `Component.telefunc.ts` next to `Component.tsx`
- Import database queries directly — the DB singleton handles connection

### Pages (Vike)

- File-based routing: `pages/<name>/+Page.tsx`
- Optional per-page files: `+config.ts`, `+data.ts`, `+Head.tsx`
- Global layout in `layouts/LayoutDefault.tsx` (Mantine AppShell with responsive sidebar)

### Components

- Colocate related files: `Component.tsx` + `Component.css` + `Component.telefunc.ts`
- Use Mantine components (AppShell, Stack, Group, DataTable from mantine-datatable)
- Use `data-testid` attributes for Playwright test selectors
- Wrap pages that need DJ Set features in `<DJSetProvider>`

### Styling

- **Primary:** Mantine components and utilities (dark theme, `primaryColor: "violet"`)
- **Custom styles:** Plain CSS files colocated with components (not CSS Modules, not Tailwind)
- **CSS-in-JS:** `@compiled/react` is configured — the `css` prop is allowed on React elements
- PostCSS with `postcss-preset-mantine` for Mantine CSS variables

### ESLint

- Flat config (`eslint.config.ts`), TypeScript-ESLint + React plugin
- Unused vars are warnings; prefix intentionally unused params with `_`
- Namespaces are allowed (`@typescript-eslint/no-namespace` is off)
- The `css` prop is whitelisted in `react/no-unknown-property`

### Database

- Add new tables in `database/sqlite/schema/` and register in `all.ts`
- Add query functions in `database/sqlite/queries/` with typed interfaces
- Use `better-sqlite3` prepared statements (synchronous API)
- Include indexes for frequently queried columns
