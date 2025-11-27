import { useState, useEffect } from 'react';
import { api } from '@/lib/electron';

/**
 * Hook to track whether the window is currently active (visible and focused).
 * Hotkeys should only be active when the window is active.
 *
 * @returns boolean indicating if the window is currently active
 */
export function useWindowActive(): boolean {
  // Start with true since document.hasFocus() should return true on mount
  const [isWindowActive, setIsWindowActive] = useState(() => {
    // Check initial focus state
    return typeof document !== 'undefined' ? document.hasFocus() : true;
  });

  useEffect(() => {
    const handleFocus = () => {
      console.log('[useWindowActive] Window focused');
      setIsWindowActive(true);
    };

    const handleBlur = () => {
      console.log('[useWindowActive] Window blurred');
      setIsWindowActive(false);
    };

    // Subscribe to Electron window events
    const unsubscribeFocus = api.onWindowFocus(handleFocus);
    const unsubscribeBlur = api.onWindowBlur(handleBlur);

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, []);

  return isWindowActive;
}
