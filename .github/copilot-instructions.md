# Copilot Instructions for Musicky

## Build, Test, and Lint

```bash
npm run dev              # Start dev server (Fastify + Vite HMR on port 3000)
npm run build            # Production build (vike build)
npm run preview          # Preview production build
npm run lint             # ESLint (flat config, TypeScript)
npm run sqlite:migrate   # Create/update SQLite tables
```

### Testing

```bash
# E2E (Playwright) — tests live in tests/specs/
npm run test:e2e                          # Headless, all 5 browser projects
npm run test:e2e:headed                   # With browser UI
npm run test:e2e:ui                       # Playwright interactive UI
npx playwright test tests/specs/some.spec.ts    # Single test file
npx playwright test -g "test name"              # Single test by name
npx playwright test --project=chromium          # Single browser

# Integration (tsx runner)
npm run test:integration                  # Tag roundtrip tests
```

E2E tests run against `http://localhost:3000` (auto-started via Playwright's `webServer` config). The CI pipeline runs ESLint + `tsc --noEmit` type-checking.

## Architecture

**Stack:** Vike (SSR framework) + React 19 + Fastify 5 + Telefunc (RPC) + SQLite (better-sqlite3) + Mantine v8 + React Flow (@xyflow/react)

### Request Flow

```
Browser → Fastify server (fastify-entry.ts)
  ├─ POST /_telefunc  → telefunc-handler.ts → *.telefunc.ts functions → SQLite queries
  ├─ GET /audio/*     → HTTP Range streaming (supports seeking)
  └─ GET /*           → vike-handler.ts → SSR page rendering
```

### Key Feature Areas

- **Moodboard** (`/moodboard`) — The primary feature. Graph-based song organization using React Flow (`@xyflow/react`). Songs are nodes; edges represent connections/transitions. Components live in `components/Moodboard/`.
- **MP3 Library** — Scan, browse, and edit metadata for local MP3 files. Phase tagging via hashtags in comments (`#starter`, `#buildup`, `#peak`, `#release`, `#feature`).
- **Tag Sync** (`components/TagSync.*`) — Bidirectional sync between the database and MP3 file tags (import/export with conflict detection).
- **Audio Player** (`components/AudioPlayer/`) — Global audio player with queue management, volume control, and progress tracking.

### Database Layer

- **Singleton:** `database/sqlite/db.ts` — one `better-sqlite3` instance, requires `DATABASE_URL` in `.env`
- **Schemas:** `database/sqlite/schema/*.ts` — register new schemas in `all.ts`, run via `npm run sqlite:migrate`
- **Queries:** `database/sqlite/queries/*.ts` — typed functions using prepared statements (synchronous API)
- **Transactions:** Use `client.transaction()` for batch operations

### Telefunc RPC

Client-server calls go through colocated `.telefunc.ts` files — no REST API layer. Telefunc functions are called directly from React components (typically in `useEffect` on mount).

```
components/MP3Library.telefunc.ts            → RPC for MP3Library.tsx
components/Moodboard/Moodboard.telefunc.ts   → RPC for MoodboardCanvas.tsx
api/file-browser.telefunc.ts                 → Shared file browser RPCs
```

### State Management

- **Simple state:** `useState` + `useEffect` with Telefunc calls
- **Complex state:** Custom reducers (`lib/mp3-library-state.ts` — typed actions + reducer + `useReducer`)
- **Shared state:** React Context (`contexts/StatusContext.tsx`)
- **Async helpers:** `hooks/use-async-state.ts` provides `execute`/`loading`/`error` pattern

## Conventions

### Telefunc Functions

- **Always prefix with `on`:** `onGetBaseFolder`, `onScanLibrary`, `onAddSongNode`
- **Always `async`** even for synchronous DB calls
- **Colocate** with the component that uses them: `Component.telefunc.ts` next to `Component.tsx`
- Import database queries directly — the DB singleton handles connection

### Pages (Vike)

- File-based routing: `pages/<name>/+Page.tsx`
- Optional per-page files: `+config.ts`, `+data.ts`, `+Head.tsx`
- Global layout in `layouts/LayoutDefault.tsx` wraps children with MantineProvider + StatusProvider

### Components

- Colocate related files: `Component.tsx` + `Component.css` + `Component.telefunc.ts`
- Use Mantine components (Stack, Group, DataTable from mantine-datatable)
- Use `data-testid` attributes for Playwright test selectors
- Drag-and-drop uses `@dnd-kit`

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

### Commits

Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
