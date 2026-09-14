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
  // Hydrate it lazily from /api/games/game/:id/detail only when a user opens a game.
  const foundation = window.MyHockeyHubFoundation;
  const drawerBody = document.getElementById('drawerBody');
  let activeGameId = '';
  let activeBroadcast = null;
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

  function renderBroadcastLink() {
    if (!drawerBody || !activeBroadcast?.available) return;
    drawerBody.querySelectorAll('[data-broadcast-watch]').forEach(node => node.remove());

    const scoreCenter = drawerBody.querySelector('.game-scoreboard .score-center');
    if (scoreCenter) {
      scoreCenter.appendChild(makeWatchLink(activeBroadcast, 'score-gs watch-link'));
      return;
    }

    const actions = drawerBody.querySelector('.actions');
    if (actions) actions.appendChild(makeWatchLink(activeBroadcast, 'rowbtn watch-link'));
  }

  async function hydrateBroadcast(gameId) {
    if (!gameId || !foundation?.api?.gameDetail) return;
    const request = ++broadcastRequest;
    activeGameId = gameId;
    activeBroadcast = null;
    try {
      const detail = await foundation.api.gameDetail(gameId);
      if (request !== broadcastRequest || activeGameId !== gameId) return;
      activeBroadcast = foundation.normalize.broadcaster(detail);
      renderBroadcastLink();
    } catch (error) {
      console.warn('Game broadcaster detail unavailable', gameId, error);
    }
  }

  document.addEventListener('click', event => {
    const gameId = gameIdFromTarget(event.target);
    if (gameId) void hydrateBroadcast(gameId);
  });

  if (drawerBody) {
    new MutationObserver(() => renderBroadcastLink()).observe(drawerBody, {
      childList: true,
      subtree: true
    });
  }
})();
