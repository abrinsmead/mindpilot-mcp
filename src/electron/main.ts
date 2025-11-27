/**
 * Electron Main Process Entry Point
 *
 * This Electron app can be launched in two ways:
 * 1. Directly by user - Shows UI, no MCP
 * 2. By AI assistant (MCP host) - Shows UI AND handles MCP protocol on stdio
 *
 * NO HTTP SERVER NEEDED - Everything is handled via IPC!
 */

import { app, Menu, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMainWindow, getMainWindow, ensureWindowVisible } from './window.js';
import { createMenu } from './menu.js';
import { initializeIPCHandlers, cleanupIPCHandlers } from './ipc/handlers.js';
import { EmbeddedMCPServer } from './mcp/embeddedServer.js';
import { IPC_CHANNELS } from './ipc/channels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if running in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Check if launched by MCP host (stdin is piped, not a TTY)
const isMCPMode = !process.stdin.isTTY;

// Global reference to MCP server
let mcpServer: EmbeddedMCPServer | null = null;

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
  const { dataPath, disableAnalytics } = parseArgs();

  // Create embedded MCP server (shares HistoryService with IPC handlers)
  mcpServer = new EmbeddedMCPServer(dataPath);

  // Initialize IPC handlers with the same HistoryService
  initializeIPCHandlers(dataPath, mcpServer.getHistoryService(), { disableAnalytics });

  // Set up diagram update handler - sends to renderer when MCP receives a diagram
  mcpServer.setDiagramUpdateHandler((diagram, title, id) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log(`[Main] Sending diagram update to renderer: ${title} (${id})`);
      mainWindow.webContents.send(IPC_CHANNELS.MCP_DIAGRAM_UPDATE, { diagram, title, id });
    }
  });

  // Set up menu
  const menu = createMenu();
  Menu.setApplicationMenu(menu);

  // Create main window
  const preloadPath = path.join(__dirname, 'preload.js');
  createMainWindow(preloadPath, isDev);

  // Ensure window is visible on screen
  ensureWindowVisible();

  // Start MCP server if launched by MCP host
  if (isMCPMode) {
    console.log('[Main] Detected MCP mode - starting embedded MCP server');
    try {
      await mcpServer.start();
      console.log('[Main] MCP server started successfully');

      // Notify renderer that MCP is active
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.MCP_STATUS, { active: true });
      }
    } catch (error) {
      console.error('[Main] Failed to start MCP server:', error);
    }
  } else {
    console.log('[Main] Standalone mode - no MCP server');
  }
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
