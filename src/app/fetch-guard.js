(() => {
  'use strict';

  const nativeFetch = globalThis.fetch?.bind(globalThis);
  if (!nativeFetch || typeof AbortController !== 'function') return;

  const DEFAULT_TIMEOUT_MS = 12000;

  globalThis.fetch = function guardedFetch(input, init = {}) {
    const timeoutMs = Number(init?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return nativeFetch(input, init);

    const controller = new AbortController();
    const externalSignal = init?.signal;
    let timedOut = false;

    const abortFromCaller = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) controller.abort(externalSignal.reason);
    else externalSignal?.addEventListener?.('abort', abortFromCaller, { once: true });

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const options = { ...init, signal: controller.signal };
    delete options.timeoutMs;

    return nativeFetch(input, options)
      .catch(error => {
        if (timedOut) {
          const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
          timeoutError.name = 'TimeoutError';
          throw timeoutError;
        }
        throw error;
      })
      .finally(() => {
        clearTimeout(timer);
        externalSignal?.removeEventListener?.('abort', abortFromCaller);
      });
  };

  globalThis.MyHockeyHubFetchGuard = { timeoutMs: DEFAULT_TIMEOUT_MS };
})();
