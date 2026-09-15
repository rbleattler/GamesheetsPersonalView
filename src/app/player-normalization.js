(() => {
  'use strict';

  function numberOrZero(value) {
    return value == null || value === '' ? 0 : Number(value);
  }

  function finiteNumber(value) {
    if (value == null || value === '' || value === '—') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function durationMinutes(value) {
    if (value == null || value === '' || value === '—') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const text = String(value).trim();
    if (!text) return null;
    if (/^\d+(?::\d+){1,2}$/.test(text)) {
      const parts = text.split(':').map(Number);
      if (parts.length === 2) return parts[0] + parts[1] / 60;
      return parts[0] * 60 + parts[1] + parts[2] / 60;
    }
    const number = Number(text.replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(number) ? number : null;
  }

  function playerName(player) {
    if (!player) return '';
    const first = player.firstName || '';
    const last = player.lastName || '';
    const name = (player.name || player.title || `${first} ${last}`).trim();
    if (name) return name;
    const number = player.number ?? player.jersey ?? '';
    return number !== '' ? `#${number}` : '';
  }

  function canonicalPosition(value, kind = '') {
    const raw = String(value || '').trim();
    const lower = raw.toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const lowerKind = String(kind || '').toLowerCase();

    if (!lower) {
      if (lowerKind.includes('goalie')) return 'Goalie';
      if (lowerKind.includes('skater')) return 'Skater';
      return '';
    }

    if (/^(g|goalie|goaltender|goal keeper|goalkeeper)$/.test(lower) || lower.includes('goalie') || lower.includes('goaltender')) return 'Goalie';
    if (/^(d|ld|rd|defense|defence|defenseman|defenceman|defender)$/.test(lower) || /defen[cs]/.test(lower)) return 'Defense';
    if (/^(f|c|lw|rw|forward|center|centre|wing|left wing|right wing)$/.test(lower) || lower.includes('forward') || lower.includes('center') || lower.includes('centre') || lower.includes('wing')) return 'Forward';
    if (/^(s|skater)$/.test(lower)) return 'Skater';

    const americanized = lower.replace(/defence/g, 'defense').replace(/defenceman/g, 'defenseman');
    return americanized.charAt(0).toUpperCase() + americanized.slice(1);
  }

  function positionCode(position, kind = '') {
    const canonical = canonicalPosition(position, kind);
    if (canonical === 'Goalie') return 'G';
    if (canonical === 'Defense') return 'D';
    if (canonical === 'Forward') return 'F';
    return 'S';
  }

  function goalieComponentStats(row, player, stats) {
    let ga = finiteNumber(
      stats.ga ?? stats.goalsAgainst ?? stats.goalsAllowed ??
      player.ga ?? player.goalsAgainst ?? player.goalsAllowed ??
      row.ga ?? row.goalsAgainst ?? row.goalsAllowed
    );
    let sa = finiteNumber(
      stats.sa ?? stats.shotsAgainst ??
      player.sa ?? player.shotsAgainst ??
      row.sa ?? row.shotsAgainst
    );
    let saves = finiteNumber(
      stats.saves ?? stats.sv ?? stats.save ??
      player.saves ?? player.sv ?? player.save ??
      row.saves ?? row.sv ?? row.save
    );
    const minutes = durationMinutes(
      stats.min ?? stats.minutes ?? stats.minutesPlayed ?? stats.timePlayed ?? stats.toi ??
      player.min ?? player.minutes ?? player.minutesPlayed ?? player.timePlayed ?? player.toi ??
      row.min ?? row.minutes ?? row.minutesPlayed ?? row.timePlayed ?? row.toi
    );
    const providedGaa = finiteNumber(stats.gaa ?? player.gaa ?? row.gaa);
    let providedSvPct = finiteNumber(
      stats.savePct ?? stats.svPct ?? stats.svPercentage ?? stats.savePercentage ??
      player.savePct ?? player.svPct ?? player.svPercentage ?? player.savePercentage ??
      row.savePct ?? row.svPct ?? row.svPercentage ?? row.savePercentage
    );
    if (providedSvPct != null && providedSvPct > 1 && providedSvPct <= 100) providedSvPct /= 100;
    const standardGameMinutes = durationMinutes(
      stats.gameLength ?? stats.standardGameLength ?? stats.regulationMinutes ??
      player.gameLength ?? player.standardGameLength ?? player.regulationMinutes ??
      row.gameLength ?? row.standardGameLength ?? row.regulationMinutes
    );

    if (sa == null && saves != null && ga != null) sa = saves + ga;
    if (saves == null && sa != null && ga != null) saves = Math.max(0, sa - ga);
    if (ga == null && sa != null && saves != null) ga = Math.max(0, sa - saves);

    return { ga, sa, saves, minutes, providedGaa, providedSvPct, standardGameMinutes };
  }

  function goalieMetrics(row, player, stats, { standardGameMinutes = null } = {}) {
    const components = goalieComponentStats(row, player, stats);
    const gameLength = durationMinutes(standardGameMinutes) ?? components.standardGameMinutes;
    const gaa = components.providedGaa ?? (
      components.ga != null && components.minutes > 0 && gameLength > 0
        ? components.ga * (gameLength / components.minutes)
        : null
    );
    const svPct = components.providedSvPct ?? (
      components.saves != null && components.sa > 0
        ? components.saves / components.sa
        : components.saves != null && components.ga != null && components.saves + components.ga > 0
          ? components.saves / (components.saves + components.ga)
          : null
    );
    return { ...components, gameLength, gaa, svPct };
  }

  function statPlayer(player) {
    if (!player || typeof player !== 'object') return {};
    const stats = player.stats || {};
    return {
      ...player,
      number: player.number ?? player.jersey ?? stats.number ?? '',
      g: stats.g ?? player.g ?? 0,
      a: stats.a ?? player.a ?? 0,
      pts: stats.pts ?? player.pts ?? ((Number(stats.g) || 0) + (Number(stats.a) || 0)),
      pim: stats.pim ?? player.pim ?? 0
    };
  }

  function normalizePlayer(raw, {
    kind = '',
    team = {},
    division = {},
    teamId = '',
    divisionId = '',
    standardGameMinutes = null
  } = {}) {
    const row = raw || {};
    const player = row.player || row.skater || row.goalie || row;
    const stats = row.stats || player.stats || row;
    const rowTeam = row.team || player.team || team || {};
    const rowDivision = row.division || player.division || division || {};
    const rawPosition = player.position ?? row.position ?? '';
    const position = canonicalPosition(rawPosition, kind);
    const inferredKind = kind || (position === 'Goalie' ? 'goalie' : 'skater');
    const displayPosition = position || canonicalPosition('', inferredKind);

    const normalized = {
      id: String(player.id ?? row.playerId ?? row.id ?? ''),
      name: playerName(player) || playerName(row),
      kind: inferredKind,
      number: player.number ?? player.jersey ?? row.number ?? row.jersey ?? '',
      position: displayPosition,
      teamId: String(rowTeam.id ?? row.teamId ?? player.teamId ?? teamId ?? ''),
      teamTitle: rowTeam.title || rowTeam.name || row.teamTitle || row.teamName || team?.title || '',
      teamLogo: rowTeam.logo || row.teamLogo || team?.logo || '',
      teamAbbr: rowTeam.abbr || row.teamAbbr || team?.abbr || '',
      divisionId: String(rowDivision.id ?? divisionId ?? ''),
      divisionTitle: rowDivision.title || division?.title || '',
      photo: player.photoURL || player.photo || row.photoURL || row.photo || '',
      g: numberOrZero(stats.g ?? stats.goals),
      a: numberOrZero(stats.a ?? stats.assists),
      pts: numberOrZero(stats.pts ?? stats.points ?? ((Number(stats.g) || 0) + (Number(stats.a) || 0))),
      pim: numberOrZero(stats.pim),
      sog: stats.sog ?? stats.shots ?? row.sog ?? row.shots ?? '—',
      gaa: stats.gaa ?? row.gaa ?? '—',
      svPct: stats.savePct ?? stats.svPct ?? stats.svPercentage ?? row.savePct ?? '—',
      w: stats.w ?? stats.wins ?? row.wins ?? '—',
      so: stats.so ?? stats.shutouts ?? row.shutouts ?? '—',
      saves: stats.saves ?? stats.sv ?? player.saves ?? player.sv ?? row.saves ?? row.sv ?? '—'
    };

    if (inferredKind === 'goalie' || displayPosition === 'Goalie') {
      const metrics = goalieMetrics(row, player, stats, { standardGameMinutes });
      normalized.ga = metrics.ga ?? '—';
      normalized.sa = metrics.sa ?? '—';
      normalized.minutes = metrics.minutes ?? '—';
      normalized.gameLength = metrics.gameLength ?? '—';
      normalized.saves = metrics.saves ?? '—';
      normalized.gaa = metrics.gaa ?? '—';
      normalized.svPct = metrics.svPct ?? '—';
    }

    return normalized;
  }

  function normalizeStandingPlayer(raw, options = {}) {
    const row = raw || {};
    const player = row.player || row.skater || row.goalie || row;
    const stats = row.stats || player.stats || row;
    return {
      ...normalizePlayer(row, options),
      g: numberOrZero(stats.g ?? stats.goals),
      a: numberOrZero(stats.a ?? stats.assists),
      pts: numberOrZero(stats.pts ?? stats.points),
      pim: numberOrZero(stats.pim),
      sog: numberOrZero(stats.sog ?? stats.shots)
    };
  }

  function inferGameLength(goalies, { scope = 'season' } = {}) {
    const explicit = [];
    const derived = [];
    for (const goalie of goalies || []) {
      const gameLength = durationMinutes(goalie?.gameLength);
      if (gameLength > 0) explicit.push(gameLength);
      const gaa = finiteNumber(goalie?.gaa);
      const ga = finiteNumber(goalie?.ga);
      const minutes = durationMinutes(goalie?.minutes);
      if (gaa != null && gaa > 0 && ga != null && ga > 0 && minutes > 0) {
        const candidate = gaa * minutes / ga;
        if (candidate >= 10 && candidate <= 120) derived.push(candidate);
      }
    }
    const candidates = explicit.length ? explicit : derived;
    if (candidates.length) {
      const sorted = [...candidates].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    }
    if (scope === 'game') {
      const byTeam = new Map();
      for (const goalie of goalies || []) {
        const minutes = durationMinutes(goalie?.minutes);
        if (!(minutes > 0)) continue;
        const key = String(goalie?.teamId || goalie?._side || 'game');
        byTeam.set(key, (byTeam.get(key) || 0) + minutes);
      }
      const totals = [...byTeam.values()].filter(value => value >= 10 && value <= 120).sort((a, b) => a - b);
      if (totals.length) return totals[totals.length - 1];
    }
    return null;
  }

  function completeGoalieMetrics(players, { scope = 'season' } = {}) {
    const rows = (players || []).map(player => ({ ...player }));
    const groups = new Map();
    for (const player of rows) {
      if (positionCode(player.position, player.kind) !== 'G') continue;
      const key = scope === 'game' ? 'game' : String(player.divisionId || 'division');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(player);
    }

    for (const goalies of groups.values()) {
      const gameLength = inferGameLength(goalies, { scope });
      for (const goalie of goalies) {
        let ga = finiteNumber(goalie.ga);
        let sa = finiteNumber(goalie.sa);
        let saves = finiteNumber(goalie.saves);
        const minutes = durationMinutes(goalie.minutes);
        if (sa == null && saves != null && ga != null) sa = saves + ga;
        if (saves == null && sa != null && ga != null) saves = Math.max(0, sa - ga);
        if (ga == null && sa != null && saves != null) ga = Math.max(0, sa - saves);
        if (goalie.gaa == null || goalie.gaa === '' || goalie.gaa === '—') {
          if (ga != null && minutes > 0 && gameLength > 0) goalie.gaa = ga * (gameLength / minutes);
        }
        if (goalie.svPct == null || goalie.svPct === '' || goalie.svPct === '—') {
          if (saves != null && sa > 0) goalie.svPct = saves / sa;
          else if (saves != null && ga != null && saves + ga > 0) goalie.svPct = saves / (saves + ga);
        }
        if (saves != null) goalie.saves = saves;
        if (sa != null) goalie.sa = sa;
        if (ga != null && (goalie.ga == null || goalie.ga === '' || goalie.ga === '—')) goalie.ga = ga;
        if (gameLength > 0 && (goalie.gameLength == null || goalie.gameLength === '' || goalie.gameLength === '—')) goalie.gameLength = gameLength;
      }
    }
    return rows;
  }

  function normalizeRoster(decodedGame, {
    side,
    team = {},
    division = {},
    divisionId = ''
  } = {}) {
    if (side !== 'home' && side !== 'visitor') return [];
    const players = decodedGame?.data?.[side]?.lineup?.players || [];
    return players
      .map(player => normalizePlayer(player, {
        team,
        teamId: team?.id,
        division,
        divisionId
      }))
      .filter(player => player.id && player.name);
  }

  function sideForTeam(game, teamId) {
    const id = String(teamId || '');
    if (!id) return '';
    if (String(game?.home?.id || '') === id) return 'home';
    if (String(game?.visitor?.id || '') === id) return 'visitor';
    return '';
  }

  function sideForPlayer(decodedGame, playerId) {
    const id = String(playerId || '');
    if (!id) return '';
    for (const side of ['visitor', 'home']) {
      const players = decodedGame?.data?.[side]?.lineup?.players || [];
      if (players.some(player => String(player?.id || '') === id)) return side;
    }
    return '';
  }

  function clock(value) {
    const parts = String(value || '').split(':');
    return parts.length === 3
      ? { period: `P${Number(parts[0]) || parts[0]}`, time: `${parts[1]}:${parts[2]}` }
      : { period: '', time: String(value || '') };
  }

  function playerEvents(decodedGame, playerId) {
    const id = String(playerId || '');
    if (!id) return [];
    const events = [];
    for (const event of Object.values(decodedGame?.events || {})) {
      if (!String(event?.type || '').includes('Goal')) continue;
      const gameClock = clock(event?.time?.clock);
      const scorer = event?.for?.scorer || {};
      const rawAssists = event?.for?.assist;
      const assists = Array.isArray(rawAssists) ? rawAssists : rawAssists ? [rawAssists] : [];
      if (String(scorer?.id || '') === id) {
        events.push({
          kind: 'Goal',
          period: gameClock.period,
          time: gameClock.time,
          detail: 'Goal'
        });
      }
      for (const assist of assists) {
        if (String(assist?.id || '') !== id) continue;
        events.push({
          kind: 'Assist',
          period: gameClock.period,
          time: gameClock.time,
          detail: `Assist on ${playerName(scorer) || 'goal'}`
        });
      }
    }
    const periodNumber = event => Number(String(event.period || '').replace(/\D/g, '')) || 0;
    const clockSeconds = event => {
      const parts = String(event.time || '').split(':').map(Number);
      return parts.length === 2 && parts.every(Number.isFinite) ? parts[0] * 60 + parts[1] : 0;
    };
    return events.sort((a, b) => periodNumber(a) - periodNumber(b) || clockSeconds(b) - clockSeconds(a));
  }

  function playerGameActivity(game, decodedGame, player, { teamId = player?.teamId || '' } = {}) {
    const playerId = String(player?.id || '');
    const side = sideForTeam(game, teamId) || sideForPlayer(decodedGame, playerId);
    if (!side) return null;
    const team = game?.[side] || {};
    const opponent = side === 'home' ? game?.visitor : game?.home;
    const raw = (decodedGame?.data?.[side]?.lineup?.players || [])
      .find(candidate => String(candidate?.id || '') === playerId);
    if (!raw) return null;
    const fallbackKind = player?.kind || (canonicalPosition(player?.position) === 'Goalie' ? 'goalie' : '');
    const normalized = normalizePlayer(raw, {
      kind: fallbackKind,
      team,
      teamId: team?.id,
      division: team?.division,
      divisionId: team?.division?.id
    });
    return {
      gameId: game?.gameId ?? game?.id ?? '',
      opponent: opponent?.title || 'Opponent',
      location: game?.location || '',
      kind: normalized.kind,
      g: normalized.g,
      a: normalized.a,
      pts: normalized.pts,
      pim: normalized.pim,
      sv: normalized.saves,
      gaa: normalized.gaa,
      svPct: normalized.svPct,
      ga: normalized.ga,
      sa: normalized.sa,
      minutes: normalized.minutes,
      events: playerEvents(decodedGame, playerId)
    };
  }

  function teamRosterFromGame(game, decodedGame, teamId, { divisionId = '', divisionTitle = '' } = {}) {
    const side = sideForTeam(game, teamId);
    if (!side) return [];
    const team = game?.[side] || {};
    const division = team?.division || { id: divisionId, title: divisionTitle };
    return normalizeRoster(decodedGame, {
      side,
      team,
      division,
      divisionId: division?.id || divisionId
    }).map(player => ({
      ...player,
      teamId: String(teamId || player.teamId || ''),
      teamTitle: player.teamTitle || team.title || '',
      teamLogo: player.teamLogo || team.logo || '',
      teamAbbr: player.teamAbbr || team.abbr || '',
      divisionId: String(player.divisionId || divisionId || ''),
      divisionTitle: player.divisionTitle || divisionTitle || division?.title || ''
    }));
  }

  const STAT_FIELDS = ['g', 'a', 'pts', 'pim', 'sog', 'gaa', 'svPct', 'w', 'so', 'saves', 'sa', 'ga', 'minutes', 'gameLength'];

  function isUsefulValue(value) {
    return value !== '' && value != null && value !== '—';
  }

  function fieldRichness(value) {
    return Object.entries(value || {}).filter(([key, item]) => !key.startsWith('_') && isUsefulValue(item)).length;
  }

  function formatGaa(value) {
    if (!isUsefulValue(value)) return '—';
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : String(value);
  }

  function formatSvPct(value) {
    if (!isUsefulValue(value)) return '—';
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    const pct = number > 1 ? number / 100 : number;
    return pct.toFixed(3).replace(/^0\./, '.').replace(/^-0\./, '-.');
  }

  // Season standings and per-game box scores describe different scopes of the
  // same player. `scope: 'season'` records (standings, roster fallback used as a
  // season proxy) are authoritative for headline stats and always win. `scope:
  // 'game'` records (a single game's lineup/box-score entry) may only fill stat
  // fields that are still unknown — they must never clobber real season stats,
  // and a later season record must still be free to overwrite a game-only guess.
  function mergePlayerRecord(existing, incoming, { scope = 'season' } = {}) {
    const merged = { ...existing };
    for (const [key, value] of Object.entries(incoming || {})) {
      if (STAT_FIELDS.includes(key)) continue;
      if (!isUsefulValue(merged[key]) && isUsefulValue(value)) merged[key] = value;
    }

    const hasSeasonStats = !!existing?._hasSeasonStats;
    if (scope === 'season') {
      for (const key of STAT_FIELDS) {
        if (isUsefulValue(incoming?.[key])) merged[key] = incoming[key];
      }
      merged._hasSeasonStats = true;
    } else {
      merged._lastGameStats = {};
      for (const key of STAT_FIELDS) {
        if (isUsefulValue(incoming?.[key])) merged._lastGameStats[key] = incoming[key];
      }
      if (!hasSeasonStats) {
        for (const key of STAT_FIELDS) {
          if (!isUsefulValue(merged[key]) && isUsefulValue(incoming?.[key])) merged[key] = incoming[key];
        }
      }
      merged._hasSeasonStats = hasSeasonStats;
    }

    const preferredPosition = canonicalPosition(incoming?.position, incoming?.kind);
    const existingPosition = canonicalPosition(existing?.position, existing?.kind);
    const specificPosition = position => ['Goalie', 'Defense', 'Forward'].includes(position);
    merged.position = specificPosition(existingPosition)
      ? existingPosition
      : specificPosition(preferredPosition)
        ? preferredPosition
        : existingPosition || preferredPosition || canonicalPosition('', merged.kind);
    if (merged.position === 'Goalie') merged.kind = 'goalie';

    return merged;
  }

  function dedupePlayers(players) {
    const useful = isUsefulValue;
    const richness = fieldRichness;
    const specificPosition = position => ['Goalie', 'Defense', 'Forward'].includes(position);
    const merge = (preferred, fallback) => {
      const merged = { ...preferred };
      for (const [key, value] of Object.entries(fallback || {})) {
        if (!useful(merged[key]) && useful(value)) merged[key] = value;
      }
      const preferredPosition = canonicalPosition(preferred?.position, preferred?.kind);
      const fallbackPosition = canonicalPosition(fallback?.position, fallback?.kind);
      merged.position = specificPosition(preferredPosition)
        ? preferredPosition
        : specificPosition(fallbackPosition)
          ? fallbackPosition
          : preferredPosition || fallbackPosition || canonicalPosition('', merged.kind);
      if (merged.position === 'Goalie') merged.kind = 'goalie';
      return merged;
    };

    const map = new Map();
    for (const player of players || []) {
      if (!player?.id) continue;
      const key = String(player.id);
      const normalized = { ...player, position: canonicalPosition(player.position, player.kind) };
      const existing = map.get(key);
      if (!existing) {
        map.set(key, normalized);
        continue;
      }
      const playerIsRicher = richness(normalized) > richness(existing);
      map.set(key, playerIsRicher ? merge(normalized, existing) : merge(existing, normalized));
    }
    return completeGoalieMetrics([...map.values()], { scope: 'season' })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  globalThis.MyHockeyHubPlayerNormalization = {
    numberOrZero,
    finiteNumber,
    durationMinutes,
    playerName,
    canonicalPosition,
    positionCode,
    goalieComponentStats,
    goalieMetrics,
    inferGameLength,
    completeGoalieMetrics,
    statPlayer,
    normalizePlayer,
    normalizeStandingPlayer,
    normalizeRoster,
    sideForTeam,
    sideForPlayer,
    playerEvents,
    playerGameActivity,
    teamRosterFromGame,
    dedupePlayers,
    mergePlayerRecord,
    formatGaa,
    formatSvPct
  };
})();
