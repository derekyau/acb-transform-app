import { contextBridge, ipcRenderer } from 'electron';
import type {
  FileActionResult,
  FilePickerResult,
  TransformRequest,
  TransformResult,
  WindowLayoutMode,
} from '../shared/ipc';

async function selectInputFile(): Promise<FilePickerResult> {
  try {
    return await ipcRenderer.invoke('dialog:open-input-file');
  } catch {
    return ipcRenderer.invoke('dialog:open-csv');
  }
}

const api = {
  selectInputFile,
  selectInputCsv: selectInputFile,
  selectOutputCsv: (): Promise<FilePickerResult> => ipcRenderer.invoke('dialog:save-csv'),
  transformFile: (request: TransformRequest): Promise<TransformResult> =>
    ipcRenderer.invoke('transform:run', request),
  transformCsv: (request: TransformRequest): Promise<TransformResult> =>
    ipcRenderer.invoke('transform:run', request),
  showItemInFolder: (filePath: string): Promise<FileActionResult> =>
    ipcRenderer.invoke('file:show-in-folder', filePath),
  openFile: (filePath: string): Promise<FileActionResult> =>
    ipcRenderer.invoke('file:open', filePath),
  setWindowLayout: (mode: WindowLayoutMode): Promise<void> =>
    ipcRenderer.invoke('window:set-layout', mode),
};

contextBridge.exposeInMainWorld('acbTransform', api);

export type AcbTransformApi = typeof api;
