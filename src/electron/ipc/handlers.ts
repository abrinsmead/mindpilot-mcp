/**
 * IPC Handlers for Electron main process
 * Handles all communication from renderer process
 */

import { ipcMain, dialog, shell, BrowserWindow, nativeTheme, app } from 'electron';
import { IPC_CHANNELS } from './channels.js';
import { HistoryService } from '../../shared/historyService.js';
import { renderMermaid } from '../../shared/renderer.js';
import { validateMermaidSyntax } from '../../shared/validator.js';
import { detectGitRepo } from '../../shared/gitRepoDetector.js';
import { DiagramHistoryEntry } from '../../shared/types.js';

let historyService: HistoryService;

export function initializeIPCHandlers(dataPath?: string): void {
  historyService = new HistoryService(dataPath);

  // Diagram operations
  ipcMain.handle(IPC_CHANNELS.DIAGRAM_RENDER, async (_event, diagram: string, background?: string, workingDir?: string, title?: string) => {
    const result = await renderMermaid(diagram, background);

    // Save to history if successful
    if (result.type === 'success' && workingDir && title) {
      try {
        const collection = await detectGitRepo(workingDir);
        const savedEntry = await historyService.saveDiagram(diagram, title, collection);
        return { ...result, diagramId: savedEntry.id };
      } catch (error) {
        console.error('Failed to save diagram to history:', error);
      }
    }

    return result;
  });

  ipcMain.handle(IPC_CHANNELS.DIAGRAM_VALIDATE, async (_event, diagram: string) => {
    return await validateMermaidSyntax(diagram);
  });

  // History operations
  ipcMain.handle(IPC_CHANNELS.HISTORY_LIST, async (_event, collection?: string | null) => {
    return await historyService.getDiagrams(collection);
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_SAVE, async (_event, diagram: string, title: string, collection: string | null) => {
    return await historyService.saveDiagram(diagram, title, collection);
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_UPDATE, async (_event, id: string, updates: Partial<Pick<DiagramHistoryEntry, 'title' | 'collection' | 'diagram'>>) => {
    await historyService.updateDiagram(id, updates);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_DELETE, async (_event, id: string) => {
    await historyService.deleteDiagram(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_MOVE, async (_event, id: string, collection: string | null) => {
    await historyService.moveDiagram(id, collection);
    return { success: true };
  });

  // Collection operations
  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_LIST, async () => {
    return await historyService.getCollections();
  });

  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_CREATE, async (_event, name: string) => {
    await historyService.createCollection(name);
    return { success: true };
  });

  // App operations
  ipcMain.handle(IPC_CHANNELS.APP_GET_STATUS, async () => {
    return {
      serverRunning: true,
      isElectron: true,
      uptime: Math.floor(process.uptime()),
    };
  });

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.APP_SHOW_SAVE_DIALOG, async (_event, options: Electron.SaveDialogOptions) => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return { canceled: true };
    return await dialog.showSaveDialog(window, options);
  });

  ipcMain.handle(IPC_CHANNELS.APP_SHOW_OPEN_DIALOG, async (_event, options: Electron.OpenDialogOptions) => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return { canceled: true, filePaths: [] };
    return await dialog.showOpenDialog(window, options);
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  // Window operations
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    const window = BrowserWindow.getFocusedWindow();
    window?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    const window = BrowserWindow.getFocusedWindow();
    window?.close();
  });

  // Theme operations
  ipcMain.handle(IPC_CHANNELS.THEME_GET, () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  ipcMain.handle(IPC_CHANNELS.THEME_SET, (_event, theme: 'light' | 'dark' | 'system') => {
    nativeTheme.themeSource = theme;
    return { success: true };
  });
}

export function cleanupIPCHandlers(): void {
  Object.values(IPC_CHANNELS).forEach(channel => {
    ipcMain.removeHandler(channel);
  });
}
