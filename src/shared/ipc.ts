export const transformerTypes = ['IBKR', 'QT', 'WS'] as const;

export type TransformerType = (typeof transformerTypes)[number];

export const transformerLabels: Record<TransformerType, string> = {
  IBKR: 'Interactive Brokers',
  QT: 'Questrade',
  WS: 'Wealthsimple',
};

export type TransformRequest = {
  inputPath: string;
  outputPath: string;
  transformerType: TransformerType;
};

export type TransformResult =
  | {
      ok: true;
      outputPath: string;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

export type FilePickerResult =
  | {
      canceled: true;
    }
  | {
      canceled: false;
      filePath: string;
    };

export type FileActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export type WindowLayoutMode = 'compact' | 'help';
