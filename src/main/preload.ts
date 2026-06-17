import { contextBridge, ipcRenderer } from 'electron';
import type { FilePickerResult, TransformRequest, TransformResult } from '../shared/ipc';

const api = {
  selectInputCsv: (): Promise<FilePickerResult> => ipcRenderer.invoke('dialog:open-csv'),
  selectOutputCsv: (): Promise<FilePickerResult> => ipcRenderer.invoke('dialog:save-csv'),
  transformCsv: (request: TransformRequest): Promise<TransformResult> =>
    ipcRenderer.invoke('transform:run', request),
};

contextBridge.exposeInMainWorld('acbTransform', api);

export type AcbTransformApi = typeof api;
