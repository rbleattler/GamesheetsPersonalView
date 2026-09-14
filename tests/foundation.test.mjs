import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

await import('../src/app/foundation.js');
const foundation=globalThis.MyHockeyHubFoundation;
const fixture=JSON.parse(await readFile(new URL('./fixtures/games.json',import.meta.url),'utf8'));

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

test('API client validates HTTP and GameSheet status without live network access',async()=>{
  const okFetch=async()=>({ok:true,status:200,statusText:'OK',json:async()=>({status:'success',data:{id:1}})});
  assert.deepEqual(await foundation.api.fetchJson('https://example.invalid',{fetchImpl:okFetch}),{status:'success',data:{id:1}});

  const badStatus=async()=>({ok:true,status:200,statusText:'OK',json:async()=>({status:'error',message:'fixture failure'})});
  await assert.rejects(()=>foundation.api.fetchJson('https://example.invalid',{fetchImpl:badStatus}),/fixture failure/);
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
