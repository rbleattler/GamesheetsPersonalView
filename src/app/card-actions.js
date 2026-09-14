(() => {
  'use strict';

  const decoratedAttr = 'data-card-actions-decorated';

  function labelIcon(kind) {
    const span = document.createElement('span');
    span.className = `game-action-icon ${kind}`;
    span.setAttribute('aria-hidden', 'true');
    if (kind === 'livebarn') span.textContent = '▶';
    return span;
  }

  function setActionLabel(node, kind, label) {
    if (!node) return;
    node.replaceChildren(labelIcon(kind), document.createTextNode(label));
  }

  function decorateCard(card) {
    if (!card || card.getAttribute(decoratedAttr) === 'true') return;

    // Mark before mutating the card. Moving its existing footer controls creates
    // child-list mutations; marking first prevents those mutations from
    // scheduling the same card again.
    card.setAttribute(decoratedAttr, 'true');

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

    // Scheduled cards have no Stats action and normally no broadcaster action.
    // Leave those cards in their existing compact layout rather than creating
    // a one-button footer row.
    if (!liveBarn && !stats) return;

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

    row.dataset.actions = String(row.children.length);
    foot.classList.toggle('game-foot-actions', row.children.length > 0);
  }

  function collectCards(node, cards) {
    if (!(node instanceof Element)) return;
    if (node.matches('.gamecard')) cards.add(node);
    node.querySelectorAll?.('.gamecard').forEach(card => cards.add(card));
  }

  function decorateAddedNodes(records) {
    const cards = new Set();
    for (const record of records) {
      for (const node of record.addedNodes) collectCards(node, cards);
    }
    for (const card of cards) decorateCard(card);
  }

  // Initial pass is intentionally a single scan. Subsequent work is limited to
  // newly rendered card subtrees, so switching to Entire Season remains O(n)
  // rather than repeatedly rescanning all cards for every footer DOM mutation.
  document.querySelectorAll('.gamecard').forEach(decorateCard);

  new MutationObserver(decorateAddedNodes).observe(document.body, {
    childList: true,
    subtree: true
  });
})();