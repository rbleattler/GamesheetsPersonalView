import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

await import('../src/app/foundation.js');
const foundation=globalThis.MyHockeyHubFoundation;
const fixture=JSON.parse(await readFile(new URL('./fixtures/games.json',import.meta.url),'utf8'));
const replayFixture=JSON.parse(await readFile(new URL('./fixtures/live-replay.json',import.meta.url),'utf8'));
const playerFixture=JSON.parse(await readFile(new URL('./fixtures/players.json',import.meta.url),'utf8'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('unwraps GameSheet data and normalizes games',()=>{
  const games=foundation.normalize.games(fixture);
  assert.equal(games.length,3);
  assert.equal(games[0].gameId,'fixture-live-1');
  assert.equal(games[0]._broadcast.available,true);
  assert.equal(games[0]._broadcast.provider,'LiveBarn');
});

test('suppresses generic LiveBarn venue-search links',()=>{
  const game=foundation.normalize.games(fixture)[1];
  assert.equal(game._broadcast.available,false);
  assert.equal(game._broadcast.suppressed[0].reason,'generic-venue-search');
});

test('missing broadcaster metadata is harmless',()=>{
  const game=foundation.normalize.games(fixture)[2];
  assert.equal(game._broadcast.available,false);
  assert.deepEqual(game._broadcast.candidates,[]);
});

test('normalizes nested player standings without app-state dependencies',()=>{
  const skaters=foundation.normalize.standingPlayers(playerFixture,{kind:'skater',divisionId:'12'});
  assert.equal(skaters.length,2);
  assert.deepEqual(skaters[0],{
    id:'101',name:'Alex Example',kind:'skater',number:'17',position:'Forward',teamId:'501',teamTitle:'Fixture Falcons',teamLogo:'https://images.example.invalid/team.png',teamAbbr:'FF',divisionId:'12',divisionTitle:'12U A',photo:'https://images.example.invalid/player.png',g:4,a:6,pts:10,pim:2,sog:19,gaa:'—',svPct:'—',w:'—',so:'—'
  });
  const goalie=foundation.normalize.standingPlayer(playerFixture.data.rows[1],{kind:'goalie',divisionId:'12'});
  assert.equal(goalie.id,'202');
  assert.equal(goalie.name,'Goalie Example');
  assert.equal(goalie.gaa,1.75);
  assert.equal(goalie.svPct,0.925);
  assert.equal(goalie.w,7);
  assert.equal(goalie.so,2);
});

test('API client validates HTTP and GameSheet status without live network access',async()=>{
  const okFetch=async()=>({ok:true,status:200,statusText:'OK',json:async()=>({status:'success',data:{id:1}})});
  assert.deepEqual(await foundation.api.fetchJson('https://example.invalid',{fetchImpl:okFetch}),{status:'success',data:{id:1}});

  const badStatus=async()=>({ok:true,status:200,statusText:'OK',json:async()=>({status:'error',message:'fixture failure'})});
  await assert.rejects(()=>foundation.api.fetchJson('https://example.invalid',{fetchImpl:badStatus}),/fixture failure/);
});

test('endpoint client owns public GameSheet URL construction',async()=>{
  const calls=[];
  const fetchImpl=async url=>{calls.push(String(url));return{ok:true,status:200,statusText:'OK',json:async()=>({status:'success',data:[]})}};
  const client=foundation.api.createClient({fetchImpl});
  await client.seasonInfo('15 111');
  await client.seasonDivisions('15111');
  await client.unifiedGames('15111');
  await client.skaterStandings('15111','?limit=20&sort=-pts');
  await client.goalieStandings('15111','limit=10&sort=gaa');
  await client.firestoreGame('15111','game/id');
  assert.deepEqual(calls,[
    'https://gamesheetstats.com/api/season-info/15%20111',
    'https://gamesheetstats.com/api/season-divisions/15111',
    'https://gamesheetstats.com/api/unified-games/15111',
    'https://gamesheetstats.com/api/players/standings/15111?limit=20&sort=-pts',
    'https://gamesheetstats.com/api/goalies/standings/15111?limit=10&sort=gaa',
    'https://firestore.googleapis.com/v1/projects/gamesheet-production/databases/(default)/documents/seasons/15111/games/game%2Fid'
  ]);
});

test('live refresh service prevents overlap and applies successful snapshots',async()=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve});
  const applied=[];
  const service=foundation.live.createRefreshService({
    getVisibleLive:()=>[{gameId:'1'}],
    fetchSnapshot:async game=>{await gate;return{...game,status:'live'}},
    applySnapshots:rows=>applied.push(...rows),
    documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},
    windowRef:{addEventListener(){},removeEventListener(){}},
    setIntervalImpl:()=>1,
    clearIntervalImpl:()=>{}
  });
  const first=service.refresh({force:true});
  const second=await service.refresh({force:true});
  assert.equal(second.skipped,'busy');
  release();
  const result=await first;
  assert.equal(result.updated,1);
  assert.equal(applied.length,1);
});

test('live refresh service refreshes on visibility recovery and reconnect',async()=>{
  const docListeners={},windowListeners={};
  const documentRef={hidden:false,addEventListener:(name,fn)=>docListeners[name]=fn,removeEventListener:name=>delete docListeners[name]};
  const windowRef={addEventListener:(name,fn)=>windowListeners[name]=fn,removeEventListener:name=>delete windowListeners[name]};
  let fetches=0;
  const service=foundation.live.createRefreshService({
    getVisibleLive:()=>[{gameId:'1'}],
    fetchSnapshot:async game=>{fetches++;return game},
    applySnapshots:()=>{},
    documentRef,windowRef,
    setIntervalImpl:()=>1,clearIntervalImpl:()=>{}
  });
  service.start();
  await tick();
  assert.equal(fetches,1);
  documentRef.hidden=true;docListeners.visibilitychange();await tick();
  assert.equal(fetches,1);
  documentRef.hidden=false;docListeners.visibilitychange();await tick();
  assert.equal(fetches,2);
  windowListeners.online();await tick();
  assert.equal(fetches,3);
  service.stop();
  assert.equal(docListeners.visibilitychange,undefined);
  assert.equal(windowListeners.online,undefined);
});

test('replay controller steps deterministically through scheduled, live, and final states',()=>{
  const replay=foundation.replay.createController(replayFixture.snapshots);
  assert.equal(replay.state().total,4);
  assert.equal(replay.current().status,'scheduled');
  assert.equal(replay.step().current.status,'live');
  assert.equal(replay.step().current.visitor.goals,2);
  assert.equal(replay.step().current.status,'final');
  assert.equal(replay.step().index,3);
  assert.equal(replay.state().done,true);
  assert.equal(replay.reset().current.status,'scheduled');
});
