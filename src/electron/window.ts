/**
 * Window Management for Electron
 */

import { BrowserWindow, screen, nativeTheme, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { IPC_CHANNELS } from './ipc/channels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to store window state
const getWindowStatePath = () => path.join(app.getPath('userData'), 'window-state.json');

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

  // Notify renderer when window is focused (for refreshing history)
  mainWindow.on('focus', () => {
    mainWindow?.webContents.send(IPC_CHANNELS.WINDOW_FOCUS);
  });

  // Also notify when window is shown (e.g., restored from minimized)
  mainWindow.on('show', () => {
    mainWindow?.webContents.send(IPC_CHANNELS.WINDOW_FOCUS);
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
  try {
    const statePath = getWindowStatePath();
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf-8');
      const state = JSON.parse(data) as WindowState;
      // Validate the loaded state has required properties
      if (typeof state.width === 'number' && typeof state.height === 'number') {
        return state;
      }
    }
  } catch (error) {
    console.error('Failed to load window state:', error);
  }
  return DEFAULT_WINDOW_STATE;
}

function saveWindowState(window: BrowserWindow): void {
  try {
    const bounds = window.getBounds();
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: window.isMaximized(),
    };
    const statePath = getWindowStatePath();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Failed to save window state:', error);
  }
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
