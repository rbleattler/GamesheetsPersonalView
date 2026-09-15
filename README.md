# MyHockeyHub

A lightweight, static personal hockey viewer built around public GameSheet / GameSheet Stats data.

MyHockeyHub provides a focused view of schedules, scores, team activity, favorite venues, players, completed-game statistics, and available external broadcaster links without requiring a GameSheet login.

## Current app

The current application is the V4 app shell and is deployed through GitHub Pages.

- Landing page: repository Pages root
- Application: `/app/`
- Legacy `gamesheets_plus.html`: retained as a compatibility redirect to the landing page
- Historical standalone V1–V3.6 prototypes: preserved in Git history and the `prototype-version-archive` release/tag rather than hosted as parallel production pages

The V3.6 implementation remains in `src/baseline/v3.6.html` as an internal migration/build baseline while V4 code is progressively separated into dedicated app modules.

## Features

- League/season discovery from the checked-in public-season catalog
- Direct season opening by GameSheet URL or season ID
- My Teams dashboard with recent results and upcoming games
- Full schedule filters for division, team, rink, date range, favorites, and text search
- Progressive schedule rendering for large season views
- Favorite venues and quick venue schedules
- Player browsing, favorites, team rosters, season stats, and recent-game activity
- Canonical hockey position display (`Forward`, `Defense`, `Goalie`, or `Skater`) with consistent F/D/G/S shorthand in compact game-stat tables
- Completed-game scoring, penalties, box score, and player views
- Game-specific LiveBarn links when public broadcaster metadata supplies an actionable URL
- Live-game refresh support
- Help/feedback flow and debug diagnostics

## Architecture

MyHockeyHub intentionally remains framework-light. It is a static site built with Node + esbuild and deployed to GitHub Pages.

Important source areas:

- `src/baseline/v3.6.html` — transitional V3.6 application baseline consumed by the build
- `src/app/foundation.js` — shared API access, normalization helpers, broadcaster discovery, live refresh, replay support
- `src/app/game-normalization.js` — Firestore game-detail decoding and normalized game/box-score/event model
- `src/app/player-normalization.js` — stable player/roster models, canonical position semantics, roster extraction, recent activity, and player deduplication
- `src/app/router.js` — route/deep-link handling
- `src/app/diagnostics.js` — debug/fixture support
- `src/app/fetch-guard.js` — fetch timeout protection
- `src/app/venue-links.js` — venue/LiveBarn inference bridge
- `src/app/card-actions.js` / `.css` — game-card action decoration
- `scripts/build.mjs` — baseline extraction and build migration rewrites
- `scripts/progressive-schedule.mjs` — progressive 30-card schedule rendering pass
- `scripts/player-normalization-integration.mjs` — transitional wiring from the legacy-derived bundle to the player normalization boundary
- `scripts/finalize-static.mjs` — asset finalization, cache busting, and selected Font Awesome SVG embedding
- `scripts/verify-build.mjs` — generated-output assertions
- `tests/` — fixture-backed normalization and foundation tests

The project does not ship the complete Font Awesome library to the browser. The build reads only the selected Free Solid SVG glyphs needed by the UI and embeds those glyphs into the generated stylesheet.

## Data access

The app currently uses public GameSheet / GameSheet Stats resources, including:

- `https://gamesheetstats.com/api`
- public Firestore REST game documents used by GameSheet

The app does not scrape credentials, bypass authentication, or embed authenticated GameSheet pages. External broadcaster links remain links to the provider.

Network behavior is progressively being centralized behind the small client surface in `src/app/foundation.js`, while raw response quirks are normalized before rendering where practical.

## Development

Requires a current Node.js installation.

```bash
npm install
npm run check
npm test
npm run build
npm run verify
```

The built static site is written to `dist/`.

To serve it locally:

```bash
cd dist
python -m http.server 8080
```

or on Windows:

```powershell
cd dist
py -m http.server 8080
```

Then open:

- `http://localhost:8080/`
- `http://localhost:8080/app/`

## Useful scripts

```bash
npm run check
npm test
npm run build
npm run verify
npm run probe:schema
```

`probe:schema` is intended for explicit schema research and may use live public endpoints. Normal CI/fixture tests do not depend on live GameSheet access.

## Deployment

Production uses the native GitHub Pages Actions deployment workflow in `.github/workflows/pages-production.yml`.

Pull requests use `.github/workflows/pr-preview.yml` to publish a branch preview under the repository's preview path for browser/device testing.

The build intentionally keeps the production application static and serverless.

## History

The repository began as a sequence of standalone HTML prototypes. Those historical versions remain available through Git history and the GitHub release/tag:

`prototype-version-archive`

The final standalone prototype snapshot is commit:

`bdbb49d93bf8dd838278b95781901d74563350d7`

## Independence

MyHockeyHub is an independent personal viewer using public GameSheet data. It is not affiliated with, endorsed by, sponsored by, or operated by GameSheet.
