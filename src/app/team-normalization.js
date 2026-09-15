(() => {
  'use strict';

  function normalizedStatus(game) {
    return String(game?.status || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
  }

  function isCompletedGame(game) {
    return normalizedStatus(game).startsWith('final');
  }

  function isLiveGame(game) {
    const status = normalizedStatus(game);
    return status === 'live' || status === 'playing' || status === 'active' ||
      status.includes('in progress') || status.startsWith('period ');
  }

  function gameDate(game) {
    return new Date(game?.timeStampZulu || `${game?.date || ''} ${game?.time || ''}`);
  }

  function isStaleLiveGame(game, now = new Date()) {
    const date = gameDate(game);
    return isLiveGame(game) && Number.isFinite(+date) && (+now - +date) > 24 * 60 * 60 * 1000;
  }

  function sideForTeam(game, teamId) {
    const id = String(teamId || '');
    if (!id) return '';
    if (String(game?.home?.id ?? '') === id) return 'home';
    if (String(game?.visitor?.id ?? '') === id) return 'visitor';
    return '';
  }

  function finiteOrNull(value) {
    if (value == null || value === '' || value === '—') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function emptySplit() {
    return { gamesPlayed: 0, wins: 0, losses: 0, ties: 0, goalsFor: 0, goalsAgainst: 0 };
  }

  // Full-season team dashboard model. `games` is the app's already-normalized,
  // already-deduped season game list (the same shape as state.games); this
  // function still defensively dedupes by gameId so callers can't accidentally
  // double-count a game that appears twice in an input array.
  function teamSeasonSummary(teamId, games, { now = new Date() } = {}) {
    const id = String(teamId || '');
    const seenKeys = new Set();
    const teamGames = [];
    for (const game of games || []) {
      const key = String(game?.gameId ?? '') || `${game?.timeStampZulu || ''}|${game?.home?.id || ''}|${game?.visitor?.id || ''}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const side = sideForTeam(game, id);
      if (!side) continue;
      teamGames.push({ game, side });
    }

    const completed = teamGames
      .filter(({ game }) => isCompletedGame(game))
      .sort((a, b) => gameDate(a.game) - gameDate(b.game));
    const upcoming = teamGames
      .filter(({ game }) => !isCompletedGame(game) && !isStaleLiveGame(game, now) && (isLiveGame(game) || gameDate(game) >= now))
      .sort((a, b) => gameDate(a.game) - gameDate(b.game));

    let wins = 0, losses = 0, ties = 0, goalsFor = 0, goalsAgainst = 0;
    let pimTotal = 0, pimGamesCounted = 0;
    let sogTotal = 0, sogGamesCounted = 0;
    const home = emptySplit();
    const away = emptySplit();
    const results = [];

    for (const { game, side } of completed) {
      const team = game?.[side] || {};
      const opponent = game?.[side === 'home' ? 'visitor' : 'home'] || {};
      const gf = finiteOrNull(team.goals) ?? 0;
      const ga = finiteOrNull(opponent.goals) ?? 0;
      goalsFor += gf;
      goalsAgainst += ga;

      let result = 'T';
      if (gf > ga) { wins++; result = 'W'; }
      else if (gf < ga) { losses++; result = 'L'; }
      else ties++;
      results.push(result);

      const split = side === 'home' ? home : away;
      split.gamesPlayed++;
      split.goalsFor += gf;
      split.goalsAgainst += ga;
      if (result === 'W') split.wins++;
      else if (result === 'L') split.losses++;
      else split.ties++;

      const pimValue = finiteOrNull(team.pim ?? team.penaltyMinutes);
      if (pimValue != null) { pimTotal += pimValue; pimGamesCounted++; }

      const sogValue = finiteOrNull(team.shots ?? team.sog);
      if (sogValue != null) { sogTotal += sogValue; sogGamesCounted++; }
    }

    const gamesPlayed = completed.length;
    const perGame = (total, count) => (count > 0 ? total / count : null);

    let streakResult = null, streakCount = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (streakResult == null) { streakResult = results[i]; streakCount = 1; continue; }
      if (results[i] !== streakResult) break;
      streakCount++;
    }

    return {
      teamId: id,
      gamesPlayed,
      wins,
      losses,
      ties,
      goalsFor,
      goalsAgainst,
      goalsForPerGame: perGame(goalsFor, gamesPlayed),
      goalsAgainstPerGame: perGame(goalsAgainst, gamesPlayed),
      pim: pimGamesCounted > 0 ? pimTotal : null,
      pimPerGame: pimGamesCounted > 0 ? pimTotal / pimGamesCounted : null,
      pimGamesCounted,
      sog: sogGamesCounted > 0 ? sogTotal : null,
      sogPerGame: sogGamesCounted > 0 ? sogTotal / sogGamesCounted : null,
      sogGamesCounted,
      streak: { result: streakResult, count: streakCount },
      nextGame: upcoming[0]?.game || null,
      home,
      away
    };
  }

  globalThis.MyHockeyHubTeamNormalization = {
    isCompletedGame,
    isLiveGame,
    isStaleLiveGame,
    sideForTeam,
    teamSeasonSummary
  };
})();
