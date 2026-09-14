# MyHockeyHub FAQ / How-to

This guide covers the parts of MyHockeyHub that are useful but not always obvious from a compact mobile interface.

## How do I find or change leagues / seasons?

Open **Settings → Find league / season**. Start typing a league name, part of a name, a season name, familiar acronym, or season ID. Results update immediately as you type.

Direct text matches rank first. MyHockeyHub can also recognize explicit acronyms in GameSheet names and cautiously infer a familiar acronym when needed—for example, **DVHL** can suggest **Delaware Valley Hockey League**. Inferred acronyms are suggestions rather than authoritative league metadata and intentionally rank below direct name matches.

The catalog is refreshed periodically rather than live. If a new season is missing, enter its GameSheet season ID or season URL in the manual field at the bottom of the finder.

## How do I add a team to My Teams?

1. Open **My Teams**.
2. Tap **Manage** or **Add**.
3. Choose the **Division** first.
4. Choose the **Team** from that division.
5. Tap **Add to My Teams**.

You can save more than one team. This is useful for families with multiple players on different age levels or teams.

## How do I switch between My Teams?

On the **My Teams** screen, use the team chips near the top of the view. The selected team becomes the active team for that page.

The active team controls the team-focused schedule, recent results, next game, and the default roster shown when you choose **Browse players**.

## What does “My Teams only” mean in Schedule or Venues?

It includes games involving **any** of your saved My Teams, not just the currently selected one.

## How do I follow a player?

There are several ways:

- Open **Players → Add Players**, check one or more players, then tap **Add Player(s)**. The picker shows a live selection count and includes **Select all** / **Clear** actions.
- Open **My Teams Roster** and tap the **☆ star** on a player card.
- Open a game’s **Players** tab and tap the **☆ star** beside a player.

A filled **★** elsewhere means the player is currently followed. In **Add Players**, already-followed players are labeled **Following** and cannot be selected again.

## What is My Players?

**My Players** is a saved list of individual players you care about across teams.

Player cards can show season stats and recent game activity. Tapping a player name opens more detailed information, including recent games and recorded goal/assist events where available.

## How does My Teams Roster work?

Open **Players**, then choose **My Teams Roster**.

If you have more than one My Team, use the **Team roster** selector to switch between them.

The roster is built from actual GameSheet game-lineup data for that specific team, then enriched with season standings/stat data where available.

## How do I favorite a venue?

Tap the **☆** beside a rink on a game card.

A filled **★** means the venue is saved. Saved venues appear under the **Venues** tab, where you can quickly see games happening there.

## What is the Venues view for?

It turns your saved rinks into quick schedule views. You can see games at those locations for Today, This Weekend, the Next 7 Days, or all upcoming games.

You can also choose **My Teams only** to show only games involving one of your saved teams.

## Why did a game that GameSheet says is Live disappear?

MyHockeyHub treats a game as **stale** when it is still reported as Live more than 24 hours after its scheduled start.

This usually means the game was never properly closed on the scoring device, was a test game, or contains stale source data.

Stale games are hidden by default so they do not look like real current live games.

## Can I see stale games anyway?

Yes.

1. Open the hamburger menu.
2. Open **Settings**.
3. Enable **Show stale games**.

When shown, stale games use a distinct stale treatment rather than appearing as normal live games.

## How do I open game stats?

For completed or live games, tap the game card or the **Stats** button.

The stats drawer includes:

- Score and team logos
- Shots on goal
- Penalty minutes
- Timeline-style game summary
- Scoring
- Penalties
- Box score
- Players

There is also a small **GameSheet ↗** link if you want to open the original GameSheet page.

## What does the Game Summary show?

The Summary is a chronological play-by-play of reported goals and penalties, grouped by period.

Goals use a goal-event icon such as **🚨**. Tapping an event expands more detail such as period, time, scorer, assists, team, and score-after where available.

## Why might a stat or event be missing?

MyHockeyHub can only display what is present in the public source data.

Youth-hockey data is sometimes incomplete. Examples include:

- Missing venue
- Missing player/team association in a standings response
- Missing assists
- Games left in Live status
- Incomplete player stats

MyHockeyHub avoids inventing source data. It may infer presentation state—such as “stale live”—but does not change the underlying GameSheet record.

## How do I change light/dark mode?

Open **Settings → Appearance** and choose:

- **Follow device**
- **Dark**
- **Light**

## Where are my preferences stored?

They are stored in your browser using `localStorage`.

There is no MyHockeyHub account or server-side user profile.

As a result, preferences do not automatically sync between devices or browsers.

## How do I reset everything?

Open **Settings → App data → Clear all MyHockeyHub data**.

This removes saved teams, players, venues, custom seasons, theme settings, and other local MyHockeyHub preferences from that browser.

## What is gamesheets_plus.html?

It is the stable “latest version” URL. Instead of requiring people to bookmark a specific numbered release, it forwards users to the current MyHockeyHub version and can show a one-time What’s New screen after an upgrade.

Older versions remain available from the project’s version-history page.

## Is MyHockeyHub affiliated with GameSheet?

No.

MyHockeyHub is an independent project that presents publicly available hockey data in a different interface. It is not affiliated with, endorsed by, sponsored by, or operated by GameSheet.
