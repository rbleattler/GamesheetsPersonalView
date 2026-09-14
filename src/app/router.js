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
})();
