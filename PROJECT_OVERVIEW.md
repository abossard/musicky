# Musicky Project Overview

## Summary

Musicky is a local-first DJ music management app built around a visual moodboard. It helps users browse a local music library, audition tracks, edit metadata, manage phases, and plan transitions on a canvas.

## Current product shape

### Core user workflows

1. Open the app and work primarily from `/moodboard`
2. Search the local library and preview tracks
3. Add songs to the canvas or playlist workflow
4. Organize tracks with phases, tags, and weighted connections
5. Review metadata changes and persist state in SQLite

### Major capabilities

- Visual moodboard with song nodes, tag nodes, and weighted edges
- Local MP3 library browsing and search
- Metadata inspection, edit queues, and tag sync workflows
- Global audio player with queue and progress support
- Settings for phase order and playback behavior
- SQLite-backed persistence for library state, playlists, DJ sets, and history

## Technical overview

### Stack

- React 19
- TypeScript
- Vike
- Fastify 5
- Telefunc
- SQLite with `better-sqlite3`
- Mantine v8
- React Flow

### Runtime flow

```text
React UI
  -> Telefunc RPC / page requests
  -> Fastify server
  -> SQLite queries and local file operations
```

### Important paths

- `pages/moodboard/+Page.tsx` - main application route
- `components/Moodboard/` - primary product surface
- `components/*.telefunc.ts` - feature-specific RPC handlers
- `database/sqlite/schema/` - schema definitions
- `database/sqlite/queries/` - typed DB access helpers
- `lib/` - metadata, playlist, graph, and scan logic

## Guidance for contributors

### What matters most

- Preserve the moodboard-first workflow
- Keep the app responsive with large local libraries
- Avoid destructive metadata changes without user intent
- Favor small, composable Telefunc endpoints over ad hoc server code
- Keep database logic centralized in the query layer

### Current conventions

- Telefunc functions are `async` and prefixed with `on`
- Component-related RPC files stay close to the component
- Mantine is the default UI toolkit
- Plain colocated CSS is preferred over introducing new styling systems
- Use `data-testid` where UI behavior needs Playwright coverage

## Long-term direction

### Lightweight Electron app

The product should evolve toward a lightweight Electron shell for desktop-first music management. Work in this direction should prioritize:

- startup speed
- low memory overhead
- clean separation between desktop shell code and shared app logic
- reliable local file access and playback

### Copilot SDK metadata automation

Musicky also aims to use Copilot SDK workflows to assist with metadata management. The best uses are:

- metadata suggestion and cleanup
- phase/tag recommendation
- inconsistency detection
- review-first automation for bulk operations

The intended model is suggestion-driven assistance, not silent automatic writes.
