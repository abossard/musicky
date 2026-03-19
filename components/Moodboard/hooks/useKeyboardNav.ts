import { useState, useEffect, useCallback } from 'react';

export type FocusZone = 'library' | 'canvas' | 'phase-bar' | 'playlist' | 'detail';

const ZONE_CYCLE: FocusZone[] = ['library', 'canvas', 'playlist'];

export interface UseKeyboardNavOptions {
  onPlayPause: () => void;
  onGeneratePlaylist: () => void;
  onToggleLibrary: () => void;
  onTogglePlaylist: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onEscape: () => void;
  onSaveCanvas: () => void;
  libraryOpen: boolean;
  playlistOpen: boolean;
}

export interface UseKeyboardNavReturn {
  activeZone: FocusZone;
  setActiveZone: (zone: FocusZone) => void;
  showShortcutHelp: boolean;
  setShowShortcutHelp: (v: boolean) => void;
}

function isInputTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function useKeyboardNav(options: UseKeyboardNavOptions): UseKeyboardNavReturn {
  const {
    onPlayPause,
    onGeneratePlaylist,
    onToggleLibrary,
    onTogglePlaylist,
    onOpenSettings,
    onOpenSearch,
    onEscape,
    onSaveCanvas,
    libraryOpen,
    playlistOpen,
  } = options;

  const [activeZone, setActiveZone] = useState<FocusZone>('canvas');
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const typing = isInputTarget(e);

    // ? — show shortcut help (only when not typing)
    if (e.key === '?' && !typing && !mod) {
      e.preventDefault();
      setShowShortcutHelp(v => !v);
      return;
    }

    // Escape — close modals/drawers/help, or deselect
    if (e.key === 'Escape') {
      if (showShortcutHelp) {
        setShowShortcutHelp(false);
        return;
      }
      onEscape();
      return;
    }

    // Space — play/pause (not when typing)
    if (e.key === ' ' && !typing && !mod) {
      e.preventDefault();
      onPlayPause();
      return;
    }

    // Modifier shortcuts
    if (mod) {
      switch (e.key.toLowerCase()) {
        case 'g':
          e.preventDefault();
          onGeneratePlaylist();
          return;
        case 'f':
          e.preventDefault();
          onOpenSearch();
          return;
        case 's':
          e.preventDefault();
          onSaveCanvas();
          return;
        case ',':
          e.preventDefault();
          onOpenSettings();
          return;
        case 'l':
          e.preventDefault();
          onToggleLibrary();
          return;
        case 'p':
          e.preventDefault();
          onTogglePlaylist();
          return;
      }
    }

    // / — focus search (not when typing)
    if (e.key === '/' && !typing && !mod) {
      e.preventDefault();
      onOpenSearch();
      return;
    }

    // Tab — cycle focus zones
    if (e.key === 'Tab' && !typing && !mod) {
      e.preventDefault();
      setActiveZone(prev => {
        const available = ZONE_CYCLE.filter(z => {
          if (z === 'library' && !libraryOpen) return false;
          if (z === 'playlist' && !playlistOpen) return false;
          return true;
        });
        if (available.length === 0) return prev;
        const idx = available.indexOf(prev);
        const next = e.shiftKey
          ? (idx <= 0 ? available.length - 1 : idx - 1)
          : (idx + 1) % available.length;
        return available[next];
      });
    }
  }, [
    onPlayPause, onGeneratePlaylist, onToggleLibrary, onTogglePlaylist,
    onOpenSettings, onOpenSearch, onEscape, onSaveCanvas,
    libraryOpen, playlistOpen, showShortcutHelp,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { activeZone, setActiveZone, showShortcutHelp, setShowShortcutHelp };
}
