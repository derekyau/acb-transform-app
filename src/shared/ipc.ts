export const transformerTypes = ['IBKR', 'QT'] as const;

export type TransformerType = (typeof transformerTypes)[number];

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
