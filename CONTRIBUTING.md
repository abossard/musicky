# Contributing to Musicky

Thank you for your interest in contributing to Musicky! This guide outlines our design principles, development practices, and contribution workflow.

## 🎯 Core Design Principles

### 1. Deep Modules (Philosophy of Software Design)
- **Hide complexity** behind simple, intuitive interfaces
- **Minimize cognitive load** for module consumers
- **Keep interfaces small** while functionality remains rich
- Example: A `MusicLibrary` module should expose `loadTracks()` and `searchTracks()` rather than exposing internal caching, database queries, and file system operations

### 2. Information Hiding
- **Encapsulate implementation details** within modules
- **Expose only what's necessary** through public interfaces
- **Avoid leaking abstractions** to higher layers
- Changes to internal implementation should not affect consumers

### 3. Stratified Design (4-Layer Architecture)
Our architecture follows a clear layering strategy:

```
┌─────────────────────────────────────┐
│  Adapters (Controllers/UI)          │  ← User-facing interfaces
├─────────────────────────────────────┤
│  Application (Use Cases)             │  ← Orchestration logic
├─────────────────────────────────────┤
│  Domain (Core Business Logic)       │  ← Pure calculations, immutable data
├─────────────────────────────────────┤
│  Infrastructure (IO Actions)         │  ← Database, Network, File System
└─────────────────────────────────────┘
```

**Domain Layer**: Pure functions, immutable data structures, no side effects
**Application Layer**: Orchestrates use cases, coordinates between domain and infrastructure
**Adapters Layer**: Controllers, UI components, API handlers
**Infrastructure Layer**: Database access, file I/O, network calls, external services

### 4. Actions vs Calculations (Grokking Simplicity)

**Calculations** (Pure Functions):
- Same input → Same output
- No side effects
- Easy to test
- Can be cached
- Belong in the **domain layer**

```typescript
// ✅ CALCULATION - Pure function
function calculatePlaylistDuration(tracks: Track[]): number {
  return tracks.reduce((sum, track) => sum + track.duration, 0);
}
```

**Actions** (Side Effects):
- Interact with the outside world
- May have different results each call
- Harder to test (require mocks/stubs)
- Belong in the **infrastructure layer**

```typescript
// ⚠️ ACTION - Has side effects
async function savePlaylist(playlist: Playlist): Promise<void> {
  await database.insert('playlists', playlist);
}
```

**Guideline**: Always separate calculations from actions. Keep calculations pure and move actions to the edges of your system.

## 📐 Invariants Convention

### What Are Invariants?
Invariants are conditions that must **always** be true for a module or data structure to be in a valid state.

### Per-Module Invariant Headers
Each module should document its invariants at the top:

```typescript
/**
 * Playlist Module
 * 
 * INVARIANTS:
 * - All track IDs in a playlist must be unique
 * - Total duration equals sum of individual track durations
 * - Playlist name must be non-empty
 * - Created timestamp must be before or equal to updated timestamp
 */
```

### Global Invariants
See `docs/design/invariants.md` for system-wide invariants that apply across modules.

## 🔄 Commit Message Prefixes

Use conventional commit prefixes to categorize your changes:

- `feat:` - New feature for the user
- `fix:` - Bug fix for the user
- `refactor:` - Code restructuring without changing behavior
- `test:` - Adding or updating tests
- `docs:` - Documentation only changes
- `chore:` - Maintenance tasks (deps, config, build)
- `perf:` - Performance improvements
- `style:` - Code style changes (formatting, whitespace)

Examples:
```
feat: add playlist shuffle functionality
test: add unit tests for track duration calculation
refactor: extract file scanning logic into separate module
docs: update architecture diagram with new caching layer
chore: upgrade typescript to 5.3
```

## ✅ Pull Request Review Checklist

Before submitting a PR, ensure:

### Design Quality
- [ ] **Deep modules**: Does the change hide complexity behind a simple interface?
- [ ] **Information hiding**: Are implementation details properly encapsulated?
- [ ] **Layer separation**: Are domain, application, adapters, and infrastructure properly separated?

### Code Quality
- [ ] **Actions isolated**: Are side effects isolated from pure calculations?
- [ ] **Invariants maintained**: Do changes preserve or document module invariants?
- [ ] **Single responsibility**: Does each function/module have one clear purpose?

### Testing
- [ ] **Test coverage**: Are new features covered by tests?
- [ ] **Test types**: Are unit tests for calculations and integration tests for actions included?
- [ ] **BDD scenarios**: For user-facing features, are Given-When-Then scenarios provided?

### Documentation
- [ ] **API documentation**: Are public interfaces documented?
- [ ] **Invariants updated**: If data structures changed, are invariants updated?
- [ ] **Architecture docs**: For structural changes, is architecture.md updated?

### Complexity Management
- [ ] **Complexity reduction**: Does this change reduce or increase system complexity?
- [ ] **Deferred debt**: Is any technical debt clearly documented?

## 🧪 Test Strategy

### Test Tiers
1. **Unit Tests** (`tests/unit/`): Test pure calculations in isolation
2. **Integration Tests** (`tests/integration/`): Test interactions between modules
3. **E2E Tests** (`tests/e2e/`): Test complete user workflows
4. **BDD Scenarios** (`features/`): Gherkin-style acceptance criteria

### Test-First Development
- Write failing tests before implementation
- Tests serve as specifications
- Red → Green → Refactor cycle

### Coverage Goals
- Pure functions (calculations): 100% coverage
- Actions with side effects: Integration tests covering happy path and error scenarios
- User workflows: At least one E2E test per user story

## 🚀 Getting Started

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/musicky.git
   cd musicky
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Create a Feature Branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

4. **Make Your Changes**
   - Follow the design principles above
   - Write tests first (TDD)
   - Keep commits focused and atomic

5. **Run Tests and Linting**
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

6. **Submit a Pull Request**
   - Use the PR template
   - Reference related issues
   - Ensure CI passes

## 📚 Additional Resources

- [Architecture Documentation](docs/design/architecture.md)
- [Invariants Documentation](docs/design/invariants.md)
- [Copilot Usage Guide](COPILOT_GUIDE.md)
- [ADR: Module Boundaries](docs/decisions/ADR-0001-module-boundaries.md)

## 🤝 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help create a welcoming community

## 💡 Need Help?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Refer to existing code for examples

Thank you for contributing to Musicky! 🎵
