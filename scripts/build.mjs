import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const legacyPath = join(root, 'v3.6.html');

const read = path => readFile(join(root, path), 'utf8');
const write = async (path, content) => {
  const target = join(out, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
};

await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'assets'), { recursive: true });

const legacy = await readFile(legacyPath, 'utf8');
const styleMatch = legacy.match(/<style>([\s\S]*?)<\/style>/i);
const scriptMatch = legacy.match(/<script>([\s\S]*?)<\/script>/i);
if (!styleMatch || !scriptMatch) throw new Error('Could not find the V3.6 inline CSS/JS baseline.');

let appCss = `${styleMatch[1]}\n.home-btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:1.1rem;min-width:42px}.watch-link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none}.debug-panel{position:fixed;z-index:90;right:12px;bottom:12px;width:min(360px,calc(100vw - 24px));border:1px solid var(--line);border-radius:14px;background:rgba(7,17,28,.97);box-shadow:0 18px 54px rgba(0,0,0,.45);padding:10px;color:var(--text);font-size:.76rem}.debug-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.debug-head button{border:0;background:transparent;color:var(--muted);font-size:1.1rem}.debug-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.debug-grid>div{border:1px solid rgba(120,150,180,.18);border-radius:9px;padding:6px;background:rgba(18,32,48,.65)}.debug-grid span{display:block;color:var(--muted);font-size:.62rem;text-transform:uppercase}.debug-grid b{display:block;margin-top:2px;overflow-wrap:anywhere}.debug-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.debug-actions button{border:1px solid #35506d;background:#102239;color:var(--text);border-radius:8px;padding:6px 8px;font-size:.7rem}html[data-theme=light] .debug-panel{background:rgba(255,255,255,.98)}html[data-theme=light] .debug-grid>div{background:#f5f8fb}`;
let appJs = scriptMatch[1];

const catalogFetch = "fetch('data/seasons.json'";
if (!appJs.includes(catalogFetch)) throw new Error('Expected season-catalog fetch was not found in V3.6.');
appJs = appJs.replace(catalogFetch, "fetch('../data/seasons.json'");

const legacyFetchJson = "async function fetchJson(url){const r=await fetch(url,{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);const b=await r.json();if(b&&typeof b==='object'&&'status'in b&&b.status!=='success')throw new Error(b.message||b.error||`GameSheet status ${b.status}`);return b}";
if (!appJs.includes(legacyFetchJson)) throw new Error('Expected V3.6 fetchJson implementation was not found.');
appJs = appJs.replace(legacyFetchJson, "async function fetchJson(url){return window.MyHockeyHubFoundation.api.fetchJson(url)}");

const legacyDataHelpers = "function dataOf(b){return b&&typeof b==='object'&&'data'in b?b.data:b}function firstData(b){const d=dataOf(b);return Array.isArray(d)?d[0]:d}";
if (!appJs.includes(legacyDataHelpers)) throw new Error('Expected V3.6 data helpers were not found.');
appJs = appJs.replace(legacyDataHelpers, "function dataOf(b){return window.MyHockeyHubFoundation.normalize.dataOf(b)}function firstData(b){return window.MyHockeyHubFoundation.normalize.firstData(b)}");

const gamesAssignment = 'state.games=dedupe(dataOf(g)||[])';
if (!appJs.includes(gamesAssignment)) throw new Error('Expected V3.6 game assignment was not found.');
appJs = appJs.replace(gamesAssignment, 'state.games=dedupe(window.MyHockeyHubFoundation.normalize.games(g))');

const gameCardMarker = 'function gameCard(g){';
if (!appJs.includes(gameCardMarker)) throw new Error('Expected V3.6 gameCard function was not found.');
appJs = appJs.replace(gameCardMarker, "function broadcastAction(g,cls='rowbtn watch-link'){const b=g?._broadcast;if(!b?.available)return'';const provider=b.provider?` · ${b.provider}`:'';return`<a class=\"${escAttr(cls)}\" target=\"_blank\" rel=\"noopener\" href=\"${escAttr(b.url)}\">▶ ${esc(b.label||'Watch')}${esc(provider)} ↗</a>`}\nfunction gameCard(g){");

const gameCardFooter = '<div class="gfoot"><a class="link" target="_blank" rel="noopener" href="https://gamesheetstats.com/seasons/${state.seasonId}/games/${g.gameId}">GameSheet ↗</a>';
if (!appJs.includes(gameCardFooter)) throw new Error('Expected V3.6 game-card footer was not found.');
appJs = appJs.replace(gameCardFooter, '<div class="gfoot"><div class="footer-actions"><a class="link" target="_blank" rel="noopener" href="https://gamesheetstats.com/seasons/${state.seasonId}/games/${g.gameId}">GameSheet ↗</a>${broadcastAction(g)}</div>');

const detailsActions = '<div class="actions"><a class="rowbtn" style="text-decoration:none" href="${escAttr(gs)}" target="_blank" rel="noopener">Open on GameSheet ↗</a></div>';
if (!appJs.includes(detailsActions)) throw new Error('Expected V3.6 game-details actions were not found.');
appJs = appJs.replace(detailsActions, '<div class="actions"><a class="rowbtn" style="text-decoration:none" href="${escAttr(gs)}" target="_blank" rel="noopener">Open on GameSheet ↗</a>${broadcastAction(g)}</div>');

const pollerPattern = /async function pollLive\(\)\{[\s\S]*?\}\s*function startPolling\(\)\{[\s\S]*?\}\s*function updateStatus\(\)\{/;
if (!pollerPattern.test(appJs)) throw new Error('Expected V3.6 live poller was not found.');
appJs = appJs.replace(pollerPattern, `let liveRefreshService=null;
function createAppLiveRefreshService(){return window.MyHockeyHubFoundation.live.createRefreshService({intervalMs:LIVE_MS,getVisibleLive:visibleLive,fetchSnapshot:liveSnapshot,applySnapshots:good=>{if(!good.length)return;const m=new Map(good.map(g=>[String(g.gameId),g]));state.games=state.games.map(g=>m.get(String(g.gameId))||g);render()},onStatus:s=>{state.polling=!!s.running;if(s.lastSuccess)state.lastLive=s.lastSuccess;state.lastError=!!s.lastError;if(!s.running)updateStatus()}})}
async function pollLive(){if(!liveRefreshService)liveRefreshService=createAppLiveRefreshService();return liveRefreshService.refresh()}
function startPolling(){liveRefreshService?.stop();liveRefreshService=createAppLiveRefreshService();window.MyHockeyHubLiveService=liveRefreshService;liveRefreshService.start()}
function updateStatus(){`);

const loadSeasonMarker = 'async function loadSeason(){clearInterval(state.poll);';
if (!appJs.includes(loadSeasonMarker)) throw new Error('Expected V3.6 loadSeason start was not found.');
appJs = appJs.replace(loadSeasonMarker, 'async function loadSeason(){liveRefreshService?.stop();clearInterval(state.poll);');

const visibilityHook = "document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollLive()});";
if (!appJs.includes(visibilityHook)) throw new Error('Expected V3.6 live-refresh visibility hook was not found.');
appJs = appJs.replace(visibilityHook, '');

const debugMarker = "const hasSavedSeason=!!(localStorage.getItem('gsv3.seasonId')";
if (!appJs.includes(debugMarker)) throw new Error('Expected V3.6 startup marker was not found.');
appJs = appJs.replace(debugMarker, `window.MyHockeyHubDebug={snapshot:()=>{const broadcasts=state.games.map(g=>g?._broadcast).filter(Boolean);return{version:'4.0.0-beta.0',view:state.view,seasonId:String(state.seasonId||''),gameCount:state.games.length,liveCount:visibleLive().length,polling:!!state.polling,lastLive:state.lastLive?state.lastLive.toISOString():null,lastError:!!state.lastError,broadcastActionable:broadcasts.filter(b=>b.available).length,broadcastSuppressed:broadcasts.reduce((n,b)=>n+(b.suppressed?.length||0),0)}},refreshLive:()=>pollLive()};${debugMarker}`);

const [routerSource, foundationSource, diagnosticsSource, siteCss, homeHtml] = await Promise.all([
  read('src/app/router.js'),
  read('src/app/foundation.js'),
  read('src/app/diagnostics.js'),
  read('src/site.css'),
  read('src/home.html')
]);
const [{ code: minCss }, { code: minJs }, { code: minRouter }, { code: minFoundation }, { code: minDiagnostics }, { code: minSiteCss }] = await Promise.all([
  transform(appCss, { loader: 'css', minify: true }),
  transform(appJs, { loader: 'js', minify: true, target: 'es2022' }),
  transform(routerSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(foundationSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(diagnosticsSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(siteCss, { loader: 'css', minify: true })
]);

let appHtml = legacy
  .replace(styleMatch[0], '<link rel="stylesheet" href="../assets/app.css">')
  .replace(scriptMatch[0], '<script src="../assets/foundation.js" defer></script>\n<script src="../assets/app.js" defer></script>\n<script src="../assets/router.js" defer></script>\n<script src="../assets/diagnostics.js" defer></script>')
  .replace('<title>MyHockeyHub — V3.6</title>', '<title>MyHockeyHub</title>');

const topActions = '<div class="top-actions"><span class="version">V3.6</span>';
if (!appHtml.includes(topActions)) throw new Error('Expected V3.6 header markup was not found.');
appHtml = appHtml.replace(
  topActions,
  '<div class="top-actions"><a class="iconbtn home-btn" href="../" aria-label="Home" title="Home">⌂</a><span class="version">V3.6</span>'
);

await Promise.all([
  write('index.html', homeHtml),
  write('app/index.html', appHtml),
  write('assets/app.css', minCss),
  write('assets/foundation.js', minFoundation),
  write('assets/app.js', minJs),
  write('assets/router.js', minRouter),
  write('assets/diagnostics.js', minDiagnostics),
  write('assets/site.css', minSiteCss),
  write('.nojekyll', '')
]);

await cp(join(root, 'data'), join(out, 'data'), { recursive: true });
for (const name of await readdir(root)) {
  if (/^v\d.*\.html$/i.test(name)) await cp(join(root, name), join(out, name));
}
for (const name of ['FAQ.md', 'LICENSE', 'versions.html']) await cp(join(root, name), join(out, name));

const compatibilityRedirect = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=app/"><title>Opening MyHockeyHub…</title></head>
<body><p>Opening <a href="app/">MyHockeyHub</a>…</p><script>location.replace('app/'+location.search+location.hash)</script></body></html>`;
await write('gamesheets_plus.html', compatibilityRedirect);

console.log('Built MyHockeyHub static site in dist/.');
