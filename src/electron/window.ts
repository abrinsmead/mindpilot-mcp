/**
 * Window Management for Electron
 */

import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export function createMainWindow(preloadPath: string, isDev: boolean): BrowserWindow {
  // Get saved window state or use defaults
  const windowState = getWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    title: 'Mindpilot',
    backgroundColor: '#1a1a2e',
    show: false, // Don't show until ready
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload script imports
    },
  });

  // Restore maximized state
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

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
    mainWindow.webContents.openDevTools();
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
