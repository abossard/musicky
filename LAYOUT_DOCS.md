# Musicky Layout Documentation

## New Layout Features

The application now uses an enhanced Mantine-based layout with the following features:

### 🌙 Dark Theme
- The application uses a dark theme by default
- Configured through Mantine's `defaultColorScheme="dark"`

### 📅 Top Title Bar with Date/Time
- Displays the current date and time in the header
- Updates automatically every second
- Format: "Weekday, Month Day, Year at HH:MM:SS"

### 📱 Responsive Left Sidebar
- Navigation menu is always visible on desktop (screens larger than 'sm' breakpoint)
- Automatically collapses on mobile devices (screens smaller than 'sm' breakpoint)
- Width: 280px when expanded
- Hamburger menu button appears on mobile to toggle navigation
- **Auto-close on mobile**: Menu automatically closes when a navigation link is clicked
- Uses Mantine's `useDisclosure` hook for state management

### 📊 Bottom Status Bar
- Shows application status with colored badges
- Displays version information
- Can be updated from any component using the status context

### 📜 Scrollable Content Area
- Main content area has its own scrollbar
- Height calculated to fit between header and footer
- Uses Mantine's ScrollArea component

## Usage

### Status Context

The layout includes a status context that allows any component to update the status bar:

```tsx
import { useStatus } from '../contexts/StatusContext';

function MyComponent() {
  const { setStatus } = useStatus();
  
  // Update status with custom color
  setStatus("Processing", "blue");
  setStatus("Error", "red");
  setStatus("Success", "green");
  
  return <div>My Component</div>;
}
```

### Available Status Colors
- `green` - Ready/Success states
- `blue` - Processing/Loading states  
- `orange` - Warning states
- `red` - Error states

## Components Structure

```
layouts/
├── LayoutDefault.tsx    # Main layout component
├── theme.ts            # Mantine theme configuration
contexts/
├── StatusContext.tsx   # Status management context
hooks/
├── useStatus.ts       # Hook for status context
```

## Layout Sections

1. **Header (60px height)**
   - Logo and app title on the left
   - Hamburger menu button (visible only on mobile)
   - Current date/time on the right

2. **Navbar (280px width when expanded)**
   - Always visible on desktop (screens ≥ 'sm' breakpoint)
   - Collapsible on mobile (screens < 'sm' breakpoint)
   - Structured navigation links

3. **Main Content Area**
   - Scrollable content
   - Responsive height calculation

4. **Footer (40px height)**
   - Status indicator with badge
   - Application version
   - System status message

## Responsive Behavior

- **Desktop (≥768px)**: Navbar is always visible, no hamburger menu
- **Mobile (<768px)**: Navbar is collapsed by default, hamburger menu appears
- **Breakpoint**: Uses Mantine's 'sm' breakpoint (768px)
- **Touch-friendly**: Burger menu is optimized for mobile interaction

## Testing Responsive Behavior

To test the responsive layout:
1. Resize your browser window to less than 768px wide
2. The hamburger menu should appear in the top-left
3. Click the hamburger menu to toggle the navigation
4. Resize back to desktop size to see the persistent navigation
