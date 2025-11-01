# ADR-0001: Four-Layer Module Boundaries and Invariants Strategy

**Status**: Accepted

**Date**: 2025-11-01

**Decision Makers**: Musicky Core Team

## Context

As Musicky grows from a basic music library application to a more sophisticated system, we need clear architectural guidelines to:

1. **Manage complexity** as features are added
2. **Maintain testability** with separation of pure logic from side effects
3. **Enable parallel development** by establishing clear module boundaries
4. **Ensure maintainability** with well-defined responsibilities per layer
5. **Support evolution** without introducing architectural decay

Without explicit architectural decisions, the codebase risks becoming a "big ball of mud" where:
- Business logic is mixed with I/O operations
- Testing requires complex mocking
- Changes ripple unpredictably across the system
- New developers struggle to understand where code belongs

## Decision

We will adopt a **four-layer architecture** with strict separation of concerns:

```
Adapters (UI/API) → Application (Use Cases) → Domain (Pure Logic)
                                    ↓
                            Infrastructure (I/O)
```

### Layer Definitions

#### 1. Domain Layer (`src/domain/`)
**Purpose**: Pure business logic and calculations

**Characteristics**:
- **No side effects**: No I/O, no mutations, no time-dependent operations
- **Pure functions**: Same input always produces same output
- **Immutable data**: All entities and value objects are immutable
- **No external dependencies**: Imports nothing from other layers

**Examples**:
```typescript
// src/domain/playlist/playlist-calculations.ts
export function calculateTotalDuration(tracks: Track[]): number {
  return tracks.reduce((sum, track) => sum + track.duration, 0);
}

export function canAddTrack(playlist: Playlist, track: Track): ValidationResult {
  if (playlist.trackIds.includes(track.id)) {
    return { valid: false, error: 'Track already in playlist' };
  }
  return { valid: true };
}
```

**Testing**: Unit tests only, no mocks needed

#### 2. Application Layer (`src/application/`)
**Purpose**: Orchestrate use cases and workflows

**Characteristics**:
- **Coordinates** domain logic and infrastructure operations
- **Implements** business workflows (use cases)
- **Manages** transactions and error handling
- **Delegates** to domain for calculations, infrastructure for I/O

**Examples**:
```typescript
// src/application/playlist-service/playlist-service.ts
export class PlaylistService {
  constructor(
    private playlistRepo: PlaylistRepository,
    private trackRepo: TrackRepository,
    private cache: CacheService
  ) {}

  async addTrackToPlaylist(
    playlistId: PlaylistId, 
    trackId: TrackId
  ): Promise<void> {
    // 1. Fetch data (infrastructure)
    const playlist = await this.playlistRepo.findById(playlistId);
    const track = await this.trackRepo.findById(trackId);
    
    // 2. Business logic (domain)
    const validationResult = canAddTrack(playlist, track);
    if (!validationResult.valid) {
      throw new ValidationError(validationResult.error);
    }
    
    // 3. Create updated state (domain)
    const updatedPlaylist = addTrack(playlist, track);
    
    // 4. Persist (infrastructure)
    await this.playlistRepo.save(updatedPlaylist);
    await this.cache.invalidate(`playlist:${playlistId}`);
  }
}
```

**Testing**: Integration tests with real or stubbed infrastructure

#### 3. Infrastructure Layer (`src/infrastructure/`)
**Purpose**: Handle all side effects and I/O operations

**Characteristics**:
- **All I/O operations**: Database, file system, network
- **External service integrations**: APIs, caches, message queues
- **Implementation of repository interfaces**
- **Imports domain types** but not application layer

**Examples**:
```typescript
// src/infrastructure/playlist-repository/sqlite-playlist-repository.ts
export class SqlitePlaylistRepository implements PlaylistRepository {
  async findById(id: PlaylistId): Promise<Playlist | null> {
    const row = await this.db.get(
      'SELECT * FROM playlists WHERE id = ?', 
      id
    );
    return row ? this.mapToPlaylist(row) : null;
  }

  async save(playlist: Playlist): Promise<void> {
    await this.db.run(
      'INSERT OR REPLACE INTO playlists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      playlist.id, playlist.name, playlist.createdAt, playlist.updatedAt
    );
  }
}
```

**Testing**: Integration tests with real database or test containers

#### 4. Adapters Layer (`src/adapters/`)
**Purpose**: Interface with external world (users, APIs, CLI)

**Characteristics**:
- **UI components**: React components, pages
- **API handlers**: HTTP endpoints, RPC handlers (Telefunc)
- **CLI commands**: Command-line interfaces
- **Input validation and transformation**
- **Output formatting and presentation**

**Examples**:
```typescript
// src/adapters/api/playlist-handlers.telefunc.ts
export async function addTrackToPlaylist(
  playlistId: string,
  trackId: string
): Promise<ApiResponse> {
  try {
    // Validate input
    if (!playlistId || !trackId) {
      return { success: false, error: 'Invalid parameters' };
    }
    
    // Delegate to application layer
    await playlistService.addTrackToPlaylist(playlistId, trackId);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**Testing**: E2E tests and component tests

### Dependency Rules

**Allowed Dependencies**:
```
Adapters → Application
Application → Domain
Application → Infrastructure (via interfaces)
Infrastructure → Domain (types only)
```

**Forbidden Dependencies**:
```
Domain → Any other layer (must remain pure)
Infrastructure → Application
Infrastructure → Adapters
Application → Adapters
```

### Invariants Strategy

**Global Invariants**: Documented in `docs/design/invariants.md`

**Module-Level Invariants**: Documented in each module's header:
```typescript
/**
 * Module: Playlist
 * 
 * INVARIANTS:
 * - All track IDs must be unique within a playlist
 * - Total duration equals sum of track durations
 * - createdAt <= updatedAt
 * 
 * ASSUMPTIONS:
 * - Track IDs reference existing tracks
 * 
 * GUARANTEES:
 * - Immutable entities
 * - Operations are atomic
 */
```

**Enforcement**:
1. **Type system**: Use TypeScript to encode invariants
2. **Validation**: Check invariants at boundaries
3. **Testing**: Assert invariants in every test
4. **Code review**: Verify invariant preservation

## Consequences

### Positive

1. **Clear separation of concerns**: Each layer has well-defined responsibilities
2. **Improved testability**: Pure domain logic needs no mocks; infrastructure can be tested in isolation
3. **Parallel development**: Teams can work on different layers independently
4. **Easier reasoning**: Understanding what a piece of code does based on its layer
5. **Better performance**: Pure functions can be memoized/cached safely
6. **Maintainability**: Changes are localized; domain logic doesn't change with I/O implementation
7. **Refactoring safety**: Pure functions are safe to refactor with test coverage
8. **Onboarding**: New developers understand system structure quickly

### Negative

1. **Initial overhead**: More files and structure upfront
2. **Learning curve**: Team must understand and follow layer rules
3. **Indirection**: Simple operations may require multiple files/layers
4. **Discipline required**: Easy to accidentally violate boundaries
5. **Boilerplate**: Mapping between layers adds code

### Mitigation Strategies

For **initial overhead** and **boilerplate**:
- Use code generation tools where appropriate
- Create templates for common patterns
- Accept that upfront structure pays off over time

For **learning curve**:
- Comprehensive documentation (this ADR, architecture.md)
- Code reviews enforcing patterns
- Pair programming for knowledge transfer
- Example implementations as reference

For **discipline**:
- Linting rules to detect cross-layer violations
- Automated architecture tests
- Regular architecture reviews

## Alternatives Considered

### 1. Traditional MVC
**Rejected because**: 
- Doesn't separate pure logic from side effects
- Business logic often leaks into controllers
- Difficult to test without mocking
- No guidance on where complex logic belongs

### 2. Hexagonal Architecture (Ports & Adapters)
**Considered but not chosen**:
- More complex than needed for current scale
- Similar goals but more ceremonious
- May adopt in future if complexity warrants

### 3. Feature-Based Organization
**Rejected because**:
- Doesn't enforce separation of concerns within features
- Encourages duplication across features
- Harder to share common logic
- Our four-layer approach can be combined with feature folders if needed

### 4. No Explicit Architecture
**Rejected because**:
- Current codebase already showing signs of mixed concerns
- Leads to technical debt and maintenance burden
- Makes testing increasingly difficult
- Prevents scaling of development team

## Implementation Plan

### Phase 1: Structure (This PR)
- [x] Create directory structure (`src/domain/`, `src/application/`, etc.)
- [x] Document architecture and invariants
- [x] Add contribution guidelines
- [ ] Set up linting rules for layer boundaries

### Phase 2: Domain Layer (Next PR)
- [ ] Implement `Playlist` entity with pure functions
- [ ] Implement `Track` entity with pure functions
- [ ] Implement `Phase` value object
- [ ] Write comprehensive unit tests (100% coverage for calculations)

### Phase 3: Infrastructure Layer
- [ ] Implement `PlaylistRepository`
- [ ] Implement `TrackRepository`
- [ ] Implement `FileSystemService`
- [ ] Write integration tests

### Phase 4: Application Layer
- [ ] Implement `PlaylistService`
- [ ] Implement `MusicLibraryService`
- [ ] Write integration tests

### Phase 5: Migration
- [ ] Gradually refactor existing code to follow architecture
- [ ] Move pure functions from `lib/` to `src/domain/`
- [ ] Extract I/O operations to `src/infrastructure/`
- [ ] Create services in `src/application/`

### Phase 6: Validation
- [ ] Architecture tests to enforce boundaries
- [ ] Code review checklist integration
- [ ] Developer training on new architecture

## Review and Evolution

This ADR should be reviewed:
- **When**: Quarterly or when significant architectural changes are proposed
- **Who**: Core development team and architecture reviewers
- **What**: Evaluate if boundaries are working, if they need adjustment, or if new layers are needed

This ADR can be **superseded** by a future ADR if:
- The architecture proves insufficient for new requirements
- A better pattern emerges that solves the same problems
- The team consensus shifts based on experience

## References

- [*A Philosophy of Software Design*](https://web.stanford.edu/~ouster/cgi-bin/book.php) by John Ousterhout
  - Chapter 4: Modules Should Be Deep
  - Chapter 5: Information Hiding
  - Chapter 11: Design it Twice

- [*Grokking Simplicity*](https://grokkingsimplicity.com/) by Eric Normand
  - Chapter 5: Actions vs Calculations vs Data
  - Chapter 8: Stratified Design
  - Chapter 12: Functional Architecture

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) by Robert C. Martin
  - Dependency Rule
  - Layers of Software

- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) by Alistair Cockburn

## Related Documentation

- [Architecture Documentation](../design/architecture.md)
- [Invariants Documentation](../design/invariants.md)
- [Contributing Guide](../../CONTRIBUTING.md)
- [Copilot Usage Guide](../../COPILOT_GUIDE.md)

---

**Last Updated**: 2025-11-01  
**Next Review**: 2026-02-01 (Quarterly)
