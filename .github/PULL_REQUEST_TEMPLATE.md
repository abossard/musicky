# Pull Request

## Problem / Behavior (Given-When-Then)

### User Story / Issue
<!-- Link to related issue: Fixes #123 -->

### Behavior Description
<!-- Use Given-When-Then format for clarity -->

**Given** (Context/Preconditions):
- 

**When** (Action/Event):
- 

**Then** (Expected Outcome):
- 

## Design Notes

### Complexity Reduction
<!-- How does this change reduce or manage complexity? -->
- **Deep Modules**: Does this hide complexity behind a simple interface?
  - 
- **Information Hiding**: What implementation details are encapsulated?
  - 
- **Cognitive Load**: Is this easier to understand than before?
  - 

### Architectural Layer Changes
<!-- Which layer(s) does this PR modify? -->
- [ ] Domain Layer (pure calculations, entities)
- [ ] Application Layer (use cases, orchestration)
- [ ] Infrastructure Layer (database, file I/O, network)
- [ ] Adapters Layer (UI components, API handlers)

## Actions vs Calculations Separation

### Calculations (Pure Functions)
<!-- List pure functions added/modified - no side effects -->
- 

### Actions (Side Effects)
<!-- List functions with I/O or side effects -->
- 

### Orchestration
<!-- How are calculations and actions coordinated? -->
- 

## Invariants Touched

### Global Invariants
<!-- Any global system invariants affected? Reference docs/design/invariants.md -->
- [ ] No global invariants affected
- [ ] Global invariants affected (specify):
  - 

### Module Invariants
<!-- List module-specific invariants added, modified, or maintained -->

**New Invariants**:
- 

**Modified Invariants**:
- 

**Verified Invariants**:
- 

## Test Coverage Summary

### Unit Tests
<!-- Tests for pure calculations/domain logic -->
- **Files**: 
- **Coverage**: %
- **Key scenarios tested**:
  - 

### Integration Tests
<!-- Tests for interactions between modules/layers -->
- **Files**: 
- **Scenarios tested**:
  - 

### E2E Tests
<!-- Tests for complete user workflows -->
- **Files**: 
- **User flows tested**:
  - 

### BDD Scenarios
<!-- Gherkin feature files if applicable -->
- **Files**: 
- **Features covered**:
  - 

### Test Execution
<!-- Paste test results or link to CI run -->
```
# Test command output
npm run test
```

## Deferred Complexity / Technical Debt

<!-- Document any intentional shortcuts or future work -->

### Known Limitations
- 

### Future Improvements
- 

### Refactoring Opportunities
- 

## Deployment Notes

<!-- Any special considerations for deployment? -->
- [ ] No special deployment steps required
- [ ] Database migration needed (describe):
- [ ] Configuration changes required (describe):
- [ ] Environment variables added/modified:

## Security Considerations

<!-- Any security implications? -->
- [ ] No security impact
- [ ] Security review needed (describe):
- [ ] Adds new authentication/authorization:
- [ ] Handles sensitive data:

## Breaking Changes

<!-- Does this PR introduce breaking changes? -->
- [ ] No breaking changes
- [ ] Breaking changes (describe impact and migration path):

## Screenshots / Demos

<!-- For UI changes, include before/after screenshots or GIFs -->

## Checklist

### Design Quality
- [ ] **Deep modules**: Change hides complexity behind simple interface
- [ ] **Information hiding**: Implementation details properly encapsulated
- [ ] **Layer separation**: Domain, application, adapters, infrastructure properly separated
- [ ] **Single responsibility**: Each function/module has one clear purpose

### Code Quality
- [ ] **Actions isolated**: Side effects isolated from pure calculations
- [ ] **Invariants maintained**: Changes preserve or document module invariants
- [ ] **Naming**: Clear, descriptive names for functions, variables, types
- [ ] **Comments**: Complex logic explained (why, not what)

### Testing
- [ ] **Test coverage**: New features covered by tests (unit + integration)
- [ ] **Test types**: Unit tests for calculations, integration tests for actions
- [ ] **BDD scenarios**: For user-facing features, Given-When-Then scenarios provided
- [ ] **Tests pass**: All tests passing locally and in CI
- [ ] **Edge cases**: Boundary conditions and error cases tested

### Documentation
- [ ] **API documentation**: Public interfaces documented with JSDoc
- [ ] **Invariants updated**: If data structures changed, invariants updated
- [ ] **Architecture docs**: For structural changes, architecture.md updated
- [ ] **README updated**: If user-facing changes, README reflects them
- [ ] **ADR created**: For significant architectural decisions, ADR added

### Process
- [ ] **Commit messages**: Follow conventional commit format (feat:, fix:, etc.)
- [ ] **Branch naming**: Descriptive branch name
- [ ] **Code reviewed**: Self-review completed
- [ ] **Linting passes**: `npm run lint` succeeds
- [ ] **Build succeeds**: `npm run build` succeeds

---

## Reviewer Guidance

When reviewing this PR, please verify:

1. **Architecture Alignment**
   - [ ] Layer boundaries respected
   - [ ] Dependencies flow in correct direction
   - [ ] No circular dependencies introduced

2. **Design Principles**
   - [ ] Deep modules: Simple interface, rich functionality
   - [ ] Actions vs calculations properly separated
   - [ ] Invariants clearly documented and maintained

3. **Test Quality**
   - [ ] Tests cover happy path and edge cases
   - [ ] Tests are readable and maintainable
   - [ ] No excessive mocking (prefer integration tests)

4. **Code Quality**
   - [ ] Code is self-documenting
   - [ ] Complex logic has explanatory comments
   - [ ] No obvious performance issues
   - [ ] Error handling is appropriate

5. **Complexity Assessment**
   - [ ] Does this PR reduce or increase system complexity?
   - [ ] Are there simpler ways to achieve the same goal?
   - [ ] Is technical debt clearly documented?

---

## Additional Context

<!-- Any other information reviewers should know? -->
