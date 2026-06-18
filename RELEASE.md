# Release Guide

This project releases desktop installers through the manual GitHub Actions workflow in `.github/workflows/release.yml`.

## Version and Tag Rule

`package.json` is the source of truth for the app version.

The GitHub release tag is derived from `package.json` with a leading `v`.

Examples:

- `package.json` version `0.1.0` uses release tag `v0.1.0`
- `package.json` version `1.0.0` uses release tag `v1.0.0`

The release workflow reads `package.json`, derives the release tag, and verifies that release exists before starting the macOS or Windows builds.

## Release Steps

1. Update `version` in `package.json`.
2. Run local verification:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

3. Commit the version change and push it.
4. Create a GitHub Release using a matching tag, for example `v1.0.0`.
   - The release can be a draft while assets are being built.
   - Create the tag from the same commit that contains the matching `package.json` version.
5. In GitHub, open **Actions** and run **Release Desktop**.
6. Enter `Branch, Tag, or SHA`.
   - Use the branch, tag, or commit SHA that contains the matching `package.json` version.
   - The default is `main`.
7. Wait for both platform jobs to finish.
8. Confirm the GitHub Release contains:
   - macOS Intel `.dmg`
   - macOS Intel `.zip`
   - macOS Apple Silicon `.dmg`
   - macOS Apple Silicon `.zip`
   - Windows `.exe`
9. Download and smoke-test the installers.
10. Publish the draft release when ready.

When rerun, the workflow deletes existing uploaded assets from the target GitHub Release before building and uploading new ones. GitHub's automatic source code archives are not uploaded assets and are not deleted by the workflow.

## Local Build Commands

Build macOS locally:

```bash
npm run dist:mac -- --x64 --arm64 --publish never
```

The macOS artifacts are written to `release/`.

Build Windows on a Windows machine:

```powershell
npm run dist:win
```

The Windows installer is written to `release/`.

## Signing Status

Current releases are unsigned.

Expected user warnings:

- macOS may show Gatekeeper warnings for the DMG or app.
- Windows may show Unknown Publisher or SmartScreen warnings for the installer.

Add macOS notarization and Windows code signing later when release trust becomes important.
