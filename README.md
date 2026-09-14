# MyHockeyHub

MyHockeyHub is a mobile-first personal hockey schedule, scores, and stats viewer built around publicly available GameSheet data.

It started as a simple way to make a very large league schedule easier to browse on a phone, then grew into a personalized view centered on the things a hockey family actually cares about: their teams, players, favorite venues, upcoming games, live scores, and game details.

> **Independent project:** MyHockeyHub is not affiliated with, endorsed by, sponsored by, or operated by GameSheet.

## Live site

- **Stable latest version:** https://rbleattler.com/GamesheetsPersonalView/gamesheets_plus.html
- **Version history / project evolution:** https://rbleattler.com/GamesheetsPersonalView/
- **Current numbered version:** `v3.5.html`

The stable `gamesheets_plus.html` URL is intended to remain shareable over time. It points users to the current version and can show a one-time “What’s new” message when the version changes.

## What it does

MyHockeyHub currently supports:

- Full-season schedule browsing and search
- Type-ahead league / season discovery from a periodically refreshed local catalog
- Conservative acronym fallback for familiar league abbreviations such as DVHL
- Division, team, date-range, rink, and status filtering
- Multiple **My Teams** for families with players on different teams
- Division-first team selection
- Favorite venues and venue-focused schedules
- **My Players** with followed-player stats and recent game activity
- Team roster browsing
- Live-score polling for games that are actually in progress
- Automatic hiding of likely stale “Live” games more than 24 hours old
- Game stats including scoring, penalties, players, shots, PIM, and box score
- Chronological play-by-play grouped by period
- Expandable goal and penalty details
- Direct links back to the corresponding GameSheet game
- Dark, light, or follow-device appearance
- Local preference persistence without accounts or a backend

## How the app is built

The project intentionally stays simple:

- Static HTML, CSS, and JavaScript
- Hosted with GitHub Pages
- No application server
- No user accounts
- No database owned by MyHockeyHub
- Preferences are stored in the browser with `localStorage`

The application reads public GameSheet/`gamesheetstats.com` data in the browser and renders it into a more personalized mobile experience.

## League / season catalog

The app cannot use GameSheet’s partner-only season-directory search API, so MyHockeyHub ships a periodically refreshed snapshot at [`data/seasons.json`](data/seasons.json). The finder searches that file locally in the browser; normal app use does not scrape season IDs.

Search ranking favors exact names, starts-with and token matches, explicit acronyms already present in a season name, and current/recent seasons. Generated acronyms are deliberately conservative: for example, **Delaware Valley Hockey League** can be found with **DVHL**, but inferred acronym matches rank below direct textual matches and require an exact acronym match.

The snapshot can lag newly created seasons, so the finder retains a direct GameSheet season ID / URL fallback.

## Privacy and local data

Saved settings such as My Teams, favorite venues, followed players, selected season, and appearance preferences are stored locally in the browser.

That means:

- Preferences are device/browser specific
- Clearing browser/site data removes them
- MyHockeyHub does not require an account to remember preferences
- Settings includes a **Clear all MyHockeyHub data** option

## Versions

This repository intentionally keeps prior versions available so design and behavior can be compared over time.

The root `index.html` contains the visual version history and links to each preserved version.

Major milestones include:

- **V1** — original public schedule viewer
- **V2** — redesigned game cards and game-stat drawer
- **V3** — personalization model: My Team, Venues, Players, Schedule
- **V3.2.x** — player detail, accurate rosters, appearance/settings, event ordering
- **V3.3** — compact scoreboard, box score, and timeline-style play-by-play
- **V3.4** — multiple My Teams and stale-live-game handling
- **V3.4.1** — natural age/tier ordering for division selectors
- **V3.4.2** — explicit Add Players multi-selection flow
- **V3.5** — searchable league/season catalog with cautious acronym matching

## Quick start

1. Open the stable latest-version URL.
2. Use **Settings → Find league / season** if you need a different league or season.
3. Choose **My Teams** and add a team by first selecting its division, then the team.
4. Add additional teams if more than one family member plays.
5. Star venues you care about.
6. Open **Players** to browse a saved team roster or follow individual players.
7. Use **Schedule** for league-wide searching and filtering.
8. Tap completed/live games to open detailed game stats.

## Help / FAQ

Some features are intentionally compact on mobile and are not immediately obvious. See [FAQ.md](FAQ.md) for practical how-to guidance, including:

- How to find or change leagues / seasons
- How to add multiple My Teams
- How to follow players from the Add Players multi-select screen
- How My Teams Roster works
- How venue favorites work
- Why some “Live” games disappear
- How to show stale games
- Where preferences are stored
- How to reset the app

## Data quality notes

MyHockeyHub reflects the public data that GameSheet reports. Youth-hockey data can occasionally be incomplete or stale—for example, a game may remain marked Live if the scorer’s device never properly closed it. MyHockeyHub makes a few presentation-level inferences, such as classifying a Live game more than 24 hours past its start time as **stale**, but it does not alter the underlying source data.

## License

This project is licensed under the [MIT License](LICENSE).

GameSheet, team names, team logos, and league data remain the property of their respective owners. Their appearance here is for identification and display of publicly available hockey information.
