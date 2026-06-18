import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runTransform } from './transformers/run-transform';
import type {
  FileActionResult,
  FilePickerResult,
  TransformRequest,
  TransformResult,
  WindowLayoutMode,
} from '../shared/ipc';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const devIconPath = path.join(app.getAppPath(), 'resources', 'icon.png');

const windowLayouts: Record<WindowLayoutMode, { width: number; height: number }> = {
  compact: { width: 704, height: 600 },
  help: { width: 900, height: 920 },
};

function createMainWindow() {
  const window = new BrowserWindow({
    width: 704,
    height: 600,
    minWidth: 640,
    minHeight: 560,
    useContentSize: true,
    title: 'ACB Transform',
    backgroundColor: '#ffffff',
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
  const openInputFile = async (): Promise<FilePickerResult> => {
    const result = await dialog.showOpenDialog({
      title: 'Select broker input file',
      properties: ['openFile'],
      filters: [
        { name: 'CSV, XLS, and XLSX Files', extensions: ['csv', 'xls', 'xlsx'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'Excel Files', extensions: ['xls', 'xlsx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, filePath: result.filePaths[0] };
  };

  ipcMain.handle('dialog:open-input-file', openInputFile);
  ipcMain.handle('dialog:open-csv', openInputFile);

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

  ipcMain.handle('file:show-in-folder', (_event, filePath: string): FileActionResult => {
    if (!filePath) {
      return { ok: false, error: 'No output file is available to reveal.' };
    }

    shell.showItemInFolder(filePath);
    return { ok: true };
  });

  ipcMain.handle('file:open', async (_event, filePath: string): Promise<FileActionResult> => {
    if (!filePath) {
      return { ok: false, error: 'No output file is available to open.' };
    }

    const error = await shell.openPath(filePath);

    if (error) {
      return { ok: false, error };
    }

    return { ok: true };
  });

  ipcMain.handle('window:set-layout', (event, mode: WindowLayoutMode): void => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const layout = windowLayouts[mode];

    if (!window || !layout) {
      return;
    }

    const display = screen.getDisplayMatching(window.getBounds());
    const width = Math.min(layout.width, display.workArea.width - 80);
    const height = Math.min(layout.height, display.workArea.height - 80);

    window.setContentSize(width, height, true);
  });
}

app.whenReady().then(() => {
  if (isDev && process.platform === 'darwin' && existsSync(devIconPath)) {
    app.dock?.setIcon(devIconPath);
  }

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
