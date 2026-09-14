(() => {
  'use strict';

  const storeKey = 'myhockeyhub.livebarnVenues.v1';
  const venueKey = value => String(value || '').trim().toLowerCase();

  function loadVenueMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storeKey) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  let venueMap = loadVenueMap();

  function saveVenueMap() {
    try { localStorage.setItem(storeKey, JSON.stringify(venueMap)); } catch {}
  }

  function surfaceIdFromUrl(value) {
    try {
      const url = new URL(value);
      if (!url.hostname.toLowerCase().includes('livebarn')) return '';
      const match = url.pathname.match(/\/video\/([^/?#]+)/i);
      return match?.[1] ? decodeURIComponent(match[1]) : '';
    } catch {
      return '';
    }
  }

  function rinkFromGameCard(card) {
    for (const group of card.querySelectorAll('.gmeta > div')) {
      const label = group.querySelector('.mk')?.textContent?.trim().toLowerCase();
      if (label !== 'rink') continue;
      return group.querySelector('.mv')?.textContent?.trim() || '';
    }
    return '';
  }

  function learnFromRenderedGames() {
    let changed = false;
    document.querySelectorAll('.gamecard').forEach(card => {
      const rink = rinkFromGameCard(card);
      if (!rink) return;
      const watch = [...card.querySelectorAll('a[href*="livebarn.com"]')]
        .map(link => ({ link, surfaceId: surfaceIdFromUrl(link.href) }))
        .find(item => item.surfaceId);
      if (!watch) return;

      const key = venueKey(rink);
      const next = {
        location: rink,
        surfaceId: watch.surfaceId,
        provider: 'LiveBarn',
        url: `https://livebarn.com/en/video/${encodeURIComponent(watch.surfaceId)}`
      };
      if (venueMap[key]?.surfaceId === next.surfaceId && venueMap[key]?.url === next.url) return;
      venueMap[key] = next;
      changed = true;
    });
    if (changed) saveVenueMap();
  }

  function makeVenueLink(venue) {
    const link = document.createElement('a');
    link.dataset.livebarnVenue = 'true';
    link.className = 'rowbtn watch-link';
    link.href = venue.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.style.textDecoration = 'none';
    link.textContent = 'LiveBarn venue ↗';
    return link;
  }

  function decorateVenues() {
    learnFromRenderedGames();
    document.querySelectorAll('#venuesView .venuecard').forEach(card => {
      const rink = card.querySelector('.venuehead h3')?.textContent?.trim() || '';
      const actions = card.querySelector('.actions');
      if (!rink || !actions || actions.querySelector('[data-livebarn-venue]')) return;
      const venue = venueMap[venueKey(rink)];
      if (venue?.url) actions.appendChild(makeVenueLink(venue));
    });
  }

  let queued = false;
  const scheduleDecorate = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      decorateVenues();
    });
  };

  new MutationObserver(scheduleDecorate).observe(document.body, {
    childList: true,
    subtree: true
  });
  decorateVenues();
})();
