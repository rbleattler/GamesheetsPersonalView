(() => {
  'use strict';

  const supportedViews = new Set(['team', 'venues', 'players', 'schedule']);
  let applyingHistory = false;

  function requestedView() {
    const view = new URL(location.href).searchParams.get('view');
    return supportedViews.has(view) ? view : '';
  }

  function navButton(view) {
    return document.querySelector(`.nav button[data-view="${view}"]`);
  }

  function writeRoute(view, replace = false) {
    if (!supportedViews.has(view)) return;
    const url = new URL(location.href);
    url.searchParams.set('view', view);
    const method = replace ? 'replaceState' : 'pushState';
    history[method]({ view }, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function applyRoute({ replaceMissing = false } = {}) {
    const view = requestedView();
    if (view) {
      const button = navButton(view);
      if (button && !button.classList.contains('active')) {
        applyingHistory = true;
        button.click();
        applyingHistory = false;
      }
      return;
    }

    if (replaceMissing) {
      const active = document.querySelector('.nav button.active')?.dataset.view ||
        localStorage.getItem('gsv3.view') || 'team';
      writeRoute(supportedViews.has(active) ? active : 'team', true);
    }
  }

  document.querySelectorAll('.nav button[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      if (!applyingHistory) writeRoute(button.dataset.view);
    });
  });

  window.addEventListener('popstate', () => applyRoute());
  applyRoute({ replaceMissing: true });

  // Broadcaster metadata is not present in the season-level unified-games feed.
  // Hydrate it lazily from /api/games/game/:id/detail and keep any discovered
  // LiveBarn surface IDs as venue-level links in local browser storage.
  const foundation = window.MyHockeyHubFoundation;
  const drawerBody = document.getElementById('drawerBody');
  const venuesView = document.getElementById('venuesView');
  const venueStoreKey = 'myhockeyhub.livebarnVenues.v1';
  const detailCache = new Map();
  const venueRequests = new Map();
  let activeGameId = '';
  let activeBroadcast = null;
  let activeVenue = null;
  let broadcastRequest = 0;

  function gameIdFromTarget(target) {
    const node = target?.closest?.('[data-stats-game],[data-game],[data-venue-stats],[data-venue-details]');
    if (!node) return '';
    return String(
      node.dataset.statsGame ||
      node.dataset.game ||
      node.dataset.venueStats ||
      node.dataset.venueDetails ||
      ''
    );
  }

  function gameIdFromDrawer() {
    if (!drawerBody) return '';
    const link = [...drawerBody.querySelectorAll('a[href*="gamesheetstats.com/seasons/"]')]
      .find(node => /\/games\/[^/?#]+/.test(node.href));
    const match = link?.href?.match(/\/games\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function venueKey(value) {
    return String(value || '').trim().toLowerCase();
  }

  function loadVenueMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(venueStoreKey) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  let venueMap = loadVenueMap();

  function saveVenueMap() {
    try { localStorage.setItem(venueStoreKey, JSON.stringify(venueMap)); } catch {}
  }

  function detailGame(detail) {
    return detail?.game || detail?.data?.game || null;
  }

  function liveBarnVenue(detail) {
    const game = detailGame(detail);
    const livebarn = game?.broadcasters?.livebarn;
    const surfaceId = String(livebarn?.surfaceId || '').trim();
    const location = String(game?.location || '').trim();
    if (!surfaceId || !location) return null;
    return {
      location,
      surfaceId,
      provider: 'LiveBarn',
      url: `https://livebarn.com/en/video/${encodeURIComponent(surfaceId)}`
    };
  }

  function rememberVenue(detail) {
    const venue = liveBarnVenue(detail);
    if (!venue) return null;
    venueMap[venueKey(venue.location)] = venue;
    saveVenueMap();
    return venue;
  }

  function specificGameBroadcast(detail) {
    const broadcast = foundation?.normalize?.broadcaster?.(detail);
    if (!broadcast?.available || !broadcast.url) return null;
    try {
      const url = new URL(broadcast.url);
      if (url.hostname.toLowerCase().includes('livebarn')) {
        const parts = url.pathname.split('/').filter(Boolean);
        // /en/video/<surface> is a useful venue page, but it is not a game-specific watch URL.
        if (parts.length <= 3) return null;
      }
    } catch {
      return null;
    }
    return broadcast;
  }

  function getDetail(gameId) {
    const id = String(gameId || '');
    if (!id || !foundation?.api?.gameDetail) return Promise.resolve(null);
    if (!detailCache.has(id)) {
      detailCache.set(id, foundation.api.gameDetail(id).catch(error => {
        detailCache.delete(id);
        throw error;
      }));
    }
    return detailCache.get(id);
  }

  function makeWatchLink(broadcast, className) {
    const link = document.createElement('a');
    link.dataset.broadcastWatch = 'true';
    link.className = className;
    link.href = broadcast.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `▶ ${broadcast.label || 'Watch'}${broadcast.provider ? ` · ${broadcast.provider}` : ''} ↗`;
    return link;
  }

  function makeVenueLink(venue, className = 'rowbtn watch-link') {
    const link = document.createElement('a');
    link.dataset.livebarnVenue = 'true';
    link.className = className;
    link.href = venue.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.style.textDecoration = 'none';
    link.textContent = 'LiveBarn venue ↗';
    return link;
  }

  function renderBroadcastLink() {
    if (!drawerBody) return;
    const scoreCenter = drawerBody.querySelector('.game-scoreboard .score-center');
    const actions = drawerBody.querySelector('.actions');
    const target = scoreCenter || actions;
    const existing = drawerBody.querySelector('[data-broadcast-watch],[data-livebarn-venue-drawer]');

    let desired = null;
    if (activeBroadcast?.available) {
      desired = {
        kind: 'game',
        url: activeBroadcast.url,
        text: `▶ ${activeBroadcast.label || 'Watch'}${activeBroadcast.provider ? ` · ${activeBroadcast.provider}` : ''} ↗`
      };
    } else if (activeVenue?.url) {
      desired = { kind: 'venue', url: activeVenue.url, text: 'LiveBarn venue ↗' };
    }

    if (!desired || !target) {
      existing?.remove();
      return;
    }

    if (
      existing &&
      existing.parentElement === target &&
      existing.href === new URL(desired.url, location.href).href &&
      existing.textContent === desired.text
    ) return;

    existing?.remove();
    target.querySelectorAll('.watch-link').forEach(node => node.remove());

    const link = desired.kind === 'game'
      ? makeWatchLink(activeBroadcast, scoreCenter ? 'score-gs watch-link' : 'rowbtn watch-link')
      : makeVenueLink(activeVenue, scoreCenter ? 'score-gs watch-link' : 'rowbtn watch-link');
    if (desired.kind === 'venue') link.dataset.livebarnVenueDrawer = 'true';
    target.appendChild(link);
  }

  async function hydrateBroadcast(gameId) {
    if (!gameId) return;
    const request = ++broadcastRequest;
    activeGameId = String(gameId);
    activeBroadcast = null;
    activeVenue = null;
    renderBroadcastLink();
    try {
      const detail = await getDetail(gameId);
      if (!detail || request !== broadcastRequest || activeGameId !== String(gameId)) return;
      activeBroadcast = specificGameBroadcast(detail);
      activeVenue = rememberVenue(detail);
      renderBroadcastLink();
      renderVenueLinks();
    } catch (error) {
      console.warn('Game broadcaster detail unavailable', gameId, error);
    }
  }

  function ensureDrawerBroadcast() {
    const gameId = gameIdFromDrawer();
    if (!gameId) return;
    if (gameId !== activeGameId) void hydrateBroadcast(gameId);
    else renderBroadcastLink();
  }

  async function discoverVenue(card, location) {
    const key = venueKey(location);
    if (!key || venueMap[key] || venueRequests.has(key)) return;
    const gameId = card.querySelector('[data-game]')?.dataset.game;
    if (!gameId) return;
    const request = getDetail(gameId)
      .then(detail => {
        rememberVenue(detail);
        renderVenueLinks();
      })
      .catch(error => console.warn('Venue broadcaster detail unavailable', location, error))
      .finally(() => venueRequests.delete(key));
    venueRequests.set(key, request);
  }

  function renderVenueLinks() {
    if (!venuesView) return;
    venuesView.querySelectorAll('.venuecard').forEach(card => {
      const location = card.querySelector('.venuehead h3')?.textContent?.trim() || '';
      const key = venueKey(location);
      const actions = card.querySelector('.actions');
      if (!actions || !key) return;
      const existing = actions.querySelector('[data-livebarn-venue]');
      const venue = venueMap[key];
      if (venue) {
        if (!existing) actions.appendChild(makeVenueLink(venue));
      } else {
        existing?.remove();
        void discoverVenue(card, location);
      }
    });
  }

  document.addEventListener('click', event => {
    const gameId = gameIdFromTarget(event.target);
    if (gameId) void hydrateBroadcast(gameId);
  });

  if (drawerBody) {
    new MutationObserver(() => ensureDrawerBroadcast()).observe(drawerBody, {
      childList: true,
      subtree: true
    });
    ensureDrawerBroadcast();
  }

  if (venuesView) {
    new MutationObserver(() => renderVenueLinks()).observe(venuesView, {
      childList: true,
      subtree: true
    });
    renderVenueLinks();
  }
})();
