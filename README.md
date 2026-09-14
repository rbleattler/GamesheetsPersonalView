# MyHockeyHub

MyHockeyHub is a mobile-first hockey schedule, scores, and stats viewer built around publicly available GameSheet data. It is designed for families and fans who want a simpler personal view of the league information they already care about.

> **Independent project:** MyHockeyHub is not affiliated with, endorsed by, sponsored by, or operated by GameSheet.

## Open the app

- **Stable latest version:** https://rbleattler.com/GamesheetsPersonalView/gamesheets_plus.html
- **Version history:** https://rbleattler.com/GamesheetsPersonalView/
- **Current numbered version:** `v3.6.html`

The stable URL is the one to share. First-time visitors are asked to choose a league/season before the app loads; returning users keep their saved selection.

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

## Quick start

1. Open the stable URL.
2. Choose your league or season.
3. Open **My Teams** and add the teams you care about (division first, then team).
4. Use **Players** to follow individuals or browse a saved team roster.
5. Star venues from game cards if you want rink-focused schedules.
6. Use **Schedule** for the full league view and filters.
7. Tap **?** beside the menu whenever you need help or want to send feedback.

## League / season catalog

GameSheet’s live season-directory search is partner-restricted, so MyHockeyHub ships a periodically refreshed snapshot at [`data/seasons.json`](data/seasons.json). The app searches that local file in the browser; normal users do **not** scrape GameSheet.

Search ranking favors exact names, starts-with/text matches, explicit acronyms already present in the source name, and current/recent seasons. Inferred acronyms are only used as a lower-confidence fallback. If a newly created season is not in the snapshot yet, users can still open it directly with its GameSheet season URL or season ID.

See [`data/README.md`](data/README.md) for the catalog maintenance notes.

## Help and feedback

The **?** button in the app opens quick help and links to the full [FAQ](FAQ.md). It also offers two ways to send feedback:

- **Build a report in the app:** enter a plain-language summary and description. MyHockeyHub adds basic app context and opens a pre-filled GitHub issue for review.
- **Use the guided GitHub form:** a short issue form asks only for useful information; no deep technical knowledge is expected.

The static app does not upload screenshots directly to GitHub. After GitHub opens, users can paste or drag images into the issue before submitting. A GitHub account is required to submit an issue.

## Privacy and local data

MyHockeyHub has no user accounts or application database. Preferences such as selected season, My Teams, favorite venues, followed players, and theme are stored in the browser with `localStorage`. They are device/browser specific and disappear if site data is cleared.

The optional feedback report can include basic context such as app version, current view, league/season, page URL, browser description, and viewport size. It does **not** include saved teams, followed players, or other personal preferences.

## How it is built

The project intentionally stays simple:

- Static HTML, CSS, and JavaScript
- GitHub Pages hosting
- Public GameSheet/`gamesheetstats.com` data fetched in the browser
- No application server
- No login system
- No MyHockeyHub database

Prior numbered HTML versions remain in the repository so the project’s evolution can be inspected or compared.

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
