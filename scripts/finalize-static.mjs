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
const faRoot = join(root, 'node_modules/@fortawesome/fontawesome-free/svgs/solid');

const faIcons = {
  house: 'house.svg',
  'circle-question': 'circle-question.svg',
  bars: 'bars.svg',
  users: 'users.svg',
  'location-dot': 'location-dot.svg',
  user: 'user.svg',
  'calendar-days': 'calendar-days.svg',
  'file-lines': 'file-lines.svg',
  'circle-play': 'circle-play.svg',
  'arrow-left': 'arrow-left.svg',
  xmark: 'xmark.svg',
  'chart-line': 'chart-line.svg',
  'trash-can': 'trash-can.svg'
};

const faEntries = await Promise.all(Object.entries(faIcons).map(async ([name, file]) => {
  const svg = await readFile(join(faRoot, file), 'utf8');
  return [name, Buffer.from(svg).toString('base64')];
}));
const faCssSource = [
  '.fa-icon{display:inline-block;width:1em;height:1em;flex:0 0 1em;background-color:currentColor;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;vertical-align:-.125em}',
  ...faEntries.map(([name, data]) => `.fa-${name}{-webkit-mask-image:url("data:image/svg+xml;base64,${data}");mask-image:url("data:image/svg+xml;base64,${data}")}`),
  '.top-actions .fa-icon{font-size:1rem}.nav-icon .fa-icon{font-size:1rem}',
  '.nav{gap:8px}.nav button{display:inline-flex;align-items:center;gap:7px}.nav-icon{display:inline-flex;align-items:center;justify-content:center;line-height:1}',
  '.close,.drawer-back{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:1rem;border:1px solid #30485f;background:#132235;color:#fff;flex:0 0 auto}.close .fa-icon,.drawer-back .fa-icon{font-size:1rem}',
  '.drawer-title-wrap{display:flex;align-items:flex-start;gap:10px;min-width:0}.drawer-title-wrap>div{min-width:0}.drawer-back[hidden]{display:none}',
  '.player-tables{display:grid;gap:16px}.player-subtable h4{margin:0 0 7px;font-size:.82rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}.player-table-scroll{overflow:auto}.goalie-subtable{padding-top:2px;border-top:1px solid rgba(120,150,180,.14)}',
  '@media(max-width:560px){.nav{gap:3px}.nav button{display:grid;gap:2px}}',
  '.team-dashboard-card{padding-bottom:14px}.team-badge{white-space:nowrap}.team-statstrip{margin-top:14px;padding-top:12px;border-top:1px solid rgba(120,150,180,.16)}.team-statstrip .stat b{font-size:.94rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default}.team-card-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}.team-action-btn{display:inline-flex;align-items:center;gap:7px}.team-remove-btn{margin-left:auto}',
  '@media(max-width:560px){.team-statstrip{grid-template-columns:repeat(3,1fr);row-gap:10px}.team-statstrip .stat:nth-child(4){border-left:0}.team-card-actions{gap:6px}.team-remove-btn{margin-left:0}.team-remove-btn .btn-text{display:none}.team-remove-btn{padding-left:11px;padding-right:11px}}'
].join('\n');

const [guardSource, venueLinksSource, cardActionsSource, cardActionsCss, gameNormalizationSource, playerNormalizationSource, teamNormalizationSource] = await Promise.all([
  read('src/app/fetch-guard.js'),
  read('src/app/venue-links.js'),
  read('src/app/card-actions.js'),
  read('src/app/card-actions.css'),
  read('src/app/game-normalization.js'),
  read('src/app/player-normalization.js'),
  read('src/app/team-normalization.js')
]);
const [{ code: minGuard }, { code: minVenueLinks }, { code: minCardActions }, { code: minCardActionsCss }, { code: minGameNormalization }, { code: minPlayerNormalization }, { code: minTeamNormalization }, { code: minFaCss }] = await Promise.all([
  transform(guardSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(venueLinksSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(cardActionsSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(cardActionsCss, { loader: 'css', minify: true }),
  transform(gameNormalizationSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(playerNormalizationSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(teamNormalizationSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(faCssSource, { loader: 'css', minify: true })
]);
const [existingAppCss, existingAppJs] = await Promise.all([
  readDist('assets/app.css'),
  readDist('assets/app.js')
]);
let finalizedAppJs = existingAppJs
  .replaceAll('version:"3.6"', 'version:"4.0"')
  .replaceAll('version:"4.0.0-beta.0"', 'version:"4.0.0"');
await Promise.all([
  writeDist('assets/fetch-guard.js', minGuard),
  writeDist('assets/venue-links.js', minVenueLinks),
  writeDist('assets/card-actions.js', minCardActions),
  writeDist('assets/game-normalization.js', minGameNormalization),
  writeDist('assets/player-normalization.js', minPlayerNormalization),
  writeDist('assets/team-normalization.js', minTeamNormalization),
  writeDist('assets/app.js', finalizedAppJs),
  writeDist('assets/app.css', `${existingAppCss}\n${minFaCss}\n${minCardActionsCss}`)
]);

const assetPaths = [
  'assets/app.css',
  'assets/foundation.js',
  'assets/drawer-navigation.js',
  'assets/game-normalization.js',
  'assets/player-normalization.js',
  'assets/team-normalization.js',
  'assets/app.js',
  'assets/router.js',
  'assets/venue-links.js',
  'assets/card-actions.js',
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
const icon = name => `<span class="fa-icon fa-${name}" aria-hidden="true"></span>`;

let appHtml = await readDist('app/index.html');
if (!appHtml.includes('name="myhockeyhub-build"')) {
  appHtml = appHtml.replace('<head>', `<head>\n${cacheMeta}`);
}
appHtml = appHtml
  .replace('<span class="version">V3.6</span>', '<span class="version">V4.0</span>')
  .replace('<div class="drawerhead"><div><h2 id="drawerTitle">Details</h2><div id="drawerSub" class="muted"></div></div>', `<div class="drawerhead"><div class="drawer-title-wrap"><button id="backDrawer" class="drawer-back" type="button" aria-label="Back" title="Back" hidden>${icon('arrow-left')}</button><div><h2 id="drawerTitle">Details</h2><div id="drawerSub" class="muted"></div></div></div>`)
  .replace(/(<a class="iconbtn home-btn"[^>]*>).*?(<\/a>)/, `$1${icon('house')}$2`)
  .replace(/(<button id="helpBtn"[^>]*>).*?(<\/button>)/, `$1${icon('circle-question')}$2`)
  .replace(/(<button id="menuBtn"[^>]*>).*?(<\/button>)/, `$1${icon('bars')}$2`)
  .replace(/(<button id="closeDrawer"[^>]*>).*?(<\/button>)/, `$1${icon('xmark')}$2`)
  .replace('<span class="nav-icon">👥</span>', `<span class="nav-icon">${icon('users')}</span>`)
  .replace('<span class="nav-icon">📍</span>', `<span class="nav-icon">${icon('location-dot')}</span>`)
  .replace('<span class="nav-icon">👤</span>', `<span class="nav-icon">${icon('user')}</span>`)
  .replace('<span class="nav-icon">🗓</span>', `<span class="nav-icon">${icon('calendar-days')}</span>`);
appHtml = appHtml.replace(
  '<script src="../assets/foundation.js" defer></script>',
  '<script src="../assets/fetch-guard.js" defer></script>\n<script src="../assets/foundation.js" defer></script>\n<script src="../assets/game-normalization.js" defer></script>\n<script src="../assets/player-normalization.js" defer></script>\n<script src="../assets/team-normalization.js" defer></script>'
);
appHtml = appHtml.replace(
  '<script src="../assets/diagnostics.js" defer></script>',
  '<script src="../assets/venue-links.js" defer></script>\n<script src="../assets/card-actions.js" defer></script>\n<script src="../assets/diagnostics.js" defer></script>'
);
appHtml = appHtml.replace(
  /\.\.\/assets\/(?:app\.css|foundation\.js|drawer-navigation\.js|game-normalization\.js|player-normalization\.js|team-normalization\.js|app\.js|router\.js|venue-links\.js|card-actions\.js|diagnostics\.js|fetch-guard\.js)(?:\?v=[a-f0-9]+)?/g,
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
