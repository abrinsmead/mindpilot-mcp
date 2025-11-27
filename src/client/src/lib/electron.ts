/**
 * Electron API wrapper for renderer process
 * Provides a unified API that works in both Electron and browser environments
 */

import type { ElectronAPI } from '../../../electron/preload.js';

// Check if we're running in Electron
export const isElectron = typeof window !== 'undefined' && window.electron?.isElectron === true;

// Get the Electron API (if available)
const electronAPI = isElectron ? window.electron : null;

// Platform detection
export const platform = electronAPI?.platform ??
  (typeof navigator !== 'undefined' ?
    (navigator.platform.includes('Mac') ? 'darwin' :
     navigator.platform.includes('Win') ? 'win32' : 'linux') :
    'linux');

export const isMac = platform === 'darwin';
export const isWindows = platform === 'win32';
export const isLinux = platform === 'linux';

/**
 * API wrapper that falls back to HTTP when not in Electron
 */
export const api = {
  // Diagram operations
  async renderDiagram(diagram: string, background?: string, workingDir?: string, title?: string) {
    if (electronAPI) {
      return electronAPI.renderDiagram(diagram, background, workingDir, title);
    }
    const response = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagram, background, workingDir, title }),
    });
    return response.json();
  },

  async validateDiagram(diagram: string) {
    if (electronAPI) {
      return electronAPI.validateDiagram(diagram);
    }
    const response = await fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagram }),
    });
    return response.json();
  },

  // History operations
  async getHistory(collection?: string | null) {
    if (electronAPI) {
      return electronAPI.getHistory(collection);
    }
    const url = collection !== undefined
      ? `/api/history?collection=${encodeURIComponent(collection ?? '')}`
      : '/api/history';
    const response = await fetch(url);
    return response.json();
  },

  async saveDiagram(diagram: string, title: string, collection: string | null) {
    if (electronAPI) {
      return electronAPI.saveDiagram(diagram, title, collection);
    }
    const response = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagram, title, collection }),
    });
    return response.json();
  },

  async updateDiagram(id: string, updates: { title?: string; collection?: string | null; diagram?: string }) {
    if (electronAPI) {
      return electronAPI.updateDiagram(id, updates);
    }
    const response = await fetch(`/api/history/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return response.json();
  },

  async deleteDiagram(id: string) {
    if (electronAPI) {
      return electronAPI.deleteDiagram(id);
    }
    const response = await fetch(`/api/history/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  async moveDiagram(id: string, collection: string | null) {
    if (electronAPI) {
      return electronAPI.moveDiagram(id, collection);
    }
    const response = await fetch(`/api/history/${id}/collection`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection }),
    });
    return response.json();
  },

  // Collection operations
  async getCollections() {
    if (electronAPI) {
      return electronAPI.getCollections();
    }
    const response = await fetch('/api/collections');
    return response.json();
  },

  async createCollection(name: string) {
    if (electronAPI) {
      return electronAPI.createCollection(name);
    }
    const response = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return response.json();
  },

  // App operations
  async getStatus() {
    if (electronAPI) {
      return electronAPI.getStatus();
    }
    const response = await fetch('/api/status');
    return response.json();
  },

  async openExternal(url: string) {
    if (electronAPI) {
      return electronAPI.openExternal(url);
    }
    window.open(url, '_blank');
    return { success: true };
  },

  async showSaveDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) {
    if (electronAPI) {
      return electronAPI.showSaveDialog(options);
    }
    // In browser mode, we can't show native dialogs
    // Return a mock result that triggers download behavior
    return { canceled: false, filePath: options.defaultPath || 'download' };
  },

  async showOpenDialog(options: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    properties?: string[];
  }) {
    if (electronAPI) {
      return electronAPI.showOpenDialog(options);
    }
    // In browser mode, we can't show native dialogs
    return { canceled: true, filePaths: [] };
  },

  async getVersion() {
    if (electronAPI) {
      return electronAPI.getVersion();
    }
    // Return version from environment or package.json
    return '0.5.0';
  },

  // Window operations (no-op in browser)
  async minimizeWindow() {
    if (electronAPI) {
      return electronAPI.minimizeWindow();
    }
  },

  async maximizeWindow() {
    if (electronAPI) {
      return electronAPI.maximizeWindow();
    }
  },

  async closeWindow() {
    if (electronAPI) {
      return electronAPI.closeWindow();
    }
    window.close();
  },

  // Theme operations
  async getTheme(): Promise<'light' | 'dark'> {
    if (electronAPI) {
      return electronAPI.getTheme();
    }
    // In browser, use media query
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  async setTheme(theme: 'light' | 'dark' | 'system') {
    if (electronAPI) {
      return electronAPI.setTheme(theme);
    }
    // In browser, theme is handled by React context
    return { success: true };
  },

  // MCP event listeners (Electron only)
  onMCPDiagramUpdate(callback: (data: { diagram: string; title: string; id: string }) => void): () => void {
    if (electronAPI?.onMCPDiagramUpdate) {
      return electronAPI.onMCPDiagramUpdate(callback);
    }
    // In browser mode, no-op (SSE handles this)
    return () => {};
  },

  onMCPStatus(callback: (data: { active: boolean }) => void): () => void {
    if (electronAPI?.onMCPStatus) {
      return electronAPI.onMCPStatus(callback);
    }
    // In browser mode, no-op
    return () => {};
  },

  // Window event listeners (Electron only)
  onWindowFocus(callback: () => void): () => void {
    if (electronAPI?.onWindowFocus) {
      return electronAPI.onWindowFocus(callback);
    }
    // In browser mode, use native focus event
    window.addEventListener('focus', callback);
    return () => window.removeEventListener('focus', callback);
  },
};

// Re-export types
export type { ElectronAPI };
