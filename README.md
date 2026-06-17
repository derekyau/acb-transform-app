# ACB Transform

ACB Transform is an Electron desktop app for transforming broker CSV files into an ACB-oriented output file. This first pass is a working skeleton: the IBKR and QT transformers copy the selected CSV unchanged to the selected output path.

## Requirements

- Node.js 24+
- npm

## Install

```bash
npm install
```

## Development

```bash
nvm use
npm install
npm run dev
```

Development mode starts the Vite renderer dev server, compiles the Electron main and preload scripts in watch mode, and opens the Electron app.

The renderer dev server runs at:

```text
http://127.0.0.1:5173
```

Electron loads that local dev server while `VITE_DEV_SERVER_URL` is set by the dev script.

## Build

```bash
npm run build
```

This runs TypeScript checks, builds the Vite renderer into `dist/renderer`, and compiles Electron main/preload code plus transformer files into `dist/main`.

## Package macOS App

```bash
npm run dist
```

This runs the production build and then packages the app with electron-builder. Packaged output is written to `release/`.

Current macOS release artifacts are configured as:

- DMG
- ZIP

The app may be unsigned unless a valid macOS signing identity is configured on the build machine.

## Where to Implement Transform Logic

The transformer harness is in `src/main/transformers/run-transform.ts`.

Implement real broker-specific logic in:

- `src/main/transformers/acb-ibkr-transform.js`
- `src/main/transformers/acb-qt-transform.js`

Each file exports:

```js
async function transform({ inputPath, outputPath }) {
  // implementation goes here
}
```

The renderer never receives direct Node.js access. File dialogs and transform execution are exposed through the secure preload bridge with `contextIsolation: true` and `nodeIntegration: false`.
