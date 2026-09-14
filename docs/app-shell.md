# App-shell migration

The `feature/app-shell-v4` branch begins the move from the single-file V3.6 prototype to a conventional static web-app layout without introducing an application server or a heavy client framework.

## Target layout

The build emits a deployable site under `dist/`:

```text
dist/
  index.html              # real MyHockeyHub home page
  app/index.html          # primary application shell
  assets/
    app.css               # minified application styles
    app.js                # minified application code
    router.js             # lightweight URL/view routing
    site.css              # home-page styles
  data/                   # local season catalog
  versions.html           # preserved version-history page
  v*.html                 # historical prototypes
  gamesheets_plus.html    # compatibility redirect to app/
```

## Transitional V3.6 baseline

The first migration deliberately treats `v3.6.html` as a behavioral baseline. `scripts/build.mjs` extracts its inline CSS and JavaScript, minifies them with esbuild, and emits them as external assets for the new `/app/` shell. This avoids a risky copy-and-rewrite of the entire app while the structure changes.

That extraction is temporary. Follow-up work will move API access, normalization, live refresh, state, and rendering into source modules. The numbered V3.6 file remains untouched as a historical snapshot.

## Routing

`src/app/router.js` adds static-host-safe routing with `?view=team`, `?view=venues`, `?view=players`, and `?view=schedule`. Browser back/forward restores the selected top-level view. The app header also receives a Home control that returns to `/`.

## Live refresh

The build preserves the existing visibility-aware 30-second live polling and adds an immediate refresh when the browser reports that it has come back online. More complete polling isolation and replay/simulator work is tracked separately.

## CI and GameSheet access

GitHub Actions builds and verifies the static artifact, but it does **not** call GameSheet. Cloudflare/bot controls make CI-originated live requests unreliable and they are unnecessary for deterministic regression coverage. Future automated data tests should use sanitized local fixtures/mocks; live schema probes belong in an explicit local developer command.

## Local build

```bash
npm install
npm run check
npm run build
npm run verify
```

Serve `dist/` with any simple static HTTP server for local browser testing. Do not open the generated HTML directly with `file://`, because the app fetches the local season catalog.
