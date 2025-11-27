/**
 * Native Menu Bar for Electron
 */

import { app, Menu, MenuItemConstructorOptions, shell, BrowserWindow } from 'electron';

const isMac = process.platform === 'darwin';

export function createMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Diagram',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            window?.webContents.send('menu:newDiagram');
          },
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as SVG...',
              accelerator: 'CmdOrCtrl+Shift+S',
              click: () => {
                const window = BrowserWindow.getFocusedWindow();
                window?.webContents.send('menu:exportSVG');
              },
            },
            {
              label: 'Export as PNG...',
              accelerator: 'CmdOrCtrl+Shift+P',
              click: () => {
                const window = BrowserWindow.getFocusedWindow();
                window?.webContents.send('menu:exportPNG');
              },
            },
            {
              label: 'Export as PDF...',
              click: () => {
                const window = BrowserWindow.getFocusedWindow();
                window?.webContents.send('menu:exportPDF');
              },
            },
          ],
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const },
        ]),
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            window?.webContents.send('menu:toggleSidebar');
          },
        },
        {
          label: 'Toggle Theme',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            window?.webContents.send('menu:toggleTheme');
          },
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            window?.webContents.send('menu:zoomIn');
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            window?.webContents.send('menu:zoomOut');
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            window?.webContents.send('menu:zoomReset');
          },
        },
        { type: 'separator' },
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' },
        { role: 'togglefullscreen' as const },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/abrinsmead/mindpilot-mcp#readme');
          },
        },
        {
          label: 'Mermaid Documentation',
          click: async () => {
            await shell.openExternal('https://mermaid.js.org/');
          },
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/abrinsmead/mindpilot-mcp/issues');
          },
        },
        { type: 'separator' },
        {
          label: 'About Mindpilot',
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            window?.webContents.send('menu:about');
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
