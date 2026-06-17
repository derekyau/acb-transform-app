import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runTransform } from './transformers/run-transform';
import type { FilePickerResult, TransformRequest, TransformResult } from '../shared/ipc';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function createMainWindow() {
  const window = new BrowserWindow({
    width: 860,
    height: 620,
    minWidth: 720,
    minHeight: 520,
    title: 'ACB Transform',
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const rendererPath = path.join(__dirname, '..', 'renderer', 'index.html');
    void window.loadURL(pathToFileURL(rendererPath).toString());
  }
}

function registerIpcHandlers() {
  ipcMain.handle('dialog:open-csv', async (): Promise<FilePickerResult> => {
    const result = await dialog.showOpenDialog({
      title: 'Select broker CSV',
      properties: ['openFile'],
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, filePath: result.filePaths[0] };
  });

  ipcMain.handle('dialog:save-csv', async (): Promise<FilePickerResult> => {
    const result = await dialog.showSaveDialog({
      title: 'Choose output CSV',
      defaultPath: 'acb-transform-output.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle(
    'transform:run',
    async (_event, request: TransformRequest): Promise<TransformResult> => runTransform(request),
  );
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
