const API_BASE='https://gamesheetstats.com/api';
const FIRESTORE_GAME_BASE='https://firestore.googleapis.com/v1/projects/gamesheet-production/databases/(default)/documents/seasons';

function dataOf(body){return body&&typeof body==='object'&&'data'in body?body.data:body}
function firstData(body){const data=dataOf(body);return Array.isArray(data)?data[0]:data}

async function fetchJson(url,{fetchImpl=globalThis.fetch,cache='no-store',credentials='omit'}={}){
  if(typeof fetchImpl!=='function')throw new Error('Fetch is unavailable');
  const response=await fetchImpl(url,{cache,credentials});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText}`.trim());
  const body=await response.json();
  if(body&&typeof body==='object'&&'status'in body&&body.status!=='success'){
    throw new Error(body.message||body.error||`GameSheet status ${body.status}`);
  }
  return body;
}

function appendQuery(url,query=''){
  const q=String(query||'').trim();
  if(!q)return url;
  return `${url}${q.startsWith('?')?q:`?${q}`}`;
}

function createApiClient({fetchImpl=globalThis.fetch}={}){
  const get=(url,options={})=>fetchJson(url,{fetchImpl,...options});
  const seasonPath=(segment,seasonId)=>`${API_BASE}/${segment}/${encodeURIComponent(String(seasonId))}`;
  return{
    fetchJson:(url,options={})=>get(url,options),
    seasonInfo:seasonId=>get(seasonPath('season-info',seasonId)),
    seasonDivisions:seasonId=>get(seasonPath('season-divisions',seasonId)),
    unifiedGames:seasonId=>get(seasonPath('unified-games',seasonId)),
    skaterStandings:(seasonId,query='')=>get(appendQuery(seasonPath('players/standings',seasonId),query)),
    goalieStandings:(seasonId,query='')=>get(appendQuery(seasonPath('goalies/standings',seasonId),query)),
    firestoreGame:(seasonId,gameId)=>get(`${FIRESTORE_GAME_BASE}/${encodeURIComponent(String(seasonId))}/games/${encodeURIComponent(String(gameId))}`)
  };
}

function asUrl(value){
  try{return value?new URL(String(value)):null}catch{return null}
}

function isGenericLiveBarnUrl(value){
  const url=asUrl(value);if(!url)return false;
  const host=url.hostname.toLowerCase();
  if(!host.includes('livebarn'))return false;
  const path=url.pathname.toLowerCase().replace(/\/+$/,'');
  const query=`${url.searchParams.get('venue')||''} ${url.searchParams.get('search')||''} ${url.searchParams.get('q')||''}`.trim();
  if(/\/(?:venue|venues|search)(?:\/|$)/.test(path))return true;
  if((path===''||path==='/')&&query)return true;
  return false;
}

function classifyBroadcastUrl(value){
  const url=asUrl(value);
  if(!url)return{url:'',actionable:false,reason:'invalid-url',provider:''};
  const provider=url.hostname.toLowerCase().includes('livebarn')?'LiveBarn':url.hostname.replace(/^www\./,'');
  if(isGenericLiveBarnUrl(url.toString()))return{url:url.toString(),actionable:false,reason:'generic-venue-search',provider};
  if(!/^https?:$/.test(url.protocol))return{url:url.toString(),actionable:false,reason:'unsupported-protocol',provider};
  return{url:url.toString(),actionable:true,reason:'game-specific',provider};
}

function candidateBroadcastUrls(raw){
  const candidates=[],seen=new Set();
  const urlKey=/^(?:url|href|link|watchurl|streamurl|videourl|vodurl|liveurl|replayurl|broadcasturl)$/i;
  const broadcastKey=/(?:broadcast|broadcaster|stream|video|vod|livebarn|watch|replay)/i;
  const push=value=>{
    if(typeof value!=='string')return;
    const v=value.trim();
    if(!v||!/^https?:\/\//i.test(v)||seen.has(v))return;
    seen.add(v);candidates.push(v);
  };
  const walk=(value,depth=0,context='')=>{
    if(value==null||depth>7)return;
    if(typeof value==='string'){
      if(broadcastKey.test(context)||/livebarn\.com/i.test(value))push(value);
      return;
    }
    if(Array.isArray(value)){
      for(const item of value.slice(0,40))walk(item,depth+1,context);
      return;
    }
    if(typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){
      const nextContext=broadcastKey.test(key)||broadcastKey.test(context)?`${context}.${key}`:key;
      if(typeof child==='string'&&(urlKey.test(key)||broadcastKey.test(key)||broadcastKey.test(context)))push(child);
      if(child&&typeof child==='object')walk(child,depth+1,nextContext);
    }
  };
  walk(raw);
  return candidates;
}

function broadcastKind(raw){
  let found='';
  const walk=(value,depth=0,context='')=>{
    if(found||value==null||depth>6)return;
    if(Array.isArray(value)){for(const item of value.slice(0,30))walk(item,depth+1,context);return}
    if(typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){
      const relevant=/(?:broadcast|broadcaster|stream|video|vod|livebarn|watch|replay)/i.test(key)||/(?:broadcast|broadcaster)/i.test(context);
      if(relevant&&/^(?:type|kind|mode|status)$/i.test(key)&&typeof child==='string'){found=child.toLowerCase();return}
      if(child&&typeof child==='object')walk(child,depth+1,relevant?`${context}.${key}`:key);
    }
  };
  walk(raw);
  return found;
}

function normalizeBroadcaster(raw){
  const candidates=candidateBroadcastUrls(raw).map(classifyBroadcastUrl);
  const usable=candidates.find(x=>x.actionable)||null;
  const kind=broadcastKind(raw);
  const label=kind.includes('vod')||kind.includes('replay')?'Replay':kind.includes('live')?'Live':'Watch';
  return{
    available:!!usable,
    url:usable?.url||'',
    provider:usable?.provider||'',
    label,
    suppressed:candidates.filter(x=>!x.actionable),
    candidates
  };
}

function richerBroadcast(...sources){
  const normalized=sources.filter(Boolean).map(normalizeBroadcaster);
  const actionable=normalized.find(x=>x.available);
  if(actionable)return actionable;
  const all=normalized.flatMap(x=>x.candidates||[]),seen=new Set(),candidates=[];
  for(const item of all){const key=`${item.url}|${item.reason}`;if(!seen.has(key)){seen.add(key);candidates.push(item)}}
  return{available:false,url:'',provider:'',label:'Watch',suppressed:candidates.filter(x=>!x.actionable),candidates};
}

function normalizeGame(raw){
  if(!raw||typeof raw!=='object')return raw;
  return{...raw,_broadcast:richerBroadcast(raw)};
}
function enrichGameBroadcast(game,...extraSources){
  if(!game||typeof game!=='object')return game;
  return{...game,_broadcast:richerBroadcast(game,game._broadcast,...extraSources)};
}
function normalizeGames(body){
  const data=dataOf(body);
  return(Array.isArray(data)?data:[]).map(normalizeGame);
}

function numberOrZero(value){return value==null||value===''?0:Number(value)}
function extractStandingRows(body){
  const roots=[],seen=new Set();
  function walk(value,depth=0){
    if(value==null||depth>5)return;
    if(Array.isArray(value)){
      if(value.length&&value.some(x=>x&&typeof x==='object'&&!Array.isArray(x)))roots.push(value);
      for(const x of value.slice(0,5))walk(x,depth+1);
      return;
    }
    if(typeof value!=='object'||seen.has(value))return;
    seen.add(value);
    for(const [key,child] of Object.entries(value))if(['data','players','standings','rows','results','items','skaters','goalies','entries'].includes(key))walk(child,depth+1);
    for(const child of Object.values(value))if(child&&typeof child==='object')walk(child,depth+1);
  }
  walk(body);
  const score=rows=>rows.reduce((n,row)=>n+(row&&(row.player||row.skater||row.goalie||row.firstName||row.lastName||row.name||row.title||row.stats)?1:0),0);
  return roots.sort((a,b)=>score(b)-score(a)||b.length-a.length)[0]||[];
}
function normalizeStandingPlayer(row,{kind='skater',divisionId=''}={}){
  const r=row||{},p=r.player||r.skater||r.goalie||r,team=r.team||p.team||{},stats=r.stats||p.stats||r,division=r.division||p.division||{};
  const first=p.firstName||r.firstName||'',last=p.lastName||r.lastName||'',name=(p.name||p.title||r.name||r.title||`${first} ${last}`).trim();
  return{
    id:String(p.id??r.playerId??r.id??''),
    name,
    kind,
    number:p.number??p.jersey??r.number??r.jersey??'',
    position:p.position??r.position??'',
    teamId:String(team.id??r.teamId??p.teamId??''),
    teamTitle:team.title||team.name||r.teamTitle||r.teamName||'',
    teamLogo:team.logo||r.teamLogo||'',
    teamAbbr:team.abbr||r.teamAbbr||'',
    divisionId:String(division.id??divisionId??''),
    divisionTitle:division.title||'',
    photo:p.photoURL||p.photo||r.photoURL||r.photo||'',
    g:numberOrZero(stats.g??stats.goals),
    a:numberOrZero(stats.a??stats.assists),
    pts:numberOrZero(stats.pts??stats.points),
    pim:numberOrZero(stats.pim),
    sog:numberOrZero(stats.sog??stats.shots),
    gaa:stats.gaa??r.gaa??'—',
    svPct:stats.savePct??stats.svPct??stats.svPercentage??r.savePct??'—',
    w:stats.w??stats.wins??r.wins??'—',
    so:stats.so??stats.shutouts??r.shutouts??'—'
  };
}
function normalizeStandingPlayers(body,options={}){
  return extractStandingRows(body).map(row=>normalizeStandingPlayer(row,options)).filter(player=>player.id&&player.name);
}

function createReplayController(snapshots,{normalize=normalizeGame}={}){
  const rows=(Array.isArray(snapshots)?snapshots:[]).map(x=>normalize({...x}));
  let index=0;
  const current=()=>rows[index]||null;
  const state=()=>({index,total:rows.length,done:rows.length===0||index===rows.length-1,current:current()});
  const reset=()=>{index=0;return state()};
  const step=()=>{if(rows.length&&index<rows.length-1)index++;return state()};
  const seek=value=>{if(!rows.length)return state();const n=Math.max(0,Math.min(rows.length-1,Number(value)||0));index=n;return state()};
  return{current,state,reset,step,seek};
}

function createLiveRefreshService({
  intervalMs=30000,
  getVisibleLive,
  fetchSnapshot,
  applySnapshots,
  onStatus=()=>{},
  documentRef=globalThis.document,
  windowRef=globalThis.window,
  setIntervalImpl=globalThis.setInterval,
  clearIntervalImpl=globalThis.clearInterval
}={}){
  let timer=null,running=false,lastSuccess=null,lastError=null;
  const refresh=async({force=false}={})=>{
    if(running)return{skipped:'busy'};
    if(!force&&documentRef?.hidden)return{skipped:'hidden'};
    const games=typeof getVisibleLive==='function'?(getVisibleLive()||[]):[];
    if(!games.length){onStatus({running:false,lastSuccess,lastError,liveCount:0});return{updated:0}}
    running=true;onStatus({running:true,lastSuccess,lastError,liveCount:games.length});
    try{
      const settled=await Promise.allSettled(games.map(fetchSnapshot));
      const good=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);
      const failures=settled.filter(x=>x.status==='rejected');
      if(good.length&&typeof applySnapshots==='function')applySnapshots(good);
      if(good.length)lastSuccess=new Date();
      lastError=failures.length?failures[0].reason:null;
      onStatus({running:false,lastSuccess,lastError,liveCount:games.length,updated:good.length});
      return{updated:good.length,failed:failures.length};
    }catch(error){
      lastError=error;onStatus({running:false,lastSuccess,lastError,liveCount:games.length});throw error;
    }finally{running=false}
  };
  const onVisible=()=>{if(!documentRef?.hidden)void refresh({force:true})};
  const onOnline=()=>void refresh({force:true});
  const start=()=>{
    if(timer!=null)clearIntervalImpl(timer);
    timer=setIntervalImpl(()=>void refresh(),intervalMs);
    documentRef?.addEventListener?.('visibilitychange',onVisible);
    windowRef?.addEventListener?.('online',onOnline);
    void refresh({force:true});
  };
  const stop=()=>{
    if(timer!=null)clearIntervalImpl(timer);timer=null;
    documentRef?.removeEventListener?.('visibilitychange',onVisible);
    windowRef?.removeEventListener?.('online',onOnline);
  };
  return{start,stop,refresh,getState:()=>({running,lastSuccess,lastError})};
}

const apiClient=createApiClient();
globalThis.MyHockeyHubFoundation={
  API_BASE,
  api:{...apiClient,createClient:createApiClient},
  normalize:{dataOf,firstData,game:normalizeGame,games:normalizeGames,enrichGameBroadcast,broadcaster:normalizeBroadcaster,standingRows:extractStandingRows,standingPlayer:normalizeStandingPlayer,standingPlayers:normalizeStandingPlayers},
  broadcast:{classifyUrl:classifyBroadcastUrl,isGenericLiveBarnUrl,candidates:candidateBroadcastUrls},
  live:{createRefreshService:createLiveRefreshService},
  replay:{createController:createReplayController}
};
