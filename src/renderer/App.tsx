import { useMemo, useState } from 'react';
import { transformerTypes, type TransformerType } from '../shared/ipc';

type Status =
  | {
      kind: 'idle';
      message: string;
    }
  | {
      kind: 'success' | 'error' | 'working';
      message: string;
    };

const initialStatus: Status = {
  kind: 'idle',
  message: 'Select an input CSV, choose a transformer, and pick an output path.',
};

function validateForm(inputPath: string, transformerType: TransformerType | '', outputPath: string) {
  if (!inputPath) {
    return 'Select an input CSV file before transforming.';
  }

  if (!inputPath.toLowerCase().endsWith('.csv')) {
    return 'The input file must be a .csv file.';
  }

  if (!transformerType) {
    return 'Select a transformer type.';
  }

  if (!outputPath) {
    return 'Choose an output file location before transforming.';
  }

  if (inputPath.toLowerCase() === outputPath.toLowerCase()) {
    return 'Choose a different output path so the input file is not overwritten.';
  }

  return null;
}

export function App() {
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [transformerType, setTransformerType] = useState<TransformerType | ''>('IBKR');
  const [status, setStatus] = useState<Status>(initialStatus);
  const [isWorking, setIsWorking] = useState(false);

  const validationError = useMemo(
    () => validateForm(inputPath, transformerType, outputPath),
    [inputPath, outputPath, transformerType],
  );

  async function chooseInputFile() {
    const result = await window.acbTransform.selectInputCsv();

    if (!result.canceled) {
      setInputPath(result.filePath);
      setStatus({ kind: 'idle', message: 'Input CSV selected.' });
    }
  }

  async function chooseOutputFile() {
    const result = await window.acbTransform.selectOutputCsv();

    if (!result.canceled) {
      setOutputPath(result.filePath);
      setStatus({ kind: 'idle', message: 'Output path selected.' });
    }
  }

  async function runTransform() {
    const error = validateForm(inputPath, transformerType, outputPath);

    if (error) {
      setStatus({ kind: 'error', message: error });
      return;
    }

    setIsWorking(true);
    setStatus({ kind: 'working', message: 'Transforming CSV...' });

    try {
      const selectedTransformer = transformerType as TransformerType;
      const result = await window.acbTransform.transformCsv({
        inputPath,
        outputPath,
        transformerType: selectedTransformer,
      });

      if (result.ok) {
        setStatus({ kind: 'success', message: result.message });
      } else {
        setStatus({ kind: 'error', message: result.error });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      setStatus({ kind: 'error', message: `The transform failed unexpectedly. ${detail}` });
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="panel" aria-labelledby="app-title">
        <div className="header">
          <div>
            <p className="eyebrow">Desktop CSV utility</p>
            <h1 id="app-title">ACB Transform</h1>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Input CSV</span>
            <div className="path-row">
              <input value={inputPath} readOnly placeholder="No input file selected" />
              <button type="button" className="secondary-button" onClick={chooseInputFile}>
                Choose CSV
              </button>
            </div>
          </label>

          <label className="field">
            <span>Transformer</span>
            <select
              value={transformerType}
              onChange={(event) => setTransformerType(event.target.value as TransformerType)}
            >
              {transformerTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Output CSV</span>
            <div className="path-row">
              <input value={outputPath} readOnly placeholder="No output file selected" />
              <button type="button" className="secondary-button" onClick={chooseOutputFile}>
                Save As
              </button>
            </div>
          </label>

          <button
            type="button"
            className="primary-button"
            onClick={runTransform}
            disabled={isWorking}
          >
            {isWorking ? 'TRANSFORMING...' : 'TRANSFORM'}
          </button>
        </div>

        <section className={`status status-${status.kind}`} aria-live="polite">
          <strong>
            {status.kind === 'success'
              ? 'Success'
              : status.kind === 'error'
                ? 'Action needed'
                : status.kind === 'working'
                  ? 'Working'
                  : 'Status'}
          </strong>
          <p>{status.message}</p>
          {validationError && status.kind !== 'error' ? (
            <p className="hint">Next: {validationError}</p>
          ) : null}
        </section>
      </section>
    </main>
  );
}
