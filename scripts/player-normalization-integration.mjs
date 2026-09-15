import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appPath = join(root, 'dist/assets/app.js');
let code = await readFile(appPath, 'utf8');

const stateMatch = code.match(/,([A-Za-z_$][\w$]*)=\{seasonId:localStorage\.getItem\("gsv3\.seasonId"\)/);
if (!stateMatch) throw new Error('Could not identify the minified app state object.');
const state = stateMatch[1];

function functionBoundsContaining(fragment) {
  const index = code.indexOf(fragment);
  if (index < 0) throw new Error(`Could not find player integration marker: ${fragment}`);

  let functionIndex = code.lastIndexOf('function ', index);
  if (functionIndex < 0) throw new Error(`Could not find function containing marker: ${fragment}`);
  let start = functionIndex;
  if (functionIndex >= 6 && code.slice(functionIndex - 6, functionIndex) === 'async ') start -= 6;

  const signatureEnd = code.indexOf('{', functionIndex);
  const signature = code.slice(functionIndex, signatureEnd);
  const signatureMatch = signature.match(/^function ([A-Za-z_$][\w$]*)\(([^)]*)\)$/);
  if (!signatureMatch) throw new Error(`Could not parse function signature for marker: ${fragment}`);

  const tail = code.slice(index + fragment.length);
  const nextMatch = tail.match(/(?:async )?function [A-Za-z_$][\w$]*\(/);
  if (!nextMatch || nextMatch.index == null) throw new Error(`Could not find function boundary after marker: ${fragment}`);
  const end = index + fragment.length + nextMatch.index;

  return {
    start,
    end,
    name: signatureMatch[1],
    params: signatureMatch[2],
    async: code.slice(start, functionIndex) === 'async '
  };
}

function replaceFunctionContaining(fragment, replacementFactory) {
  const bounds = functionBoundsContaining(fragment);
  const replacement = replacementFactory(bounds);
  code = code.slice(0, bounds.start) + replacement + code.slice(bounds.end);
  return bounds.name;
}

replaceFunctionContaining('svPercentage', ({ name }) => `function ${name}(e,t,a){
  const r=e||{},p=r.player||r.skater||r.goalie||r,rawTeam=r.team||p.team||{},teamId=String(rawTeam.id??r.teamId??p.teamId??''),team=${state}.teams.find(x=>String(x.id)===teamId)||{},rawDivision=r.division||p.division||{},divisionId=String(rawDivision.id??a??''),division=${state}.divisions.find(x=>String(x.id)===divisionId)||{};
  return window.MyHockeyHubPlayerNormalization.normalizeStandingPlayer(r,{kind:t,team,teamId,division,divisionId})
}`);

replaceFunctionContaining('Object.keys(a).filter', ({ name }) => `function ${name}(e){return window.MyHockeyHubPlayerNormalization.dedupePlayers(e)}`);

replaceFunctionContaining('Roster fallback failed for game', ({ name }) => `async function ${name}(e,t){
  const rows=[],divisionTitle=${state}.divisions.find(d=>String(d.id)===String(t))?.title||'',dateOf=g=>new Date(g.timeStampZulu||\`${'${g.date||""} ${g.time||""}'}\`);
  for(const teamId of e){
    const games=${state}.games.filter(g=>(String(g.home?.id||'')===String(teamId)||String(g.visitor?.id||'')===String(teamId))&&dateOf(g)<=new Date).sort((a,b)=>dateOf(b)-dateOf(a));
    for(const game of games.slice(0,8))try{
      const raw=await window.MyHockeyHubFoundation.api.firestoreGame(${state}.seasonId,game.gameId),decoded=window.MyHockeyHubGameNormalization.firestoreDocument(raw);
      rows.push(...window.MyHockeyHubPlayerNormalization.teamRosterFromGame(game,decoded,teamId,{divisionId:String(t||''),divisionTitle}))
    }catch(error){console.warn('Roster fallback failed for game',game.gameId,error)}
  }
  return window.MyHockeyHubPlayerNormalization.dedupePlayers(rows)
}`);

replaceFunctionContaining('detail:`Assist on ${', ({ name }) => `function ${name}(e,t){return window.MyHockeyHubPlayerNormalization.playerEvents(e,t)}`);

replaceFunctionContaining('Player game detail unavailable', ({ name }) => `async function ${name}(e){
  const teamId=String(e.teamId||''),dateOf=g=>new Date(g.timeStampZulu||\`${'${g.date||""} ${g.time||""}'}\`),statusOf=g=>String(g?.status||'').toLowerCase().replace(/[_-]+/g,' ').trim(),games=${state}.games.filter(g=>teamId&&(String(g.home?.id||'')===teamId||String(g.visitor?.id||'')===teamId)&&statusOf(g)==='final').sort((a,b)=>dateOf(b)-dateOf(a)).slice(0,6),rows=[];
  for(const game of games)try{
    const raw=await window.MyHockeyHubFoundation.api.firestoreGame(${state}.seasonId,game.gameId),decoded=window.MyHockeyHubGameNormalization.firestoreDocument(raw),activity=window.MyHockeyHubPlayerNormalization.playerGameActivity(game,decoded,e,{teamId});
    if(activity)rows.push({...activity,date:dateOf(game)})
  }catch(error){console.warn('Player game detail unavailable',game.gameId,error)}
  return rows
}`);

replaceFunctionContaining('photo:a.photoURL||""', ({ name }) => `function ${name}(e,t){return window.MyHockeyHubPlayerNormalization.normalizePlayer(e,{team:t||{},teamId:t?.id,division:t?.division||{},divisionId:t?.division?.id})}`);

const playerHeader = '<th>Team</th><th>Player</th><th>#</th><th>G</th>';
if (!code.includes(playerHeader)) throw new Error('Could not find game-stats player table header.');
code = code.replace(playerHeader, '<th>Team</th><th>Player</th><th>Pos</th><th>#</th><th>G</th>');

const playerRowPattern = /<td>\$\{([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*)\.number\|\|\2\.jersey\|\|""\)\}<\/td><td>\$\{\1\(\2\.g\?\?0\)\}<\/td>/;
const playerRowMatch = code.match(playerRowPattern);
if (!playerRowMatch) throw new Error('Could not find game-stats player number/stat cells.');
const [, escapeFn, playerVar] = playerRowMatch;
const expr = value => '${' + value + '}';
code = code.replace(playerRowPattern,
  `<td>${expr(`${escapeFn}(window.MyHockeyHubPlayerNormalization.positionCode(${playerVar}.position,${playerVar}.kind))`)}</td>` +
  `<td>${expr(`${escapeFn}(${playerVar}.number||${playerVar}.jersey||"")`)}</td>` +
  `<td>${expr(`${escapeFn}(${playerVar}.g??0)`)}</td>`
);

const { code: minified } = await transform(code, {
  loader: 'js',
  minify: true,
  target: 'es2022'
});
await writeFile(appPath, minified);

console.log('Routed player standings, roster fallback, player events, recent activity, dedupe, stats-player registration, and game-stats position labels through MyHockeyHubPlayerNormalization.');
