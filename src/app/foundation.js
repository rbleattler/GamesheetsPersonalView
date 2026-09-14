const API_BASE='https://gamesheetstats.com/api';

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
  const candidates=[];
  const push=value=>{if(typeof value==='string'&&value.trim())candidates.push(value.trim())};
  const b=raw?.broadcaster??raw?.broadcast??raw?.stream??raw?.video??raw?.vod;
  push(raw?.broadcastUrl);push(raw?.watchUrl);push(raw?.streamUrl);push(raw?.videoUrl);push(raw?.vodUrl);
  if(typeof b==='string')push(b);
  if(b&&typeof b==='object'){
    for(const key of ['url','href','link','watchUrl','streamUrl','videoUrl','vodUrl','liveUrl','replayUrl'])push(b[key]);
  }
  return[...new Set(candidates)];
}

function normalizeBroadcaster(raw){
  const candidates=candidateBroadcastUrls(raw).map(classifyBroadcastUrl);
  const usable=candidates.find(x=>x.actionable)||null;
  const meta=raw?.broadcaster??raw?.broadcast??null;
  const kind=String(meta?.type??meta?.kind??raw?.broadcastType??'').toLowerCase();
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

function normalizeGame(raw){
  if(!raw||typeof raw!=='object')return raw;
  return{...raw,_broadcast:normalizeBroadcaster(raw)};
}
function normalizeGames(body){
  const data=dataOf(body);
  return(Array.isArray(data)?data:[]).map(normalizeGame);
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

globalThis.MyHockeyHubFoundation={
  API_BASE,
  api:{fetchJson},
  normalize:{dataOf,firstData,game:normalizeGame,games:normalizeGames,broadcaster:normalizeBroadcaster},
  broadcast:{classifyUrl:classifyBroadcastUrl,isGenericLiveBarnUrl},
  live:{createRefreshService:createLiveRefreshService},
  replay:{createController:createReplayController}
};
