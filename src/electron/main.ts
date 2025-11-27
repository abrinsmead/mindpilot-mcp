/**
 * Electron Main Process Entry Point
 */

import { app, Menu, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMainWindow, getMainWindow, ensureWindowVisible } from './window.js';
import { createMenu } from './menu.js';
import { initializeIPCHandlers, cleanupIPCHandlers } from './ipc/handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if running in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Parse command line arguments
function parseArgs(): { dataPath?: string; disableAnalytics: boolean } {
  const args = process.argv.slice(2);
  let dataPath: string | undefined;
  let disableAnalytics = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data-path' && args[i + 1]) {
      dataPath = args[i + 1];
      i++;
    }
    if (args[i] === '--disable-analytics') {
      disableAnalytics = true;
    }
  }

  return { dataPath, disableAnalytics };
}

async function initialize(): Promise<void> {
  const { dataPath } = parseArgs();

  // Initialize IPC handlers
  initializeIPCHandlers(dataPath);

  // Set up menu
  const menu = createMenu();
  Menu.setApplicationMenu(menu);

  // Create main window
  const preloadPath = path.join(__dirname, 'preload.js');
  createMainWindow(preloadPath, isDev);

  // Ensure window is visible on screen
  ensureWindowVisible();
}

// App lifecycle handlers
app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  cleanupIPCHandlers();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    const preloadPath = path.join(__dirname, 'preload.js');
    createMainWindow(preloadPath, isDev);
  }
});

// Handle second instance (single instance lock)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Focus the main window if a second instance is launched
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
