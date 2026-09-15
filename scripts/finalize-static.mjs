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
  '.player-tables{display:grid;gap:16px;min-width:0}.player-subtable{min-width:0}.player-subtable h4{margin:0 0 7px;font-size:.82rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}.player-table-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;min-width:0}.goalie-subtable{padding-top:2px;border-top:1px solid rgba(120,150,180,.14)}',
  '.player-table-scroll table{min-width:540px;width:100%;table-layout:fixed}.player-table-scroll th,.player-table-scroll td{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player-table-scroll .col-icon{width:32px;text-align:center;padding-left:4px;padding-right:4px}.player-table-scroll .col-team{width:96px}.player-table-scroll .col-player{width:auto}.player-table-scroll .col-narrow{width:42px;text-align:center}.player-table-scroll .col-num{width:52px;text-align:right}',
  '@media(max-width:560px){.player-table-scroll table{min-width:480px}.player-table-scroll .col-team{width:72px}.player-table-scroll .col-num{width:46px}}',
  '.player-tables-mobile{display:none}.team-tabs{display:flex;gap:6px;margin-bottom:10px;overflow:auto}.team-tab-btn{flex:0 0 auto;border:1px solid #30455e;background:#0c1826;color:#b9c9dc;border-radius:999px;padding:7px 12px;font-size:.78rem;font-weight:750;white-space:nowrap}.team-tab-btn.active{background:#157bdc;border-color:#2d99f3;color:#fff}.team-tab-pane{display:none}.team-tab-pane.active{display:block}',
  '.player-tables-mobile .player-table-scroll table{min-width:0;width:100%}.player-tables-mobile td{padding:6px 2px;font-size:clamp(.7rem,3.4vw,.8rem)}.player-tables-mobile th{padding:4px 2px;font-size:clamp(.52rem,2.6vw,.64rem);white-space:normal;word-break:break-word;overflow:visible;text-overflow:clip;line-height:1.15;vertical-align:bottom}.player-tables-mobile .col-narrow{width:24px;text-align:center}',
  '.player-num{display:inline-block;min-width:1.4em;margin-right:5px;color:var(--muted);font-weight:800;font-variant-numeric:tabular-nums}',
  '.followed-row{background:rgba(255,190,63,.08)}.followed-row td:first-child{box-shadow:inset 3px 0 0 var(--amber)}',
  '.player-tables-mobile .player-table-scroll{overflow-x:auto;scrollbar-width:thin}',
  '.player-tables-mobile .player-table-scroll table{width:100%;min-width:0;table-layout:auto}',
  '.player-tables-mobile .col-player{width:auto;min-width:var(--mhh-player-col,96px);position:sticky;left:0;z-index:2;background:#0e1a28;white-space:normal;overflow-wrap:break-word;line-height:1.25;box-shadow:7px 0 7px -7px rgba(0,0,0,.85)}',
  '.player-tables-mobile th.col-player{white-space:nowrap;letter-spacing:.04em;padding-left:5px}',
  '.player-tables-mobile .col-num{width:40px;min-width:40px;text-align:right;white-space:nowrap}',
  '.player-tables-mobile th.col-num{white-space:nowrap;word-break:normal}',
  '.player-tables-mobile td.col-num{vertical-align:top}',
  '.player-tables-mobile td.col-player{display:flex;align-items:flex-start;gap:0}',
  '.player-tables-mobile td.col-player .player-num{flex:0 0 22px;min-width:22px;margin-right:7px;text-align:right}',
  '.player-tables-mobile td.col-player .player-link{flex:1 1 auto;min-width:0}',
  '.player-tables-mobile th,.player-tables-mobile td{border-left:1px solid rgba(120,150,180,.09)}',
  '.player-tables-mobile th:first-child,.player-tables-mobile td:first-child{border-left:0}',
  '.player-tables-mobile .team-tabs{gap:0;margin:0 0 10px;border-bottom:1px solid var(--line)}',
  '.player-tables-mobile .team-tab-btn{flex:0 0 auto;border:0;border-bottom:3px solid transparent;border-radius:0;background:none;color:var(--muted);padding:9px 10px;font-size:.82rem;font-weight:750}',
  '.player-tables-mobile .team-tab-btn.active{background:none;border-bottom-color:var(--blue);color:var(--blue);font-weight:800}',
  'html[data-theme="light"] .player-tables-mobile .col-player{background:#fff}',
  '.followed-row .col-player{background:#21272a}',
  'html[data-theme="light"] .followed-row .col-player{background:#f7f3eb}',
  '.stat-legend{display:flex;flex-wrap:wrap;gap:5px 12px;margin:2px 0 14px;padding-top:8px;border-top:1px solid rgba(120,150,180,.14);font-size:.68rem;color:var(--muted)}.stat-legend b{color:var(--text);font-weight:800;margin-right:2px}',
  '@media(max-width:560px){.player-tables-desktop{display:none}.player-tables-mobile{display:block}.stat-legend{font-size:.64rem;gap:4px 9px}}',
  '@media(max-width:560px){.nav{gap:3px}.nav button{display:grid;gap:2px}}',
  '.team-dashboard-card{padding-bottom:14px}.team-badge{white-space:nowrap;display:inline-flex;align-items:center;gap:0}.team-badge-remove{display:none;align-items:center;justify-content:center;border:0;background:transparent;color:var(--red);padding:4px 2px 4px 9px;margin-left:7px;border-left:1px solid rgba(255,65,65,.35);cursor:pointer;line-height:1}.team-badge-remove .fa-icon{width:.85em;height:.85em}.team-statstrip{margin-top:14px;padding-top:12px;border-top:1px solid rgba(120,150,180,.16)}.team-statstrip .stat b{font-size:.94rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default}.team-card-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}.team-action-btn{display:inline-flex;align-items:center;gap:7px}.team-remove-btn{margin-left:auto}',
  '@media(max-width:560px){.team-statstrip{grid-template-columns:repeat(3,1fr);row-gap:10px}.team-statstrip .stat:nth-child(4){border-left:0}.team-card-actions{gap:6px}.team-action-btn.team-remove-btn{display:none}.team-badge-remove{display:inline-flex}}',
  '.my-team-switcher-select{display:none}.my-team-switcher-pills{display:flex;gap:7px;overflow:auto;flex:1 1 auto}',
  '@media(max-width:560px){.my-team-switcher-select{display:block;flex:1 1 auto;min-height:44px;background:#0c1826;color:var(--text);border:1px solid #30455e;border-radius:12px;padding:9px 12px;font-weight:750}.my-team-switcher-pills{display:none}}'
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
