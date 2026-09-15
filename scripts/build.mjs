import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const legacyPath = join(root, 'src/baseline/v3.6.html');

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

let appCss = `${styleMatch[1]}\n.home-btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:1.1rem;min-width:42px}.watch-link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none}.debug-panel{position:fixed;z-index:90;right:12px;bottom:12px;width:min(360px,calc(100vw - 24px));border:1px solid var(--line);border-radius:14px;background:rgba(7,17,28,.97);box-shadow:0 18px 54px rgba(0,0,0,.45);padding:10px;color:var(--text);font-size:.76rem}.debug-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.debug-head button{border:0;background:transparent;color:var(--muted);font-size:1.1rem}.debug-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.debug-grid>div{border:1px solid rgba(120,150,180,.18);border-radius:9px;padding:6px;background:rgba(18,32,48,.65)}.debug-grid span{display:block;color:var(--muted);font-size:.62rem;text-transform:uppercase}.debug-grid b{display:block;margin-top:2px;overflow-wrap:anywhere}.debug-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.debug-actions button{border:1px solid #35506d;background:#102239;color:var(--text);border-radius:8px;padding:6px 8px;font-size:.7rem}.debug-note{margin-top:7px;color:var(--muted);font-size:.67rem;line-height:1.35}html[data-theme=light] .debug-panel{background:rgba(255,255,255,.98)}html[data-theme=light] .debug-grid>div{background:#f5f8fb}`;
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

const endpointRewrites = [
  ["fetchJson(`${API}/season-info/${state.seasonId}`)", "window.MyHockeyHubFoundation.api.seasonInfo(state.seasonId)"],
  ["fetchJson(`${API}/season-divisions/${state.seasonId}`)", "window.MyHockeyHubFoundation.api.seasonDivisions(state.seasonId)"],
  ["fetchJson(`${API}/unified-games/${state.seasonId}`)", "window.MyHockeyHubFoundation.api.unifiedGames(state.seasonId)"],
  ["fetchJson(`${API}/season-info/${m[1]}`)", "window.MyHockeyHubFoundation.api.seasonInfo(m[1])"],
  ["fetchJson(`${API}/players/standings/${state.seasonId}${base}&sort=-pts`)", "window.MyHockeyHubFoundation.api.skaterStandings(state.seasonId,`${base}&sort=-pts`)"],
  ["fetchJson(`${API}/goalies/standings/${state.seasonId}${base}&sort=gaa`)", "window.MyHockeyHubFoundation.api.goalieStandings(state.seasonId,`${base}&sort=gaa`)" ]
];
for (const [from,to] of endpointRewrites) {
  if (!appJs.includes(from)) throw new Error(`Expected V3.6 endpoint call was not found: ${from}`);
  appJs = appJs.split(from).join(to);
}

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

const scoreLink = '<a class="score-gs" target="_blank" rel="noopener" href="${escAttr(gs)}">GameSheet ↗</a></div><div class="score-team">';
if (!appJs.includes(scoreLink)) throw new Error('Expected V3.6 stats GameSheet link was not found.');
appJs = appJs.replace(scoreLink, '<a class="score-gs" target="_blank" rel="noopener" href="${escAttr(gs)}">GameSheet ↗</a>${broadcastAction(g,\'score-gs watch-link\')}</div><div class="score-team">');

const liveSnapshotMarker = 'd=firestoreData(await fetchJson(u)),total=d?.computed?.scoreboard?.total;if(!total||total.home==null||total.visitor==null)throw new Error(\'No live score\');return{...g,status:';
if (!appJs.includes(liveSnapshotMarker)) throw new Error('Expected V3.6 live snapshot marker was not found.');
appJs = appJs.replace(liveSnapshotMarker, 'd=firestoreData(await fetchJson(u)),enriched=window.MyHockeyHubFoundation.normalize.enrichGameBroadcast(g,d),total=d?.computed?.scoreboard?.total;if(!total||total.home==null||total.visitor==null)throw new Error(\'No live score\');return{...enriched,status:');

const statsFetchMarker = 'd=firestoreData(await fetchJson(u));renderStats(g,boxFromFirestore(g,d))';
if (!appJs.includes(statsFetchMarker)) throw new Error('Expected V3.6 stats fetch marker was not found.');
appJs = appJs.replace(statsFetchMarker, 'raw=await fetchJson(u),d=firestoreData(raw),enriched=window.MyHockeyHubFoundation.normalize.enrichGameBroadcast(g,d),legacyBox=boxFromFirestore(g,d),normalizedBox=window.MyHockeyHubGameNormalization.gameBoxFromFirestore(g,raw);Object.assign(g,enriched);if(JSON.stringify(legacyBox)!==JSON.stringify(normalizedBox)){console.warn(\'Game normalization parity mismatch\',{gameId:g.gameId,legacy:legacyBox,normalized:normalizedBox});window.MyHockeyHubNormalizationParity={gameId:String(g.gameId),match:false}}else window.MyHockeyHubNormalizationParity={gameId:String(g.gameId),match:true};renderStats(g,normalizedBox)');

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

const registerPlayerMarker = "function registerPlayer(p){if(!p?.id)return p;const id=String(p.id),old=state.playerRegistry[id]||{};state.playerRegistry[id]={...old,...p,id};return state.playerRegistry[id]}";
if (!appJs.includes(registerPlayerMarker)) throw new Error('Expected V3.6 registerPlayer implementation was not found.');
appJs = appJs.replace(registerPlayerMarker, "function registerPlayer(p,scope='season'){if(!p?.id)return p;const id=String(p.id),old=state.playerRegistry[id]||{};const merged=window.MyHockeyHubPlayerNormalization.mergePlayerRecord(old,p,{scope});state.playerRegistry[id]=merged;return merged}");

const inlinePlayerLinkRegisterMarker = 'registerPlayer(statsPlayerRecord(p,team));';
if (!appJs.includes(inlinePlayerLinkRegisterMarker)) throw new Error('Expected V3.6 inlinePlayerLink registration was not found.');
appJs = appJs.replace(inlinePlayerLinkRegisterMarker, "registerPlayer(statsPlayerRecord(p,team),'game');");

const renderStatsRegisterMarker = "for(const side of ['visitor','home'])for(const p of (b?.[side]?.roster?.players||[]))registerPlayer(statsPlayerRecord(p,b[side]));";
if (!appJs.includes(renderStatsRegisterMarker)) throw new Error('Expected V3.6 renderStats registration was not found.');
appJs = appJs.replace(renderStatsRegisterMarker, "for(const side of ['visitor','home'])for(const p of (b?.[side]?.roster?.players||[]))registerPlayer(statsPlayerRecord(p,b[side]),'game');");

const playerCardGaaMarker = "esc(p.gaa??'—')";
if (!appJs.includes(playerCardGaaMarker)) throw new Error('Expected V3.6 player-card GAA formatting was not found.');
appJs = appJs.replace(playerCardGaaMarker, "esc(window.MyHockeyHubPlayerNormalization.formatGaa(p.gaa))");

const playerCardSvPctMarker = "esc(p.svPct??'—')";
if (!appJs.includes(playerCardSvPctMarker)) throw new Error('Expected V3.6 player-card SV% formatting was not found.');
appJs = appJs.replace(playerCardSvPctMarker, "esc(window.MyHockeyHubPlayerNormalization.formatSvPct(p.svPct))");

const playerDetailGaaMarker = "sbox('GAA',p.gaa??'—')";
if (!appJs.includes(playerDetailGaaMarker)) throw new Error('Expected V3.6 player-detail GAA formatting was not found.');
appJs = appJs.replace(playerDetailGaaMarker, "sbox('GAA',window.MyHockeyHubPlayerNormalization.formatGaa(p.gaa))");

const playerDetailSvPctMarker = "sbox('SV%',p.svPct??'—')";
if (!appJs.includes(playerDetailSvPctMarker)) throw new Error('Expected V3.6 player-detail SV% formatting was not found.');
appJs = appJs.replace(playerDetailSvPctMarker, "sbox('SV%',window.MyHockeyHubPlayerNormalization.formatSvPct(p.svPct))");

const renderTeamLocalsMarker = "next=upcoming[0],div=teamDivisionTitle(t);els.teamView.innerHTML=";
if (!appJs.includes(renderTeamLocalsMarker)) throw new Error('Expected V3.6 renderTeam locals were not found.');
appJs = appJs.replace(renderTeamLocalsMarker, "next=upcoming[0],div=teamDivisionTitle(t),summary=window.MyHockeyHubTeamNormalization.teamSeasonSummary(t.id,state.games),teamRecordText=summary.gamesPlayed?(summary.wins+'-'+summary.losses+'-'+summary.ties):'—',teamPimPerGameText=summary.pimPerGame!=null?summary.pimPerGame.toFixed(1):'—',teamNextGame=summary.nextGame,teamNextOpponent=teamNextGame?(String(teamNextGame.home?.id)===String(t.id)?teamNextGame.visitor:teamNextGame.home):null,teamNextShortText=teamNextGame?(new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(gameDate(teamNextGame))+' '+fmtTime(gameDate(teamNextGame))):'—',teamNextTitle=teamNextGame?(fmtLong(gameDate(teamNextGame))+' vs '+(teamNextOpponent?.title||'Opponent')):'No upcoming games scheduled';els.teamView.innerHTML=");

const teamCardMarker = '<section class="panel hero"><div class="teamhero">${logo(t)}<div><div class="teamname">${esc(t.title)}</div><div class="muted">${esc(div)}</div></div><div class="right"><span class="pill">★ My Team</span></div></div><div class="actions"><button id="teamSchedule" class="soft">View full schedule</button><button id="teamPlayers" class="soft">Browse players</button><button id="removeTeam" class="soft danger">Remove team</button></div></section>';
if (!appJs.includes(teamCardMarker)) throw new Error('Expected V3.6 team-card markup was not found.');
appJs = appJs.replace(teamCardMarker, '<section class="panel hero team-dashboard-card"><div class="teamhero">${logo(t)}<div><div class="teamname">${esc(t.title)}</div><div class="muted">${esc(div)}</div></div><div class="right"><span class="pill team-badge"><span class="team-badge-label">★ My Team</span><button id="removeTeamMobile" class="team-badge-remove" type="button" aria-label="Remove team" title="Remove team"><span class="fa-icon fa-trash-can" aria-hidden="true"></span></button></span></div></div><div class="statstrip team-statstrip"><div class="stat"><b>${esc(teamRecordText)}</b><small>Record</small></div><div class="stat"><b>${esc(summary.goalsFor)}</b><small>GF</small></div><div class="stat"><b>${esc(summary.goalsAgainst)}</b><small>GA</small></div><div class="stat"><b>${esc(teamPimPerGameText)}</b><small>PIM/G</small></div><div class="stat"><b title="${escAttr(teamNextTitle)}">${esc(teamNextShortText)}</b><small>Next</small></div></div><div class="team-card-actions"><button id="teamSchedule" class="soft team-action-btn"><span class="fa-icon fa-calendar-days" aria-hidden="true"></span><span class="btn-text">Schedule</span></button><button id="teamRoster" class="soft team-action-btn"><span class="fa-icon fa-users" aria-hidden="true"></span><span class="btn-text">Roster</span></button><button id="teamStatsBtn" class="soft team-action-btn"><span class="fa-icon fa-chart-line" aria-hidden="true"></span><span class="btn-text">Stats</span></button><button id="removeTeam" class="soft danger team-action-btn team-remove-btn" aria-label="Remove team" title="Remove team"><span class="fa-icon fa-trash-can" aria-hidden="true"></span><span class="btn-text">Remove</span></button></div></section>');

const myTeamSwitcherMarker = '<div class="my-team-switcher">${teams.map(x=>`<button class="chip my-team-chip ${String(x.id)===String(t.id)?\'active\':\'\'}" data-team-switch="${escAttr(x.id)}">${esc(x.title)}${teamDivisionTitle(x)?` · ${esc(teamDivisionTitle(x))}`:\'\'}</button>`).join(\'\')}<button id="addAnotherTeam" class="chip">＋ Add</button></div>';
if (!appJs.includes(myTeamSwitcherMarker)) throw new Error('Expected V3.6 my-team-switcher markup was not found.');
appJs = appJs.replace(myTeamSwitcherMarker, '<div class="my-team-switcher"><select id="myTeamSwitcher" class="my-team-switcher-select" aria-label="Switch team">${teams.map(x=>`<option value="${escAttr(x.id)}" ${String(x.id)===String(t.id)?\'selected\':\'\'}>${esc(x.title)}${teamDivisionTitle(x)?` · ${esc(teamDivisionTitle(x))}`:\'\'}</option>`).join(\'\')}</select><div class="my-team-switcher-pills">${teams.map(x=>`<button class="chip my-team-chip ${String(x.id)===String(t.id)?\'active\':\'\'}" data-team-switch="${escAttr(x.id)}">${esc(x.title)}${teamDivisionTitle(x)?` · ${esc(teamDivisionTitle(x))}`:\'\'}</button>`).join(\'\')}</div><button id="addAnotherTeam" class="chip">＋ Add</button></div>');

const teamSwitchWireMarker = "querySelectorAll('[data-team-switch]').forEach(b=>b.onclick=()=>{setActiveMyTeam(b.dataset.teamSwitch);renderTeam()});$('#manageTeams').onclick=openManageTeams;";
if (!appJs.includes(teamSwitchWireMarker)) throw new Error('Expected V3.6 team-switch wiring was not found.');
appJs = appJs.replace(teamSwitchWireMarker, "querySelectorAll('[data-team-switch]').forEach(b=>b.onclick=()=>{setActiveMyTeam(b.dataset.teamSwitch);renderTeam()});if($('#myTeamSwitcher'))$('#myTeamSwitcher').onchange=()=>{setActiveMyTeam($('#myTeamSwitcher').value);renderTeam()};$('#manageTeams').onclick=openManageTeams;");

const eventDetailGameSheetLinkMarker = '<div class="actions"><a class="link" target="_blank" rel="noopener" href="${escAttr(gs)}">Open game on GameSheet ↗</a></div>';
const eventDetailGameSheetLinkCount = appJs.split(eventDetailGameSheetLinkMarker).length - 1;
if (eventDetailGameSheetLinkCount !== 2) throw new Error(`Expected exactly 2 occurrences of the expanded-event GameSheet link, found ${eventDetailGameSheetLinkCount}.`);
appJs = appJs.split(eventDetailGameSheetLinkMarker).join('');

const playerTeamTabsWireMarker = "wireTimeline(els.drawerBody)}";
if (!appJs.includes(playerTeamTabsWireMarker)) throw new Error('Expected V3.6 renderStats tab wiring was not found.');
appJs = appJs.replace(playerTeamTabsWireMarker, "wireTimeline(els.drawerBody);els.drawerBody.querySelectorAll('.team-tab-btn').forEach(btn=>btn.onclick=()=>{els.drawerBody.querySelectorAll('.team-tab-btn').forEach(x=>x.classList.toggle('active',x===btn));els.drawerBody.querySelectorAll('.team-tab-pane').forEach(x=>x.classList.toggle('active',x.dataset.teamPane===btn.dataset.teamTab))})}");

const removeTeamWireMarker = "$('#removeTeam').onclick=()=>{if(window.confirm(`Remove ${t.title} from My Teams?`)){removeMyTeam(t.id);renderTeam()}};";
if (!appJs.includes(removeTeamWireMarker)) throw new Error('Expected V3.6 removeTeam wiring was not found.');
appJs = appJs.replace(removeTeamWireMarker, "const confirmRemoveTeam=()=>{if(window.confirm(`Remove ${t.title} from My Teams?`)){removeMyTeam(t.id);renderTeam()}};$('#removeTeam').onclick=confirmRemoveTeam;if($('#removeTeamMobile'))$('#removeTeamMobile').onclick=confirmRemoveTeam;");

const teamRosterWireMarker = "$('#teamPlayers').onclick=()=>{state.playerRosterTeamId=t.id;state.playerMode='team';setView('players')}}";
if (!appJs.includes(teamRosterWireMarker)) throw new Error('Expected V3.6 team-roster wiring was not found.');
appJs = appJs.replace(teamRosterWireMarker, "$('#teamRoster').onclick=()=>{state.playerRosterTeamId=t.id;state.playerMode='team';setView('players')};$('#teamStatsBtn').onclick=()=>openTeamStats(t.id)}");

const renderTeamDefMarker = 'function renderTeam(){';
if (!appJs.includes(renderTeamDefMarker)) throw new Error('Expected V3.6 renderTeam definition was not found.');
appJs = appJs.replace(renderTeamDefMarker, "function openTeamStats(teamId){const t=state.teams.find(x=>String(x.id)===String(teamId));if(!t)return;const summary=window.MyHockeyHubTeamNormalization.teamSeasonSummary(t.id,state.games),record=summary.gamesPlayed?`${summary.wins}-${summary.losses}-${summary.ties}`:'—',streakText=summary.streak.result?`${summary.streak.result}${summary.streak.count}`:'—',nextGame=summary.nextGame,nextOpponent=nextGame?(String(nextGame.home?.id)===String(t.id)?nextGame.visitor:nextGame.home):null,nextText=nextGame?`${fmtLong(gameDate(nextGame))} vs ${nextOpponent?.title||'Opponent'}`:'No upcoming games scheduled',homeRecord=`${summary.home.wins}-${summary.home.losses}-${summary.home.ties}`,awayRecord=`${summary.away.wins}-${summary.away.losses}-${summary.away.ties}`,sogSection=summary.sog!=null?`<div class=\"statssection\"><h3>Shots</h3><div class=\"statsgrid\">${sbox('SOG',summary.sog)}${sbox('SOG/G',summary.sogPerGame.toFixed(1))}</div></div>`:'';openDrawer('Team Stats',t.title,`<div class=\"statssection\"><h3>Season</h3><div class=\"statsgrid\">${sbox('Record',record)}${sbox('Games Played',summary.gamesPlayed)}${sbox('GF',summary.goalsFor)}${sbox('GA',summary.goalsAgainst)}${sbox('GF/G',summary.goalsForPerGame!=null?summary.goalsForPerGame.toFixed(2):'—')}${sbox('GA/G',summary.goalsAgainstPerGame!=null?summary.goalsAgainstPerGame.toFixed(2):'—')}${sbox('PIM',summary.pim??'—')}${sbox('PIM/G',summary.pimPerGame!=null?summary.pimPerGame.toFixed(1):'—')}</div></div>${sogSection}<div class=\"statssection\"><h3>Home / Away</h3><div class=\"statsgrid\">${sbox('Home',homeRecord)}${sbox('Home GF-GA',`${summary.home.goalsFor}-${summary.home.goalsAgainst}`)}${sbox('Away',awayRecord)}${sbox('Away GF-GA',`${summary.away.goalsFor}-${summary.away.goalsAgainst}`)}</div></div><div class=\"statssection\"><h3>Form</h3><div class=\"statsgrid\">${sbox('Current Streak',streakText)}</div><div class=\"muted\" style=\"margin-top:9px\">${esc(nextText)}</div></div>`)}\nfunction renderTeam(){");

const elsMarker = "drawerBody:$('drawerBody'),closeDrawer:$('closeDrawer')};";
if (!appJs.includes(elsMarker)) throw new Error('Expected V3.6 els object was not found.');
appJs = appJs.replace(elsMarker, "drawerBody:$('drawerBody'),closeDrawer:$('closeDrawer'),backDrawer:$('backDrawer')};");

const drawerNavWiringMarker = "document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('#helpBtn').onclick=openHelp;$('#menuBtn').onclick=openSettings;bindTeamDelegates();";
if (!appJs.includes(drawerNavWiringMarker)) throw new Error('Expected V3.6 final wiring block was not found.');
appJs = appJs.replace(drawerNavWiringMarker, `const __mhCloseDrawerOriginal=closeDrawer;
const __mhNav=window.MyHockeyHubDrawerNavigation.createDrawerNavigation({
  isOpen:()=>els.drawer.classList.contains('open'),
  captureExtra:()=>{const activeTabBtn=els.drawerBody.querySelector('.tabs .tab.active');return{activeTab:activeTabBtn?activeTabBtn.dataset.tab:null,scrollTop:els.drawer.scrollTop}},
  restoreExtra:extra=>{if(!extra)return;if(extra.activeTab){const tabButton=els.drawerBody.querySelector('.tabs .tab[data-tab="'+extra.activeTab+'"]');if(tabButton&&!tabButton.classList.contains('active'))tabButton.click()}els.drawer.scrollTop=extra.scrollTop||0},
  onClose:()=>{__mhCloseDrawerOriginal();__mhSyncBackButton()}
});
function __mhSyncBackButton(){if(!els.backDrawer)return;const open=els.drawer.classList.contains('open');els.backDrawer.hidden=!open;els.backDrawer.title=__mhNav.depth()?'Back':'Back to app';els.backDrawer.setAttribute('aria-label',els.backDrawer.title)}
function __mhWrapDrawerNav(key,fn){return function(...args){const result=__mhNav.go(key,()=>fn.apply(this,args));__mhSyncBackButton();return result}}
openStats=__mhWrapDrawerNav('gameStats',openStats);
openGameDetails=__mhWrapDrawerNav('gameDetails',openGameDetails);
openPlayerDetail=__mhWrapDrawerNav('playerDetail',openPlayerDetail);
openPlayerPicker=__mhWrapDrawerNav('addPlayers',openPlayerPicker);
openManageTeams=__mhWrapDrawerNav('manageTeams',openManageTeams);
openSettings=__mhWrapDrawerNav('settings',openSettings);
openHelp=__mhWrapDrawerNav('help',openHelp);
openFeedbackForm=__mhWrapDrawerNav('feedback',openFeedbackForm);
openSeasonFinder=__mhWrapDrawerNav('seasonFinder',openSeasonFinder);
openTeamStats=__mhWrapDrawerNav('teamStats',openTeamStats);
closeDrawer=function(){__mhNav.reset();__mhCloseDrawerOriginal();__mhSyncBackButton()};
if(els.backDrawer)els.backDrawer.onclick=()=>{__mhNav.back();__mhSyncBackButton()};
window.MyHockeyHubDrawerNav={back:()=>__mhNav.back(),depth:()=>__mhNav.depth(),peek:()=>__mhNav.peek(),reset:()=>__mhNav.reset()};
${drawerNavWiringMarker}`);

const debugMarker = "const hasSavedSeason=!!(localStorage.getItem('gsv3.seasonId')";
if (!appJs.includes(debugMarker)) throw new Error('Expected V3.6 startup marker was not found.');
appJs = appJs.replace(debugMarker, `let debugReplayOriginalGames=null;window.MyHockeyHubDebug={snapshot:()=>{const broadcasts=state.games.map(g=>g?._broadcast).filter(Boolean);return{version:'4.0.0-beta.0',view:state.view,seasonId:String(state.seasonId||''),gameCount:state.games.length,liveCount:visibleLive().length,polling:!!state.polling,lastLive:state.lastLive?state.lastLive.toISOString():null,lastError:!!state.lastError,broadcastActionable:broadcasts.filter(b=>b.available).length,broadcastSuppressed:broadcasts.reduce((n,b)=>n+(b.suppressed?.length||0),0),normalizationParity:window.MyHockeyHubNormalizationParity||null,replayActive:!!debugReplayOriginalGames}},refreshLive:()=>pollLive(),applyReplay:snapshot=>{if(!snapshot)return;liveRefreshService?.stop();if(!debugReplayOriginalGames)debugReplayOriginalGames=state.games;const g=window.MyHockeyHubFoundation.normalize.game({...snapshot,timeStampZulu:new Date().toISOString()});state.games=[g,...debugReplayOriginalGames.filter(x=>String(x.gameId)!==String(g.gameId))];buildTeams();state.view='schedule';state.schedule={division:'',team:'',rink:'',when:'all',search:'SIM-1',myTeam:false,faves:false,scheduled:false};render()},exitReplay:()=>{if(!debugReplayOriginalGames)return;state.games=debugReplayOriginalGames;debugReplayOriginalGames=null;buildTeams();render();startPolling()}};${debugMarker}`);

const [routerSource, foundationSource, diagnosticsSource, drawerNavigationSource, siteCss, homeHtml] = await Promise.all([
  read('src/app/router.js'),
  read('src/app/foundation.js'),
  read('src/app/diagnostics.js'),
  read('src/app/drawer-navigation.js'),
  read('src/site.css'),
  read('src/home.html')
]);
const [{ code: minCss }, { code: minJs }, { code: minRouter }, { code: minFoundation }, { code: minDiagnostics }, { code: minDrawerNavigation }, { code: minSiteCss }] = await Promise.all([
  transform(appCss, { loader: 'css', minify: true }),
  transform(appJs, { loader: 'js', minify: true, target: 'es2022' }),
  transform(routerSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(foundationSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(diagnosticsSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(drawerNavigationSource, { loader: 'js', minify: true, target: 'es2022' }),
  transform(siteCss, { loader: 'css', minify: true })
]);

let appHtml = legacy
  .replace(styleMatch[0], '<link rel="stylesheet" href="../assets/app.css">')
  .replace(scriptMatch[0], '<script src="../assets/foundation.js" defer></script>\n<script src="../assets/drawer-navigation.js" defer></script>\n<script src="../assets/app.js" defer></script>\n<script src="../assets/router.js" defer></script>\n<script src="../assets/diagnostics.js" defer></script>')
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
  write('assets/drawer-navigation.js', minDrawerNavigation),
  write('assets/app.js', minJs),
  write('assets/router.js', minRouter),
  write('assets/diagnostics.js', minDiagnostics),
  write('assets/site.css', minSiteCss),
  write('.nojekyll', '')
]);

await cp(join(root, 'data'), join(out, 'data'), { recursive: true });
await mkdir(join(out, 'debug'), { recursive: true });
await cp(join(root, 'tests/fixtures/live-replay.json'), join(out, 'debug/live-replay.json'));
await cp(join(root, 'FAQ.md'), join(out, 'FAQ.md'));
await cp(join(root, 'LICENSE'), join(out, 'LICENSE'));

const compatibilityRedirect = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./"><title>Opening MyHockeyHub…</title></head>
<body><p>Opening <a href="./">MyHockeyHub</a>…</p><script>location.replace('./')</script></body></html>`;
await write('gamesheets_plus.html', compatibilityRedirect);

console.log('Built MyHockeyHub static site in dist/.');