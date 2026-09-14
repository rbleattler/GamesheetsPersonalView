# Season catalog

`seasons.json` is a manually refreshed snapshot of public GameSheet season metadata used by MyHockeyHub’s client-side league/season finder.

It is intentionally static because GameSheet’s official season-directory search endpoint is partner-restricted. Normal MyHockeyHub users do **not** scrape GameSheet; they search this local file in the browser.

The catalog can include source-side test, demo, duplicate, or stale records because it reflects discovered public season metadata. The app ranks likely useful/current hockey seasons higher and keeps a manual season ID/URL fallback for seasons added after the last refresh.

When refreshing the snapshot, preserve at least: `SeasonID`, `Sport`, `LeagueName`, `SeasonName`, `StartDate`, `EndDate`, and `StatsUrl`.
