# MyHockeyHub app shell

MyHockeyHub is now built as a lightweight static application. The historical standalone HTML prototypes were archived at the `prototype-version-archive` GitHub release before the app-shell cutover.

The current source of truth is the app shell under `src/`, with build/test tooling under `scripts/` and `tests/`.

## Build

```bash
npm install
npm run check
npm test
npm run build
npm run verify
```

The static site is emitted to `dist/` and is suitable for GitHub Pages deployment.

## Production hosting

Production is intended to deploy through the native GitHub Pages Actions workflow in `.github/workflows/pages-production.yml` after the repository Pages source is switched to **GitHub Actions**.

The first cutover workflow is intentionally manual-only (`workflow_dispatch`) so merging the app-shell PR cannot replace the existing production site before the Pages setting is changed deliberately.

## Prototype archive

The pre-app-shell repository state, including the old V1–V3.6 HTML prototypes, is preserved in Git at the `prototype-version-archive` release/tag. Those prototype files are not part of the current source tree or production artifact.
