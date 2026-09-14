from pathlib import Path
import re

p = Path('v2.html')
s = p.read_text()

helpers = r'''function statClock(clock){
    const parts=String(clock||'').split(':');
    if(parts.length===3){return{period:`P${Number(parts[0])||parts[0]}`,time:`${parts[1]}:${parts[2]}`}}
    return{period:'',time:String(clock||'')}
}
function normalizeStatPlayer(p){if(!p||typeof p!=='object')return{};const stats=p.stats||{};return{...p,number:p.number??p.jersey??stats.number??'',g:stats.g??p.g??0,a:stats.a??p.a??0,pts:stats.pts??p.pts??((Number(stats.g)||0)+(Number(stats.a)||0)),pim:stats.pim??p.pim??0}}
function groupEvents(items){const m=new Map();for(const e of items){const key=e.periodLabel||e.period||'';if(!m.has(key))m.set(key,[]);m.get(key).push(e)}return[...m.entries()].map(([period,periodEvents])=>({period,periodEvents}))}
function normalizeFirestoreBox(g,d){
    const visitorData=d?.data?.visitor||{};
    const homeData=d?.data?.home||{};
    const score=d?.computed?.scoreboard?.total||{};
    const shots=d?.computed?.shots?.total||{};
    const rawEvents=Object.values(d?.events||{});
    const goalEvents=[];
    const penaltyEvents=[];

    for(const e of rawEvents){
        const type=String(e?.type||'');
        const c=statClock(e?.time?.clock);
        if(type.includes('Goal')&&e?.for?.scorer){
            const assists=Array.isArray(e.for.assist)?e.for.assist:[];
            goalEvents.push({periodLabel:c.period,period:c.period,time:c.time,goalScorer:normalizeStatPlayer(e.for.scorer),assist1By:normalizeStatPlayer(assists[0]),assist2By:normalizeStatPlayer(assists[1]),team:e.for.team,powerPlay:Boolean(e.powerPlay||e.goal?.powerPlay||e.for?.powerPlay),shg:Boolean(e.shg||e.goal?.shg),en:Boolean(e.en||e.goal?.en),gameWinningGoal:Boolean(e.gameWinningGoal||e.goal?.gameWinningGoal)});
        }
        if(type.includes('HockeyPenalty')){
            const player=e?.for?.player||e?.player||{};
            penaltyEvents.push({periodLabel:c.period,period:c.period,time:c.time,committedBy:normalizeStatPlayer(player),penaltyType:{title:e?.penalty?.label||e?.penalty?.code||'Penalty',duration:e?.penalty?.length||''}});
        }
    }

    const normalizeTeam=(side,data,base)=>({...base,title:data?.details?.title||base?.title||side,logo:data?.details?.logo||base?.logo||'',finalScore:score?.[side]??base?.goals,sog:shots?.[side]??base?.shots,roster:{players:(data?.lineup?.players||[]).map(normalizeStatPlayer)}});
    return{visitor:normalizeTeam('visitor',visitorData,g.visitor||{}),home:normalizeTeam('home',homeData,g.home||{}),tables:{goalsByPeriod:groupEvents(goalEvents),penaltiesByPeriod:groupEvents(penaltyEvents)}};
}
function normalizeUnifiedBox(g){
    const toGoals=(team,side)=>(team?.goalDetails||[]).map(x=>({periodLabel:`P${x.period||''}`,period:`P${x.period||''}`,time:x.clockTime||'',goalScorer:{firstName:x.firstName||'',lastName:x.lastName||'',id:x.id,jersey:x.jersey||''},assist1By:{},assist2By:{},team:{vs:side}}));
    const all=[...toGoals(g.visitor,'visitor'),...toGoals(g.home,'home')];
    return{visitor:{...g.visitor,finalScore:g.visitor?.goals,sog:g.visitor?.shots,roster:{players:[]}},home:{...g.home,finalScore:g.home?.goals,sog:g.home?.shots,roster:{players:[]}},tables:{goalsByPeriod:groupEvents(all),penaltiesByPeriod:[]}};
}
async function openStats(gameId){
    const g=state.games.find(x=>String(x.gameId)===String(gameId));if(!g)return;
    state.boxGame=g;state.boxScore=null;state.statsTab='summary';
    els.drawerSub.textContent=`${g.visitor?.title||'Visitor'} vs ${g.home?.title||'Home'} · ${formatDate(gameDate(g))}`;
    els.drawerBody.className='loading';els.drawerBody.textContent='Loading GameSheet game details…';
    els.drawerBackdrop.classList.add('open');els.statsDrawer.classList.add('open');els.statsDrawer.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
    try{
        const url=`https://firestore.googleapis.com/v1/projects/gamesheet-production/databases/(default)/documents/seasons/${encodeURIComponent(state.seasonId)}/games/${encodeURIComponent(g.gameId)}`;
        const doc=await fetchJson(url);
        const data=firestoreData(doc);
        state.boxScore=normalizeFirestoreBox(g,data);
        renderStats();
    }catch(e){
        console.warn('Detailed Firestore stats unavailable; using unified-games summary.',e);
        state.boxScore=normalizeUnifiedBox(g);
        renderStats();
        const note=document.createElement('div');note.className='section';note.innerHTML='<div style="color:var(--muted);font-size:.82rem">Detailed assists, penalties, and player stats were unavailable for this game. Showing the stats included in the season game feed.</div>';
        els.drawerBody.prepend(note);
    }
}
function closeStats'''

pattern = re.compile(r'async function openStats\(gameId\)\{.*?\nfunction closeStats', re.S)
s2, count = pattern.subn(lambda _: helpers, s, count=1)
if count != 1:
    raise RuntimeError(f'Expected one openStats block; replaced {count}')
p.write_text(s2)
