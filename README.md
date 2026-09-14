# MyHockeyHub

MyHockeyHub is a mobile-first hockey schedule, scores, and stats viewer built around publicly available GameSheet data. It is designed for families and fans who want a simpler personal view of the league information they already care about.

> **Independent project:** MyHockeyHub is not affiliated with, endorsed by, sponsored by, or operated by GameSheet.

## Open the current published app

- **Stable V3.6 link:** https://rbleattler.com/GamesheetsPersonalView/gamesheets_plus.html
- **Published version history:** https://rbleattler.com/GamesheetsPersonalView/
- **Current numbered version:** `v3.6.html`

The `feature/app-shell-v4` branch is restructuring the project into a real static web app. Its build output uses `/` as the home page, `/app/` as the application, and `/versions.html` as the historical version browser. The published URLs above remain the V3.6 experience until that work is explicitly approved and deployed.

The current PR build is isolated at:

- **PR #9 preview:** https://rbleattler.com/GamesheetsPersonalView/pr-preview/pr-9/
- **Preview diagnostics/replay:** https://rbleattler.com/GamesheetsPersonalView/pr-preview/pr-9/app/?debug=1

Nothing under the preview path is promoted to the production root automatically.

## What it does

- Search for a league/season as you type
- Recognize familiar acronyms conservatively (for example, `DVHL`)
- Browse and filter the full schedule
- Save multiple **My Teams**
- Follow individual **My Players**
- Save favorite venues
- Show live and completed game details, scoring, penalties, box score, and rosters
- Hide obviously stale “Live” games by default
- Keep preferences locally without requiring an account
- Offer built-in Help, FAQ access, and a simple feedback/reporting flow

## League / season catalog

GameSheet’s live season-directory search is partner-restricted, so MyHockeyHub ships a periodically refreshed snapshot at [`data/seasons.json`](data/seasons.json). The app searches that local file in the browser; normal users do **not** scrape GameSheet.

Search ranking favors exact names, starts-with/text matches, explicit acronyms already present in the source name, and current/recent seasons. Inferred acronyms are only used as a lower-confidence fallback. If a newly created season is not in the snapshot yet, users can still open it directly with its GameSheet season URL or season ID.

See [`data/README.md`](data/README.md) for the catalog maintenance notes.

## App-shell development

The new structure stays intentionally lightweight: static HTML, CSS, and JavaScript with a small esbuild-based build step. There is still no application server, login system, or MyHockeyHub database.

```bash
npm install
npm run check
npm test
npm run build
npm run verify
```

`npm run build` creates the deployable site in `dist/`. The generated primary app HTML has no inline JavaScript or `<style>` block; the V3.6 behavioral baseline is extracted and minified into reusable browser-cacheable assets while the code is progressively modularized.

The build currently emits:

```text
dist/
  index.html          # MyHockeyHub home
  app/index.html      # primary app
  assets/             # app/site CSS and JavaScript
  data/               # local season catalog
  debug/              # sanitized replay fixtures for explicit debug mode
  versions.html       # version history
  v*.html             # preserved historical versions
```

A lightweight router keeps top-level app views in the URL (`?view=team`, `venues`, `players`, or `schedule`) and supports browser back/forward navigation. The app also has a Home control back to the root page.

See [`docs/app-shell.md`](docs/app-shell.md) for the migration design and transitional details.

## CI and external data

GitHub Actions validates and builds the app without calling GameSheet. Public GameSheet endpoints can be subject to Cloudflare/bot protection, so CI does not depend on live endpoint access. Regression tests and live-score simulations use sanitized fixtures/mocks.

For an explicit local schema check, run:

```bash
npm run probe:schema -- --season 15111
```

or pass a public HTTPS endpoint with `--url`. The schema probe is intentionally local-only and is never invoked by CI.

## Live scores and replay testing

The app-shell preview now routes live refresh through a dedicated service with overlap protection, 30-second polling, page-visibility awareness, and immediate refresh when connectivity returns. The production V3.6 implementation remains unchanged until the app-shell work is approved.

Append `?debug=1` to the preview app URL to open the diagnostics panel. It shows polling state, last refresh/error state, broadcaster-link counts, and a **fixture replay** control. The replay walks a local fake game through scheduled → live score changes → final so score-state behavior can be exercised even when no real game is live. Replay data is local and never writes to GameSheet.

## Help and feedback

The **?** button in the app opens quick help and links to the full [FAQ](FAQ.md). It also offers two ways to send feedback:

- **Build a report in the app:** enter a plain-language summary and description. MyHockeyHub adds basic app context and opens a pre-filled GitHub issue for review.
- **Use the guided GitHub form:** a short issue form asks only for useful information; no deep technical knowledge is expected.

The static app does not upload screenshots directly to GitHub. After GitHub opens, users can paste or drag images into the issue before submitting. A GitHub account is required to submit an issue.

## Privacy and local data

MyHockeyHub has no user accounts or application database. Preferences such as selected season, My Teams, favorite venues, followed players, and theme are stored in the browser with `localStorage`. They are device/browser specific and disappear if site data is cleared.

The optional feedback report can include basic context such as app version, current view, league/season, page URL, browser description, and viewport size. It does **not** include saved teams, followed players, or other personal preferences.

## Version highlights

- **V1** — original schedule/rink viewer
- **V2** — richer cards and in-app game stats
- **V3** — My Teams, Venues, Players, and Schedule product model
- **V3.2.x** — player details, accurate rosters, appearance/settings, event ordering
- **V3.3** — compact scoreboard, box score, timeline play-by-play
- **V3.4** — multiple My Teams and stale-live cleanup
- **V3.4.2** — clearer Add Players multi-selection
- **V3.5** — searchable league/season catalog
- **V3.6** — first-run league selection, Help, and feedback/reporting

## Data quality

MyHockeyHub reflects public source data. Youth-hockey records can occasionally be incomplete, duplicated, stale, or incorrectly left in a Live state. MyHockeyHub may infer presentation state (for example, treating a Live game older than 24 hours as stale), but it does not rewrite the source record.

## License

This project is licensed under the [MIT License](LICENSE).

GameSheet, team names, team logos, and league data remain the property of their respective owners. Their appearance here is for identification and display of publicly available sports information.
