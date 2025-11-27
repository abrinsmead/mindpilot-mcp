/**
 * IPC Channel definitions for Electron communication
 * These channels define the contract between main and renderer processes
 */

export const IPC_CHANNELS = {
  // Diagram operations
  DIAGRAM_RENDER: 'diagram:render',
  DIAGRAM_VALIDATE: 'diagram:validate',

  // History operations
  HISTORY_LIST: 'history:list',
  HISTORY_SAVE: 'history:save',
  HISTORY_UPDATE: 'history:update',
  HISTORY_DELETE: 'history:delete',
  HISTORY_MOVE: 'history:move',

  // Collection operations
  COLLECTIONS_LIST: 'collections:list',
  COLLECTIONS_CREATE: 'collections:create',

  // App operations
  APP_GET_STATUS: 'app:getStatus',
  APP_OPEN_EXTERNAL: 'app:openExternal',
  APP_SHOW_SAVE_DIALOG: 'app:showSaveDialog',
  APP_SHOW_OPEN_DIALOG: 'app:showOpenDialog',
  APP_GET_VERSION: 'app:getVersion',

  // Window operations
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // Theme
  THEME_GET: 'theme:get',
  THEME_SET: 'theme:set',
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
