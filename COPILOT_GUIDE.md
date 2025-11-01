# GitHub Copilot Usage Guide for Musicky

This guide helps you leverage GitHub Copilot effectively while maintaining Musicky's design principles: deep modules, clear invariants, and separation of actions from calculations.

## 🎯 Core Principles for Copilot Prompts

### 1. Test-First Development

Always prompt Copilot to generate tests before implementation:

**❌ Poor Prompt:**
```typescript
// Generate a function to calculate total playlist duration
```

**✅ Good Prompt:**
```typescript
// TEST: Given a playlist with tracks [120s, 180s, 90s], when calculating total duration, then return 390s
// TEST: Given an empty playlist, when calculating total duration, then return 0
// Generate unit tests for calculatePlaylistDuration function
```

### 2. Distinguish Pure Functions from Actions

Use clear comments to indicate whether code should be a pure calculation or an action with side effects:

**For Pure Calculations (Domain Layer):**
```typescript
// PURE CALCULATION: Extract phase tags from comment string
// Input: comment string (e.g., "Great track #peak #feature")
// Output: array of phase tags (e.g., ["peak", "feature"])
// No side effects, same input always produces same output
function extractPhases(comment: string): string[] {
```

**For Actions (Infrastructure Layer):**
```typescript
// ACTION: Save playlist to database
// Side effects: Database write operation
// Returns: Promise resolving when save completes
async function savePlaylistToDb(playlist: Playlist): Promise<void> {
```

### 3. Specify Layer in Comments

Help Copilot understand which architectural layer you're working in:

```typescript
// DOMAIN LAYER: Pure business logic for track filtering
// CALCULATION: Filter tracks by minimum duration threshold
function filterTracksByDuration(tracks: Track[], minDuration: number): Track[] {
```

```typescript
// INFRASTRUCTURE LAYER: File system operations
// ACTION: Read MP3 metadata from file
async function readMp3Metadata(filePath: string): Promise<Metadata> {
```

## 📝 Effective Prompt Patterns

### Pattern 1: Test Generation

**Prompt Template:**
```typescript
// GENERATE UNIT TESTS for [function_name]
// Test cases:
// 1. [Happy path description]
// 2. [Edge case 1]
// 3. [Edge case 2]
// 4. [Error condition]
// Use Jest/Vitest syntax
```

**Example:**
```typescript
// GENERATE UNIT TESTS for calculatePlaylistDuration
// Test cases:
// 1. Normal playlist with multiple tracks returns correct sum
// 2. Empty playlist returns 0
// 3. Single track playlist returns track duration
// 4. Playlist with zero-duration tracks handles correctly
```

### Pattern 2: Pure Function Refactoring

**Prompt Template:**
```typescript
// REFACTOR: Extract pure calculation from this action-heavy code
// Current code has side effects mixed with business logic
// Extract PURE FUNCTIONS for: [list what to extract]
// Keep ACTIONS separate for: [list side effects]

[existing code to refactor]
```

**Example:**
```typescript
// REFACTOR: Extract pure calculation from this action-heavy code
// Current code has side effects mixed with business logic
// Extract PURE FUNCTIONS for: duration calculation, track validation
// Keep ACTIONS separate for: database updates, file I/O

async function processPlaylist(playlistId: string) {
  const playlist = await db.getPlaylist(playlistId); // ACTION
  const totalDuration = playlist.tracks.reduce((sum, t) => sum + t.duration, 0); // CALCULATION
  await db.updateDuration(playlistId, totalDuration); // ACTION
}
```

### Pattern 3: Deep Module Interface Design

**Prompt Template:**
```typescript
// DESIGN MODULE INTERFACE: [ModuleName]
// Goals:
// - Hide complexity behind simple interface
// - Minimize exposed methods (deep module principle)
// - Clear, intuitive method names
// - Comprehensive documentation
// 
// Internal complexity to hide: [list complex operations]
// Public interface should expose: [list essential operations]
```

**Example:**
```typescript
// DESIGN MODULE INTERFACE: PlaylistManager
// Goals:
// - Hide complexity behind simple interface
// - Minimize exposed methods (deep module principle)
// - Clear, intuitive method names
// - Comprehensive documentation
// 
// Internal complexity to hide: caching, database queries, validation, duration calculations
// Public interface should expose: createPlaylist, addTrack, removeTrack, getPlaylist, searchPlaylists
```

### Pattern 4: Invariant Documentation

**Prompt Template:**
```typescript
// DOCUMENT INVARIANTS for [ModuleName/ClassName]
// Conditions that must always be true:
// 1. [Invariant 1]
// 2. [Invariant 2]
// 3. [Invariant 3]
// Add as JSDoc comment block
```

**Example:**
```typescript
// DOCUMENT INVARIANTS for Playlist class
// Conditions that must always be true:
// 1. All track IDs must be unique within the playlist
// 2. Total duration equals sum of individual track durations
// 3. Playlist name must be non-empty string
// 4. createdAt <= updatedAt
// Add as JSDoc comment block
```

### Pattern 5: Integration Test Generation

**Prompt Template:**
```typescript
// GENERATE INTEGRATION TEST for [feature name]
// Test interaction between: [list modules/components]
// Scenario: [describe user workflow or system interaction]
// Setup: [describe test setup/fixtures]
// Assertions: [what to verify]
```

**Example:**
```typescript
// GENERATE INTEGRATION TEST for playlist persistence
// Test interaction between: PlaylistService, Database, Cache
// Scenario: User creates playlist, adds tracks, saves, retrieves from different session
// Setup: Clean database, mock track data
// Assertions: Playlist persisted correctly, tracks in order, cache invalidated
```

## 🏗️ Maintaining Deep Modules

### When Creating New Modules

**Prompt Copilot with:**
```typescript
// CREATE MODULE: [ModuleName]
// Design principles:
// - DEEP MODULE: Rich functionality, minimal interface
// - INFORMATION HIDING: Encapsulate all implementation details
// - SMALL INTERFACE: Maximum 5 public methods
// 
// Functionality needed: [comprehensive list]
// Public methods: [minimal essential list]
// Private implementation: [complex operations to hide]
```

### When Extending Existing Modules

**Prompt Copilot with:**
```typescript
// EXTEND MODULE: [ModuleName]
// Maintain principles:
// - Keep interface small (avoid adding public methods if possible)
// - Hide new complexity behind existing methods
// - Consider if this should be a separate module
// 
// New functionality: [description]
// Preferred: Enhance existing method [method_name]
// Alternative: Add new method only if necessary
```

## ⚖️ Refactoring Prompts

### Separating Actions from Calculations

```typescript
// REFACTOR TO SEPARATE ACTIONS AND CALCULATIONS
// Current mixed code: [paste code with mixed concerns]
// 
// Step 1: Identify all CALCULATIONS (pure functions)
// Step 2: Identify all ACTIONS (side effects)
// Step 3: Extract calculations to pure functions in domain layer
// Step 4: Keep actions in infrastructure layer
// Step 5: Coordinate in application layer
```

### Reducing Complexity

```typescript
// REFACTOR FOR COMPLEXITY REDUCTION
// Current function: [function_name]
// Issues:
// - Too many responsibilities
// - Complex nested logic
// - Hard to test
// 
// Apply:
// - Single Responsibility Principle
// - Extract helper functions
// - Simplify conditionals
// - Add early returns
```

### Improving Module Depth

```typescript
// REFACTOR TO DEEPEN MODULE
// Current module: [ModuleName]
// Problem: Shallow module (simple implementation, complex interface)
// Goal: Deep module (rich implementation, simple interface)
// 
// Current interface: [list public methods]
// Proposed interface: [reduced list]
// Hidden complexity: [what to encapsulate]
```

## 🧪 BDD Scenario Prompts

### Generating Gherkin Features

```typescript
// GENERATE BDD FEATURE: [feature name]
// Format: Gherkin syntax
// Include:
// - Feature description
// - User story (As a... I want... So that...)
// - 3-5 scenarios covering:
//   - Happy path
//   - Edge cases
//   - Error conditions
// Use Given-When-Then format
```

**Example:**
```gherkin
// GENERATE BDD FEATURE: Playlist Shuffle
// Format: Gherkin syntax
// Include:
// - Feature description
// - User story (As a music lover, I want to shuffle my playlist, So that I can enjoy varied playback)
// - Scenarios: Normal shuffle, empty playlist, single-track playlist
// Use Given-When-Then format
```

## 📊 Complexity Metrics Prompts

```typescript
// ANALYZE COMPLEXITY for [function/module name]
// Report:
// - Cyclomatic complexity
// - Lines of code
// - Number of dependencies
// - Public interface size
// Suggest refactoring if complexity is high
```

## 🎭 Prompt Examples by Task

### Creating a New Feature

```typescript
// NEW FEATURE: Add track to playlist
// 
// 1. TESTS FIRST:
//    - Unit test: pure calculation for validating track addition
//    - Integration test: end-to-end playlist update with database
// 
// 2. PURE CALCULATION (domain/playlist.ts):
//    - Function: canAddTrackToPlaylist(playlist, track) -> boolean
//    - Validates: track not already in playlist, track object valid
//    - No side effects
// 
// 3. ACTION (infrastructure/playlist-repository.ts):
//    - Function: persistPlaylistUpdate(playlist) -> Promise<void>
//    - Database update operation
// 
// 4. ORCHESTRATION (application/playlist-service.ts):
//    - Function: addTrackToPlaylist(playlistId, trackId)
//    - Coordinates validation (calculation) and persistence (action)
// 
// Follow 4-layer architecture: domain → application → adapters → infrastructure
```

### Code Review Assistant

```typescript
// CODE REVIEW PROMPT for [PR/file name]
// Check for:
// 1. Actions vs Calculations separation
// 2. Deep module principles (interface size vs functionality)
// 3. Invariants documented and maintained
// 4. Layer boundaries respected
// 5. Test coverage for new code
// 6. Complexity hotspots
// Provide specific suggestions for improvements
```

## 🚫 Anti-Patterns to Avoid

### Don't Mix Concerns in Prompts

**❌ Bad:**
```typescript
// Create a function that gets playlist from database and calculates duration
```

**✅ Good:**
```typescript
// CALCULATION: Pure function to calculate playlist duration from track array
// ACTION: Separate function to fetch playlist from database
// ORCHESTRATION: Service method that fetches then calculates
```

### Don't Skip Test Generation

**❌ Bad:**
```typescript
// Implement playlist shuffle feature
```

**✅ Good:**
```typescript
// Step 1: Generate unit tests for shufflePlaylist calculation
// Step 2: Implement pure shufflePlaylist function
// Step 3: Generate integration test for full shuffle workflow
```

### Don't Ignore Layer Boundaries

**❌ Bad:**
```typescript
// Add database code to this domain function
```

**✅ Good:**
```typescript
// Keep this domain function pure (no database)
// Create separate infrastructure function for database access
// Coordinate in application layer
```

## 📚 Resources

- [CONTRIBUTING.md](CONTRIBUTING.md) - Full design principles
- [docs/design/architecture.md](docs/design/architecture.md) - Architecture details
- [docs/design/invariants.md](docs/design/invariants.md) - System invariants

## 💡 Tips for Success

1. **Be Explicit**: Copilot works best with clear, detailed comments
2. **Context Matters**: Include relevant context in comments (layer, pure vs action, test type)
3. **Iterate**: Start with test prompts, then implementation prompts
4. **Review Generated Code**: Ensure Copilot's suggestions maintain principles
5. **Leverage Examples**: Show Copilot examples of desired patterns in comments

Remember: Copilot is a tool to accelerate development while maintaining high design standards. Always review generated code for adherence to our core principles! 🎵
