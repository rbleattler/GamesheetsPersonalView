(() => {
  'use strict';

  const url = new URL(location.href);
  const enabled = url.searchParams.get('debug') === '1' || sessionStorage.getItem('myhockeyhub.debug') === '1';
  if (!enabled) return;
  sessionStorage.setItem('myhockeyhub.debug', '1');

  const root = document.createElement('aside');
  root.className = 'debug-panel';
  root.innerHTML = `
    <div class="debug-head"><b>Preview diagnostics</b><button type="button" data-debug-close>×</button></div>
    <div class="debug-grid" data-debug-grid></div>
    <div class="debug-actions">
      <button type="button" data-debug-refresh>Refresh live now</button>
      <button type="button" data-debug-copy>Copy snapshot</button>
      <button type="button" data-debug-disable>Disable</button>
    </div>
  `;
  document.body.appendChild(root);

  const grid = root.querySelector('[data-debug-grid]');
  let lastSnapshot = null;

  const stringify = value => value == null ? '—' : String(value);
  const draw = () => {
    const adapter = window.MyHockeyHubDebug;
    if (!adapter?.snapshot) {
      grid.innerHTML = '<div>Waiting for app state…</div>';
      return;
    }
    const s = adapter.snapshot();
    lastSnapshot = s;
    const rows = [
      ['View', s.view],
      ['Season', s.seasonId],
      ['Games', s.gameCount],
      ['Visible live', s.liveCount],
      ['Polling', s.polling ? 'yes' : 'no'],
      ['Last live refresh', s.lastLive || '—'],
      ['Refresh error', s.lastError ? 'yes' : 'no'],
      ['Broadcast links', s.broadcastActionable],
      ['Broadcast suppressed', s.broadcastSuppressed]
    ];
    grid.innerHTML = rows.map(([k,v]) => `<div><span>${k}</span><b>${stringify(v)}</b></div>`).join('');
  };

  root.querySelector('[data-debug-refresh]').onclick = async () => {
    await window.MyHockeyHubDebug?.refreshLive?.();
    draw();
  };
  root.querySelector('[data-debug-copy]').onclick = async () => {
    draw();
    if (!lastSnapshot) return;
    try { await navigator.clipboard.writeText(JSON.stringify(lastSnapshot, null, 2)); } catch {}
  };
  root.querySelector('[data-debug-disable]').onclick = () => {
    sessionStorage.removeItem('myhockeyhub.debug');
    const u = new URL(location.href);u.searchParams.delete('debug');location.replace(u);
  };
  root.querySelector('[data-debug-close]').onclick = () => root.remove();

  draw();
  const timer = setInterval(draw, 2000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
})();
