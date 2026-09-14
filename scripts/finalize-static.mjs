import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const read = path => readFile(join(root, path), 'utf8');
const readDist = path => readFile(join(dist, path), 'utf8');
const writeDist = (path, content) => writeFile(join(dist, path), content);

const [guardSource, venueLinksSource] = await Promise.all([
  read('src/app/fetch-guard.js'),
  read('src/app/venue-links.js')
]);
const [{ code: minGuard }, { code: minVenueLinks }] = await Promise.all([
  transform(guardSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(venueLinksSource, { loader: 'js', minify: true, target: 'es2022' })
]);
await Promise.all([
  writeDist('assets/fetch-guard.js', minGuard),
  writeDist('assets/venue-links.js', minVenueLinks)
]);

const assetPaths = [
  'assets/app.css',
  'assets/foundation.js',
  'assets/app.js',
  'assets/router.js',
  'assets/venue-links.js',
  'assets/diagnostics.js',
  'assets/site.css',
  'assets/fetch-guard.js'
];
const assetContents = await Promise.all(assetPaths.map(readDist));
const buildId = createHash('sha256')
  .update(assetContents.join('\n---asset---\n'))
  .digest('hex')
  .slice(0, 12);

const cacheMeta = `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n<meta http-equiv="Pragma" content="no-cache">\n<meta http-equiv="Expires" content="0">\n<meta name="myhockeyhub-build" content="${buildId}">`;
const versionAsset = value => `${value.split('?')[0]}?v=${buildId}`;

let appHtml = await readDist('app/index.html');
if (!appHtml.includes('name="myhockeyhub-build"')) {
  appHtml = appHtml.replace('<head>', `<head>\n${cacheMeta}`);
}
appHtml = appHtml.replace(
  '<script src="../assets/foundation.js" defer></script>',
  '<script src="../assets/fetch-guard.js" defer></script>\n<script src="../assets/foundation.js" defer></script>'
);
appHtml = appHtml.replace(
  '<script src="../assets/diagnostics.js" defer></script>',
  '<script src="../assets/venue-links.js" defer></script>\n<script src="../assets/diagnostics.js" defer></script>'
);
appHtml = appHtml.replace(
  /\.\.\/assets\/(?:app\.css|foundation\.js|app\.js|router\.js|venue-links\.js|diagnostics\.js|fetch-guard\.js)(?:\?v=[a-f0-9]+)?/g,
  match => versionAsset(match)
);
await writeDist('app/index.html', appHtml);

let homeHtml = await readDist('index.html');
if (!homeHtml.includes('name="myhockeyhub-build"')) {
  homeHtml = homeHtml.replace('<head>', `<head>\n${cacheMeta}`);
}
homeHtml = homeHtml.replace(/assets\/site\.css(?:\?v=[a-f0-9]+)?/g, match => versionAsset(match));
await writeDist('index.html', homeHtml);

console.log(`Finalized static assets with build id ${buildId}.`);
