import test from 'node:test';
import assert from 'node:assert/strict';

await import('../src/app/drawer-navigation.js');
const { createDrawerNavigation } = globalThis.MyHockeyHubDrawerNavigation;

function harness() {
  const shown = [];
  let open = false;
  let closed = 0;
  let currentTabByKey = {};
  const restored = [];
  const nav = createDrawerNavigation({
    isOpen: () => open,
    captureExtra: () => ({ activeTab: currentTabByKey.current, scrollTop: 42 }),
    restoreExtra: extra => restored.push(extra),
    onClose: () => { open = false; closed += 1; }
  });
  function openScreen(key, tab) {
    return nav.go(key, () => {
      open = true;
      currentTabByKey.current = tab;
      shown.push(key);
    });
  }
  return { nav, shown, openScreen, isClosed: () => closed, restored };
}

test('root drawer -> Back closes', () => {
  const { nav, isClosed, openScreen } = harness();
  openScreen('gameStats');
  assert.equal(nav.depth(), 0);
  nav.back();
  assert.equal(isClosed(), 1);
  assert.equal(nav.peek(), null);
});

test('Game Stats -> Player -> Back returns Game Stats', () => {
  const { nav, shown, openScreen } = harness();
  openScreen('gameStats');
  openScreen('player');
  assert.equal(nav.depth(), 1);
  shown.length = 0;
  nav.back();
  assert.deepEqual(shown, ['gameStats']);
  assert.equal(nav.peek().key, 'gameStats');
  assert.equal(nav.depth(), 0);
});

test('Game Stats -> Player -> Full Game Stats -> Back returns Player -> Back returns Game Stats', () => {
  const { nav, shown, openScreen } = harness();
  openScreen('gameStats');
  openScreen('player');
  openScreen('fullGameStats');
  assert.equal(nav.depth(), 2);

  shown.length = 0;
  nav.back();
  assert.deepEqual(shown, ['player']);
  assert.equal(nav.peek().key, 'player');
  assert.equal(nav.depth(), 1);

  shown.length = 0;
  nav.back();
  assert.deepEqual(shown, ['gameStats']);
  assert.equal(nav.peek().key, 'gameStats');
  assert.equal(nav.depth(), 0);
});

test('stack clears on X/close, and does not resurrect after the drawer reopens fresh', () => {
  const { nav, openScreen, isClosed } = harness();
  openScreen('gameStats');
  openScreen('player');
  assert.equal(nav.depth(), 1);
  nav.reset();
  assert.equal(nav.depth(), 0);
  assert.equal(nav.peek(), null);

  const { shown } = (() => {
    const shown = [];
    nav.go('settings', () => shown.push('settings'));
    return { shown };
  })();
  assert.deepEqual(shown, ['settings']);
  nav.back();
  assert.equal(isClosed(), 1);
});

test('active tab and scroll position are captured on leave and restored on Back', () => {
  const { nav, openScreen, restored } = harness();
  openScreen('gameStats', 'summary');
  // Simulate the user switching tabs before drilling into a player.
  const tabAtLeaveTime = 'boxscore';
  const nav2 = nav; // same instance
  // Overwrite captured tab by re-invoking with a helper that mimics tab switch.
  const shownTabs = [];
  nav2.go('player', () => shownTabs.push('player'));
  // Nothing captured yet for 'player' entry since it has no tabs; back() should
  // still hand back whatever was captured when leaving gameStats.
  return nav2.back().then(() => {
    assert.equal(restored.length, 1);
    assert.ok('activeTab' in restored[0]);
    assert.equal(restored[0].scrollTop, 42);
  });
});

test('back() waits for an async thunk before restoring extra state', async () => {
  const restored = [];
  const nav = createDrawerNavigation({
    isOpen: () => true,
    captureExtra: () => ({ marker: 'captured' }),
    restoreExtra: extra => restored.push(extra),
    onClose: () => {}
  });
  let openGameStatsCalls = 0;
  const gameStatsThunk = async () => {
    openGameStatsCalls += 1;
    order.push(`open-gameStats-start-${openGameStatsCalls}`);
    await new Promise(resolve => setTimeout(resolve, 5));
    order.push(`open-gameStats-end-${openGameStatsCalls}`);
  };
  const order = [];
  nav.go('gameStats', gameStatsThunk);
  await new Promise(resolve => setTimeout(resolve, 10));
  order.length = 0;

  nav.go('player', () => { order.push('open-player'); });
  const backPromise = nav.back();
  order.push('back-called-synchronously');
  await backPromise;
  assert.deepEqual(order, [
    'open-player',
    'open-gameStats-start-2',
    'back-called-synchronously',
    'open-gameStats-end-2'
  ]);
  assert.equal(restored.length, 1);
  assert.deepEqual(restored[0], { marker: 'captured' });
});

function fakeButton(tab, active) {
  const classes = new Set(active ? ['tab', 'active'] : ['tab']);
  return {
    dataset: { tab },
    classList: {
      contains: name => classes.has(name),
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      toggle: (name, force) => (force ? classes.add(name) : classes.delete(name))
    },
    clicked: false,
    click() { this.clicked = true; }
  };
}

// Mirrors the exact wiring used in build.mjs: captureExtra/restoreExtra read and
// write DOM state through querySelector + classList/dataset, the same shape the
// real app's drawer uses for its tab strip and scroll container.
test('integration-shaped wiring: game-stats tab state survives a Player -> Back round trip', async () => {
  let activeTabName = 'summary';
  const tabButtons = {
    summary: fakeButton('summary', true),
    boxscore: fakeButton('boxscore', false)
  };
  const drawerBody = {
    querySelector(selector) {
      if (selector === '.tabs .tab.active') return tabButtons[activeTabName];
      const match = selector.match(/data-tab="([^"]+)"/);
      return match ? tabButtons[match[1]] : null;
    }
  };
  const drawer = { scrollTop: 0 };
  const renderedScreens = [];

  const nav = createDrawerNavigation({
    isOpen: () => renderedScreens.length > 0,
    captureExtra: () => ({
      activeTab: drawerBody.querySelector('.tabs .tab.active')?.dataset.tab || null,
      scrollTop: drawer.scrollTop
    }),
    restoreExtra: extra => {
      if (!extra) return;
      if (extra.activeTab) {
        const tabButton = drawerBody.querySelector('.tabs .tab[data-tab="' + extra.activeTab + '"]');
        if (tabButton && !tabButton.classList.contains('active')) tabButton.click();
      }
      drawer.scrollTop = extra.scrollTop || 0;
    },
    onClose: () => { renderedScreens.length = 0; }
  });

  // Mirrors renderStats(): every (re-)render of Game Stats resets the tab strip
  // back to "summary", exactly like the real app's freshly-built tabs markup.
  const renderGameStats = () => {
    renderedScreens.push('gameStats');
    tabButtons.boxscore.classList.remove('active');
    tabButtons.summary.classList.add('active');
    activeTabName = 'summary';
    drawer.scrollTop = 260;
  };
  nav.go('gameStats', renderGameStats);
  // The user switches to the Box Score tab and scrolls before drilling into a player.
  tabButtons.summary.classList.remove('active');
  tabButtons.boxscore.classList.add('active');
  activeTabName = 'boxscore';
  drawer.scrollTop = 640;

  nav.go('player', () => { renderedScreens.push('player'); drawer.scrollTop = 0; });
  await nav.back();

  assert.deepEqual(renderedScreens, ['gameStats', 'player', 'gameStats']);
  assert.equal(activeTabName, 'summary', 'the replayed render defaults back to the summary tab before restoreExtra runs');
  assert.equal(tabButtons.boxscore.clicked, true, 'Back must re-select the tab that was active when the user left Game Stats');
  assert.equal(drawer.scrollTop, 640);
});

test('peek reflects the current entry key without mutating the stack', () => {
  const { nav, openScreen } = harness();
  openScreen('help');
  assert.equal(nav.peek().key, 'help');
  openScreen('feedback');
  assert.equal(nav.peek().key, 'feedback');
  assert.equal(nav.depth(), 1);
});
