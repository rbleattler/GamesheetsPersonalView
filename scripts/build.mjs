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

const visibilityHook = "document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollLive()});";
if (!appJs.includes(visibilityHook)) throw new Error('Expected live-refresh visibility hook was not found in V3.6.');
appJs = appJs.replace(
  visibilityHook,
  `${visibilityHook}window.addEventListener('online',()=>pollLive());`
);

const [{ code: minCss }, { code: minJs }, routerSource, siteCss, homeHtml] = await Promise.all([
  transform(appCss, { loader: 'css', minify: true }),
  transform(appJs, { loader: 'js', minify: true, target: 'es2022' }),
  read('src/app/router.js'),
  read('src/site.css'),
  read('src/home.html')
]);
const [{ code: minRouter }, { code: minSiteCss }] = await Promise.all([
  transform(routerSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(siteCss, { loader: 'css', minify: true })
]);

let appHtml = legacy
  .replace(styleMatch[0], '<link rel="stylesheet" href="../assets/app.css">')
  .replace(scriptMatch[0], '<script src="../assets/app.js" defer></script>\n<script src="../assets/router.js" defer></script>')
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
