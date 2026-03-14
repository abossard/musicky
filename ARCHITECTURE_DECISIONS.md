# Musicky — Architectural Design Decisions

## Executive Summary

This document codifies four foundational design principles for the Musicky music management application: **Grokking Simplicity** (Eric Normand), **A Philosophy of Software Design** (John Ousterhout), **Finite State Machines** for state gating, and **Unidirectional Data Flow** for UI updates. Each principle is mapped to precise TypeScript patterns, with concrete rules, code examples drawn from the existing codebase, and guidance for new development. The Musicky codebase already partially implements these patterns — this document formalizes what exists and prescribes what remains to be adopted.

---

## Table of Contents

1. [Principle 1: Grokking Simplicity — Actions, Calculations, and Data](#principle-1-grokking-simplicity)
2. [Principle 2: A Philosophy of Software Design — Deep Modules and Complexity Budget](#principle-2-a-philosophy-of-software-design)
3. [Principle 3: Finite State Machines — State Gating](#principle-3-finite-state-machines)
4. [Principle 4: Unidirectional Data Flow — View Architecture](#principle-4-unidirectional-data-flow)
5. [Performance and Latency Principles](#performance-and-latency-principles)
6. [Decision Matrix: When to Apply Which Principle](#decision-matrix)
7. [Confidence Assessment](#confidence-assessment)
8. [Footnotes](#footnotes)

---

## Principle 1: Grokking Simplicity

**Source:** *Grokking Simplicity* by Eric Normand (Manning, 2021)[^1]

### Core Concept

All code is classified into exactly one of three categories:

| Category | Definition | When/How Often Called Matters? | Side Effects? |
|---|---|---|---|
| **Data** | Inert facts — plain objects, arrays, strings. Immutable by convention. | No | No |
| **Calculations** | Pure functions. Same input → same output. No side effects. | No | No |
| **Actions** | Functions that depend on *when* or *how many times* they're called. Side-effecting. | **Yes** | **Yes** |

### What This Means for Musicky (TypeScript)

#### Rule 1: Classify Every Module

Every `.ts` file and every exported function **must** be identifiable as Data, Calculation, or Action. When the classification is ambiguous, the module is too large and must be split.

**Current codebase alignment:**

| File | Classification | Evidence |
|---|---|---|
| `lib/math-utils.ts` | ✅ **Calculation** | Pure functions: `clamp`, `normalize`, `lerp` — no side effects, no imports from actions[^2] |
| `lib/format-utils.ts` | ✅ **Calculation** | Pure formatting: `formatTime`, `formatDuration`, `formatFileSize`[^3] |
| `lib/validation-utils.ts` | ✅ **Calculation** | Type guards: `isEmpty`, `isNonEmpty`, `isValidNumber`[^4] |
| `lib/mp3-data-utils.ts` | ✅ **Calculation** | Pure data transformations: `extractPhases`, `togglePhase`, `getEffectiveComment`[^5] |
| `lib/audio-state.ts` | ✅ **Calculation** | Pure reducer: `audioReducer` is `(State, Action) → State`[^6] |
| `lib/mp3-library-state.ts` | ✅ **Calculation** | Pure reducer: `mp3LibraryReducer`[^7] |
| `lib/audio-commands.ts` | ⚠️ **Action** (correctly isolated) | `executeCommand` mutates `HTMLAudioElement`[^8] |
| `lib/mp3-library-effects.ts` | ⚠️ **Action** | Calls Telefunc RPCs (`onGetAllMP3Files`, etc.), dispatches state changes[^9] |
| `database/sqlite/queries/*.ts` | ⚠️ **Action** | All perform I/O against SQLite[^10] |
| `components/*.telefunc.ts` | ⚠️ **Action** | Server-side RPC endpoints performing DB reads/writes[^11] |

#### Rule 2: Push Actions to the Edges

```
┌──────────────────────────────────────────────────┐
│                    ACTION SHELL                    │
│  ┌──────────────────────────────────────────────┐ │
│  │             CALCULATION CORE                  │ │
│  │                                               │ │
│  │  extractPhases()  togglePhase()  clamp()      │ │
│  │  formatTime()     audioReducer()              │ │
│  │  mp3LibraryReducer()  getEffectiveComment()   │ │
│  │                                               │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  telefunc handlers  │  useEffect hooks  │  DB I/O  │
│  audio commands     │  event listeners  │  fs ops   │
└──────────────────────────────────────────────────┘
```

**The rule:** Business logic lives in the Calculation Core. Actions are thin wrappers that:
1. Gather data (from DB, user input, DOM, network)
2. Pass it through calculations
3. Write results (to DB, DOM, network)

**Good example already in the codebase:**

```typescript
// lib/mp3-data-utils.ts — CALCULATION (pure)
export const togglePhase = (currentPhases: string[], phase: string, checked: boolean): string[] => {
  return checked 
    ? [...new Set([...currentPhases, phase])]
    : currentPhases.filter(p => p !== phase);
};

// lib/mp3-library-effects.ts — ACTION (thin wrapper calling calculations)
const handlePhaseToggle = useCallback(async (filePath: string, phase: string, checked: boolean) => {
  dispatch({ type: 'SET_FILE_UPDATING', filePath, updating: true });     // action
  const effectiveComment = getEffectiveComment(/*...*/);                  // calculation
  const currentPhases = extractPhases(effectiveComment, state.phases);    // calculation
  const newPhases = togglePhase(currentPhases, phase, checked);          // calculation
  const result = await onUpdateFilePhases(filePath, newPhases);          // action
  // ...
}, [/*...*/]);
```
[^9]

#### Rule 3: Data is Immutable

TypeScript enforcement:

```typescript
// REQUIRED: Use readonly for all Data types
export interface MP3Metadata {
  readonly filePath: string;
  readonly title?: string;
  readonly artist?: string;
  readonly album?: string;
  readonly duration?: number;
  readonly comment?: string;
  readonly genre?: readonly string[];
  readonly track?: { readonly no: number | null; readonly of: number | null };
}

// REQUIRED: Reducers use spread, never mutate
case 'UPDATE_FILE':
  return {
    ...state,
    mp3Files: state.mp3Files.map(file =>          // .map creates new array
      file.filePath === action.file.filePath 
        ? action.file                              // replace, don't mutate
        : file
    )
  };
```

**Already correct in the codebase:** All reducers use spread syntax for immutable updates[^6][^7]. The `SET_FILE_UPDATING` case creates a new `Set` instead of mutating[^7].

#### Rule 4: Stratified Design

Layers call only downward, never upward:

```
Layer 4 (UI):       React Components (pages/, components/)
Layer 3 (Effects):  Custom hooks with side effects (lib/*-effects.ts, hooks/)
Layer 2 (Logic):    Pure calculations (lib/*-utils.ts, lib/*-state.ts)
Layer 1 (Data):     Type definitions and constants (lib/mp3-metadata.ts, interfaces)
Layer 0 (Infra):    Database, file system, network (database/, *.telefunc.ts)
```

**Decision:** No file in Layer 2 (Logic) may import from Layer 3 (Effects) or Layer 0 (Infra). If a calculation needs data from the database, it must receive that data as a parameter.

#### Rule 5: Higher-Order Functions for Cross-Cutting Concerns

Already present in the codebase:

```typescript
// hooks/use-async-state.ts — Higher-order function for error handling
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  onError?: (error: string) => void
) {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      onError?.(errorMsg);
      return null;
    }
  };
}

// Higher-order function for post-operation refresh
export function withRefresh<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  refreshFn?: () => void | Promise<void>
) {
  return async (...args: T): Promise<R> => {
    const result = await fn(...args);
    await refreshFn?.();
    return result;
  };
}
```
[^12]

These are **Calculations** that produce new **Actions** — a classic Grokking Simplicity pattern for managing side effects while keeping the composition logic pure.

---

## Principle 2: A Philosophy of Software Design

**Source:** *A Philosophy of Software Design* by John Ousterhout (2nd edition, 2021)[^13]

### Core Concept

Software complexity has three symptoms: **change amplification** (a simple change requires modifying many places), **cognitive load** (how much a developer must know to work with the code), and **unknown unknowns** (things that aren't obvious). The antidote is **deep modules**: modules that hide significant complexity behind simple interfaces.

### What This Means for Musicky (TypeScript)

#### Rule 1: Deep Modules, Not Shallow Modules

A **deep module** has a simple interface but hides significant implementation complexity. A **shallow module** has an interface nearly as complex as its implementation — it shifts rather than absorbs complexity.

**Good example (deep module) — already in the codebase:**

```typescript
// database/sqlite/db.ts — Deep module
// Interface: one function, no parameters
export function db(): Database { ... }

// Hidden complexity:
// - Singleton management
// - Automatic backup on first connection
// - Environment variable resolution
// - Error handling for missing DATABASE_URL
```
[^10]

**The `db()` function hides 5 concerns behind a zero-argument interface.** Callers never think about connection management, backup policy, or environment configuration.

**Another deep module:**

```typescript
// hooks/use-async-state.ts — Deep module
export function useAsyncState<T>() {
  // Interface: returns { data, loading, error, execute, reset }
  // Hidden complexity:
  // - Loading state management
  // - Error capture and formatting
  // - Automatic loading/error reset on new execution
  // - Type-safe generic data storage
}
```
[^12]

**Shallow module anti-pattern to avoid:**

```typescript
// ❌ BAD: Shallow module — interface is as complex as implementation
function setLoading(dispatch: Dispatch, loading: boolean) {
  dispatch({ type: 'SET_LOADING', loading });
}

// ✅ GOOD: The dispatch call is already simple enough. Don't wrap it.
// Or, if you must abstract, make it deep:
function loadDataWithRetry(dispatch: Dispatch, loader: () => Promise<Data>, retries = 3) {
  // Now the interface hides retry logic, error handling, loading states
}
```

#### Rule 2: Define Errors Out of Existence

Instead of propagating errors for callers to handle, design interfaces where errors cannot occur or are handled internally.

**Good example already in the codebase:**

```typescript
// lib/audio-commands.ts — errors defined out of existence for callers
export async function executeCommand(
  audio: HTMLAudioElement | null, 
  command: AudioCommand
): Promise<string | null> {
  if (!audio) return 'Audio element not available';  // No throw — caller gets null or error string
  try {
    await command.execute(audio);
    return null;                                     // null = success
  } catch (error) {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
```
[^8]

**The caller never needs try/catch.** The return type `string | null` encodes success/failure in the type system.

**Decision for Musicky:** All Telefunc RPC handlers should return result types, not throw:

```typescript
// REQUIRED pattern for telefunc handlers
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

// Already partially implemented:
export async function onApplyPendingEdit(editId: number): Promise<{ success: boolean; error?: string }> {
  // ...
}
```
[^11]

#### Rule 3: Strategic vs. Tactical Programming

**Tactical programming** = "just make it work." Leads to complexity accumulation.
**Strategic programming** = invest 10-20% extra time in good design.

**Decision:** Every PR must satisfy the **10% rule** — spend at least 10% of development time on design improvement, even if it's not directly required by the feature.

**Concrete for Musicky:**
- When adding a new feature that touches state, extract the pure calculation into `lib/` *before* wiring it up in a component
- When adding a new Telefunc handler, design the return type as `Result<T>` from the start
- When a module grows beyond ~200 lines, split it strategically (not just arbitrarily)

#### Rule 4: Comments Describe Things That Are Not Obvious

**Decision for Musicky:**
- **Interface comments** (on exported functions): Describe *what* and *why*, not *how*
- **Implementation comments**: Only where the code does something non-obvious
- **No comments** on obvious code (e.g., `// set loading to true` before `dispatch({ type: 'SET_LOADING', loading: true })`)

```typescript
// ✅ GOOD: Non-obvious comment explaining design decision
// Audio events are mapped to state actions to maintain unidirectional flow.
// The audio element is the source of truth for playback state; we never
// set isPlaying directly — it's derived from the element's events.
const eventMap: Record<string, (e?: Event) => void> = {
  play: () => dispatch({ type: 'PLAY' }),
  pause: () => dispatch({ type: 'PAUSE' }),
  // ...
};
```

#### Rule 5: Information Hiding and Leakage Prevention

**Decision:** Implementation details must not leak across module boundaries.

| Boundary | What Must Not Leak |
|---|---|
| `database/` → `components/` | SQL column names, raw row types, connection details |
| `*.telefunc.ts` → `*.tsx` | Server-side error details, file system paths (for security + design) |
| `lib/*-state.ts` → `components/` | Internal state shape beyond what the component renders |
| `lib/audio-commands.ts` → `components/` | `HTMLAudioElement` API details |

**Already good:** The `dj-sets.ts` query file maps raw SQL rows to typed interfaces (`DJSet`, `DJSetItem`) before returning[^10]. The `mp3-edits.ts` query file maps `file_path` → `filePath` (snake_case → camelCase) at the boundary[^14].

---

## Principle 3: Finite State Machines

### Core Concept

A Finite State Machine (FSM) is a model with:
1. A finite set of **states** (exactly one active at a time)
2. A finite set of **events** (inputs that trigger transitions)
3. A **transition function**: `(currentState, event) → nextState`
4. An **initial state**
5. (Optional) **actions** executed on transitions

The key benefit: **impossible states become unrepresentable.** You cannot be "loading" and "playing" simultaneously if the FSM doesn't allow it.

### What This Means for Musicky (TypeScript)

#### Current State: Implicit State Machines

The codebase already uses reducer patterns that *behave like* state machines but don't *enforce* state machine constraints[^6][^7]. For example, `audioReducer` has an implicit state machine:

```
              LOAD_START         CAN_PLAY           PLAY
  ┌─────────┐ ─────────→ ┌──────────┐ ────────→ ┌──────────┐
  │  idle    │            │ loading  │           │ playing  │
  └─────────┘            └──────────┘           └──────────┘
       ↑                      │                   │      ↑
       │                      │ ERROR              │      │
       │                      ▼                   │ PAUSE│
       │                 ┌──────────┐             ▼      │
       │    RESET        │  error   │         ┌──────────┐
       └─────────────────│          │←────────│  paused  │
                         └──────────┘         └──────────┘
                                                   │
                                                   │ ENDED
                                                   ▼
                                              ┌──────────┐
                                              │  ended   │
                                              └──────────┘
```

**Problem with the current approach:** The reducer accepts *any* action in *any* state. You can dispatch `PLAY` while in the `loading` state, and the reducer will set `isPlaying: true` even though the audio hasn't loaded yet. There's no guard.

#### Decision: Formalize FSMs with Discriminated Union States

**Option A: Use XState (recommended for complex machines)**

XState v5[^15] is the TypeScript-first state machine library with:
- Visual editor and inspector
- Actor model for spawning child machines
- Type-safe events, context, and guards
- Model-based testing

**Option B: TypeScript-native FSMs with discriminated unions (for simpler machines)**

For cases where XState is overkill, use this pattern:

```typescript
// Step 1: Define states as a discriminated union
type AudioPlayerState =
  | { status: 'idle' }
  | { status: 'loading'; src: string }
  | { status: 'ready'; src: string; duration: number }
  | { status: 'playing'; src: string; duration: number; currentTime: number }
  | { status: 'paused'; src: string; duration: number; currentTime: number }
  | { status: 'error'; message: string };

// Step 2: Define events
type AudioPlayerEvent =
  | { type: 'LOAD'; src: string }
  | { type: 'LOADED'; duration: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TIME_UPDATE'; currentTime: number }
  | { type: 'ENDED' }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };

// Step 3: Transition function with exhaustive guards
function audioPlayerTransition(
  state: AudioPlayerState,
  event: AudioPlayerEvent
): AudioPlayerState {
  switch (state.status) {
    case 'idle':
      switch (event.type) {
        case 'LOAD': return { status: 'loading', src: event.src };
        default: return state;  // All other events ignored in idle
      }
    
    case 'loading':
      switch (event.type) {
        case 'LOADED': return { 
          status: 'ready', 
          src: state.src, 
          duration: event.duration 
        };
        case 'ERROR': return { status: 'error', message: event.message };
        default: return state;  // Cannot PLAY while loading
      }
    
    case 'ready':
      switch (event.type) {
        case 'PLAY': return { 
          status: 'playing', 
          src: state.src, 
          duration: state.duration, 
          currentTime: 0 
        };
        case 'RESET': return { status: 'idle' };
        default: return state;
      }
    
    case 'playing':
      switch (event.type) {
        case 'PAUSE': return { 
          status: 'paused', 
          src: state.src, 
          duration: state.duration, 
          currentTime: state.currentTime 
        };
        case 'TIME_UPDATE': return { ...state, currentTime: event.currentTime };
        case 'ENDED': return { status: 'idle' };
        case 'ERROR': return { status: 'error', message: event.message };
        default: return state;
      }
    
    case 'paused':
      switch (event.type) {
        case 'PLAY': return { 
          status: 'playing', 
          src: state.src, 
          duration: state.duration, 
          currentTime: state.currentTime 
        };
        case 'RESET': return { status: 'idle' };
        default: return state;
      }
    
    case 'error':
      switch (event.type) {
        case 'RESET': return { status: 'idle' };
        default: return state;
      }
  }
}
```

**Key differences from the current reducer pattern:**

| Current Pattern (lib/audio-state.ts) | FSM Pattern |
|---|---|
| Flat state: `{ isPlaying, isLoading, error }` — 8 possible boolean combos | Discriminated union: exactly 6 named states |
| Any action accepted in any state | Events only accepted in valid states |
| Caller must check `state.isPlaying && !state.isLoading` | Caller checks `state.status === 'playing'` |
| Possible impossible state: `isPlaying: true, isLoading: true` | Type system prevents impossible states |
| No transition visualization | State chart directly derivable from code |

#### Decision: Which Components Need FSMs

| Component/Feature | Complexity | FSM Required? | Rationale |
|---|---|---|---|
| Audio Player | High — lifecycle with async loading, play/pause/seek, error recovery | **Yes — formalize** | Currently implicit in `audioReducer`[^6]. Impossible states possible. |
| Pending Edits Workflow | High — 16 actions, multi-selection, apply/reject lifecycle | **Yes — formalize** | Most complex state in the codebase[^16]. Selection + editing + async operations. |
| MP3 Library | Medium — CRUD with loading/error | **Optional — keep reducer** | Linear flow (load → display → update). No complex state transitions. |
| DJ Set Selection | Low — simple toggles | **No — keep useState** | No lifecycle, no impossible states possible[^17]. |
| File Browser navigation | Medium — tree navigation with loading | **Optional** | Could benefit from `idle → loading → loaded → error` FSM. |
| Status bar | Low | **No** | Simple string display[^18]. |

#### Guard Pattern for TypeScript

When using the native FSM pattern, TypeScript's type narrowing serves as guards:

```typescript
function handlePlayClick(state: AudioPlayerState, dispatch: Dispatch) {
  // TypeScript narrows the type — you can only access .currentTime if status is 'paused'
  if (state.status === 'paused' || state.status === 'ready') {
    dispatch({ type: 'PLAY' });
  }
  // If state.status is 'loading', this is a no-op — the button should be disabled
}

// In JSX:
<Button 
  disabled={state.status === 'loading' || state.status === 'idle'}
  onClick={() => handlePlayClick(state, dispatch)}
>
  {state.status === 'playing' ? 'Pause' : 'Play'}
</Button>
```

---

## Principle 4: Unidirectional Data Flow

### Core Concept

Data flows in one direction through the application:

```
  ┌──────────────────────────────────────────────────────┐
  │                                                       │
  │    Action ──→ Dispatcher ──→ Store ──→ View          │
  │      ↑                                    │          │
  │      └────────────── User Event ──────────┘          │
  │                                                       │
  └──────────────────────────────────────────────────────┘
```

**Rules:**
1. Views never modify state directly
2. Views dispatch actions (events)
3. A single reducer/store computes the next state
4. Views re-render based on the new state
5. No two-way data binding

### What This Means for Musicky (TypeScript/React)

#### The Musicky Unidirectional Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER                                                         │
│                                                                   │
│  ┌──────────────┐   dispatch(action)   ┌──────────────────────┐ │
│  │  React       │ ──────────────────→  │  useReducer          │ │
│  │  Components  │                      │  (pure reducer fn)   │ │
│  │  (View)      │ ←────────────────── │                      │ │
│  │              │   new state          │  audioReducer        │ │
│  └──────┬───────┘                      │  mp3LibraryReducer   │ │
│         │                              │  pendingEditsReducer │ │
│         │ user events                  └──────────┬───────────┘ │
│         │ (click, input)                          │              │
│         │                                side effects           │
│         │                                (telefunc calls,       │
│         │                                 audio commands)       │
│         ▼                                         │              │
│  ┌──────────────┐                      ┌──────────▼───────────┐ │
│  │  Effect      │ ──── telefunc ────→  │  Server              │ │
│  │  Hooks       │                      │  (*.telefunc.ts)     │ │
│  │  (Actions)   │ ←── result ────────  │                      │ │
│  └──────────────┘                      └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### Already Implemented Correctly

**Pattern 1: useReducer + dispatch (pure unidirectional flow)**

The MP3 Library implements textbook unidirectional flow[^7][^9]:

```
User clicks "toggle phase"
    → dispatch({ type: 'SET_FILE_UPDATING', filePath, updating: true })   [View → Store]
    → extractPhases(...)                                                   [Calculation]
    → togglePhase(...)                                                     [Calculation]
    → await onUpdateFilePhases(filePath, newPhases)                       [Action → Server]
    → await refreshPendingEdits()                                          [Action → Server]
    → dispatch({ type: 'SET_PENDING_EDITS', pendingEdits: edits })        [Server → Store]
    → React re-renders with new state                                      [Store → View]
```

**Pattern 2: Audio events → dispatch → re-render**

```typescript
// lib/audio-effects.ts — Events become actions
const eventMap: Record<string, (e?: Event) => void> = {
  play:        () => dispatch({ type: 'PLAY' }),
  pause:       () => dispatch({ type: 'PAUSE' }),
  timeupdate:  () => dispatch({ type: 'TIME_UPDATE', currentTime: audio.currentTime }),
  ended:       () => dispatch({ type: 'ENDED' }),
  error:       (e) => dispatch({ type: 'ERROR', error: /* ... */ }),
};
```
[^19]

The `HTMLAudioElement` fires native events → the `useAudioEventListeners` hook maps them to typed actions → the `audioReducer` computes new state → React re-renders. **The view never reads from the audio element directly for rendering.**

**Pattern 3: Command Pattern as action abstraction**

```typescript
// lib/audio-commands.ts — Commands are Actions expressed as Data
const command = state.isPlaying ? createPauseCommand() : createPlayCommand();
const error = await executeCommand(audioRef.current, command);
```
[^8]

Commands are data objects (Grokking Simplicity: Data) that describe actions. The `executeCommand` function is the single Action that interprets them. This is the **Command as Data** pattern.

#### What Needs Improvement

**Anti-pattern 1: DJSetContext uses useState, not useReducer**

The `DJSetContext` currently uses 5 separate `useState` calls[^17]:

```typescript
// ❌ Current — multiple independent state variables
const [isDJSetMode, setDJSetMode] = useState(false);
const [activeSet, setActiveSet] = useState<DJSet | null>(null);
const [availableSets, setAvailableSets] = useState<DJSet[]>([]);
const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
const [loading, setLoading] = useState(false);
```

**Problem:** State updates are not atomic. Setting `isDJSetMode` to `false` and then clearing `selectedFiles` are two separate renders. The intermediate state (mode off, files still selected) is visible to child components.

**Fix:** Consolidate into a reducer:

```typescript
// ✅ Proposed — single atomic state
interface DJSetState {
  readonly mode: 'inactive' | 'selecting' | 'adding';
  readonly activeSet: DJSet | null;
  readonly availableSets: readonly DJSet[];
  readonly selectedFiles: readonly string[];
}

type DJSetAction =
  | { type: 'ACTIVATE'; set: DJSet }
  | { type: 'DEACTIVATE' }
  | { type: 'TOGGLE_FILE'; filePath: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_AVAILABLE'; sets: DJSet[] }
  | { type: 'START_ADDING' }
  | { type: 'ADDING_COMPLETE' };
```

**Anti-pattern 2: useAudioQueue uses setState with callbacks**

The `useAudioQueue` hook uses a single `useState<AudioQueueState>` with callback-based updates[^20]:

```typescript
// ❌ Current — setState callbacks are bidirectional in spirit
const playTrack = useCallback((track: MP3Metadata) => {
  setState(prev => {
    if (prev.currentTrack?.filePath === track.filePath) {
      return { ...prev, isPlaying: !prev.isPlaying, wasPlaying: !prev.isPlaying };
    }
    return { ...prev, currentTrack: track, isPlaying: false, wasPlaying: prev.isPlaying };
  });
}, []);
```

**This is an implicit reducer.** The callback `prev => newState` *is* a reducer function, but it's defined inline in each action creator, making it hard to test and reason about.

**Fix:** Extract to explicit reducer:

```typescript
// ✅ Proposed
type QueueAction =
  | { type: 'PLAY_TRACK'; track: MP3Metadata }
  | { type: 'TOGGLE_PLAY_PAUSE' }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'CLEAR' }
  | { type: 'SET_KEEP_PLAYHEAD'; enabled: boolean }
  | { type: 'UPDATE_POSITION'; time: number };

function audioQueueReducer(state: AudioQueueState, action: QueueAction): AudioQueueState {
  switch (action.type) {
    case 'PLAY_TRACK':
      if (state.currentTrack?.filePath === action.track.filePath) {
        return { ...state, isPlaying: !state.isPlaying };
      }
      return { ...state, currentTrack: action.track, isPlaying: false };
    // ...
  }
}
```

#### Strict Rules for Unidirectional Flow

1. **Components must never call `setState` with derived state.** Use `useMemo` or compute in the reducer.
2. **Side effects (telefunc calls, audio commands) happen only in effect hooks or event handlers**, never during render.
3. **Context providers expose `state` and `dispatch`**, not individual setters.
4. **Derived values use `useMemo` or computed properties in hooks**, not stored state.

Already correct in `usePendingEditsState`[^16]:

```typescript
// Computed derived state — not stored, calculated each render
const computed = {
  allSelected: state.selectedEdits.length === state.pendingEdits.length,
  someSelected: state.selectedEdits.length > 0,
  selectedCount: state.selectedEdits.length,
  totalCount: state.pendingEdits.length,
};
```

---

## Performance and Latency Principles

### Server-Side: Audio Streaming

The Fastify server already implements HTTP Range requests for audio streaming[^21]:

```typescript
// fastify-entry.ts — Range request handler
if (range) {
  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  reply.code(206);
  reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
  const stream = createReadStream(filePath, { start, end });
  return reply.send(stream);
}
```

**Performance rules:**
- **Stream, never buffer** — use `createReadStream` with range, not `readFile`
- **SQLite is synchronous** — `better-sqlite3` prepared statements are faster than async alternatives for single-process servers[^10]
- **Transactions for batch operations** — already used in `reorderSetItems`[^10]

### Client-Side: React Performance

| Technique | Where Applied | Status |
|---|---|---|
| `useCallback` for stable references | All effect hooks in `mp3-library-effects.ts` | ✅ Done[^9] |
| `useMemo` for derived computations | Computed state in `usePendingEditsState` | ✅ Done[^16] |
| Immutable state updates in reducers | All 3 reducers | ✅ Done[^6][^7] |
| Avoid unnecessary re-renders via Context splitting | `StatusContext` separate from `DJSetContext` | ✅ Done[^17][^18] |
| `useRef` for values that don't trigger re-render | `savedPositionRef` in `useAudioQueue` | ✅ Done[^20] |
| Debounce high-frequency events | `TIME_UPDATE` dispatches | ⚠️ Not yet — consider throttling |

**Decision:** `TIME_UPDATE` events fire ~4 times per second during playback. Consider throttling to once per 250ms if profiling shows render bottleneck.

### Database Performance

- **Prepared statements** — all queries use `client.prepare(sql)` which compiles SQL once[^10][^14]
- **Indexes** — schema files should include indexes on frequently queried columns
- **WAL mode** — consider enabling SQLite WAL mode for concurrent read performance:

```typescript
export function db(): Database {
  if (!singleton) {
    singleton = sqlite(process.env.DATABASE_URL);
    singleton.pragma('journal_mode = WAL');  // Concurrent readers, single writer
  }
  return singleton;
}
```

---

## Decision Matrix

| Situation | Apply Which Principle | Concrete Action |
|---|---|---|
| Adding a new utility function | Grokking Simplicity | Classify as Calculation. No imports from actions/infra. |
| Adding a new telefunc handler | Grokking Simplicity + Philosophy | Classify as Action. Return `Result<T>`, not throw. Design deep interface. |
| Adding a new component with complex state | FSM + Unidirectional | Design state machine first (draw the states). Use `useReducer`. |
| Adding a new component with simple state | Unidirectional | `useState` is fine if ≤2 state variables with no inter-dependencies. |
| Refactoring a growing module | Philosophy | Check depth. Split into deep modules, not shallow ones. |
| Debugging impossible state | FSM | Convert flat boolean flags to discriminated union states. |
| Performance issue in rendering | Unidirectional + Grokking | Check: is derived state being stored? Is a calculation being done in render? Move to `useMemo` or reducer. |
| Adding cross-cutting concern (loading, error, retry) | Grokking Simplicity | Use higher-order function pattern (`withErrorHandling`, `withRefresh`). |

---

## Confidence Assessment

| Claim | Confidence | Basis |
|---|---|---|
| Codebase already uses reducer pattern extensively | **High** | Verified 3 reducers, 35+ action types across files |
| No existing FSM library (xstate) installed | **High** | Verified `package.json` dependencies |
| Audio state has implicit impossible states | **High** | `isPlaying: true, isLoading: true` is representable in current types |
| DJSetContext would benefit from reducer refactor | **Medium-High** | 5 `useState` calls with inter-dependencies; intermediate states visible |
| XState would be beneficial for complex machines | **Medium** | Depends on team preference; native TS FSMs are also viable |
| SQLite WAL mode would improve performance | **Medium** | Depends on concurrent access patterns; single-user app may not benefit |
| TIME_UPDATE throttling needed | **Low** | Requires profiling; React may batch these efficiently already |

---

## Footnotes

[^1]: Eric Normand, *Grokking Simplicity: Taming Complex Software with Functional Thinking* (Manning, 2021). https://www.manning.com/books/grokking-simplicity

[^2]: `lib/math-utils.ts:1-11` — Pure functions `clamp`, `normalize`, `lerp` with zero imports.

[^3]: `lib/format-utils.ts:1-36` — Pure formatting functions. No side effects, no external state.

[^4]: `lib/validation-utils.ts:1-26` — Type guard functions. Pure calculations returning boolean.

[^5]: `lib/mp3-data-utils.ts:1-97` — Pure data transformations. Imports only from other calculation modules (`format-utils`, `validation-utils`).

[^6]: `lib/audio-state.ts:1-66` — `AudioState` interface, `AudioAction` discriminated union, `audioReducer` pure function.

[^7]: `lib/mp3-library-state.ts:1-98` — `MP3LibraryState`, `MP3LibraryAction` (9 types), `mp3LibraryReducer`, `useMP3LibraryState` hook.

[^8]: `lib/audio-commands.ts:1-49` — Command Pattern. `AudioCommand` interface, factory functions, `executeCommand` executor.

[^9]: `lib/mp3-library-effects.ts:1-191` — Effect hooks `useDataLoader`, `usePhaseActions`, `useEditActions`. All actions dispatch through the reducer, never mutate state directly.

[^10]: `database/sqlite/db.ts:1-37` — Singleton `db()` function. `database/sqlite/queries/dj-sets.ts:1-123` — Typed query functions with prepared statements and transactions.

[^11]: `components/MP3Library.telefunc.ts:1-187` — Telefunc RPC handlers. `onApplyPendingEdit` returns `{ success: boolean; error?: string }`.

[^12]: `hooks/use-async-state.ts:1-64` — `useAsyncState<T>`, `withErrorHandling`, `withRefresh`, `composeAsync` higher-order functions.

[^13]: John Ousterhout, *A Philosophy of Software Design* (Yaknyam Press, 2nd edition, 2021).

[^14]: `database/sqlite/queries/mp3-edits.ts:1-79` — Maps snake_case DB columns to camelCase TypeScript interfaces at the query boundary.

[^15]: XState v5 documentation. https://stately.ai/docs/xstate — TypeScript-first state machine and actor model library.

[^16]: `hooks/use-pending-edits-state.ts` — 16 action types, computed derived state (`allSelected`, `someSelected`, `selectedCount`), action creators with `useCallback`.

[^17]: `contexts/DJSetContext.tsx:1-128` — 5 `useState` calls, context provider with mixed state/actions interface.

[^18]: `contexts/StatusContext.tsx:1-43` — Simple status string + color context. No complex state.

[^19]: `lib/audio-effects.ts:1-132` — `useAudioEventListeners` maps 9 DOM audio events to typed `AudioAction` dispatches. `useExternalSync` manages play/pause sync with external state.

[^20]: `hooks/useAudioQueue.ts:1-129` — `AudioQueueState` with `useState` + callback-based state updates. `savedPositionRef` uses `useRef` for non-rendering state.

[^21]: `fastify-entry.ts:54-94` — HTTP Range request handler for audio streaming with `createReadStream`.
