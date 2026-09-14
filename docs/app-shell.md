# App-shell migration

The `feature/app-shell-v4` branch moves the single-file V3.6 prototype toward a conventional static web-app layout without introducing an application server or a heavy client framework.

## Release isolation

The app-shell work is preview-only until explicit approval. Production continues to serve the existing V3.6/version-history content from the root of `gh-pages`; PR #9 is published independently at:

`https://rbleattler.com/GamesheetsPersonalView/pr-preview/pr-9/`

The preview workflow writes only its `pr-preview/pr-9/` destination and preserves the production files at the branch root.

## Target layout

The build emits a deployable site under `dist/`:

```text
dist/
  index.html              # real MyHockeyHub home page
  app/index.html          # primary application shell
  assets/
    app.css               # minified application styles
    foundation.js         # API, normalization, broadcast, live/replay services
    app.js                # minified application code
    router.js             # lightweight URL/view routing
    diagnostics.js        # explicit debug/fixture-replay UI
    site.css              # home-page styles
  data/                   # local season catalog
  debug/live-replay.json  # sanitized fake-game replay fixture
  versions.html           # preserved version-history page
  v*.html                 # historical prototypes
  gamesheets_plus.html    # compatibility redirect to app/
```

## Transitional V3.6 baseline

The migration deliberately treats `v3.6.html` as a behavioral baseline. `scripts/build.mjs` extracts its inline CSS and JavaScript, minifies them with esbuild, and emits them as external assets for the new `/app/` shell. The numbered V3.6 file itself remains untouched as a historical snapshot.

The build currently rewrites selected baseline seams into source modules rather than rewriting the entire application at once. GameSheet fetch/status handling, basic response normalization, broadcast-link classification, live-refresh behavior, routing, diagnostics, and replay control now have source-owned implementations.

## Routing

`src/app/router.js` adds static-host-safe routing with `?view=team`, `?view=venues`, `?view=players`, and `?view=schedule`. Browser back/forward restores the selected top-level view. The app header also receives a Home control that returns to the preview root.

## API and normalization

`src/app/foundation.js` is the current shared boundary for public GameSheet access. The preview routes fetch/status handling and unified-game normalization through this layer. Optional broadcaster fields are normalized into `_broadcast` metadata so UI code does not need to know every raw payload shape.

Broadcaster URLs are classified before rendering. Generic LiveBarn venue/search links are deliberately suppressed; only actionable HTTP(S) links can produce Watch/Live/Replay actions.

## Live refresh

The preview uses the shared live-refresh service in `foundation.js`. It:

- prevents overlapping refreshes;
- polls visible live games on a 30-second interval;
- pauses normal polling while the page is hidden;
- forces a refresh when the page becomes visible again;
- forces a refresh when the browser reports connectivity has returned;
- exposes last-success/error state for diagnostics.

Production V3.6 is not changed by this work until promotion is approved.

## Diagnostics and replay

Append `?debug=1` to the preview app URL to enable `src/app/diagnostics.js`. The panel shows current view/season, game and live counts, polling state, last refresh/error state, and broadcaster normalization counts.

The diagnostics panel can load `debug/live-replay.json` and step a fake game through scheduled, live score changes, and final. The simulator temporarily injects only the sanitized fixture into the preview's in-memory game state and restores the original data when finished. It does not write to GameSheet and does not replace saved user preferences.

## CI and GameSheet access

GitHub Actions runs syntax checks, fixture tests, the build, and artifact verification, but it does **not** call GameSheet. Cloudflare/bot controls make CI-originated live requests unreliable and they are unnecessary for deterministic regression coverage.

A local-only schema probe is available for explicit developer checks:

```bash
npm run probe:schema -- --season 15111
npm run probe:schema -- --url https://gamesheetstats.com/api/unified-games/15111
```

The probe reports wrapper/data shape, sample keys, critical unified-game fields, and broadcaster-normalization counts. It is not invoked by CI.

## Local build

```bash
npm install
npm run check
npm test
npm run build
npm run verify
```

Serve `dist/` with any simple static HTTP server for local browser testing. Do not open the generated HTML directly with `file://`, because the app fetches local data assets.
