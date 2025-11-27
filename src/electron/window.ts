/**
 * Window Management for Electron
 */

import { BrowserWindow, screen, nativeTheme } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for light and dark mode
const COLORS = {
  light: {
    background: '#ffffff',
  },
  dark: {
    background: '#1a1a2e',
  },
};

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1200,
  height: 800,
  isMaximized: false,
};

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(preloadPath: string, isDev: boolean, showOnReady: boolean = true): BrowserWindow {
  // Get saved window state or use defaults
  const windowState = getWindowState();

  // Get initial theme
  const isDarkMode = nativeTheme.shouldUseDarkColors;
  const backgroundColor = isDarkMode ? COLORS.dark.background : COLORS.light.background;

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    title: 'Mindpilot',
    backgroundColor,
    show: false, // Don't show until ready
    // macOS-specific: use native titlebar that respects system theme
    titleBarStyle: process.platform === 'darwin' ? 'default' : undefined,
    // Windows-specific: use dark title bar when in dark mode
    ...(process.platform === 'win32' && {
      titleBarOverlay: isDarkMode ? {
        color: COLORS.dark.background,
        symbolColor: '#ffffff',
      } : {
        color: COLORS.light.background,
        symbolColor: '#000000',
      },
    }),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload script imports
    },
  });

  // Listen for theme changes and update window
  nativeTheme.on('updated', () => {
    if (!mainWindow) return;

    const newIsDarkMode = nativeTheme.shouldUseDarkColors;
    const newBackgroundColor = newIsDarkMode ? COLORS.dark.background : COLORS.light.background;

    mainWindow.setBackgroundColor(newBackgroundColor);

    // Update Windows titlebar overlay
    if (process.platform === 'win32') {
      mainWindow.setTitleBarOverlay({
        color: newBackgroundColor,
        symbolColor: newIsDarkMode ? '#ffffff' : '#000000',
      });
    }
  });

  // Restore maximized state
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Show window when ready (unless starting hidden for MCP mode)
  if (showOnReady) {
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });
  }

  // Save window state on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load the app
  if (isDev) {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // DevTools can be opened manually with Cmd+Option+I (macOS) or F12 (Windows/Linux)
  } else {
    // Production: load built files
    const indexPath = path.join(__dirname, '../public/index.html');
    mainWindow.loadFile(indexPath);
  }

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function getWindowState(): WindowState {
  // In a real app, you'd load this from electron-store or similar
  // For now, return defaults
  return DEFAULT_WINDOW_STATE;
}

function saveWindowState(window: BrowserWindow): void {
  // In a real app, you'd save this to electron-store or similar
  const bounds = window.getBounds();
  const state: WindowState = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    isMaximized: window.isMaximized(),
  };
  // TODO: Save state to persistent storage
  console.log('Window state to save:', state);
}

export function ensureWindowVisible(): void {
  if (!mainWindow) return;

  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const { workArea } = display;

  // Check if window is at least partially visible
  const isVisible =
    bounds.x < workArea.x + workArea.width &&
    bounds.x + bounds.width > workArea.x &&
    bounds.y < workArea.y + workArea.height &&
    bounds.y + bounds.height > workArea.y;

  if (!isVisible) {
    // Center window on primary display
    mainWindow.center();
  }
}
