# Musicky Architecture

This document describes the architectural design of Musicky, following principles from *A Philosophy of Software Design* and *Grokking Simplicity*.

## 🏗️ Four-Layer Architecture

Musicky follows a stratified design with clear separation of concerns across four distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    ADAPTERS LAYER                            │
│  (Controllers, UI Components, API Handlers)                  │
│                                                              │
│  Responsibilities:                                           │
│  - Handle user input and present output                     │
│  - Convert external data formats to internal models         │
│  - Manage UI state and rendering                            │
│  - HTTP/API request handling                                │
│                                                              │
│  Examples: React components, Telefunc handlers, CLI         │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│  (Use Cases, Orchestration, Workflows)                      │
│                                                              │
│  Responsibilities:                                           │
│  - Coordinate business operations                           │
│  - Orchestrate domain logic and infrastructure              │
│  - Implement use case flows                                 │
│  - Manage transactions                                       │
│                                                              │
│  Examples: PlaylistService, MusicLibraryService             │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                             │
│  (Core Business Logic, Pure Calculations, Entities)         │
│                                                              │
│  Responsibilities:                                           │
│  - Pure business logic (calculations)                       │
│  - Domain entities and value objects                        │
│  - Business rule validation                                 │
│  - Immutable data transformations                           │
│                                                              │
│  Constraints:                                                │
│  - NO side effects (no I/O, no mutations)                   │
│  - Same input → Same output (referentially transparent)     │
│  - Easily testable without mocks                            │
│                                                              │
│  Examples: calculateDuration, filterByPhase, validateTrack  │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                        │
│  (I/O Actions: Database, File System, Network)              │
│                                                              │
│  Responsibilities:                                           │
│  - Database operations (CRUD)                               │
│  - File system I/O                                          │
│  - External API calls                                       │
│  - Caching mechanisms                                       │
│                                                              │
│  Characteristics:                                            │
│  - All side effects isolated here                           │
│  - Can fail (network, disk, etc.)                          │
│  - Requires integration testing                             │
│                                                              │
│  Examples: Database repositories, File I/O utilities        │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow Diagram

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ (1) User Action
       ↓
┌─────────────────────────────────────┐
│      ADAPTERS                       │
│  - UI Component / API Handler       │
│  - Parse/Validate Input             │
│  - Convert to Domain Model          │
└──────┬──────────────────────────────┘
       │ (2) Domain Command
       ↓
┌─────────────────────────────────────┐
│      APPLICATION                    │
│  - Orchestrate Use Case             │
│  - Call Domain Logic                │
│  - Coordinate Infrastructure        │
└──────┬──────────────────────────────┘
       │ (3) Pure Calculation
       ↓
┌─────────────────────────────────────┐
│      DOMAIN                         │
│  - Pure Business Logic              │
│  - Calculate/Validate/Transform     │
│  - Return Immutable Result          │
└──────┬──────────────────────────────┘
       │ (4) Data to Persist
       ↓
┌─────────────────────────────────────┐
│      INFRASTRUCTURE                 │
│  - Database Write                   │
│  - File System Update               │
│  - Cache Invalidation               │
└──────┬──────────────────────────────┘
       │ (5) Success/Failure Result
       ↓
┌─────────────────────────────────────┐
│      APPLICATION                    │
│  - Handle Result                    │
│  - Error Management                 │
└──────┬──────────────────────────────┘
       │ (6) Response
       ↓
┌─────────────────────────────────────┐
│      ADAPTERS                       │
│  - Format Response                  │
│  - Update UI                        │
└──────┬──────────────────────────────┘
       │ (7) Rendered Result
       ↓
┌─────────────┐
│    User     │
└─────────────┘
```

## 🧩 Module Candidates

Based on our music library domain, here are the initial module candidates organized by layer:

### Domain Layer Modules

**Playlist Module** (`src/domain/playlist/`)
- **Purpose**: Core playlist business logic
- **Responsibilities**: Playlist calculations, validation, transformations
- **Key Functions**: 
  - `calculateTotalDuration(tracks: Track[]): number`
  - `canAddTrack(playlist: Playlist, track: Track): boolean`
  - `shuffleTracks(tracks: Track[]): Track[]`
  - `filterByPhase(tracks: Track[], phase: Phase): Track[]`
- **Invariants**: See `docs/design/invariants.md`

**Track Module** (`src/domain/track/`)
- **Purpose**: Track entity and operations
- **Responsibilities**: Track validation, metadata transformations
- **Key Functions**:
  - `validateTrackData(data: unknown): Track | ValidationError`
  - `extractPhases(comment: string): Phase[]`
  - `updatePhases(comment: string, phase: Phase, add: boolean): string`
- **Invariants**: See `docs/design/invariants.md`

**Phase Module** (`src/domain/phase/`)
- **Purpose**: Phase tag logic
- **Responsibilities**: Phase validation, parsing, formatting
- **Key Functions**:
  - `parsePhases(text: string): Phase[]`
  - `formatPhaseTag(phase: Phase): string`
  - `isValidPhase(phase: string): boolean`

### Application Layer Modules

**PlaylistService** (`src/application/playlist-service/`)
- **Purpose**: Orchestrate playlist use cases
- **Public Interface**:
  - `createPlaylist(name: string): Promise<PlaylistId>`
  - `addTrackToPlaylist(playlistId: PlaylistId, trackId: TrackId): Promise<void>`
  - `removeTrackFromPlaylist(playlistId: PlaylistId, trackId: TrackId): Promise<void>`
  - `getPlaylist(playlistId: PlaylistId): Promise<Playlist>`
  - `shufflePlaylist(playlistId: PlaylistId): Promise<void>`
- **Hidden Complexity**: Caching, validation, error handling, transaction management

**MusicLibraryService** (`src/application/music-library-service/`)
- **Purpose**: Orchestrate music library operations
- **Public Interface**:
  - `scanMusicDirectory(path: string): Promise<ScanResult>`
  - `searchTracks(query: string): Promise<Track[]>`
  - `updateTrackMetadata(trackId: TrackId, metadata: Metadata): Promise<void>`
  - `getTracksByPhase(phase: Phase): Promise<Track[]>`
- **Hidden Complexity**: File scanning, metadata extraction, database updates, cache invalidation

### Infrastructure Layer Modules

**PlaylistRepository** (`src/infrastructure/playlist-repository/`)
- **Purpose**: Playlist persistence
- **Operations**:
  - `save(playlist: Playlist): Promise<void>`
  - `findById(id: PlaylistId): Promise<Playlist | null>`
  - `delete(id: PlaylistId): Promise<void>`
  - `findAll(): Promise<Playlist[]>`

**TrackRepository** (`src/infrastructure/track-repository/`)
- **Purpose**: Track persistence
- **Operations**:
  - `save(track: Track): Promise<void>`
  - `findById(id: TrackId): Promise<Track | null>`
  - `findByPath(path: string): Promise<Track | null>`
  - `search(query: string): Promise<Track[]>`

**FileSystemService** (`src/infrastructure/file-system-service/`)
- **Purpose**: File system operations
- **Operations**:
  - `readDirectory(path: string): Promise<string[]>`
  - `readFile(path: string): Promise<Buffer>`
  - `exists(path: string): Promise<boolean>`
  - `getMetadata(path: string): Promise<FileMetadata>`

**CacheService** (`src/infrastructure/cache-service/`)
- **Purpose**: Data caching
- **Operations**:
  - `get<T>(key: string): Promise<T | null>`
  - `set<T>(key: string, value: T, ttl?: number): Promise<void>`
  - `invalidate(pattern: string): Promise<void>`

### Adapters Layer Modules

**API Controllers** (`src/adapters/api/`)
- Telefunc handlers for RPC calls
- Convert HTTP requests to application layer calls
- Format responses

**UI Components** (`src/adapters/ui/`)
- React components (already exist in `/components`)
- Handle user interactions
- Display application state

## 🎯 Design Goals

### 1. Deep Modules
Each module should:
- **Hide significant complexity** behind a simple interface
- **Minimize the public API surface** (prefer 3-7 public methods max)
- **Provide rich functionality** without exposing implementation details

Example:
```typescript
// GOOD: Deep module - rich functionality, simple interface
class PlaylistService {
  async createPlaylist(name: string): Promise<PlaylistId>
  async addTrack(playlistId: PlaylistId, trackId: TrackId): Promise<void>
  async getPlaylist(playlistId: PlaylistId): Promise<Playlist>
  
  // Hides: validation, caching, database ops, error handling, transactions
}

// BAD: Shallow module - exposes too much
class PlaylistService {
  async validatePlaylistName(name: string): ValidationResult
  async checkPlaylistExists(id: PlaylistId): boolean
  async insertPlaylistToDb(playlist: Playlist): Promise<void>
  async invalidatePlaylistCache(id: PlaylistId): void
  async getPlaylistFromCache(id: PlaylistId): Playlist | null
  async getPlaylistFromDb(id: PlaylistId): Promise<Playlist>
  // ... many more methods exposing internals
}
```

### 2. Separation of Actions and Calculations

**Calculations** (Domain Layer):
- Pure functions
- No side effects
- Deterministic
- Easy to test, cache, reason about

**Actions** (Infrastructure Layer):
- I/O operations
- Side effects
- Non-deterministic
- Require integration testing

**Orchestration** (Application Layer):
- Coordinates calculations and actions
- Manages workflows
- Handles errors

### 3. Information Hiding

- **Implementation details stay private**
- **Only essential operations are exposed**
- **Changes to internals don't affect consumers**

### 4. Clear Boundaries

- **No cross-layer imports** (except downward dependencies)
- **Domain layer imports nothing** from other layers
- **Infrastructure layer doesn't import from Application**
- **Adapters depend on Application, not Domain directly**

## 📏 Dependency Rules

```
Adapters → Application → Domain
                ↓
         Infrastructure
```

- **Domain**: No external dependencies (pure)
- **Application**: Depends on Domain and Infrastructure interfaces
- **Infrastructure**: Depends on Domain types only
- **Adapters**: Depends on Application

## 🔍 Module Discovery Process

When identifying new modules:

1. **Identify the core concept** (noun in the domain)
2. **List all operations** related to that concept
3. **Separate calculations from actions**
4. **Group related operations** into cohesive modules
5. **Design minimal public interface**
6. **Hide complexity** behind simple methods
7. **Document invariants**

## 📝 Next Steps

1. **Implement Playlist domain entity** with pure calculation functions
2. **Create PlaylistService** in application layer
3. **Build PlaylistRepository** in infrastructure layer
4. **Add API controllers** in adapters layer
5. **Write comprehensive tests** at each layer

## 🔗 Related Documentation

- [Invariants Documentation](./invariants.md)
- [ADR-0001: Module Boundaries](../decisions/ADR-0001-module-boundaries.md)
- [Contributing Guide](../../CONTRIBUTING.md)
- [Copilot Usage Guide](../../COPILOT_GUIDE.md)

---

**Note**: This is a living document. Update as architecture evolves and new patterns emerge.
