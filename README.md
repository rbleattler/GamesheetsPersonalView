# MyHockeyHub

MyHockeyHub is a mobile-first hockey schedule, scores, and stats viewer built around publicly available GameSheet data. It is designed for families and fans who want a simpler personal view of the league information they already care about.

> **Independent project:** MyHockeyHub is not affiliated with, endorsed by, sponsored by, or operated by GameSheet.

## Published app

- **Home:** https://rbleattler.com/GamesheetsPersonalView/
- **App:** https://rbleattler.com/GamesheetsPersonalView/app/
- **Legacy launcher:** https://rbleattler.com/GamesheetsPersonalView/gamesheets_plus.html

`gamesheets_plus.html` is kept for compatibility with old bookmarks and links. It redirects to the normal MyHockeyHub landing page.

The standalone V1–V3.6 prototype era is preserved in the [`prototype-version-archive`](https://github.com/rbleattler/GamesheetsPersonalView/releases/tag/prototype-version-archive) GitHub release/tag rather than being carried forward in the current production artifact.

## What it does

- Search for a league/season as you type
- Recognize familiar acronyms conservatively (for example, `DVHL`)
- Browse and filter the full schedule
- Save multiple **My Teams**
- Follow individual **My Players**
- Save favorite venues
- Show live and completed game details, scoring, penalties, box score, and rosters
- Surface GameSheet and actionable LiveBarn links when available
- Hide obviously stale “Live” games by default
- Keep preferences locally without requiring an account
- Offer built-in Help, FAQ access, and a simple feedback/reporting flow

## League / season catalog

GameSheet’s live season-directory search is partner-restricted, so MyHockeyHub ships a periodically refreshed snapshot at [`data/seasons.json`](data/seasons.json). The app searches that local file in the browser; normal users do **not** scrape GameSheet.

Search ranking favors exact names, starts-with/text matches, explicit acronyms already present in the source name, and current/recent seasons. Inferred acronyms are only used as a lower-confidence fallback. If a newly created season is not in the snapshot yet, users can still open it directly with its GameSheet season URL or season ID.

See [`data/README.md`](data/README.md) for catalog maintenance notes.

## Architecture and build

The project is intentionally lightweight: static HTML, CSS, and JavaScript with a small esbuild-based build step. There is no application server, login system, or MyHockeyHub database.

```bash
npm install
npm run check
npm test
npm run build
npm run verify
```

`npm run build` creates the deployable site in `dist/`. The generated application uses external, cache-busted CSS/JavaScript assets. The transitional V3.6 behavioral baseline is retained internally at `src/baseline/v3.6.html` while the implementation is progressively modularized.

Current build output includes:

```text
dist/
  index.html                # MyHockeyHub landing page
  app/index.html            # primary app
  gamesheets_plus.html      # legacy redirect to the landing page
  assets/                   # app/site CSS and JavaScript
  data/                     # local season catalog
  debug/                    # sanitized replay fixture for debug mode
  FAQ.md
  LICENSE
```

The historical standalone `v*.html` files and `versions.html` are no longer part of current source or production output; they remain available through Git history and the prototype archive release/tag.

A lightweight router keeps top-level app views in the URL (`?view=team`, `venues`, `players`, or `schedule`) and supports browser back/forward navigation. The app also has a Home control back to the root landing page.

See [`docs/app-shell.md`](docs/app-shell.md) for architecture and hosting details.

## Production hosting

GitHub Pages is configured to use **GitHub Actions** as its source. The production workflow is `.github/workflows/pages-production.yml`.

For the initial cutover, production deployment is intentionally **manual-only** (`workflow_dispatch`) so merging the app-shell PR does not automatically replace the existing live site. After the first native Pages deployment is verified, the workflow can be changed to deploy automatically from `main` and the old production role of `gh-pages` can be retired.

## CI and external data

GitHub Actions validates and builds the app without calling GameSheet. Public GameSheet endpoints can be subject to Cloudflare/bot protection, so CI does not depend on live endpoint access. Regression tests and live-score simulations use sanitized fixtures/mocks.

For an explicit local schema check, run:

```bash
npm run probe:schema -- --season 15111
```

or pass a public HTTPS endpoint with `--url`. The schema probe is intentionally local-only and is never invoked by CI.

## Live scores, LiveBarn, and replay testing

Live refresh uses overlap protection, 30-second polling, page-visibility awareness, immediate reconnect refresh, and bounded fetch waits so failed detail requests do not leave the UI spinning forever.

Game detail normalization can surface actionable broadcaster links such as game-specific LiveBarn URLs. Generic LiveBarn pages are not presented as game-specific watch links. Known surface IDs can also be used to infer venue links.

Append `?debug=1` to the app URL to open the diagnostics panel. It shows polling/error/broadcast state and includes a local fixture replay that walks a fake game through scheduled → live score changes → final. Replay data is local and never writes to GameSheet.

## Help and feedback

The **?** button in the app opens quick help and links to the full [FAQ](FAQ.md). It also offers two ways to send feedback:

- **Build a report in the app:** enter a plain-language summary and description. MyHockeyHub adds basic app context and opens a pre-filled GitHub issue for review.
- **Use the guided GitHub form:** a short issue form asks only for useful information; no deep technical knowledge is expected.

The static app does not upload screenshots directly to GitHub. After GitHub opens, users can paste or drag images into the issue before submitting. A GitHub account is required to submit an issue.

## Privacy and local data

MyHockeyHub has no user accounts or application database. Preferences such as selected season, My Teams, favorite venues, followed players, and theme are stored in the browser with `localStorage`. They are device/browser specific and disappear if site data is cleared.

The optional feedback report can include basic context such as app version, current view, league/season, page URL, browser description, and viewport size. It does **not** include saved teams, followed players, or other personal preferences.

## Prototype archive

The final pre-app-shell repository state is preserved at the `prototype-version-archive` release/tag. That snapshot contains the historical standalone V1–V3.6 files and the old version-history page.

## Data quality

MyHockeyHub reflects public source data. Youth-hockey records can occasionally be incomplete, duplicated, stale, or incorrectly left in a Live state. MyHockeyHub may infer presentation state (for example, treating a Live game older than 24 hours as stale), but it does not rewrite the source record.

## License

This project is licensed under the [MIT License](LICENSE).

GameSheet, team names, team logos, and league data remain the property of their respective owners. Their appearance here is for identification and display of publicly available sports information.
