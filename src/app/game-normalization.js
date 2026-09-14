(() => {
  'use strict';

  function firestoreValue(value) {
    if (!value || typeof value !== 'object') return undefined;
    if ('nullValue' in value) return null;
    if ('stringValue' in value) return value.stringValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('booleanValue' in value) return Boolean(value.booleanValue);
    if ('timestampValue' in value) return value.timestampValue;
    if (value.mapValue) {
      const result = {};
      for (const [key, child] of Object.entries(value.mapValue.fields || {})) {
        result[key] = firestoreValue(child);
      }
      return result;
    }
    if (value.arrayValue) return (value.arrayValue.values || []).map(firestoreValue);
    return undefined;
  }

  function firestoreDocument(document) {
    const result = {};
    for (const [key, value] of Object.entries(document?.fields || {})) {
      result[key] = firestoreValue(value);
    }
    return result;
  }

  function clock(value) {
    const parts = String(value || '').split(':');
    return parts.length === 3
      ? { period: `P${Number(parts[0]) || parts[0]}`, time: `${parts[1]}:${parts[2]}` }
      : { period: '', time: String(value || '') };
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

  function penaltyMinutes(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value).trim();
    if (/^\d+:\d+$/.test(text)) {
      const [minutes, seconds] = text.split(':').map(Number);
      return minutes + (seconds / 60);
    }
    const match = text.match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function periodSortKey(value) {
    const text = String(value || '').trim().toUpperCase();
    const match = text.match(/\d+/);
    if (match) return Number(match[0]);
    if (text.includes('OT')) return 100;
    if (text.includes('SO')) return 200;
    return 999;
  }

  function clockSeconds(value) {
    const parts = String(value || '').trim().split(':').map(Number);
    if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return -1;
  }

  function compareEvents(a, b) {
    const periodDifference = periodSortKey(a?.periodLabel || a?.period) - periodSortKey(b?.periodLabel || b?.period);
    if (periodDifference) return periodDifference;
    return clockSeconds(b?.time) - clockSeconds(a?.time);
  }

  function groupEvents(items) {
    const groups = new Map();
    for (const event of [...(items || [])].sort(compareEvents)) {
      const period = event.periodLabel || event.period || '';
      if (!groups.has(period)) groups.set(period, []);
      groups.get(period).push(event);
    }
    return [...groups.entries()].map(([period, periodEvents]) => ({ period, periodEvents }));
  }

  function gameBox(game, decoded) {
    const visitorData = decoded?.data?.visitor || {};
    const homeData = decoded?.data?.home || {};
    const score = decoded?.computed?.scoreboard?.total || {};
    const shots = decoded?.computed?.shots?.total || {};
    const events = Object.values(decoded?.events || {});
    const goals = [];
    const penalties = [];
    const visitorIds = new Set((visitorData?.lineup?.players || []).map(player => String(player.id)));
    const homeIds = new Set((homeData?.lineup?.players || []).map(player => String(player.id)));
    const pim = { visitor: 0, home: 0 };

    const teamSideForId = id => String(id || '') === String(game?.visitor?.id)
      ? 'visitor'
      : String(id || '') === String(game?.home?.id)
        ? 'home'
        : '';
    const sideForPlayer = player => visitorIds.has(String(player?.id))
      ? 'visitor'
      : homeIds.has(String(player?.id))
        ? 'home'
        : '';
    const sideForEvent = (event, player) => teamSideForId(
      event?.for?.team?.id ?? event?.team?.id ?? event?.for?.teamId ?? event?.teamId
    ) || sideForPlayer(player);

    for (const event of events) {
      const type = String(event?.type || '');
      const gameClock = clock(event?.time?.clock);
      if (type.includes('Goal') && event?.for?.scorer) {
        const rawAssists = event.for.assist;
        const assists = Array.isArray(rawAssists) ? rawAssists : rawAssists ? [rawAssists] : [];
        goals.push({
          periodLabel: gameClock.period,
          time: gameClock.time,
          goalScorer: statPlayer(event.for.scorer),
          assist1By: statPlayer(assists[0]),
          assist2By: statPlayer(assists[1]),
          teamSide: sideForEvent(event, event.for.scorer)
        });
      }
      if (type.includes('HockeyPenalty')) {
        const player = statPlayer(event?.for?.player || event?.player || {});
        const side = sideForEvent(event, player);
        const duration = event?.penalty?.length ?? event?.penalty?.duration ?? event?.duration ?? '';
        const minutes = penaltyMinutes(duration);
        if (side) pim[side] += minutes;
        penalties.push({
          periodLabel: gameClock.period,
          time: gameClock.time,
          committedBy: player,
          teamSide: side,
          penaltyType: {
            title: event?.penalty?.label || event?.penalty?.code || 'Penalty',
            duration,
            minutes
          }
        });
      }
    }

    const rosterPim = data => (data?.lineup?.players || []).reduce(
      (sum, player) => sum + penaltyMinutes(player?.stats?.pim ?? player?.pim),
      0
    );
    const team = (side, data, base) => {
      const basePim = penaltyMinutes(base?.pim ?? base?.penaltyMinutes);
      const resolvedPim = pim[side] > 0 ? pim[side] : basePim > 0 ? basePim : rosterPim(data);
      return {
        ...base,
        title: base?.title || data?.details?.title || side,
        logo: base?.logo || data?.details?.logo || '',
        primaryColor: base?.primaryColor || base?.primaryColour || data?.details?.primaryColor || data?.details?.primaryColour || '',
        finalScore: score?.[side] ?? base?.goals,
        sog: shots?.[side] ?? base?.shots,
        pim: resolvedPim,
        roster: { players: (data?.lineup?.players || []).map(statPlayer) }
      };
    };

    return {
      visitor: team('visitor', visitorData, game?.visitor || {}),
      home: team('home', homeData, game?.home || {}),
      tables: {
        goalsByPeriod: groupEvents(goals),
        penaltiesByPeriod: groupEvents(penalties)
      }
    };
  }

  function gameBoxFromFirestore(game, document) {
    return gameBox(game, firestoreDocument(document));
  }

  globalThis.MyHockeyHubGameNormalization = {
    firestoreValue,
    firestoreDocument,
    clock,
    statPlayer,
    penaltyMinutes,
    compareEvents,
    groupEvents,
    gameBox,
    gameBoxFromFirestore
  };
})();
