import { useEffect, useMemo, useState } from 'react';
import acbImportOptionsUrl from './assets/acb-settings/import-options.png';
import acbSpreadsheetConfigurationUrl from './assets/acb-settings/spreadsheet-configuration.png';
import appLogoUrl from './assets/app/acb-transform-logo.png';
import ibkrFlexQuerySettingsUrl from './assets/broker-instructions/ibkr-flex-query-settings.jpg';
import ibkrIconUrl from './assets/brokers/ibkr-favicon.png';
import questradeIconUrl from './assets/brokers/questrade-logo.svg';
import wealthsimpleIconUrl from './assets/brokers/wealthsimple-favicon.svg';
import buyMeACoffeeBadgeUrl from './assets/support/buy-me-a-coffee.png';
import { transformerLabels, transformerTypes, type TransformerType } from '../shared/ipc';

type AppView = 'transform' | 'brokerInstructions' | 'adjustedCostBaseSettings';

type Status =
  | {
      kind: 'idle';
      message: string;
    }
  | {
      kind: 'success';
      message: string;
      outputPath: string;
    }
  | {
      kind: 'error' | 'working';
      message: string;
    };

const initialStatus: Status = {
  kind: 'idle',
  message: 'Select an input file, choose a transformer, and pick an output path.',
};

function ChevronDownIcon() {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M10 4L6 8l4 4" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6" />
      <path d="M6.4 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.8.6-.8 1.1v.2" />
      <path d="M8 11.5h.01" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 2v2" />
      <path d="M8 12v2" />
      <path d="M2 8h2" />
      <path d="M12 8h2" />
      <path d="M3.8 3.8l1.4 1.4" />
      <path d="M10.8 10.8l1.4 1.4" />
      <path d="M12.2 3.8l-1.4 1.4" />
      <path d="M5.2 10.8l-1.4 1.4" />
      <circle cx="8" cy="8" r="2.3" />
    </svg>
  );
}

const exportInstructions: Record<
  TransformerType,
  {
    iconUrl: string;
    title: string;
    summary: string;
    steps: string[];
    screenshot?: {
      alt: string;
      title: string;
      url: string;
    };
  }
> = {
  IBKR: {
    iconUrl: ibkrIconUrl,
    title: transformerLabels.IBKR,
    summary: 'Create a Flex Query export that includes only trades.',
    steps: [
      'Log in to Interactive Brokers Client Portal.',
      'Go to Statements and Reporting, then open Flex Queries.',
      'Create a new Flex Query and name it something like ACB-trades-export.',
      'Under Sections, select Trades only.',
      'Use the settings shown below for the Flex Query output and general configuration.',
      `Use the downloaded file as the input file with the ${transformerLabels.IBKR} transformer.`,
    ],
    screenshot: {
      alt: 'Interactive Brokers Flex Query settings showing CSV format, no header and trailer records, column headers enabled, no single column header row, no section code and line descriptor, last business day period, dd/MM/yyyy date format, HHmmss time format, semicolon date time separator, default profit and loss, no offsetting trade cancel pairs, no currency rates, and no audit trail fields.',
      title: 'Flex Query Settings',
      url: ibkrFlexQuerySettingsUrl,
    },
  },
  QT: {
    iconUrl: questradeIconUrl,
    title: transformerLabels.QT,
    summary: 'Export your account activity for the same date range you plan to transform.',
    steps: [
      'Sign in to Questrade and open the account you want to export.',
      'Go to Reports, then open Account activity.',
      'Set the date range to the tax year or custom range you need.',
      'In the activity filters, choose Deselect All, then select only Trades.',
      'Download or export the results as a CSV, XLS, or XLSX file.',
      `Use the downloaded file as the input file with the ${transformerLabels.QT} transformer.`,
    ],
  },
  WS: {
    iconUrl: wealthsimpleIconUrl,
    title: transformerLabels.WS,
    summary: 'Export all trades and account activity as a CSV from the Activity tab.',
    steps: [
      `Log in to ${transformerLabels.WS} on the web using a desktop browser.`,
      'Click the Activity tab.',
      'Click Download activities.',
      'Choose your date range.',
      'Select the account or accounts you want to export.',
      'Click Download CSV.',
      `Use the downloaded file as the input file with the ${transformerLabels.WS} transformer.`,
    ],
  },
};

function validateForm(inputPath: string, transformerType: TransformerType | '', outputPath: string) {
  if (!inputPath) {
    return 'Select an input file before transforming.';
  }

  if (!/\.(csv|xls|xlsx)$/i.test(inputPath)) {
    return 'The input file must be a .csv, .xls, or .xlsx file.';
  }

  if (!transformerType) {
    return 'Select a transformer type.';
  }

  if (!outputPath) {
    return 'Choose an output file location before transforming.';
  }

  if (!outputPath.toLowerCase().endsWith('.csv')) {
    return 'The output file must be a .csv file.';
  }

  if (inputPath.toLowerCase() === outputPath.toLowerCase()) {
    return 'Choose a different output path so the input file is not overwritten.';
  }

  return null;
}

export function App() {
  const [activeView, setActiveView] = useState<AppView>('transform');
  const [activeInstructionType, setActiveInstructionType] = useState<TransformerType>('IBKR');
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [transformerType, setTransformerType] = useState<TransformerType | ''>('');
  const [isTransformerMenuOpen, setIsTransformerMenuOpen] = useState(false);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [isWorking, setIsWorking] = useState(false);

  const validationError = useMemo(
    () => validateForm(inputPath, transformerType, outputPath),
    [inputPath, outputPath, transformerType],
  );

  useEffect(() => {
    void window.acbTransform.setWindowLayout?.(
      activeView === 'transform' ? 'compact' : 'help',
    );
  }, [activeView]);

  async function chooseInputFile() {
    const result = await (
      window.acbTransform.selectInputFile ?? window.acbTransform.selectInputCsv
    )();

    if (!result.canceled) {
      setInputPath(result.filePath);
      setStatus({ kind: 'idle', message: 'Input file selected.' });
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
    setStatus({ kind: 'working', message: 'Transforming file...' });

    try {
      const selectedTransformer = transformerType as TransformerType;
      const transform = window.acbTransform.transformFile ?? window.acbTransform.transformCsv;
      const result = await transform({
        inputPath,
        outputPath,
        transformerType: selectedTransformer,
      });

      if (result.ok) {
        setStatus({
          kind: 'success',
          message: result.message,
          outputPath: result.outputPath,
        });
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

  async function openOutputFile() {
    if (status.kind !== 'success') {
      return;
    }

    if (!window.acbTransform.openFile) {
      setStatus({
        kind: 'error',
        message: 'Restart the app to enable opening output files.',
      });
      return;
    }

    try {
      const result = await window.acbTransform.openFile(status.outputPath);

      if (!result.ok) {
        setStatus({ kind: 'error', message: `Could not open the output file. ${result.error}` });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      setStatus({ kind: 'error', message: `Could not open the output file. ${detail}` });
    }
  }

  async function openOutputFolder() {
    if (status.kind !== 'success') {
      return;
    }

    if (!window.acbTransform.showItemInFolder) {
      setStatus({
        kind: 'error',
        message: 'Restart the app to enable opening output folders.',
      });
      return;
    }

    try {
      const result = await window.acbTransform.showItemInFolder(status.outputPath);

      if (!result.ok) {
        setStatus({
          kind: 'error',
          message: `Could not open the enclosing folder. ${result.error}`,
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      setStatus({ kind: 'error', message: `Could not open the enclosing folder. ${detail}` });
    }
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <section className="panel" aria-labelledby="app-title">
          <div className="header">
            <img src={appLogoUrl} alt="" className="app-logo" aria-hidden="true" />
            <h1 id="app-title">ACB Transform</h1>
          </div>

          {activeView === 'transform' ? (
            <>
              <div className="screen-intro">
                <p>
                  Export a file from your broker and then upload it to this tool and transform it to
                  a format compatible with adjustedcostbase.ca.
                </p>
                <div className="help-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setActiveView('brokerInstructions')}
                  >
                    <HelpIcon /> Broker Export Instructions
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setActiveView('adjustedCostBaseSettings')}
                  >
                    <SettingsIcon /> AdjustedCostBase Settings Template
                  </button>
                </div>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Input File</span>
                  <div className="path-row">
                    <input value={inputPath} readOnly placeholder="No input file selected" />
                    <button type="button" className="secondary-button" onClick={chooseInputFile}>
                      Choose File
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span>Transformer</span>
                  <div
                    className="transformer-select"
                    onBlur={(event) => {
                      const nextFocus = event.relatedTarget;

                      if (!(nextFocus instanceof Node) || !event.currentTarget.contains(nextFocus)) {
                        setIsTransformerMenuOpen(false);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="transformer-select-button"
                      aria-haspopup="listbox"
                      aria-expanded={isTransformerMenuOpen}
                      onClick={() => setIsTransformerMenuOpen((isOpen) => !isOpen)}
                    >
                      {transformerType ? (
                        <>
                          <img
                            src={exportInstructions[transformerType].iconUrl}
                            alt=""
                            className="broker-icon"
                            aria-hidden="true"
                          />
                          <span>{exportInstructions[transformerType].title}</span>
                        </>
                      ) : (
                        <span className="transformer-placeholder">Select a transformer</span>
                      )}
                      <span className="select-chevron" aria-hidden="true">
                        <ChevronDownIcon />
                      </span>
                    </button>

                    {isTransformerMenuOpen ? (
                      <div className="transformer-menu" role="listbox" aria-label="Transformer">
                        {transformerTypes.map((type) => (
                          <button
                            type="button"
                            className={
                              transformerType === type
                                ? 'transformer-option active'
                                : 'transformer-option'
                            }
                            role="option"
                            aria-selected={transformerType === type}
                            onClick={() => {
                              setTransformerType(type);
                              setIsTransformerMenuOpen(false);
                            }}
                            key={type}
                          >
                            <img
                              src={exportInstructions[type].iconUrl}
                              alt=""
                              className="broker-icon"
                              aria-hidden="true"
                            />
                            <span>{exportInstructions[type].title}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
                  disabled={isWorking || Boolean(validationError)}
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
                {status.kind === 'success' ? (
                  <div className="status-actions">
                    <button type="button" className="status-action-button" onClick={openOutputFolder}>
                      Open enclosing folder
                    </button>
                    <button type="button" className="status-action-button" onClick={openOutputFile}>
                      Open file
                    </button>
                  </div>
                ) : null}
              </section>
            </>
          ) : activeView === 'brokerInstructions' ? (
            <section className="instructions" aria-labelledby="instructions-title">
              <div className="instructions-header">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setActiveView('transform')}
                >
                  <ChevronLeftIcon /> Back to transform
                </button>
                <div className="instructions-intro">
                  <h2 id="instructions-title">Export File Instructions</h2>
                  <p>
                    Pick the platform you are exporting from, then use that file as the input.
                  </p>
                </div>
              </div>

              <div className="instruction-list">
                <div className="platform-tabs" aria-label="Instruction platform">
                  {transformerTypes.map((type) => (
                    <button
                      type="button"
                      className={
                        activeInstructionType === type ? 'platform-tab active' : 'platform-tab'
                      }
                      onClick={() => setActiveInstructionType(type)}
                      key={type}
                    >
                      <img
                        src={exportInstructions[type].iconUrl}
                        alt=""
                        className="broker-icon"
                        aria-hidden="true"
                      />
                      {exportInstructions[type].title}
                    </button>
                  ))}
                </div>

                <article className="instruction-panel">
                  <div className="instruction-header">
                    <div>
                      <h3 className="broker-title">
                        <img
                          src={exportInstructions[activeInstructionType].iconUrl}
                          alt=""
                          className="broker-icon"
                          aria-hidden="true"
                        />
                        {exportInstructions[activeInstructionType].title}
                      </h3>
                      <p>{exportInstructions[activeInstructionType].summary}</p>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setTransformerType(activeInstructionType);
                        setActiveView('transform');
                      }}
                    >
                      Use {exportInstructions[activeInstructionType].title}
                    </button>
                  </div>

                  <ol>
                    {exportInstructions[activeInstructionType].steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>

                  {exportInstructions[activeInstructionType].screenshot ? (
                    <div className="instruction-screenshot-block">
                      <h4>{exportInstructions[activeInstructionType].screenshot.title}</h4>
                      <img
                        src={exportInstructions[activeInstructionType].screenshot.url}
                        alt={exportInstructions[activeInstructionType].screenshot.alt}
                        className="settings-screenshot"
                      />
                    </div>
                  ) : null}
                </article>
              </div>
            </section>
          ) : (
            <section className="instructions" aria-labelledby="settings-title">
              <div className="instructions-header">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setActiveView('transform')}
                >
                  <ChevronLeftIcon /> Back to transform
                </button>
                <div className="instructions-intro">
                  <h2 id="settings-title">AdjustedCostBase Settings Template</h2>
                  <p>
                    Configure adjustedcostbase.ca with this template before importing transformed
                    CSV files.
                  </p>
                </div>
              </div>

              <article className="instruction-panel">
                <ol>
                  <li>Go to adjustedcostbase.ca and sign in.</li>
                  <li>Open the spreadsheet import flow.</li>
                  <li>Create or manage a settings template named Trades-Template.</li>
                  <li>Match the spreadsheet configuration and import options shown below.</li>
                  <li>
                    Save the settings template, then use it when importing this tool's output CSV.
                  </li>
                </ol>
              </article>

              <article className="instruction-panel">
                <h3>Spreadsheet Configuration</h3>
                <img
                  src={acbSpreadsheetConfigurationUrl}
                  alt="AdjustedCostBase spreadsheet configuration showing columns A through J mapped to security, date, transaction type, amount, shares, commission, memo, exchange rate or currency code, price in foreign currency, and commission in foreign currency."
                  className="settings-screenshot"
                />
              </article>

              <article className="instruction-panel">
                <h3>Import Options</h3>
                <img
                  src={acbImportOptionsUrl}
                  alt="AdjustedCostBase import options showing day month year date format, skip unrecognized transaction types, gross amount, and ignore header row."
                  className="settings-screenshot"
                />
              </article>
            </section>
          )}
        </section>

        <footer className="app-footer">
          <a
            href="https://buymeacoffee.com/derekyau"
            target="_blank"
            rel="noreferrer"
            aria-label="Buy me a coffee"
          >
            <img src={buyMeACoffeeBadgeUrl} alt="Buy Me a Coffee" />
          </a>
        </footer>
      </div>
    </main>
  );
}
