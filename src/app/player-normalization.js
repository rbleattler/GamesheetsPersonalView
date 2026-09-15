(() => {
  'use strict';

  function numberOrZero(value) {
    return value == null || value === '' ? 0 : Number(value);
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
    divisionId = ''
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

    return {
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

  function dedupePlayers(players) {
    const useful = value => value !== '' && value != null && value !== '—';
    const richness = value => Object.values(value || {}).filter(useful).length;
    const merge = (preferred, fallback) => {
      const merged = { ...preferred };
      for (const [key, value] of Object.entries(fallback || {})) {
        if (!useful(merged[key]) && useful(value)) merged[key] = value;
      }
      merged.position = canonicalPosition(merged.position, merged.kind);
      if (!merged.position) merged.position = canonicalPosition('', merged.kind);
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
    return [...map.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  globalThis.MyHockeyHubPlayerNormalization = {
    numberOrZero,
    playerName,
    canonicalPosition,
    positionCode,
    statPlayer,
    normalizePlayer,
    normalizeStandingPlayer,
    normalizeRoster,
    sideForTeam,
    sideForPlayer,
    playerEvents,
    playerGameActivity,
    teamRosterFromGame,
    dedupePlayers
  };
})();
