/**
 * Electron Preload Script
 * Exposes a safe, typed API to the renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc/channels.js';

// Type definitions for MCP events
export interface MCPDiagramUpdate {
  diagram: string;
  title: string;
  id: string;
}

export interface MCPStatus {
  active: boolean;
}

// Type definitions for the exposed API
export interface ElectronAPI {
  // Diagram operations
  renderDiagram: (diagram: string, background?: string, workingDir?: string, title?: string) => Promise<any>;
  validateDiagram: (diagram: string) => Promise<any>;

  // History operations
  getHistory: (collection?: string | null) => Promise<any[]>;
  saveDiagram: (diagram: string, title: string, collection: string | null) => Promise<any>;
  updateDiagram: (id: string, updates: any) => Promise<any>;
  deleteDiagram: (id: string) => Promise<any>;
  moveDiagram: (id: string, collection: string | null) => Promise<any>;

  // Collection operations
  getCollections: () => Promise<string[]>;
  createCollection: (name: string) => Promise<any>;

  // App operations
  getStatus: () => Promise<any>;
  openExternal: (url: string) => Promise<any>;
  showSaveDialog: (options: any) => Promise<any>;
  showOpenDialog: (options: any) => Promise<any>;
  getVersion: () => Promise<string>;

  // Window operations
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // Theme operations
  getTheme: () => Promise<'light' | 'dark'>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<any>;

  // MCP event listeners
  onMCPDiagramUpdate: (callback: (data: MCPDiagramUpdate) => void) => () => void;
  onMCPStatus: (callback: (data: MCPStatus) => void) => () => void;

  // Window event listeners
  onWindowFocus: (callback: () => void) => () => void;

  // Platform info
  platform: NodeJS.Platform;
  isElectron: true;
}

// Expose the API to the renderer
const electronAPI: ElectronAPI = {
  // Diagram operations
  renderDiagram: (diagram, background, workingDir, title) =>
    ipcRenderer.invoke(IPC_CHANNELS.DIAGRAM_RENDER, diagram, background, workingDir, title),
  validateDiagram: (diagram) =>
    ipcRenderer.invoke(IPC_CHANNELS.DIAGRAM_VALIDATE, diagram),

  // History operations
  getHistory: (collection) =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_LIST, collection),
  saveDiagram: (diagram, title, collection) =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_SAVE, diagram, title, collection),
  updateDiagram: (id, updates) =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_UPDATE, id, updates),
  deleteDiagram: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_DELETE, id),
  moveDiagram: (id, collection) =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_MOVE, id, collection),

  // Collection operations
  getCollections: () =>
    ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_LIST),
  createCollection: (name) =>
    ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_CREATE, name),

  // App operations
  getStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_GET_STATUS),
  openExternal: (url) =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_EXTERNAL, url),
  showSaveDialog: (options) =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_SHOW_SAVE_DIALOG, options),
  showOpenDialog: (options) =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_SHOW_OPEN_DIALOG, options),
  getVersion: () =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),

  // Window operations
  minimizeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),

  // Theme operations
  getTheme: () =>
    ipcRenderer.invoke(IPC_CHANNELS.THEME_GET),
  setTheme: (theme) =>
    ipcRenderer.invoke(IPC_CHANNELS.THEME_SET, theme),

  // MCP event listeners - return unsubscribe function
  onMCPDiagramUpdate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: MCPDiagramUpdate) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.MCP_DIAGRAM_UPDATE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MCP_DIAGRAM_UPDATE, handler);
  },
  onMCPStatus: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: MCPStatus) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.MCP_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MCP_STATUS, handler);
  },

  // Window event listeners - return unsubscribe function
  onWindowFocus: (callback) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.WINDOW_FOCUS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_FOCUS, handler);
  },

  // Platform info
  platform: process.platform,
  isElectron: true,
};

contextBridge.exposeInMainWorld('electron', electronAPI);

// Type augmentation for window object
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
