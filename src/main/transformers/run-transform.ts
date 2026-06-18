import path from 'node:path';
import { createRequire } from 'node:module';
import type { TransformRequest, TransformResult, TransformerType } from '../../shared/ipc';

type Transformer = {
  transform: (args: { inputPath: string; outputPath: string }) => Promise<void>;
};

const loadTransformer = createRequire(__filename);

const transformerLoaders: Record<TransformerType, () => Transformer> = {
  IBKR: () => loadTransformer('./acb-ibkr-transform.js') as Transformer,
  QT: () => loadTransformer('./acb-qt-transform.js') as Transformer,
};

const supportedInputExtensions = new Set(['.csv', '.xls', '.xlsx']);

function isSupportedInputPath(filePath: string) {
  return supportedInputExtensions.has(path.extname(filePath).toLowerCase());
}

function isCsvPath(filePath: string) {
  return path.extname(filePath).toLowerCase() === '.csv';
}

function normalizeForComparison(filePath: string) {
  return path.resolve(filePath).toLowerCase();
}

function validateRequest(request: TransformRequest): string | null {
  if (!request.inputPath) {
    return 'Select an input file before transforming.';
  }

  if (!isSupportedInputPath(request.inputPath)) {
    return 'The input file must be a .csv, .xls, or .xlsx file.';
  }

  if (!request.transformerType) {
    return 'Select a transformer type.';
  }

  if (!transformerLoaders[request.transformerType]) {
    return 'Select a supported transformer type.';
  }

  if (!request.outputPath) {
    return 'Choose an output file location before transforming.';
  }

  if (!isCsvPath(request.outputPath)) {
    return 'The output file must be a .csv file.';
  }

  if (normalizeForComparison(request.inputPath) === normalizeForComparison(request.outputPath)) {
    return 'Choose a different output path so the input file is not overwritten.';
  }

  return null;
}

export async function runTransform(request: TransformRequest): Promise<TransformResult> {
  const validationError = validateRequest(request);

  if (validationError) {
    return { ok: false, error: validationError };
  }

  try {
    const transformer = transformerLoaders[request.transformerType]();

    await transformer.transform({
      inputPath: request.inputPath,
      outputPath: request.outputPath,
    });

    return {
      ok: true,
      outputPath: request.outputPath,
      message: `Transformed CSV saved to ${request.outputPath}`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return {
      ok: false,
      error: `The transform failed unexpectedly. ${detail}`,
    };
  }
}
