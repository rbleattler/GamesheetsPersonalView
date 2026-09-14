(() => {
  'use strict';

  function labelIcon(kind) {
    const span = document.createElement('span');
    span.className = `game-action-icon ${kind}`;
    span.setAttribute('aria-hidden', 'true');
    span.textContent = kind === 'gamesheet' ? '▤' : '▶';
    return span;
  }

  function setActionLabel(node, kind, label) {
    if (!node) return;
    node.replaceChildren(labelIcon(kind), document.createTextNode(label));
  }

  function decorateCard(card) {
    const meta = card.querySelector('.gmeta');
    if (meta) {
      for (const group of [...meta.children]) {
        const label = group.querySelector('.mk')?.textContent?.trim().toLowerCase();
        if (label === 'game') group.remove();
      }
      meta.classList.toggle('game-meta-two', meta.children.length === 2);
    }

    const foot = card.querySelector('.gfoot');
    if (!foot) return;

    const gameSheet = foot.querySelector('a[href*="gamesheetstats.com/seasons/"]');
    const liveBarn = foot.querySelector('a[href*="livebarn.com"]');
    const stats = foot.querySelector('button.stats');
    if (!gameSheet && !liveBarn && !stats) return;

    let row = foot.querySelector(':scope > .game-action-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'game-action-row';
      foot.prepend(row);
    }

    foot.querySelectorAll('.stats-hint').forEach(node => node.remove());

    if (gameSheet) {
      gameSheet.className = 'game-action game-action-secondary gamesheet-action';
      gameSheet.style.textDecoration = 'none';
      gameSheet.removeAttribute('data-broadcast-watch');
      if (!gameSheet.querySelector('.game-action-icon')) setActionLabel(gameSheet, 'gamesheet', 'GameSheet');
      if (gameSheet.parentElement !== row) row.appendChild(gameSheet);
    }

    if (liveBarn) {
      liveBarn.className = 'game-action game-action-secondary livebarn-action';
      liveBarn.style.textDecoration = 'none';
      if (!liveBarn.querySelector('.game-action-icon')) setActionLabel(liveBarn, 'livebarn', 'LiveBarn');
      if (liveBarn.parentElement !== row) row.appendChild(liveBarn);
    }

    if (stats) {
      stats.className = 'game-action game-action-primary stats';
      stats.textContent = 'Stats';
      if (stats.parentElement !== row) row.appendChild(stats);
    }

    for (const wrapper of [...foot.querySelectorAll(':scope > .footer-actions')]) {
      if (!wrapper.children.length && !wrapper.textContent.trim()) wrapper.remove();
    }

    foot.classList.toggle('game-foot-actions', row.children.length > 0);
  }

  function decorateAll() {
    document.querySelectorAll('.gamecard').forEach(decorateCard);
  }

  let queued = false;
  function scheduleDecorate() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      decorateAll();
    });
  }

  new MutationObserver(scheduleDecorate).observe(document.body, {
    childList: true,
    subtree: true
  });
  decorateAll();
})();