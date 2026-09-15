(() => {
  'use strict';

  // A drawer/modal navigation stack built from logical entries, not DOM capture.
  // Each entry is {key, thunk, extra}: `thunk` re-renders that screen from its own
  // closed-over params/state, and `extra` holds small UI state (active tab, scroll
  // position) that can't be recovered just by re-rendering. Back replays the
  // previous entry's thunk instead of restoring cached DOM, so listeners are always
  // freshly wired and never "dead".
  function createDrawerNavigation({ isOpen, captureExtra, restoreExtra, onClose } = {}) {
    let stack = [];
    let current = null;

    function go(key, thunk) {
      const wasOpen = typeof isOpen === 'function' ? !!isOpen() : stack.length > 0 || !!current;
      if (wasOpen && current) {
        current.extra = typeof captureExtra === 'function' ? captureExtra() : current.extra;
        stack.push(current);
      } else {
        stack = [];
      }
      current = { key, thunk, extra: null };
      return thunk();
    }

    function back() {
      const previous = stack.pop();
      if (!previous) {
        current = null;
        if (typeof onClose === 'function') onClose();
        return null;
      }
      current = previous;
      const result = previous.thunk();
      return Promise.resolve(result).then(value => {
        if (typeof restoreExtra === 'function') restoreExtra(previous.extra);
        return value;
      });
    }

    function reset() {
      stack = [];
      current = null;
    }

    function depth() {
      return stack.length;
    }

    function peek() {
      return current ? { key: current.key, extra: current.extra } : null;
    }

    return { go, back, reset, depth, peek };
  }

  globalThis.MyHockeyHubDrawerNavigation = { createDrawerNavigation };
})();
