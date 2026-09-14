import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const required = [
  'index.html',
  'app/index.html',
  'assets/app.css',
  'assets/fetch-guard.js',
  'assets/foundation.js',
  'assets/app.js',
  'assets/router.js',
  'assets/venue-links.js',
  'assets/card-actions.js',
  'assets/diagnostics.js',
  'assets/site.css',
  'data/seasons.json',
  'debug/live-replay.json',
  'FAQ.md',
  'LICENSE',
  'gamesheets_plus.html'
];

await Promise.all(required.map(path => access(join(dist, path))));
const appHtml = await readFile(join(dist, 'app/index.html'), 'utf8');
const homeHtml = await readFile(join(dist, 'index.html'), 'utf8');
const legacyLauncherHtml = await readFile(join(dist, 'gamesheets_plus.html'), 'utf8');
const appCss = await readFile(join(dist, 'assets/app.css'), 'utf8');
const appJs = await readFile(join(dist, 'assets/app.js'), 'utf8');
const guardJs = await readFile(join(dist, 'assets/fetch-guard.js'), 'utf8');
const foundationJs = await readFile(join(dist, 'assets/foundation.js'), 'utf8');
const venueLinksJs = await readFile(join(dist, 'assets/venue-links.js'), 'utf8');
const cardActionsJs = await readFile(join(dist, 'assets/card-actions.js'), 'utf8');
const diagnosticsJs = await readFile(join(dist, 'assets/diagnostics.js'), 'utf8');

if (/<style[\s>]/i.test(appHtml)) throw new Error('App HTML still contains an inline <style> block.');
if (/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(appHtml)) throw new Error('App HTML still contains inline JavaScript.');
if (!appHtml.includes('href="../"') || !appHtml.includes('aria-label="Home"')) throw new Error('App Home control is missing.');
if (!appHtml.includes('../assets/fetch-guard.js?v=') || !appHtml.includes('../assets/foundation.js?v=') || !appHtml.includes('../assets/app.js?v=') || !appHtml.includes('../assets/router.js?v=') || !appHtml.includes('../assets/venue-links.js?v=') || !appHtml.includes('../assets/card-actions.js?v=') || !appHtml.includes('../assets/diagnostics.js?v=')) throw new Error('Versioned external app bundles are missing.');
if (!appHtml.includes('name="myhockeyhub-build"') || !homeHtml.includes('name="myhockeyhub-build"')) throw new Error('Static build marker is missing.');
if (!homeHtml.includes('assets/site.css?v=')) throw new Error('Home stylesheet is not cache-busted.');
if (!homeHtml.includes('href="app/"')) throw new Error('Home page app navigation is incomplete.');
if (homeHtml.includes('versions.html')) throw new Error('Home page still links to the retired hosted version archive.');
if (!homeHtml.includes('prototype-version-archive')) throw new Error('Home page does not reference the GitHub prototype archive.');
if (!legacyLauncherHtml.includes('http-equiv="refresh" content="0;url=./"') || !legacyLauncherHtml.includes("location.replace('./')")) throw new Error('Legacy gamesheets_plus.html does not redirect to the landing page.');
if (legacyLauncherHtml.includes('url=app/') || legacyLauncherHtml.includes("location.replace('app/")) throw new Error('Legacy gamesheets_plus.html still redirects directly to the app.');
if (!guardJs.includes('MyHockeyHubFetchGuard') || !guardJs.includes('AbortController') || !guardJs.includes('TimeoutError')) throw new Error('Fetch timeout guard was not emitted correctly.');
if (!venueLinksJs.includes('livebarnVenues.v1') || !venueLinksJs.includes('gamecard') || !venueLinksJs.includes('LiveBarn venue')) throw new Error('Venue LiveBarn inference bridge was not emitted correctly.');
if (!cardActionsJs.includes('game-action-row') || !cardActionsJs.includes('GameSheet') || !cardActionsJs.includes('LiveBarn')) throw new Error('Game-card action-row decorator was not emitted correctly.');
if (!cardActionsJs.includes('addedNodes') || !cardActionsJs.includes('card-actions-decorated')) throw new Error('Game-card decorator is not using incremental added-node processing.');
if (!appCss.includes('.game-action-row') || !appCss.includes('.game-meta-two') || !appCss.includes('[data-actions="1"]')) throw new Error('Game-card action-row styles were not emitted correctly.');
if (!appJs.includes('MyHockeyHubFoundation')) throw new Error('App bundle is not using the shared foundation layer.');
for (const method of ['seasonInfo','seasonDivisions','unifiedGames','skaterStandings','goalieStandings']) {
  if (!appJs.includes(method)) throw new Error(`App bundle is not using API client method ${method}.`);
}
if (!appJs.includes('MyHockeyHubLiveService')) throw new Error('App bundle is not exposing the shared live-refresh service.');
if (!appJs.includes('MyHockeyHubDebug')) throw new Error('Preview diagnostics adapter was not emitted.');
if (!foundationJs.includes('MyHockeyHubFoundation') || !foundationJs.includes('addEventListener') || !foundationJs.includes('"online"') || !foundationJs.includes('createController') || !foundationJs.includes('firestoreGame')) throw new Error('Foundation API/live/replay support was not emitted correctly.');
if (!diagnosticsJs.includes('myhockeyhub.debug') || !diagnosticsJs.includes('live-replay.json')) throw new Error('Diagnostics/replay bundle was not emitted correctly.');

console.log('Build verification passed.');
