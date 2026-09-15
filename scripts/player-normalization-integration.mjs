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

replaceFunctionContaining('No roster data reported.', ({ name, params }) => {
  const box = params.split(',')[0] || 'e';
  return `function ${name}(${params}){
    const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const favs=${state}.favoritePlayersBySeason[${state}.seasonId]||{};
    const normalize=(side,team)=>(team?.roster?.players||[]).map(raw=>{
      const player=window.MyHockeyHubPlayerNormalization.normalizePlayer(raw,{team:team||{},teamId:team?.id,division:team?.division||{},divisionId:team?.division?.id});
      player._side=side;player._team=team?.title||(side==='visitor'?'Away':'Home');
      if(player.id){const id=String(player.id);${state}.playerRegistry[id]=window.MyHockeyHubPlayerNormalization.mergePlayerRecord(${state}.playerRegistry[id]||{},player,{scope:'game'})}
      return player
    });
    const rows=window.MyHockeyHubPlayerNormalization.completeGoalieMetrics([...normalize('visitor',${box}.visitor),...normalize('home',${box}.home)],{scope:'game'}).filter(player=>player.id&&player.name);
    if(!rows.length)return '<div class="empty" style="padding:16px">No roster data reported.</div>';
    const goalies=rows.filter(player=>window.MyHockeyHubPlayerNormalization.positionCode(player.position,player.kind)==='G');
    const skaters=rows.filter(player=>window.MyHockeyHubPlayerNormalization.positionCode(player.position,player.kind)!=='G');
    const follow=player=>\`<button class="star player-follow \${favs[String(player.id)]?'active':''}" data-player="\${esc(player.id)}" data-side="\${esc(player._side)}" title="\${favs[String(player.id)]?'Unfollow player':'Follow player'}">\${favs[String(player.id)]?'★':'☆'}</button>\`;
    const playerLink=player=>\`<button class="player-link" data-player="\${esc(player.id)}">\${esc(player.name)}</button>\`;
    const formatGaa=window.MyHockeyHubPlayerNormalization.formatGaa;
    const formatSvPct=window.MyHockeyHubPlayerNormalization.formatSvPct;
    const formatMinutes=value=>{if(value==null||value===''||value==='—')return '—';const n=Number(value);return Number.isFinite(n)?String(Math.round(n)):String(value)};
    const skaterTable=skaters.length?\`<section class="player-subtable"><h4>Skaters</h4><div class="player-table-scroll"><table><thead><tr><th></th><th>Team</th><th>Player</th><th>Pos</th><th>#</th><th>G</th><th>A</th><th>PTS</th><th>PIM</th><th>SOG</th></tr></thead><tbody>\${skaters.map(player=>\`<tr><td>\${follow(player)}</td><td>\${esc(player._team)}</td><td>\${playerLink(player)}</td><td>\${esc(window.MyHockeyHubPlayerNormalization.positionCode(player.position,player.kind))}</td><td>\${esc(player.number||'')}</td><td>\${esc(player.g??0)}</td><td>\${esc(player.a??0)}</td><td>\${esc(player.pts??0)}</td><td>\${esc(player.pim??0)}</td><td>\${esc(player.sog??'—')}</td></tr>\`).join('')}</tbody></table></div></section>\`:'';
    const goalieTable=goalies.length?\`<section class="player-subtable goalie-subtable"><h4>Goalies</h4><div class="player-table-scroll"><table><thead><tr><th></th><th>Team</th><th>Player</th><th>#</th><th>SV</th><th>SA</th><th>GA</th><th>SV%</th><th>GAA</th><th>MIN</th></tr></thead><tbody>\${goalies.map(player=>\`<tr><td>\${follow(player)}</td><td>\${esc(player._team)}</td><td>\${playerLink(player)}</td><td>\${esc(player.number||'')}</td><td>\${esc(player.saves??'—')}</td><td>\${esc(player.sa??'—')}</td><td>\${esc(player.ga??'—')}</td><td>\${esc(formatSvPct(player.svPct))}</td><td>\${esc(formatGaa(player.gaa))}</td><td>\${esc(formatMinutes(player.minutes))}</td></tr>\`).join('')}</tbody></table></div></section>\`:'';
    return \`<div class="player-tables">\${skaterTable}\${goalieTable}</div>\`
  }`;
});

const { code: minified } = await transform(code, {
  loader: 'js',
  minify: true,
  target: 'es2022'
});
await writeFile(appPath, minified);

console.log('Routed player standings, roster fallback, player events, recent activity, dedupe, stats-player registration, derived goalie rates, and split skater/goalie game tables through MyHockeyHubPlayerNormalization.');
