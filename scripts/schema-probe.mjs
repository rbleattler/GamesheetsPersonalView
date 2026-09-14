#!/usr/bin/env node
import '../src/app/foundation.js';

const foundation = globalThis.MyHockeyHubFoundation;
const args = process.argv.slice(2);
const valueAfter = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : '';
};

const season = valueAfter('--season');
const explicitUrl = valueAfter('--url');
const url = explicitUrl || (season ? `${foundation.API_BASE}/unified-games/${encodeURIComponent(season)}` : '');

if (!url || args.includes('--help') || args.includes('-h')) {
  console.log(`MyHockeyHub public-schema probe\n\nUsage:\n  npm run probe:schema -- --season 15111\n  npm run probe:schema -- --url https://gamesheetstats.com/api/unified-games/15111\n\nThis command is intentionally local-only. CI must not depend on live GameSheet access.`);
  process.exit(url ? 0 : 2);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error('Invalid --url value.');
  process.exit(2);
}
if (parsed.protocol !== 'https:') {
  console.error('Schema probe only accepts HTTPS endpoints.');
  process.exit(2);
}

const started = Date.now();
try {
  const body = await foundation.api.fetchJson(parsed.toString());
  const data = foundation.normalize.dataOf(body);
  const rows = Array.isArray(data) ? data : data && typeof data === 'object' ? [data] : [];
  const sample = rows[0] || null;
  const topKeys = body && typeof body === 'object' ? Object.keys(body).sort() : [];
  const sampleKeys = sample && typeof sample === 'object' ? Object.keys(sample).sort() : [];
  const isGamesEndpoint = /\/unified-games\//.test(parsed.pathname);

  const report = {
    endpoint: parsed.origin + parsed.pathname,
    elapsedMs: Date.now() - started,
    wrapperStatus: body && typeof body === 'object' && 'status' in body ? body.status : '(none)',
    dataType: Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data,
    rowCount: rows.length,
    topLevelKeys: topKeys,
    sampleKeys
  };

  if (isGamesEndpoint) {
    const required = ['gameId', 'status', 'home', 'visitor'];
    report.missingCriticalGameFields = required.filter(k => !(k in (sample || {})));
    const normalized = foundation.normalize.games(body);
    report.broadcast = {
      actionable: normalized.filter(g => g?._broadcast?.available).length,
      suppressed: normalized.reduce((n, g) => n + (g?._broadcast?.suppressed?.length || 0), 0),
      gamesWithAnyCandidate: normalized.filter(g => (g?._broadcast?.candidates?.length || 0) > 0).length
    };
  }

  console.log(JSON.stringify(report, null, 2));
  if (isGamesEndpoint && report.missingCriticalGameFields.length) process.exitCode = 1;
} catch (error) {
  console.error(`Schema probe failed: ${error?.message || error}`);
  console.error('This can also happen when Cloudflare/bot protection rejects the local request; the probe is not used by CI.');
  process.exitCode = 1;
}
