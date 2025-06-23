# Musicky Project Overview

A modern, responsive music application built with Mantine v8, React, and TypeScript. Features a file browser for local music libraries and a clean, mobile-friendly interface.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## 🏗️ Architecture

### Frontend Stack
- **React 18** - UI framework
- **Mantine v8** - Component library and styling
- **TypeScript** - Type safety
- **Vike** - Full-stack React framework

### Backend Stack
- **Fastify** - High-performance web server
- **Telefunc** - Type-safe RPC for client-server communication
- **SQLite** - Database (for todos example)

## 📁 Project Structure

```
musicky/
├── components/          # Reusable React components
│   ├── FileBrowser.tsx  # File browser component
│   ├── FileBrowser.telefunc.ts # File browser API
│   ├── Link.tsx         # Navigation link component
│   └── ResponsiveIndicator.tsx
├── layouts/            # Page layouts
│   ├── LayoutDefault.tsx # Main layout with sidebar + status bar
│   └── theme.ts         # Mantine theme configuration
├── pages/              # Application pages
│   ├── index/          # Homepage
│   ├── file-browser/   # File browser demo
│   ├── todo/           # Todo example
│   └── star-wars/      # API example
├── contexts/           # React contexts
│   └── StatusContext.tsx # Global status management
├── hooks/              # Custom React hooks
│   └── useStatus.ts    # Status context hook
├── lib/                # Utility libraries
│   └── file-browser.ts # File system operations
└── server/             # Server configuration
    ├── fastify-entry.ts # Server entry point
    └── vike-handler.ts  # Page rendering
```

## 🎵 Core Features

### 📱 Responsive Layout
- **Desktop**: Always-visible sidebar navigation
- **Mobile**: Collapsible sidebar with hamburger menu
- **Auto-close**: Mobile menu closes after navigation
- **Status Bar**: Real-time clock and global status

### 🗂️ File Browser
- **Local Navigation**: Browse files starting from home directory
- **Music Focus**: Default mp3 filtering with multi-format support
- **Security**: Restricted to user's home directory only
- **Search & Filter**: Real-time search with extension filtering
- **Multiple Selection**: Single or multi-file selection modes
- **Responsive**: Works seamlessly on desktop and mobile
- **Keyboard Friendly**: Navigate files with arrow keys and Enter

### 🎨 UI/UX
- **Modern Design**: Clean, music-focused interface
- **Dark Theme**: Default dark theme with Mantine components
- **Accessibility**: ARIA labels and full keyboard navigation
- **Performance**: Efficient rendering and state management

## 🔧 Key Components

### LayoutDefault
Main application layout with responsive sidebar and status bar.

```tsx
// Automatic responsive behavior
// Mobile: collapsible sidebar
// Desktop: always-visible sidebar
// Status bar with real-time updates
```

### FileBrowser
Full-featured file browser component for music libraries.

```tsx
<FileBrowser
  onFileSelect={handleFileSelect}
  extensions={['mp3', 'flac', 'wav']}
  allowMultipleSelection={true}
  height={600}
/>
```

### StatusContext
Global status management for the application.

```tsx
const { status, setStatus, menuOpened, setMenuOpened } = useStatus();
```

## 🛠️ Development

### Available Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run type-check # Run TypeScript checks
```

### Adding New Pages
1. Create folder in `pages/`
2. Add `+Page.tsx` component
3. Optional: Add `+config.ts` for page configuration
4. Optional: Add `+data.ts` for server-side data loading

### Adding API Endpoints
1. Create `.telefunc.ts` file in `api/` or page directory
2. Export functions for client-server communication
3. Use TypeScript for full type safety

## 📚 Documentation

- [`LAYOUT_DOCS.md`](./LAYOUT_DOCS.md) - Detailed layout implementation
- [`RESPONSIVE_IMPLEMENTATION.md`](./RESPONSIVE_IMPLEMENTATION.md) - Responsive behavior guide
- [`AUTO_CLOSE_IMPLEMENTATION.md`](./AUTO_CLOSE_IMPLEMENTATION.md) - Mobile menu behavior
- [`FILE_BROWSER_DOCS.md`](./FILE_BROWSER_DOCS.md) - File browser library reference

## 🎯 Future Enhancements

### Music Player Features
- Audio playback integration
- Playlist management
- Now playing visualization
- Audio metadata extraction

### File Browser Improvements
- File preview functionality
- Drag and drop support
- Custom icons (when icon package issues are resolved)

### Additional Features
- Music library indexing
- Search across all music files
- Album art display
- Audio waveform visualization
- Favorites and playlists

## 🔒 Security

- **Path Restriction**: File access limited to user's home directory
- **Input Validation**: All user inputs are validated
- **XSS Prevention**: Proper escaping and sanitization
- **CSRF Protection**: Built into Telefunc RPC system

## 📱 Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile**: iOS Safari, Chrome Mobile, Samsung Internet
- **Responsive**: All screen sizes from 320px to 4K displays

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Built with ❤️ for music lovers who want to organize and play their local music collections.
