from pathlib import Path
import re

src = Path('v3.3.html').read_text(encoding='utf-8')
s = src.replace('MyHockeyHub — V3.3', 'MyHockeyHub — V3.4').replace('>V3.2.1 preview<', '>V3.4 preview<')

# Mobile polish for five tabs, compact box score, multi-team controls, and stale-game treatment.
css = r'''
/* V3.4: multiple My Teams, compact box score, and stale-game inference */
.my-team-switcher{display:flex;gap:7px;overflow:auto;margin:0 0 12px;padding:2px 0}.my-team-chip{display:flex;align-items:center;gap:7px;white-space:nowrap}.team-picker-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.saved-teams{display:grid;gap:7px;margin-top:12px}.saved-team-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#102033}.saved-team-row b{display:block}.saved-team-row small{color:var(--muted)}
.badge.stale{color:#ffd98a;border-color:rgba(255,190,63,.5);background:rgba(110,76,10,.25)}.gamecard.stale{border-color:rgba(255,190,63,.5);box-shadow:inset 4px 0 0 var(--amber),0 13px 36px rgba(0,0,0,.24)}
.box-score-wrap{overflow:visible}.box-score{width:100%;min-width:0!important;table-layout:fixed}.box-score th,.box-score td{padding:7px 4px}.box-score th:first-child,.box-score td:first-child{width:34%}.box-team{min-width:0}.box-team span{overflow:hidden;text-overflow:ellipsis}.box-team-short{display:none}.box-score .logo.xs{width:26px;height:26px;flex:0 0 26px}
@media(max-width:560px){.team-picker-grid{grid-template-columns:1fr}.tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));overflow:visible}.tabs .tab{min-width:0;padding:9px 2px;font-size:.69rem;overflow:hidden;text-overflow:ellipsis}.box-score{font-size:.72rem}.box-score th,.box-score td{padding:6px 2px}.box-score th:first-child,.box-score td:first-child{width:27%}.box-team{gap:4px}.box-team-full{display:none}.box-team-short{display:inline}.box-score .logo.xs{width:22px;height:22px;flex-basis:22px}.my-team-switcher{margin-left:-2px;margin-right:-2px}}
'''
s = s.replace('</style>', css + '\n</style>', 1)

# State: migrate from the original single-team preference into an array of My Teams.
old_state = "myTeamBySeason:readJson('gsv3.myTeamBySeason',readJson('gsv2.myTeamBySeason',{})),favoriteRinks:"
new_state = "myTeamsBySeason:readJson('gsv3.myTeamsBySeason',{}),activeMyTeamBySeason:readJson('gsv3.activeMyTeamBySeason',{}),showStaleGames:readJson('gsv3.showStaleGames',false),favoriteRinks:"
if old_state not in s:
    raise SystemExit('state team preference source not found')
s = s.replace(old_state, new_state, 1)
s = s.replace("state.playerMode='favorites';state.playerRegistry={};state.playerDetailCache={};state.theme=localStorage.getItem('gsv3.theme')||'system';applyTheme(state.theme);", "state.playerMode='favorites';state.playerRosterTeamId='';state.playerRegistry={};state.playerDetailCache={};state.theme=localStorage.getItem('gsv3.theme')||'system';applyTheme(state.theme);", 1)
old_migration = "if(!state.myTeamBySeason['15111']&&localStorage.getItem('dvhl.myTeamId'))state.myTeamBySeason['15111']=localStorage.getItem('dvhl.myTeamId');"
new_migration = r'''const legacyMyTeamBySeason=readJson('gsv3.myTeamBySeason',readJson('gsv2.myTeamBySeason',{}));
for(const [season,id] of Object.entries(legacyMyTeamBySeason)){if(id&&!(state.myTeamsBySeason[season]||[]).length)state.myTeamsBySeason[season]=[String(id)]}
if(!(state.myTeamsBySeason['15111']||[]).length&&localStorage.getItem('dvhl.myTeamId'))state.myTeamsBySeason['15111']=[String(localStorage.getItem('dvhl.myTeamId'))];
for(const [season,ids] of Object.entries(state.myTeamsBySeason)){state.myTeamsBySeason[season]=[...new Set((Array.isArray(ids)?ids:[ids]).map(String).filter(Boolean))];if(!state.activeMyTeamBySeason[season]||!state.myTeamsBySeason[season].includes(String(state.activeMyTeamBySeason[season])))state.activeMyTeamBySeason[season]=state.myTeamsBySeason[season][0]||''}'''
if old_migration not in s:
    raise SystemExit('legacy team migration source not found')
s = s.replace(old_migration, new_migration, 1)
s = s.replace("localStorage.setItem('gsv3.myTeamBySeason',JSON.stringify(state.myTeamBySeason));", "localStorage.setItem('gsv3.myTeamsBySeason',JSON.stringify(state.myTeamsBySeason));localStorage.setItem('gsv3.activeMyTeamBySeason',JSON.stringify(state.activeMyTeamBySeason));localStorage.setItem('gsv3.showStaleGames',JSON.stringify(!!state.showStaleGames));", 1)

# Team helpers + stale-game inference.
helpers_pat = re.compile(r"function myTeamId\(\).*?function stat\(g\)", re.S)
helpers = r'''function myTeamIds(){return[...new Set((state.myTeamsBySeason[state.seasonId]||[]).map(String).filter(Boolean))]}
function myTeamId(){const ids=myTeamIds(),active=String(state.activeMyTeamBySeason[state.seasonId]||'');return ids.includes(active)?active:(ids[0]||'')}
function myTeams(){const ids=new Set(myTeamIds());return state.teams.filter(t=>ids.has(String(t.id)))}
function myTeam(){return state.teams.find(t=>t.id===String(myTeamId()))}
function hasTeam(g,id){return id&&(String(g.home?.id)===String(id)||String(g.visitor?.id)===String(id))}
function isMyTeamGame(g){return myTeamIds().some(id=>hasTeam(g,id))}
function setActiveMyTeam(id){id=String(id||'');if(!myTeamIds().includes(id))return;state.activeMyTeamBySeason[state.seasonId]=id;savePrefs()}
function addMyTeam(id){id=String(id||'');if(!id)return;const ids=myTeamIds();if(!ids.includes(id))ids.push(id);state.myTeamsBySeason[state.seasonId]=ids;state.activeMyTeamBySeason[state.seasonId]=id;savePrefs()}
function removeMyTeam(id){id=String(id||'');const ids=myTeamIds().filter(x=>x!==id);state.myTeamsBySeason[state.seasonId]=ids;if(String(state.activeMyTeamBySeason[state.seasonId]||'')===id)state.activeMyTeamBySeason[state.seasonId]=ids[0]||'';if(String(state.playerRosterTeamId||'')===id)state.playerRosterTeamId=ids[0]||'';savePrefs()}
function stat(g)'''
s, n = helpers_pat.subn(lambda _: helpers, s, count=1)
if n != 1:
    raise SystemExit(f'team helper replacement count={n}')

# Add stale helpers after gameDate.
old_game_date = "function gameDate(g){return new Date(g.timeStampZulu||`${g.date||''} ${g.time||''}`)}"
new_game_date = old_game_date + "function isStaleLive(g){return live(g)&&Date.now()-gameDate(g).getTime()>24*60*60*1000}function showGame(g){return state.showStaleGames||!isStaleLive(g)}"
if old_game_date not in s:
    raise SystemExit('gameDate source not found')
s = s.replace(old_game_date, new_game_date, 1)

# Badge and main game card stale treatment.
s = s.replace("function badge(g){if(live(g))return'<span class=\"badge live\">● Live</span>';", "function badge(g){if(isStaleLive(g))return'<span class=\"badge stale\">Stale</span>';if(live(g))return'<span class=\"badge live\">● Live</span>';", 1)
card_pat = re.compile(r"function gameCard\(g\)\{.*?\}\nfunction bindGameActions", re.S)
card_repl = r'''function gameCard(g){const d=gameDate(g),rink=g.location?.trim()||'',fav=state.favoriteRinks.has(rink),stale=isStaleLive(g),hasStats=live(g)||stat(g)==='final';return`<article class="gamecard${live(g)&&!stale?' live':''}${stale?' stale':''}${hasStats?' has-stats':''}" ${hasStats?`data-stats-game="${escAttr(g.gameId)}" role="button" tabindex="0" aria-label="Open stats for ${escAttr(g.visitor?.title||'Visitor')} versus ${escAttr(g.home?.title||'Home')}"`:''}><div class="ghead"><div><strong>${esc(fmtDate(d))}</strong><div class="muted">${esc(fmtTime(d))}</div></div>${badge(g)}</div><div class="teams"><div class="trow">${logo(g.visitor,'sm')}<div><div class="tname">${esc(g.visitor?.title||'Visitor')}</div><div class="side">Away</div></div><div class="score">${stat(g)==='scheduled'?'—':esc(g.visitor?.goals??'')}</div></div><div class="trow">${logo(g.home,'sm')}<div><div class="tname">${esc(g.home?.title||'Home')}</div><div class="side">Home</div></div><div class="score">${stat(g)==='scheduled'?'—':esc(g.home?.goals??'')}</div></div></div><div class="gmeta"><div><div class="mk">Division</div><div class="mv">${esc(division(g))}</div></div><div><div class="mk">Rink</div><div class="mv"><button class="star${fav?' active':''}" data-rink="${escAttr(rink)}">${fav?'★':'☆'}</button> ${esc(rink||'—')}</div></div><div><div class="mk">Game</div><div class="mv">${esc(g.number||g.gameId)}</div></div></div><div class="gfoot"><a class="link" target="_blank" rel="noopener" href="https://gamesheetstats.com/seasons/${state.seasonId}/games/${g.gameId}">GameSheet ↗</a>${hasStats?`<div class="footer-actions"><span class="stats-hint">${stale?'Stats available · stale ›':'Stats available ›'}</span><button class="rowbtn stats" data-game="${g.gameId}">Stats</button></div>`:'<span class="muted">Scheduled</span>'}</div></article>`}
function bindGameActions'''
s, n = card_pat.subn(lambda _: card_repl, s, count=1)
if n != 1:
    raise SystemExit(f'gameCard replacement count={n}')

# My Teams view: division-first picker, switch among saved teams, and manage/add/remove.
team_pat = re.compile(r"function teamGames\(\).*?\nfunction miniResult", re.S)
team_repl = r'''function teamDivisionTitle(t){return[...t.divisions].map(id=>state.divisions.find(d=>String(d.id)===String(id))?.title).filter(Boolean)[0]||''}
function teamPickerOptions(divisionId){return scheduleTeamGroups(divisionId).map(x=>`<option value="${escAttr(x.ids[0])}">${esc(x.title)}</option>`).join('')}
function wireTeamPicker(divId,teamId){const d=$(divId),t=$(teamId);if(!d||!t)return;const refresh=()=>{t.innerHTML='<option value="">Choose a team</option>'+teamPickerOptions(d.value)};d.onchange=refresh;refresh()}
function openManageTeams(){const saved=myTeams();openDrawer('My Teams','Add, remove, or switch teams',`<div class="settings-grid"><section class="settings-section"><h3>Add a team</h3><div class="team-picker-grid"><div><label class="label">Division</label><select id="manageTeamDivision"><option value="">Choose division</option>${state.divisions.map(d=>`<option value="${d.id}">${esc(d.title)}</option>`).join('')}</select></div><div><label class="label">Team</label><select id="manageTeamPicker"><option value="">Choose a division first</option></select></div></div><div class="actions"><button id="manageAddTeam" class="primary" disabled>Add to My Teams</button></div></section><section class="settings-section"><h3>Saved teams</h3><div id="savedTeamsList" class="saved-teams"></div></section></div>`);const div=$('#manageTeamDivision'),picker=$('#manageTeamPicker'),add=$('#manageAddTeam'),list=$('#savedTeamsList');const fill=()=>{picker.innerHTML='<option value="">Choose a team</option>'+teamPickerOptions(div.value);add.disabled=!picker.value};div.onchange=fill;picker.onchange=()=>add.disabled=!picker.value;add.onclick=()=>{addMyTeam(picker.value);openManageTeams()};const draw=()=>{const teams=myTeams();list.innerHTML=teams.length?teams.map(t=>`<div class="saved-team-row"><div><b>${esc(t.title)}</b><small>${esc(teamDivisionTitle(t))}</small></div><div style="display:flex;gap:6px"><button class="rowbtn" data-activate-team="${escAttr(t.id)}">${String(t.id)===String(myTeamId())?'Active':'View'}</button><button class="rowbtn danger" data-remove-team="${escAttr(t.id)}">Remove</button></div></div>`).join(''):'<div class="muted">No saved teams yet.</div>';list.querySelectorAll('[data-activate-team]').forEach(b=>b.onclick=()=>{setActiveMyTeam(b.dataset.activateTeam);closeDrawer();renderTeam()});list.querySelectorAll('[data-remove-team]').forEach(b=>b.onclick=()=>{removeMyTeam(b.dataset.removeTeam);openManageTeams()})};draw()}
function teamGames(teamId=myTeamId()){return teamId?state.games.filter(g=>hasTeam(g,teamId)&&showGame(g)).sort((a,b)=>gameDate(a)-gameDate(b)):[]}
function renderTeam(){const teams=myTeams(),t=myTeam(),now=new Date();if(!t){els.teamView.innerHTML=`<div class="heading"><div><h1>My Teams</h1><p>Add the teams your family cares about.</p></div></div><section class="panel hero"><div class="team-picker-grid"><div><label class="label">Division</label><select id="chooseTeamDivision"><option value="">Choose division</option>${state.divisions.map(d=>`<option value="${d.id}">${esc(d.title)}</option>`).join('')}</select></div><div><label class="label">Team</label><select id="chooseMyTeam"><option value="">Choose a division first</option></select></div></div><div class="actions"><button id="saveMyTeam" class="primary" disabled>Add to My Teams</button></div></section>`;wireTeamPicker('chooseTeamDivision','chooseMyTeam');const picker=$('#chooseMyTeam'),save=$('#saveMyTeam');picker.onchange=()=>save.disabled=!picker.value;save.onclick=()=>{addMyTeam(picker.value);renderTeam()};return}const games=teamGames(t.id),upcoming=games.filter(g=>live(g)||gameDate(g)>=now),finals=games.filter(g=>stat(g)==='final').sort((a,b)=>gameDate(b)-gameDate(a)),next=upcoming[0],div=teamDivisionTitle(t);els.teamView.innerHTML=`<div class="heading"><div><h1>My Teams</h1><p>${teams.length===1?'Your saved team.':'Switch between your saved teams.'}</p></div><button id="manageTeams" class="soft">Manage</button></div><div class="my-team-switcher">${teams.map(x=>`<button class="chip my-team-chip ${String(x.id)===String(t.id)?'active':''}" data-team-switch="${escAttr(x.id)}">${esc(x.title)}${teamDivisionTitle(x)?` · ${esc(teamDivisionTitle(x))}`:''}</button>`).join('')}<button id="addAnotherTeam" class="chip">＋ Add</button></div><section class="panel hero"><div class="teamhero">${logo(t)}<div><div class="teamname">${esc(t.title)}</div><div class="muted">${esc(div)}</div></div><div class="right"><span class="pill">★ My Team</span></div></div><div class="actions"><button id="teamSchedule" class="soft">View full schedule</button><button id="teamPlayers" class="soft">Browse players</button><button id="removeTeam" class="soft danger">Remove team</button></div></section>${next?`<div class="section-title"><h2>Next Game</h2></div><div id="nextGame">${gameCard(next)}</div>`:''}<div class="section-title"><h2>Recent Results</h2><button id="allTeamGames" class="rowbtn">View all</button></div><div class="grid2">${finals.slice(0,4).map(miniResult).join('')||'<div class="panel empty">No completed games yet.</div>'}</div><div class="section-title"><h2>Upcoming Schedule</h2></div><div class="list">${upcoming.slice(next?1:0,6).map(compactGame).join('')||'<div class="panel empty">No upcoming games.</div>'}</div>`;bindGameActions(els.teamView);els.teamView.querySelectorAll('.miniresult[data-game]').forEach(card=>{card.onclick=()=>openStats(card.dataset.game);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openStats(card.dataset.game)}}});els.teamView.querySelectorAll('[data-team-switch]').forEach(b=>b.onclick=()=>{setActiveMyTeam(b.dataset.teamSwitch);renderTeam()});$('#manageTeams').onclick=openManageTeams;$('#addAnotherTeam').onclick=openManageTeams;$('#removeTeam').onclick=()=>{if(window.confirm(`Remove ${t.title} from My Teams?`)){removeMyTeam(t.id);renderTeam()}};const showTeamSchedule=()=>{state.schedule.team=t.id;setView('schedule')};$('#teamSchedule').onclick=showTeamSchedule;$('#allTeamGames').onclick=showTeamSchedule;$('#teamPlayers').onclick=()=>{state.playerRosterTeamId=t.id;state.playerMode='team';setView('players')}}
function miniResult'''
s, n = team_pat.subn(lambda _: team_repl, s, count=1)
if n != 1:
    raise SystemExit(f'renderTeam replacement count={n}')

# Venues: My Teams means any saved team, and stale games follow the global visibility setting.
venue_pat = re.compile(r"function renderVenues\(\).*?\nfunction favPlayerMap", re.S)
venue_repl = r'''function renderVenues(){const f=[...state.favoriteRinks].sort(),hasMine=myTeamIds().length>0;els.venuesView.innerHTML=`<div class="heading"><div><h1>Favorite Venues</h1><p>Your saved rinks and quick schedules.</p></div><div class="count">${f.length} ${f.length===1?'venue':'venues'}</div></div><div class="chips"><button class="chip ${state.venueRange==='today'?'active':''}" data-range="today">Today</button><button class="chip ${state.venueRange==='weekend'?'active':''}" data-range="weekend">This Weekend</button><button class="chip ${state.venueRange==='next7'?'active':''}" data-range="next7">Next 7 Days</button><button class="chip ${state.venueRange==='all'?'active':''}" data-range="all">Upcoming</button><button id="venueMine" class="chip ${state.venueMyTeam?'active':''}">My Teams only</button></div><div class="list" style="margin-top:11px">${f.length?f.map(r=>venueCard(r,hasMine)).join(''):'<div class="panel empty">Star a rink from any game card and it will appear here.</div>'}</div>`;els.venuesView.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{state.venueRange=b.dataset.range;renderVenues()});if($('#venueMine'))$('#venueMine').onclick=()=>{state.venueMyTeam=!state.venueMyTeam;renderVenues()};els.venuesView.querySelectorAll('.unstar').forEach(b=>b.onclick=()=>toggleRink(b.dataset.rink));els.venuesView.querySelectorAll('.viewvenue').forEach(b=>b.onclick=()=>{state.schedule.rink=b.dataset.rink;state.schedule.when='all';setView('schedule')});els.venuesView.querySelectorAll('.stats').forEach(b=>b.onclick=()=>openStats(b.dataset.game));els.venuesView.querySelectorAll('.details').forEach(b=>b.onclick=()=>openGameDetails(b.dataset.game))}
function venueCard(r,hasMine){let games=state.games.filter(g=>showGame(g)&&g.location?.trim()===r&&venueWindow(g));if(state.venueMyTeam)games=games.filter(isMyTeamGame);games.sort((a,b)=>gameDate(a)-gameDate(b));const myCount=state.games.filter(g=>showGame(g)&&g.location?.trim()===r&&isMyTeamGame(g)&&gameDate(g)>=new Date()).length;return`<section class="venuecard"><div class="venuehead"><div style="display:flex;gap:10px"><div class="venueicon">◫</div><div><h3>${esc(r)}</h3><div class="muted">Favorite venue</div></div></div><button class="star active unstar" data-rink="${escAttr(r)}">★</button></div><div class="venuemeta"><span class="pill">${games.length} in view</span>${hasMine?`<span class="pill">My Teams: ${myCount} upcoming</span>`:''}</div><div class="venuegames">${games.slice(0,5).map(g=>{const hs=live(g)||stat(g)==='final',action=hs?'Stats':'Details';return`<div class="venuegame clickable" data-venue-${hs?'stats':'details'}="${escAttr(g.gameId)}"><div><b>${esc(fmtDate(gameDate(g)).split(',')[0])}</b><div class="time">${esc(fmtTime(gameDate(g)))}</div></div><div class="match">${esc(g.visitor?.title||'')} vs ${esc(g.home?.title||'')}</div><button class="rowbtn ${hs?'stats':'details'}" data-game="${g.gameId}">${action}</button></div>`}).join('')||'<div class="empty" style="padding:16px">No games in this window.</div>'}</div><div class="actions"><button class="soft viewvenue" data-rink="${escAttr(r)}">View full venue schedule</button></div></section>`}
function favPlayerMap'''
s, n = venue_pat.subn(lambda _: venue_repl, s, count=1)
if n != 1:
    raise SystemExit(f'venue replacement count={n}')

# Players roster: switch among saved My Teams.
players_pat = re.compile(r"function renderPlayers\(\).*?\nasync function loadPlayersForTeam", re.S)
players_repl = r'''function renderPlayers(){const teams=myTeams(),ids=new Set(teams.map(t=>String(t.id))),wanted=ids.has(String(state.playerRosterTeamId||''))?String(state.playerRosterTeamId):myTeamId(),t=state.teams.find(x=>String(x.id)===wanted),favs=Object.values(favPlayerMap());state.playerRosterTeamId=wanted;favs.forEach(registerPlayer);els.playersView.innerHTML=`<div class="heading"><div><h1>Players</h1><p>${state.playerMode==='team'?'Roster for one of your teams.':'Players you follow.'}</p></div><button id="addPlayers" class="primary">＋ Add Players</button></div><div class="player-modebar"><button class="chip ${state.playerMode==='favorites'?'active':''}" data-player-mode="favorites">My Players</button><button class="chip ${state.playerMode==='team'?'active':''}" data-player-mode="team">My Teams Roster</button></div>${state.playerMode==='team'?`${teams.length?`<div style="margin-bottom:10px"><label class="label">Team roster</label><select id="rosterTeamPicker">${teams.map(x=>`<option value="${escAttr(x.id)}" ${String(x.id)===wanted?'selected':''}>${esc(x.title)}${teamDivisionTitle(x)?` — ${esc(teamDivisionTitle(x))}`:''}</option>`).join('')}</select></div>`:''}<div class="roster-note">Tap any player name for season stats and recent-game detail. Star players to add them to My Players.</div><div id="teamRosterList" class="list">${t?'<div class="panel empty">Loading roster…</div>':'<div class="panel empty">Add a My Team first.</div>'}</div>`:(favs.length?`<div class="list">${favs.map(playerCard).join('')}</div>`:'<div class="panel empty">No players followed yet. Use My Teams Roster or Add Players to find players.</div>')}`;els.playersView.querySelectorAll('[data-player-mode]').forEach(b=>b.onclick=()=>{state.playerMode=b.dataset.playerMode;renderPlayers()});const add=$('#addPlayers');if(add)add.onclick=()=>openPlayerPicker().catch(e=>console.error(e));const rosterPicker=$('#rosterTeamPicker');if(rosterPicker)rosterPicker.onchange=()=>{state.playerRosterTeamId=rosterPicker.value;setActiveMyTeam(rosterPicker.value);renderPlayers()};if(state.playerMode==='team'&&t)loadTeamRosterView(t).catch(e=>{const root=$('#teamRosterList');if(root)root.innerHTML=`<div class="panel empty">Could not load roster: ${esc(e.message)}</div>`})}
async function loadPlayersForTeam'''
s, n = players_pat.subn(lambda _: players_repl, s, count=1)
if n != 1:
    raise SystemExit(f'renderPlayers replacement count={n}')

# Schedule filters: any My Team, stale hidden by default, and add selected team instead of replacing.
s = s.replace('> My Team only</label>', '> My Teams only</label>', 1)
s = s.replace('>Set selected team as My Team</button>', '>Add selected team to My Teams</button>', 1)
s = s.replace("if(s.myTeam&&!hasTeam(g,myTeamId()))return false;", "if(!showGame(g))return false;if(s.myTeam&&!isMyTeamGame(g))return false;", 1)
s = s.replace("state.myTeamBySeason[state.seasonId]=ids[0];savePrefs();refreshScheduleResults()", "addMyTeam(ids[0]);refreshScheduleResults()", 1)

# Filter stale games from team/venue current views and never poll them as live.
s = s.replace("function currentGames(){if(state.view==='schedule')return scheduleGames();if(state.view==='team')return teamGames().filter(g=>live(g)||gameDate(g)>=new Date());if(state.view==='venues')return state.games.filter(g=>state.favoriteRinks.has(g.location?.trim())&&venueWindow(g));return[]}function visibleLive(){return currentGames().filter(live)}", "function currentGames(){if(state.view==='schedule')return scheduleGames();if(state.view==='team')return teamGames().filter(g=>live(g)||gameDate(g)>=new Date());if(state.view==='venues')return state.games.filter(g=>showGame(g)&&state.favoriteRinks.has(g.location?.trim())&&venueWindow(g));return[]}function visibleLive(){return currentGames().filter(g=>live(g)&&!isStaleLive(g))}", 1)

# Settings: stale toggle and pluralized descriptions.
settings_pat = re.compile(r"function openSettings\(\)\{.*?\}\nfunction bindTeamDelegates", re.S)
settings_repl = r'''function openSettings(){const opts=catalog().map(x=>`<option value="${escAttr(x.id)}" ${String(x.id)===String(state.seasonId)?'selected':''}>${esc(x.title||`Season ${x.id}`)}</option>`).join('');openDrawer('Settings','League, appearance, schedule cleanup, and app data',`<div class="settings-grid"><section class="settings-section"><h3>League / season</h3><label class="label">Current season</label><select id="settingsSeason">${opts}</select><div class="actions"><button id="settingsAddSeason" class="soft">＋ Add season</button></div></section><section class="settings-section"><h3>Appearance</h3><label class="label">Theme</label><select id="settingsTheme"><option value="system" ${state.theme==='system'?'selected':''}>Follow device</option><option value="dark" ${state.theme==='dark'?'selected':''}>Dark</option><option value="light" ${state.theme==='light'?'selected':''}>Light</option></select><div class="theme-help">Follow device updates automatically when your system appearance changes.</div></section><section class="settings-section"><h3>Schedule cleanup</h3><label style="display:flex;gap:9px;align-items:flex-start"><input id="settingsShowStale" type="checkbox" ${state.showStaleGames?'checked':''} style="margin-top:3px"><span><b>Show stale games</b><span class="theme-help" style="display:block">A game still marked Live more than 24 hours after its scheduled start is treated as stale. These are usually test games or games that were never properly ended on the scoring device, so they are hidden by default.</span></span></label></section><section class="settings-section"><h3>App data</h3><button id="settingsClearData" class="soft danger">Clear all MyHockeyHub data</button><div class="theme-help">Removes My Teams, favorite venues, My Players, added seasons, and appearance preferences stored on this device.</div></section><div class="settings-note">MyHockeyHub is an independent personal viewer using public GameSheet data. It is not affiliated with, endorsed by, sponsored by, or operated by GameSheet.</div></div>`);$('#settingsSeason').onchange=async()=>{state.seasonId=$('#settingsSeason').value;savePrefs();fillSeason();closeDrawer();await loadSeason()};$('#settingsAddSeason').onclick=async()=>{closeDrawer();await addSeason()};$('#settingsTheme').onchange=()=>{applyTheme($('#settingsTheme').value);savePrefs()};$('#settingsShowStale').onchange=()=>{state.showStaleGames=$('#settingsShowStale').checked;savePrefs();render()};$('#settingsClearData').onclick=clearAppData}
function bindTeamDelegates'''
s, n = settings_pat.subn(lambda _: settings_repl, s, count=1)
if n != 1:
    raise SystemExit(f'settings replacement count={n}')

# Old team delegate referenced the single-team map; replace it with a minimal safe delegate.
delegate_pat = re.compile(r"function bindTeamDelegates\(\)\{.*?\}\nfunction esc", re.S)
delegate_repl = r'''function bindTeamDelegates(){els.teamView.onclick=e=>{const b=e.target.closest?.('button');if(!b)return;if(b.id==='manageTeams'||b.id==='addAnotherTeam')openManageTeams()}}
function esc'''
s, n = delegate_pat.subn(lambda _: delegate_repl, s, count=1)
if n != 1:
    raise SystemExit(f'team delegate replacement count={n}')

# Box score: fit on mobile using team abbreviations rather than forcing a horizontal scroll.
box_pat = re.compile(r"function boxScoreHtml\(b\)\{.*?\}\nfunction wireTimeline", re.S)
box_repl = r'''function boxScoreHtml(b){const away=b.visitor||{},home=b.home||{},allPeriods=new Set(['P1','P2','P3']);for(const e of goals(b)){const p=e.periodLabel||e.period;if(p)allPeriods.add(String(p))}const periods=[...allPeriods].sort((a,b)=>periodSortKey(a)-periodSortKey(b)),count=(side,p)=>goals(b).filter(e=>e.teamSide===side&&String(e.periodLabel||e.period||'')===String(p)).length,row=(side,t)=>`<tr><td><div class="box-team">${logo(t,'xs')}<span class="box-team-full">${esc(t.title||pretty(side))}</span><span class="box-team-short">${esc(abbr(t))}</span></div></td>${periods.map(p=>`<td>${count(side,p)}</td>`).join('')}<td class="box-total">${esc(t.finalScore??'—')}</td><td>${esc(t.sog??'—')}</td><td>${esc(teamPimValue(t))}</td></tr>`;return`<div class="box-score-wrap"><table class="box-score"><thead><tr><th>Team</th>${periods.map(p=>`<th>${esc(String(p).replace(/^P/,''))}</th>`).join('')}<th>T</th><th>SOG</th><th>PIM</th></tr></thead><tbody>${row('visitor',away)}${row('home',home)}</tbody></table></div>`}
function wireTimeline'''
s, n = box_pat.subn(lambda _: box_repl, s, count=1)
if n != 1:
    raise SystemExit(f'box score replacement count={n}')

# Nav copy.
s = s.replace('<span class="nav-label">My Team</span>', '<span class="nav-label">My Teams</span>', 1)

Path('v3.4.html').write_text(s, encoding='utf-8')

# Stable latest-version entry.
stable = Path('gamesheets_plus.html').read_text(encoding='utf-8')
stable = stable.replace('V3.3','V3.4').replace("'3.3'","'3.4'").replace("'v3.3.html'","'v3.4.html'")
start = stable.index('  <div class="items">')
end = stable.index('  <div id="originalNote"', start)
items = '''  <div class="items">\n    <div class="item"><div class="check">✓</div><div><b>Multiple My Teams</b><span>Save more than one team, switch between them, and browse each team roster independently.</span></div></div>\n    <div class="item"><div class="check">✓</div><div><b>Cleaner box score on phones</b><span>The box score now fits the mobile drawer and uses compact team abbreviations when space is tight.</span></div></div>\n    <div class="item"><div class="check">✓</div><div><b>Stale live-game cleanup</b><span>Games still marked Live more than 24 hours after start are hidden by default and can be restored from Settings.</span></div></div>\n  </div>\n'''
stable = stable[:start] + items + stable[end:]
Path('gamesheets_plus.html').write_text(stable, encoding='utf-8')

# Version history.
index = Path('index.html').read_text(encoding='utf-8')
index = index.replace('<div class="version"><div class="tag current">V3.3</div>', '<div class="version"><div class="tag">V3.3</div>', 1)
marker = '<section class="versions">\n'
card = '<div class="version"><div class="tag current">V3.4</div><div class="desc"><b>Multiple teams and smarter schedule cleanup</b><span>My Teams now supports multiple kids/teams with division-first selection and per-team rosters. Mobile box scores fit without unnecessary scrolling, and stale Live games older than 24 hours are hidden by default with an opt-in Settings toggle.</span></div><a class="open" href="v3.4.html">Open V3.4</a></div>\n'
if marker not in index:
    raise SystemExit('index marker missing')
index = index.replace(marker, marker + card, 1)
Path('index.html').write_text(index, encoding='utf-8')
