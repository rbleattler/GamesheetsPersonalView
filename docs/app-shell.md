# MyHockeyHub app shell

MyHockeyHub is built as a lightweight static application. The historical standalone HTML prototypes were archived at the `prototype-version-archive` GitHub release/tag before the app-shell cutover.

The current source of truth is the app shell under `src/`, with build/test tooling under `scripts/` and `tests/`. The V3.6 implementation is retained only as an internal migration baseline at `src/baseline/v3.6.html`; it is not published as a numbered production page.

## Build

```bash
npm install
npm run check
npm test
npm run build
npm run verify
```

The static site is emitted to `dist/` and is suitable for GitHub Pages deployment.

Current output intentionally includes:

```text
dist/
  index.html                # landing page
  app/index.html            # primary application
  gamesheets_plus.html      # legacy redirect to ./
  assets/                   # cache-busted CSS/JS
  data/                     # season catalog
  debug/                    # sanitized replay fixture
  FAQ.md
  LICENSE
```

Historical `v*.html` files and `versions.html` are intentionally excluded from current source and deployment output.

## Production hosting

GitHub Pages is configured to use **GitHub Actions** as its source.

Production deploys through `.github/workflows/pages-production.yml` using the native Pages pipeline:

1. checkout
2. install dependencies
3. `npm run check`
4. `npm test`
5. `npm run build`
6. `npm run verify`
7. `actions/configure-pages`
8. `actions/upload-pages-artifact`
9. `actions/deploy-pages`

The first cutover workflow is intentionally manual-only (`workflow_dispatch`). This keeps the merge and the first production replacement as separate, deliberate actions. After the first native Pages deployment is verified, the workflow can be changed to deploy automatically on pushes to `main`.

The old `gh-pages` branch remains only as legacy/preview infrastructure during the cutover and can be retired after production is confirmed healthy.

## Legacy URL compatibility

`gamesheets_plus.html` remains in the built artifact because older bookmarks and shared links may still point to it. It is a minimal redirect to the normal MyHockeyHub landing page (`./`), not a separate application entry point.

Build verification checks this behavior so the legacy URL cannot silently drift back to an obsolete numbered-version flow.

## Prototype archive

The pre-app-shell repository state, including the old V1–V3.6 HTML prototypes and version-history page, is preserved in Git at the `prototype-version-archive` release/tag.

Those prototype files are intentionally not part of the current source tree or production artifact. Git is the archive.

## Runtime structure

The application remains framework-light. GameSheet access, normalization, live refresh, broadcaster handling, routing, diagnostics, and UI compatibility behavior are progressively separated into modules under `src/app/`.

Notable runtime safeguards include:

- normalized GameSheet API access through `MyHockeyHubFoundation`;
- bounded browser fetch waits so failed game-detail requests do not spin forever;
- lazy broadcaster-detail hydration;
- actionable LiveBarn game links only when a game-specific URL exists;
- venue/surface inference from known LiveBarn URLs;
- 30-second live polling with overlap protection and reconnect/visibility recovery;
- incremental game-card decoration so large “Entire season” renders are not repeatedly rescanned;
- deterministic fixture tests and an optional `?debug=1` replay/diagnostics mode.

CI does not depend on live GameSheet requests.
