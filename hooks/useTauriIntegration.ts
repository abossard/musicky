import { useEffect } from 'react';

/**
 * Listens for Tauri tray menu actions and dispatches them
 * to the audio player via custom DOM events.
 */
export function useTauriTrayActions() {
  useEffect(() => {
    // Only run in Tauri environment
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return;
    }

    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlistenFn = await listen<string>('tray-action', (event) => {
          window.dispatchEvent(new CustomEvent('musicky:tray-action', { detail: event.payload }));
        });
        unlisten = unlistenFn;
      } catch {
        // Not in Tauri context
      }
    })();

    return () => {
      unlisten?.();
    };
  }, []);
}
