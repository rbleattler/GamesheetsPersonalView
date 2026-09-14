# MyHockeyHub FAQ / How-to

This is the practical guide for the things that are useful but not always obvious on a compact phone screen. In the app, tap **?** beside the hamburger menu for quick help and feedback options.

## I’m new. Where do I start?

Open the stable MyHockeyHub URL. On a first visit, MyHockeyHub asks you to choose a **league / season** before loading the schedule. After that, add your teams from **My Teams** and optionally follow players or favorite venues.

## How do I find or change leagues / seasons?

First-time users get the finder automatically. Later, open **Settings → Find league / season**. Results filter as you type. You can search by full name, part of a name, season name, familiar acronym, or numeric season ID.

Direct text matches rank first. Explicit acronyms in GameSheet names are recognized, and MyHockeyHub can cautiously infer common-style acronyms when needed—for example, **DVHL** can suggest **Delaware Valley Hockey League**. Inferred acronym results are intentionally lower-confidence.

## What if my league or season is missing?

The searchable catalog is refreshed periodically rather than live. If a brand-new season is not present yet, use the manual GameSheet season URL / season ID field at the bottom of the finder.

## How do I add a team to My Teams?

1. Open **My Teams**.
2. Tap **Manage** or **Add**.
3. Choose the **Division** first.
4. Choose the **Team**.
5. Tap **Add to My Teams**.

You can save multiple teams for families with players in different divisions or organizations.

## How do I switch between My Teams?

Use the team chips near the top of **My Teams**. The selected team controls that page’s next game, recent results, upcoming schedule, and default roster.

**My Teams only** filters in Schedule or Venues include games from any saved My Team, not just the currently selected one.

## How do I follow a player?

The easiest path is **Players → Add Players**. Choose a division/team, check one or more players, then tap **Add Player(s)**. Already-followed players are labeled **Following**.

You can also use the star on **My Teams Roster** or in a game’s **Players** tab. A filled **★** means that player is followed.

## How does My Teams Roster work?

Open **Players → My Teams Roster**. If you saved more than one team, choose the team from the roster selector. The roster is based on actual GameSheet game-lineup data and is enriched with standings/stat data where available.

## How do I favorite a venue?

Tap the **☆** beside a rink on a game card. A filled **★** means it is saved. Favorite venues appear under **Venues**, where you can quickly see games there.

## How do I open game stats?

For completed or live games, tap the game card or **Stats**. The drawer can include score, shots, PIM, summary timeline, scoring, penalties, box score, and players. The **GameSheet ↗** link opens the original source page.

## Why did a GameSheet “Live” game disappear?

MyHockeyHub treats a game still marked Live more than 24 hours after its scheduled start as **stale**. These are often test games or games that were never properly ended on the scoring device. Stale games are hidden by default.

To see them, open **Settings → Show stale games**.

## Why might a stat, player, or event be missing?

MyHockeyHub can only show what is available in the public source data. Missing venue information, incomplete lineups, missing assists, incomplete player stats, duplicates, and stale statuses can all happen. MyHockeyHub avoids inventing source data.

## What is the ? button?

The **?** button beside the hamburger menu opens **Help & feedback**. It includes quick reminders, a link to this full FAQ, and two ways to send feedback.

## How do I report a problem or suggest something?

Tap **? → Report a problem or suggestion**. Describe what you saw in plain language. A short summary and a description are enough. Optional fields let you add what you expected and steps to reproduce.

MyHockeyHub can attach basic context to the draft: app version, current view, league/season, page URL, browser description, and screen size. It does not include your saved teams or followed players.

Tap **Continue to GitHub** to review the pre-filled issue before submitting. You can also choose the **guided GitHub form** instead.

## Can I attach screenshots?

Yes, but the static MyHockeyHub site does not upload them directly. After GitHub opens, paste or drag screenshots into the issue before submitting. This avoids requiring MyHockeyHub to hold a GitHub token or ask for repository authorization.

## Do I need a GitHub account to send feedback?

A GitHub account is required to submit an issue. Reading the app and FAQ does not require one.

## How do I change light/dark mode?

Open **Settings → Appearance** and choose **Follow device**, **Dark**, or **Light**.

## Where are my preferences stored?

They are stored in your browser with `localStorage`. There is no MyHockeyHub account or server-side user profile, so settings do not automatically sync between devices or browsers.

## How do I reset everything?

Open **Settings → App data → Clear all MyHockeyHub data**. This removes locally saved teams, players, venues, added seasons, theme settings, and other MyHockeyHub preferences from that browser.

## What is gamesheets_plus.html?

It is the stable “latest version” URL. It can show first-run onboarding or a one-time What’s New message, then forwards to the current numbered version. Older versions stay available from the version-history page.

## Is MyHockeyHub affiliated with GameSheet?

No. MyHockeyHub is an independent project that presents publicly available data in a different interface. It is not affiliated with, endorsed by, sponsored by, or operated by GameSheet.
