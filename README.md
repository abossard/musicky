# Musicky

Musicky is a local-first music management workspace for DJs and curators. It combines a searchable MP3 library, metadata editing, audio auditioning, and a visual moodboard so you can organize tracks by energy, transitions, and set flow.

## What the app does today

- **Visual moodboard:** place songs and tags on a canvas, connect them, and shape transitions visually
- **Phase-driven workflow:** organize tracks with ordered phases such as `starter`, `buildup`, `peak`, `release`, and custom phases
- **Metadata operations:** inspect tags, queue edits, and keep track of metadata changes
- **Playback tooling:** audition tracks with the global audio player while working on the board
- **Search and review:** find tracks quickly, inspect details, and review pending work
- **Local library management:** browse local files and persist app state in SQLite

## Product overview

Musicky is centered on the **Moodboard** page. Instead of treating the library as a plain table, the app lets users build a visual map of tracks, tags, and transitions while still supporting the operational work needed to prepare a set:

1. **Load a local music library**
2. **Search and audition tracks**
3. **Tag tracks with phases and metadata**
4. **Arrange songs and tags on the canvas**
5. **Review connections, playlists, and pending edits**

This makes the product part library manager, part set-planning tool, and part metadata workbench.

## Architecture overview

**Stack**

- React 19
- Vike for SSR/routing
- Fastify 5 server
- Telefunc RPC
- SQLite via `better-sqlite3`
- Mantine v8
- React Flow for the moodboard canvas

**Request flow**

```text
Browser
  -> Fastify server (fastify-entry.ts)
     -> /_telefunc requests -> *.telefunc.ts -> SQLite queries / file operations
     -> /audio/* -> streamed audio with range requests
     -> page requests -> Vike page rendering
```

**Main folders**

- `pages/` - route entry points (`/moodboard`, `/settings`, error page, redirect page)
- `components/` - UI components, including the large `Moodboard/` feature area
- `api/` and `components/*.telefunc.ts` - Telefunc entry points
- `database/sqlite/` - schema files, queries, and DB singleton
- `lib/` - business logic for metadata, scanning, graph behavior, and playlists
- `hooks/` and `contexts/` - reusable client state helpers
- `docs/` - design notes and architecture documents

## Key feature areas

### Moodboard and graph editing

The moodboard is the main experience. It supports:

- song nodes and tag nodes
- weighted edges and connection editing
- library and playlist side panels
- global search and keyboard navigation
- review and settings drawers
- integrated playback controls

### Metadata and tag management

The app includes tools for:

- reading MP3 metadata
- editing and syncing tags
- persisting pending edits
- phase-based organization for workflow and search

### Local-first persistence

Musicky stores state in SQLite, including:

- library settings
- playlists
- DJ sets and set items
- song connections
- phase edges
- moodboard and canvas state
- MP3 edit history

## Quick start

### Prerequisites

- Node.js
- npm
- A local music library

### Setup

```bash
npm install
printf "DATABASE_URL=./database.sqlite\n" > .env
npm run sqlite:migrate
npm run dev
```

Then open `http://localhost:3000`.

## Developer workflow

```bash
npm run dev            # Start the Fastify + Vite dev server
npm run lint           # ESLint
npm run build          # Production build
npm run sqlite:migrate # Create or update SQLite tables
npm run test:e2e       # Playwright end-to-end tests
```

Notes:

- Playwright tests run against `http://localhost:3000`
- Telefunc functions are colocated with the components that use them
- Database access goes through typed query helpers in `database/sqlite/queries`

## Working conventions

- Keep Telefunc functions prefixed with `on`
- Keep related component files together (`Component.tsx`, `Component.css`, `Component.telefunc.ts`)
- Prefer Mantine components for layout and controls
- Use `data-testid` for stable Playwright selectors
- Keep DB schema changes in `database/sqlite/schema/` and register them in `all.ts`

## Documentation map

- `PROJECT_OVERVIEW.md` - concise project brief for contributors and agents
- `.github/copilot-instructions.md` - repository-specific implementation guidance
- `COPILOT_GUIDE.md` - prompt patterns and AI collaboration guidance
- `docs/design/architecture.md` - architecture notes
- `docs/design/invariants.md` - design constraints and system invariants

## Long-term plan

### 1. Lightweight and efficient Electron app

The long-term direction is to package Musicky as a desktop-first Electron application while keeping the current local-first workflow intact. The focus should be:

- fast startup and low memory use
- smooth playback and canvas interaction for large libraries
- native-feeling file access and local persistence
- a clear boundary between shared app logic and desktop shell code

### 2. Copilot SDK integration for metadata automation

Another long-term goal is to use Copilot SDK capabilities to automate repetitive metadata work. Good targets include:

- suggesting missing titles, artists, and comments
- proposing phase tags from context and prior edits
- spotting inconsistent metadata across related tracks
- assisting with review queues instead of applying destructive changes automatically

The preferred direction is **human-in-the-loop automation**: suggestions first, explicit user confirmation before writing tags or changing library state.
