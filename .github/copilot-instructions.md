# GitHub Copilot Instructions for Musicky

> **About this file**: These instructions help GitHub Copilot understand the Musicky project structure, conventions, and best practices. They guide Copilot in making appropriate code changes that align with the project's architecture and standards.

## Project Overview

Musicky is a modern, production-ready music library management application for local music collections. It helps users organize, browse, and play local MP3 files with advanced features like phase tagging, metadata editing, and a responsive audio player.

**Key Features:**
- Smart file browsing with security-first folder access
- Full-featured audio player with volume control and progress tracking
- Phase tagging system for organizing tracks (#starter, #buildup, #peak, #release, #feature)
- Metadata editing with pending edit management
- Responsive design for desktop and mobile devices
- Security-first approach with restricted file access and input validation
- High-performance data loading and caching

## Technical Stack

- **Frontend**: React 19, TypeScript, Mantine UI v8
- **Backend**: Fastify server with Telefunc RPC
- **Database**: SQLite with Better-SQLite3
- **Build System**: Vite with Vike framework
- **Audio**: HTML5 Audio API with music-metadata library for metadata extraction
- **Testing**: Playwright (for E2E tests)
- **Linting**: ESLint with TypeScript support

## Architecture Principles

Musicky follows a **stratified design** with clear separation of concerns:

1. **UI Components Layer** - React components in `/components`
2. **Business Logic Layer** - Pure functions in `/lib`
3. **Data Service Layer** - Centralized data management in `/lib/music-data-service.ts`
4. **API Layer** - Telefunc endpoints in `/api`
5. **Database/File System** - SQLite database and file operations

### Key Design Principles
- **Deep Modules**: Complex functionality hidden behind simple interfaces
- **Information Hiding**: Implementation details abstracted from consumers
- **Single Responsibility**: Each module has one clear purpose
- **Stratified Design**: Clear layers with minimal coupling
- **Separation of Calculations and Actions**: Pure functions vs side effects

## Directory Structure

```
musicky/
├── api/                    # Telefunc API endpoints (*.telefunc.ts)
├── assets/                 # Static assets (images, SVG)
├── components/             # React UI components
│   ├── AudioPlayer/        # Audio player components
│   ├── FileBrowser.tsx     # File browser component
│   ├── MP3Library.tsx      # Main library interface
│   └── Settings.tsx        # Settings management
├── contexts/               # React contexts for global state
├── database/               # SQLite database and schemas
│   ├── sqlite/             # Database configuration, queries, schemas
│   └── schema/             # Data type definitions
├── hooks/                  # Custom React hooks
├── layouts/                # Page layouts (LayoutDefault.tsx, theme.ts)
├── lib/                    # Business logic and utilities
│   ├── music-data-service.ts  # Centralized data management
│   ├── mp3-business-logic.ts  # Pure business functions
│   ├── error-manager.ts       # Error handling system
│   └── audio-*.ts            # Audio-related utilities
├── pages/                  # Vike page components (+Page.tsx, +config.ts)
├── scripts/                # Build and utility scripts
├── server/                 # Server configuration and middleware
├── screenshots/            # Application screenshots
└── tests/                  # Test files (*.test.ts)
```

## Build, Test, and Lint Commands

### Development
```bash
npm install              # Install dependencies
npm run dev              # Start development server (http://localhost:3000)
npm run sqlite:migrate   # Initialize/migrate SQLite database
```

### Production
```bash
npm run build            # Build for production
npm run preview          # Preview production build
```

### Quality Checks
```bash
npm run lint             # Run ESLint (Note: currently non-functional - requires jiti package)
npx tsc -p tsconfig.json # TypeScript type checking (also runs in CI)
```

**Important**: The linting command currently fails due to missing `jiti` dependency (required for ESLint 9.x to load TypeScript config files on Node.js < 22.10.0). Use TypeScript type checking as the primary quality gate. To fix: `npm install --save-dev jiti`

### Testing
- Tests are located in `/tests` directory
- Currently using Playwright for E2E testing
- Run tests with: `npx playwright test` (if configured)

### CI/CD Pipeline
- **Continuous Integration**: GitHub Actions workflow in `.github/workflows/ci.yml`
- **Automated Checks**: TypeScript type checking (`npx tsc -p tsconfig.json`)
- **Trigger**: Runs on pushes and PRs to `main` and `master` branches (as configured in ci.yml)
- **Pre-commit Requirements**: Ensure TypeScript compilation passes before committing

## Coding Conventions

### TypeScript
- **Always use TypeScript** - No JavaScript files unless absolutely necessary
- Use strict type checking - avoid `any` types
- Define interfaces for component props and data structures
- Use type imports: `import type { Props } from './types'`

### React Components
- Use functional components with hooks
- Place components in appropriate directories:
  - `/components` for reusable UI components
  - `/pages/[page-name]` for page-specific components
- Use Mantine UI components for consistent styling
- Follow React best practices (avoid prop drilling, use context for global state)

### File Naming
- React components: PascalCase (e.g., `AudioPlayer.tsx`)
- Telefunc APIs: kebab-case with `.telefunc.ts` suffix (e.g., `file-browser.telefunc.ts`)
- Utilities/libraries: kebab-case (e.g., `music-data-service.ts`)
- Test files: match source file name with `.test.ts` suffix

### Code Style
- Use consistent indentation (2 spaces)
- Follow ESLint rules defined in `eslint.config.ts`
- Write descriptive variable and function names
- Add comments for complex logic, but prefer self-documenting code
- Keep functions small and focused (single responsibility)

### State Management
- Use React Context for global state (see `/contexts`)
- Use custom hooks for reusable stateful logic (see `/hooks`)
- Centralize data management in `music-data-service.ts`
- Prefer immutable state updates

### API Design
- Use Telefunc for type-safe client-server communication
- Export functions from `.telefunc.ts` files
- Validate inputs on the server side
- Return meaningful error messages

## Security Considerations

**Critical Security Rules:**
- **Path Restriction**: All file access MUST be restricted to the user's home directory
- **Input Validation**: Validate and sanitize all user inputs
- **XSS Prevention**: Properly escape user content in UI
- **No Secrets**: Never commit secrets, API keys, or credentials
- **Dependency Security**: Keep dependencies updated and scan for vulnerabilities

## Common Tasks and Patterns

### Adding a New Page
1. Create folder in `/pages/[page-name]`
2. Add `+Page.tsx` component
3. Optional: Add `+config.ts` for page configuration
4. Optional: Add `+data.ts` for server-side data loading
5. Update navigation in `/layouts/LayoutDefault.tsx` if needed

### Adding a New Component
1. Create component file in `/components` or `/components/[feature]`
2. Use TypeScript with proper prop interfaces
3. Use Mantine UI components for styling
4. Export the component for use in pages

### Adding Business Logic
1. Add pure functions to `/lib` directory
2. Separate calculations (pure) from actions (side effects)
3. Use TypeScript for type safety
4. Add tests for complex logic

### Working with Audio Files
- Use `music-metadata` library for reading MP3 metadata
- Use `node-id3` for writing ID3 tags
- Handle audio playback through HTML5 Audio API
- Manage audio state through contexts and hooks

### Database Operations
- Database schema is in `/database/sqlite/schema`
- Queries are in `/database/sqlite/queries`
- Use Better-SQLite3 for synchronous database operations
- Run migrations with `npm run sqlite:migrate`

## Testing Guidelines

- Write tests for business logic functions
- Test component behavior, not implementation details
- Use Playwright for E2E tests of critical user flows
- **Before making changes**: Run `npx tsc -p tsconfig.json` to establish a baseline of existing errors
- **Before committing**: Run `npx tsc -p tsconfig.json` again and ensure no new errors were introduced
- **Note**: There may be pre-existing TypeScript errors in the codebase. Focus only on ensuring your changes don't introduce additional errors.

## Performance Optimization

- **Smart Caching**: Use intelligent data caching with selective refresh
- **Lazy Loading**: Load components and data on demand
- **Bundle Optimization**: Leverage Vite's code splitting and tree shaking
- **Database Indexing**: Ensure queries are optimized for large music libraries

## Documentation

When making significant changes:
- Update relevant documentation files (e.g., `AUDIO_PLAYER_DOCS.md`, `FILE_BROWSER_DOCS.md`)
- Keep `PROJECT_OVERVIEW.md` up to date
- Add comments for complex algorithms or business logic
- Update README.md if adding new features or changing setup instructions

## Git and PR Guidelines

- Write clear, descriptive commit messages
- Keep commits focused and atomic
- Test changes locally before pushing
- Ensure CI passes (TypeScript type checking)
- Reference issue numbers in commit messages when applicable

## Common Pitfalls to Avoid

1. **Don't bypass security restrictions** - Always validate file paths and restrict to home directory
2. **Don't use inline styles** - Use Mantine UI's styling system
3. **Don't create deep component hierarchies** - Keep components flat and composable
4. **Don't mix concerns** - Keep UI, business logic, and data access separate
5. **Don't forget error handling** - Use the error management system in `/lib/error-manager.ts`
6. **Don't add unnecessary dependencies** - Use existing libraries when possible
7. **Don't fix unrelated issues** - Focus only on the task at hand; ignore pre-existing errors
8. **Don't remove or modify working code** - Make surgical, minimal changes only

## Useful Resources

- [Vike Documentation](https://vike.dev) - Full-stack React framework
- [Mantine UI v8 Docs](https://mantine.dev) - Component library
- [Telefunc Documentation](https://telefunc.com) - RPC framework
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3) - SQLite library
- [music-metadata](https://github.com/Borewit/music-metadata) - Audio metadata library

## When in Doubt

1. Check existing code for patterns and conventions
2. Refer to the documentation files in the repository root
3. Follow the stratified design principles
4. Keep changes minimal and focused
5. Test thoroughly before submitting

---

**Remember**: Musicky is designed with security, performance, and user experience in mind. Maintain these principles in all changes you make.
