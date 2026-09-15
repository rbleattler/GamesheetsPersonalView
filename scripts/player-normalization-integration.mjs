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

// Minimal JS-aware scanner used only to find the END of a function reliably.
// Scanning forward for "the next `function` keyword" (the previous approach)
// silently swallows any non-function statements sitting between the target
// function and whatever function happens to follow it in the minified output
// (e.g. top-level `const` declarations) -- those bytes get deleted along with
// the function they get merged into. Real brace/string/template/regex-aware
// matching from the function's own opening `{` does not have that failure mode.
function skipStringLiteral(text, index, quote) {
  let i = index + 1;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === quote) return i + 1;
    i++;
  }
  return text.length;
}

function skipTemplateLiteral(text, index) {
  let i = index + 1;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === '`') return i + 1;
    if (text[i] === '$' && text[i + 1] === '{') { i = skipBalancedBraces(text, i + 1); continue; }
    i++;
  }
  return text.length;
}

function looksLikeRegexContext(text, index) {
  let j = index - 1;
  while (j >= 0 && /\s/.test(text[j])) j--;
  if (j < 0) return true;
  const ch = text[j];
  if (/[A-Za-z0-9_$)\]]/.test(ch)) {
    const word = text.slice(0, j + 1).match(/([A-Za-z_$][\w$]*)$/);
    return !!(word && ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await'].includes(word[1]));
  }
  return true;
}

function skipRegexLiteral(text, index) {
  let i = index + 1;
  let inClass = false;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === '[') { inClass = true; i++; continue; }
    if (text[i] === ']') { inClass = false; i++; continue; }
    if (text[i] === '/' && !inClass) { i++; break; }
    i++;
  }
  while (i < text.length && /[a-z]/i.test(text[i])) i++;
  return i;
}

// `openBraceIndex` must point at a '{'. Returns the index just past its
// matching '}', correctly skipping over string/template/regex literal
// contents so braces inside them are never mistaken for real block braces.
function skipBalancedBraces(text, openBraceIndex) {
  let i = openBraceIndex + 1;
  let depth = 1;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === '"' || ch === "'") { i = skipStringLiteral(text, i, ch); continue; }
    if (ch === '`') { i = skipTemplateLiteral(text, i); continue; }
    if (ch === '/' && looksLikeRegexContext(text, i)) { i = skipRegexLiteral(text, i); continue; }
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') { depth--; i++; continue; }
    i++;
  }
  return i;
}

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

  const end = skipBalancedBraces(code, signatureEnd);
  if (index + fragment.length > end) throw new Error(`Marker fell outside its own function body: ${fragment}`);

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
    const playerLink=player=>\`\${player.number?\`<span class="player-num">\${esc(player.number)}</span>\`:''}<button class="player-link" data-player="\${esc(player.id)}">\${esc(player.name)}</button>\`;
    const formatGaa=window.MyHockeyHubPlayerNormalization.formatGaa;
    const formatSvPct=window.MyHockeyHubPlayerNormalization.formatSvPct;
    const formatMinutes=value=>{if(value==null||value===''||value==='—')return '—';const n=Number(value);return Number.isFinite(n)?String(Math.round(n)):String(value)};
    const useful=value=>value!=null&&value!==''&&value!=='—';
    const rowAttrs=player=>favs[String(player.id)]?' class="followed-row"':'';
    const canonicalPos=player=>window.MyHockeyHubPlayerNormalization.canonicalPosition(player.position,player.kind);
    const SKATER_COLUMNS=[
      {header:'G',label:'Goals',value:p=>p.g??0},
      {header:'A',label:'Assists',value:p=>p.a??0},
      {header:'PT',label:'Points',value:p=>p.pts??0},
      {header:'PIM',label:'Penalty min.',value:p=>p.pim??0},
      {header:'SOG',label:'Shots on goal',value:p=>p.sog??'—'}
    ];
    const GOALIE_COLUMNS=[
      {header:'SV',label:'Saves',value:p=>p.saves??'—'},
      {header:'SA',label:'Shots against',value:p=>p.sa??'—'},
      {header:'GA',label:'Goals against',value:p=>p.ga??'—'},
      {header:'SV%',label:'Save %',value:p=>formatSvPct(p.svPct)},
      {header:'GAA',label:'Goals against avg.',value:p=>formatGaa(p.gaa)},
      {header:'MIN',label:'Minutes',value:p=>formatMinutes(p.minutes)}
    ];
    const visibleColumns=(cols,rowset)=>cols.filter(c=>rowset.some(p=>useful(c.value(p))));
    const groupTable=(title,groupRows,cols,goalie,showTeam)=>{
      if(!groupRows.length)return '';
      const headCells=(showTeam?'<th class="col-team">Team</th>':'')+'<th class="col-player">Player</th>'+cols.map(c=>\`<th class="col-num">\${esc(c.header)}</th>\`).join('');
      const bodyRows=groupRows.map(p=>{
        const cells=(showTeam?\`<td class="col-team">\${esc(p._team)}</td>\`:'')+\`<td class="col-player">\${playerLink(p)}</td>\`+cols.map(c=>\`<td class="col-num">\${esc(c.value(p))}</td>\`).join('');
        return \`<tr\${rowAttrs(p)}>\${cells}</tr>\`;
      }).join('');
      return \`<section class="player-subtable\${goalie?' goalie-subtable':''}"><h4>\${esc(title)}</h4><div class="player-table-scroll"><table><thead><tr>\${headCells}</tr></thead><tbody>\${bodyRows}</tbody></table></div></section>\`;
    };
    const legend=cols=>cols.length?\`<div class="stat-legend">\${cols.map(c=>\`<span><b>\${esc(c.header)}</b> \${esc(c.label)}</span>\`).join('')}</div>\`:'';
    const skaterSections=(skaterRows,showTeam)=>{
      if(!skaterRows.length)return '';
      const cols=visibleColumns(SKATER_COLUMNS,skaterRows);
      const forwards=skaterRows.filter(p=>canonicalPos(p)==='Forward');
      const defense=skaterRows.filter(p=>canonicalPos(p)==='Defense');
      const others=skaterRows.filter(p=>canonicalPos(p)!=='Forward'&&canonicalPos(p)!=='Defense');
      return groupTable('Forwards',forwards,cols,false,showTeam)+groupTable('Defense',defense,cols,false,showTeam)+groupTable('Skaters',others,cols,false,showTeam)+legend(cols);
    };
    const goalieSection=(goalieRows,showTeam)=>{
      if(!goalieRows.length)return '';
      const cols=visibleColumns(GOALIE_COLUMNS,goalieRows);
      return groupTable('Goalies',goalieRows,cols,true,showTeam)+legend(cols);
    };
    const desktopTables=\`<div class="player-tables-desktop"><div class="player-tables">\${skaterSections(skaters,true)}\${goalieSection(goalies,true)}</div></div>\`;
    const teamSides=[{side:'visitor',label:${box}.visitor?.title||'Away'},{side:'home',label:${box}.home?.title||'Home'}];
    const teamPane=(side,label,active)=>{
      const teamSkaters=skaters.filter(p=>p._side===side);
      const teamGoalies=goalies.filter(p=>p._side===side);
      const body=skaterSections(teamSkaters,false)+goalieSection(teamGoalies,false)+(!teamSkaters.length&&!teamGoalies.length?'<div class="empty" style="padding:16px">No roster data reported.</div>':'');
      return \`<div class="team-tab-pane\${active?' active':''}" data-team-pane="\${esc(side)}"><div class="player-tables">\${body}</div></div>\`;
    };
    const teamTabsHtml=teamSides.map((s,i)=>\`<button class="team-tab-btn\${i===0?' active':''}" type="button" data-team-tab="\${esc(s.side)}">\${esc(s.label||(s.side==='visitor'?'Away':'Home'))}</button>\`).join('');
    const teamPanesHtml=teamSides.map((s,i)=>teamPane(s.side,s.label,i===0)).join('');
    const mobileTables=\`<div class="player-tables-mobile"><div class="team-tabs">\${teamTabsHtml}</div>\${teamPanesHtml}</div>\`;
    return \`\${desktopTables}\${mobileTables}\`
  }`;
});

const { code: minified } = await transform(code, {
  loader: 'js',
  minify: true,
  target: 'es2022'
});
await writeFile(appPath, minified);

console.log('Routed player standings, roster fallback, player events, recent activity, dedupe, stats-player registration, derived goalie rates, and split skater/goalie game tables through MyHockeyHubPlayerNormalization.');
