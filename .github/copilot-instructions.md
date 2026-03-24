# Copilot Instructions for Musicky

## Project summary

Musicky is a local-first DJ music management app. The current product is centered on the moodboard experience: users search a local library, audition tracks, edit metadata, assign phases, and arrange songs visually with graph connections.

When working in this repository, optimize for:

- **fast local workflows**
- **safe metadata handling**
- **responsive canvas interactions**
- **clear separation between UI, RPC, and persistence**

## Core skills to apply

### 1. Music metadata workflow awareness

- Prefer reviewable changes over automatic metadata rewrites
- Preserve existing tags unless the feature explicitly replaces them
- Treat metadata automation as assistive, not authoritative
- Keep edit history and pending-edit flows intact

### 2. Moodboard-first product thinking

- `/moodboard` is the main application surface
- Changes that affect search, playback, tags, playlists, or review flows should fit naturally into the moodboard workflow
- Avoid designs that make the visual planning flow secondary

### 3. Local-first performance discipline

- Assume users may work with large local libraries
- Prefer incremental data loading and targeted refreshes
- Avoid expensive repeated scans or overly chatty RPC patterns
- Keep UI interactions lightweight, especially on the moodboard canvas

### 4. Human-in-the-loop automation

- Future AI features should produce suggestions, queues, or review items
- Do not introduce silent bulk metadata updates
- Make it easy for users to inspect and confirm automated proposals

## Build, test, and lint

```bash
npm run dev              # Start dev server (Fastify + Vite HMR on port 3000)
npm run build            # Production build
npm run preview          # Preview production build
npm run lint             # ESLint
npm run sqlite:migrate   # Create/update SQLite tables
npm run test:e2e         # Playwright end-to-end tests
```

Tests run against `http://localhost:3000`.

## Architecture

**Stack:** Vike + React 19 + Fastify 5 + Telefunc + SQLite + Mantine + React Flow

### Request flow

```text
Browser -> Fastify server (fastify-entry.ts)
  -> POST /_telefunc -> *.telefunc.ts -> SQLite queries / file operations
  -> GET /audio/* -> streamed audio responses
  -> GET /* -> Vike SSR
```

### Main feature areas

- `components/Moodboard/` - canvas, panels, search, review, playback bar, phase flow editor
- `components/MP3MetadataViewer.tsx`, `TagSync.tsx`, `PendingEditsManager.tsx` - metadata workflows
- `components/Settings.tsx` - phase order and playback settings
- `hooks/useAudioQueue.ts` - playback queue logic
- `database/sqlite/queries/` - persistence layer

## Conventions

### Telefunc

- Prefix Telefunc functions with `on`
- Keep them `async`
- Colocate feature RPC files with the component when practical
- Let Telefunc handlers call query helpers directly instead of embedding SQL in UI code

### Database

- Add schema changes in `database/sqlite/schema/`
- Register new schema modules in `database/sqlite/schema/all.ts`
- Add typed helpers in `database/sqlite/queries/`
- Use prepared statements and transactions where appropriate

### UI

- Prefer Mantine components first
- Keep related files colocated
- Use plain CSS files already established in the repo
- Add `data-testid` attributes for important interactive elements

## Long-term plan

### Lightweight Electron app

When introducing architecture or abstractions, favor choices that can later support a lightweight Electron shell without rewriting core product logic. Shared business logic, persistence, and metadata features should stay portable.

### Copilot SDK integration

Future AI work should focus on metadata assistance:

- suggest metadata completions
- recommend phases/tags
- detect inconsistencies and duplicates
- prepare review queues for user approval

Design new automation so it can plug into a review-first workflow instead of bypassing it.
