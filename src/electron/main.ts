/**
 * Electron Main Process Entry Point
 *
 * This is a standalone Electron UI app that can be:
 * 1. Launched directly by user - Shows UI with history
 * 2. Launched by MCP server with --show-diagram=<id> to display a specific diagram
 *
 * The MCP protocol is handled by a separate lightweight Node.js process.
 */

import { app, Menu, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMainWindow, getMainWindow, ensureWindowVisible } from './window.js';
import { createMenu } from './menu.js';
import { initializeIPCHandlers, cleanupIPCHandlers } from './ipc/handlers.js';
import { IPC_CHANNELS } from './ipc/channels.js';
import { HistoryService } from '../shared/historyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if running in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Parse command line arguments
function parseArgs(): { dataPath?: string; disableAnalytics: boolean; showDiagramId?: string } {
  const args = process.argv.slice(2);
  let dataPath: string | undefined;
  let disableAnalytics = false;
  let showDiagramId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data-path' && args[i + 1]) {
      dataPath = args[i + 1];
      i++;
    }
    if (args[i] === '--disable-analytics') {
      disableAnalytics = true;
    }
    if (args[i] === '--show-diagram' && args[i + 1]) {
      showDiagramId = args[i + 1];
      i++;
    }
  }

  return { dataPath, disableAnalytics, showDiagramId };
}

async function initialize(): Promise<void> {
  const { dataPath, disableAnalytics, showDiagramId } = parseArgs();

  console.log('[Main] Starting Electron UI', { dataPath, showDiagramId, isDev });

  // Create history service
  const historyService = new HistoryService(dataPath);

  // Initialize IPC handlers
  initializeIPCHandlers(dataPath, historyService, { disableAnalytics });

  // Set up menu
  const menu = createMenu();
  Menu.setApplicationMenu(menu);

  // Create main window
  const preloadPath = path.join(__dirname, 'preload.js');
  createMainWindow(preloadPath, isDev, true);

  // Ensure window is visible on screen
  ensureWindowVisible();

  // If launched with --show-diagram, send the diagram to the renderer once it's ready
  if (showDiagramId) {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.once('did-finish-load', async () => {
        try {
          // Load the diagram from history
          const diagrams = await historyService.getDiagrams();
          const diagram = diagrams.find(d => d.id === showDiagramId);

          if (diagram) {
            console.log(`[Main] Loading diagram: ${diagram.title} (${showDiagramId})`);
            // Send to renderer to display
            mainWindow.webContents.send(IPC_CHANNELS.MCP_DIAGRAM_UPDATE, {
              diagram: diagram.diagram,
              title: diagram.title,
              id: diagram.id,
            });
          } else {
            console.warn(`[Main] Diagram not found: ${showDiagramId}`);
          }
        } catch (error) {
          console.error('[Main] Failed to load diagram:', error);
        }
      });
    }
  }
}

// App lifecycle handlers
app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  // On macOS, apps typically stay running even when all windows are closed
  // Only clean up handlers if we're actually quitting
  if (process.platform !== 'darwin') {
    cleanupIPCHandlers();
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clean up handlers when app is actually quitting (e.g., Cmd+Q on macOS)
  cleanupIPCHandlers();
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
  // Another instance is already running
  // Pass the diagram ID to the existing instance and quit
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine, _workingDirectory) => {
    // Focus the main window if a second instance is launched
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();

      // Check if the second instance was launched with --show-diagram
      const showDiagramIndex = commandLine.indexOf('--show-diagram');
      if (showDiagramIndex !== -1 && commandLine[showDiagramIndex + 1]) {
        const diagramId = commandLine[showDiagramIndex + 1];
        console.log(`[Main] Second instance requested diagram: ${diagramId}`);

        // Load and display the diagram
        const { dataPath } = parseArgs();
        const historyService = new HistoryService(dataPath);

        historyService.getDiagrams().then(diagrams => {
          const diagram = diagrams.find(d => d.id === diagramId);
          if (diagram) {
            mainWindow.webContents.send(IPC_CHANNELS.MCP_DIAGRAM_UPDATE, {
              diagram: diagram.diagram,
              title: diagram.title,
              id: diagram.id,
            });
          }
        }).catch(error => {
          console.error('[Main] Failed to load diagram:', error);
        });
      }
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
