import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useLocalStorageBoolean } from '@/hooks/useLocalStorage';
import { api, isElectron } from '@/lib/electron';

export interface ThemeContextValue {
  isDarkMode: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isDarkMode, setIsDarkMode] = useLocalStorageBoolean('mindpilot-mcp-dark-mode', false);

  // Apply dark mode class to document element and sync with Electron native theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Sync with Electron's native theme to update title bar
    if (isElectron) {
      api.setTheme(isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const setTheme = (isDark: boolean) => {
    setIsDarkMode(isDark);
  };

  const value: ThemeContextValue = {
    isDarkMode,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}