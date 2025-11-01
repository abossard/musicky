# System Invariants

This document defines the invariants for Musicky - conditions that must **always** be true for the system to be in a valid state.

## What Are Invariants?

**Invariants** are assertions about the system state that must hold at all times. They serve as:
- **Contracts** that code must maintain
- **Documentation** of system guarantees
- **Test assertions** to verify correctness
- **Design constraints** that guide implementation

## 🌍 Global System Invariants

These invariants apply across the entire system:

### 1. Data Consistency

**INV-GLOBAL-001**: All entity IDs must be unique within their type
- Track IDs are unique across all tracks
- Playlist IDs are unique across all playlists
- No two entities of the same type share an ID

**INV-GLOBAL-002**: All timestamps follow chronological ordering
- `createdAt <= updatedAt` for all entities
- Timestamps are in ISO 8601 format
- Timestamps represent UTC time

**INV-GLOBAL-003**: All file paths are absolute and validated
- File paths must be absolute (start with `/` or drive letter)
- File paths must be within allowed directories
- File paths must not contain directory traversal attempts (`..`)

### 2. Layer Separation

**INV-GLOBAL-004**: Domain layer functions are pure
- No I/O operations in domain layer
- No mutations of input parameters
- Same input always produces same output
- No side effects (database, file system, network)

**INV-GLOBAL-005**: Actions are isolated to infrastructure layer
- All database operations in infrastructure layer
- All file system operations in infrastructure layer
- All network operations in infrastructure layer

**INV-GLOBAL-006**: Layer dependencies flow downward only
- Adapters → Application → Domain
- Infrastructure → Domain (types only)
- No upward or circular dependencies

### 3. Data Integrity

**INV-GLOBAL-007**: All domain entities are immutable
- Once created, entity properties cannot be changed
- Updates create new entity instances
- No setter methods on domain entities

**INV-GLOBAL-008**: All validation happens before persistence
- Invalid data never reaches the database
- Validation errors returned before any I/O
- Domain validation is separate from database constraints

## 📦 Per-Module Invariant Guidelines

Each module should document its specific invariants in a header comment:

```typescript
/**
 * [Module Name]
 * 
 * INVARIANTS:
 * - [Invariant 1: Description of what must always be true]
 * - [Invariant 2: Description of what must always be true]
 * - [Invariant 3: Description of what must always be true]
 * 
 * ASSUMPTIONS:
 * - [Assumption 1: What this module assumes about inputs/state]
 * 
 * GUARANTEES:
 * - [Guarantee 1: What this module promises about outputs/effects]
 */
```

## 🎵 Domain Entity Invariants

### Playlist Entity

**Module**: `src/domain/playlist/playlist.ts`

```typescript
/**
 * Playlist Entity
 * 
 * INVARIANTS:
 * - INV-PLAYLIST-001: Playlist ID must be non-empty string
 * - INV-PLAYLIST-002: Playlist name must be non-empty string (1-255 chars)
 * - INV-PLAYLIST-003: All track IDs in playlist must be unique
 * - INV-PLAYLIST-004: Track IDs list cannot contain null/undefined values
 * - INV-PLAYLIST-005: Total duration equals sum of individual track durations
 * - INV-PLAYLIST-006: createdAt <= updatedAt
 * - INV-PLAYLIST-007: Track count equals length of trackIds array
 * 
 * ASSUMPTIONS:
 * - Track IDs reference valid, existing tracks
 * - Track durations are non-negative integers (seconds)
 * 
 * GUARANTEES:
 * - All operations return new Playlist instance (immutable)
 * - Invalid operations return Error, never invalid state
 */

interface Playlist {
  readonly id: PlaylistId;
  readonly name: string;
  readonly trackIds: ReadonlyArray<TrackId>;
  readonly totalDuration: number; // seconds
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

### Track Entity

**Module**: `src/domain/track/track.ts`

```typescript
/**
 * Track Entity
 * 
 * INVARIANTS:
 * - INV-TRACK-001: Track ID must be non-empty string
 * - INV-TRACK-002: File path must be absolute and non-empty
 * - INV-TRACK-003: Duration must be non-negative integer (seconds)
 * - INV-TRACK-004: Duration must be >= 0 and <= 86400 (24 hours max)
 * - INV-TRACK-005: Title must be non-empty string (1-500 chars)
 * - INV-TRACK-006: Artist can be empty but not null/undefined
 * - INV-TRACK-007: Album can be empty but not null/undefined
 * - INV-TRACK-008: Phases list contains only valid phase tags
 * - INV-TRACK-009: Phases list has no duplicates
 * - INV-TRACK-010: createdAt <= updatedAt
 * 
 * ASSUMPTIONS:
 * - File path points to readable MP3 file
 * - Metadata extracted before Track creation
 * 
 * GUARANTEES:
 * - Track is immutable after creation
 * - All string fields are trimmed
 * - Phases are normalized to lowercase
 */

interface Track {
  readonly id: TrackId;
  readonly filePath: string;
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly duration: number; // seconds
  readonly phases: ReadonlyArray<Phase>;
  readonly comment: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

### Phase Value Object

**Module**: `src/domain/phase/phase.ts`

```typescript
/**
 * Phase Value Object
 * 
 * INVARIANTS:
 * - INV-PHASE-001: Phase must be one of: starter, buildup, peak, release, feature
 * - INV-PHASE-002: Phase values are lowercase only
 * - INV-PHASE-003: Phase cannot be empty string
 * 
 * ASSUMPTIONS:
 * - Phase values are validated before creation
 * 
 * GUARANTEES:
 * - Phase is immutable
 * - Phase comparison is case-insensitive but stored as lowercase
 */

type Phase = 'starter' | 'buildup' | 'peak' | 'release' | 'feature';
```

## 🔧 Service Layer Invariants

### PlaylistService

**Module**: `src/application/playlist-service/playlist-service.ts`

```typescript
/**
 * PlaylistService
 * 
 * INVARIANTS:
 * - INV-PS-001: Cannot add the same track to a playlist twice
 * - INV-PS-002: Cannot add non-existent track to playlist
 * - INV-PS-003: Playlist operations are transactional (all-or-nothing)
 * - INV-PS-004: Cache and database stay synchronized
 * - INV-PS-005: Playlist duration always matches sum of track durations
 * 
 * ASSUMPTIONS:
 * - Database operations may fail (network, disk, etc.)
 * - Repository layer handles data persistence correctly
 * 
 * GUARANTEES:
 * - All public methods maintain playlist invariants
 * - Failed operations leave system in consistent state (rollback)
 * - Cache invalidated on every mutation
 */
```

### MusicLibraryService

**Module**: `src/application/music-library-service/music-library-service.ts`

```typescript
/**
 * MusicLibraryService
 * 
 * INVARIANTS:
 * - INV-MLS-001: Track file paths are unique in the library
 * - INV-MLS-002: Only valid MP3 files are added to library
 * - INV-MLS-003: Track metadata stays synchronized with file system
 * - INV-MLS-004: Search results contain only existing tracks
 * 
 * ASSUMPTIONS:
 * - File system operations may fail or be slow
 * - Files may be modified externally between scans
 * 
 * GUARANTEES:
 * - Scan operations are atomic per directory
 * - Invalid files are logged but don't stop scan
 * - Stale tracks marked as unavailable, not deleted
 */
```

## 🛡️ Invariant Enforcement

### 1. Design Time
- Document invariants in module headers
- Design APIs that make invalid states unrepresentable
- Use TypeScript's type system to encode invariants

### 2. Development Time
- Write unit tests asserting each invariant
- Use property-based testing for invariants
- Code reviews check invariant preservation

### 3. Runtime
- Validate inputs at module boundaries
- Throw descriptive errors on invariant violations
- Use assertion functions in development mode

```typescript
// Example: Invariant enforcement function
function assertPlaylistInvariants(playlist: Playlist): void {
  assert(playlist.id.length > 0, 'INV-PLAYLIST-001 violated: empty ID');
  assert(playlist.name.length > 0, 'INV-PLAYLIST-002 violated: empty name');
  assert(new Set(playlist.trackIds).size === playlist.trackIds.length, 
         'INV-PLAYLIST-003 violated: duplicate track IDs');
  assert(playlist.createdAt <= playlist.updatedAt,
         'INV-PLAYLIST-006 violated: createdAt > updatedAt');
  // ... more assertions
}
```

## 📊 Invariant Testing Strategy

### Unit Tests
Each invariant should have at least one unit test:

```typescript
describe('Playlist Invariants', () => {
  test('INV-PLAYLIST-003: Track IDs must be unique', () => {
    const trackIds = ['track-1', 'track-2', 'track-1']; // duplicate
    expect(() => createPlaylist({ trackIds })).toThrow('duplicate track IDs');
  });
  
  test('INV-PLAYLIST-005: Duration equals sum of track durations', () => {
    const tracks = [
      { id: 't1', duration: 120 },
      { id: 't2', duration: 180 },
      { id: 't3', duration: 90 }
    ];
    const playlist = createPlaylist({ tracks });
    expect(playlist.totalDuration).toBe(390);
  });
});
```

### Property-Based Tests
Use property-based testing for universal invariants:

```typescript
import fc from 'fast-check';

test('INV-PLAYLIST-006: createdAt <= updatedAt (property-based)', () => {
  fc.assert(
    fc.property(
      fc.date(), // arbitrary createdAt
      fc.date(), // arbitrary updatedAt
      (created, updated) => {
        if (created <= updated) {
          const playlist = createPlaylist({ createdAt: created, updatedAt: updated });
          expect(playlist.createdAt.getTime()).toBeLessThanOrEqual(
            playlist.updatedAt.getTime()
          );
        }
      }
    )
  );
});
```

## 🔄 Invariant Evolution

When invariants change:

1. **Document the change** in this file
2. **Update module header comments**
3. **Update or add tests** for new invariants
4. **Run full test suite** to ensure no violations
5. **Update ADRs** if architectural implications exist

## 📚 Related Documentation

- [Architecture Overview](./architecture.md)
- [ADR-0001: Module Boundaries](../decisions/ADR-0001-module-boundaries.md)
- [Contributing Guide](../../CONTRIBUTING.md)

---

**Note**: This is a living document. Update as new invariants are discovered or existing ones evolve.
