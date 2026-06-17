/// <reference types="vite/client" />

import type { AcbTransformApi } from '../main/preload';

declare global {
  interface Window {
    acbTransform: AcbTransformApi;
  }
}
