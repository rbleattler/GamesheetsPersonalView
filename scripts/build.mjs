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

let appCss = `${styleMatch[1]}\n.home-btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:1.1rem;min-width:42px}`;
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

const visibilityHook = "document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollLive()});";
if (!appJs.includes(visibilityHook)) throw new Error('Expected live-refresh visibility hook was not found in V3.6.');
appJs = appJs.replace(
  visibilityHook,
  `${visibilityHook}window.addEventListener('online',()=>pollLive());`
);

const [routerSource, foundationSource, siteCss, homeHtml] = await Promise.all([
  read('src/app/router.js'),
  read('src/app/foundation.js'),
  read('src/site.css'),
  read('src/home.html')
]);
const [{ code: minCss }, { code: minJs }, { code: minRouter }, { code: minFoundation }, { code: minSiteCss }] = await Promise.all([
  transform(appCss, { loader: 'css', minify: true }),
  transform(appJs, { loader: 'js', minify: true, target: 'es2022' }),
  transform(routerSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(foundationSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(siteCss, { loader: 'css', minify: true })
]);

let appHtml = legacy
  .replace(styleMatch[0], '<link rel="stylesheet" href="../assets/app.css">')
  .replace(scriptMatch[0], '<script src="../assets/foundation.js" defer></script>\n<script src="../assets/app.js" defer></script>\n<script src="../assets/router.js" defer></script>')
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
