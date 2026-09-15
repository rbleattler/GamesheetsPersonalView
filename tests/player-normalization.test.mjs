import test from 'node:test';
import assert from 'node:assert/strict';

await import('../src/app/player-normalization.js');
const normalize=globalThis.MyHockeyHubPlayerNormalization;

const game={
  gameId:'fixture-game',
  location:'Fixture Rink',
  visitor:{id:'V',title:'Visitors',logo:'v.png',abbr:'VIS',division:{id:'12',title:'12U A'}},
  home:{id:'H',title:'Home',logo:'h.png',abbr:'HOM',division:{id:'12',title:'12U A'}}
};
const decoded={
  data:{
    visitor:{lineup:{players:[
      {id:'10',firstName:'Alex',lastName:'Visitor',number:'10',position:'Forward',stats:{g:2,a:1,pim:0,sog:5}},
      {id:'11',firstName:'Casey',lastName:'Goalie',number:'30',position:'Goalie',stats:{gaa:1.25,savePct:0.94,wins:4,shutouts:1,saves:22}}
    ]}},
    home:{lineup:{players:[
      {id:'20',firstName:'Sam',lastName:'Home',number:'20',position:'Defense',stats:{g:0,a:1,pim:2}}
    ]}}
  },
  events:{
    goal1:{type:'HockeyGoal',time:{clock:'1:12:34'},for:{scorer:{id:'10',firstName:'Alex',lastName:'Visitor'},assist:{id:'20',firstName:'Sam',lastName:'Home'}}},
    goal2:{type:'HockeyGoal',time:{clock:'2:05:12'},for:{scorer:{id:'20',firstName:'Sam',lastName:'Home'},assist:[{id:'10',firstName:'Alex',lastName:'Visitor'}]}}
  }
};

test('normalizes roster players into a stable app shape',()=>{
  const players=normalize.normalizeRoster(decoded,{side:'visitor',team:game.visitor,division:game.visitor.division});
  assert.equal(players.length,2);
  assert.deepEqual(players[0],{
    id:'10',name:'Alex Visitor',kind:'skater',number:'10',position:'Forward',teamId:'V',teamTitle:'Visitors',teamLogo:'v.png',teamAbbr:'VIS',divisionId:'12',divisionTitle:'12U A',photo:'',g:2,a:1,pts:3,pim:0,sog:5,gaa:'—',svPct:'—',w:'—',so:'—',saves:'—'
  });
  assert.equal(players[1].kind,'goalie');
  assert.equal(players[1].svPct,0.94);
  assert.equal(players[1].saves,22);
});

test('canonicalizes hockey positions for display and shorthand',()=>{
  assert.equal(normalize.canonicalPosition('defence'),'Defense');
  assert.equal(normalize.canonicalPosition('DEFENCEMAN'),'Defense');
  assert.equal(normalize.canonicalPosition('centre'),'Forward');
  assert.equal(normalize.canonicalPosition('left wing'),'Forward');
  assert.equal(normalize.canonicalPosition('goalie'),'Goalie');
  assert.equal(normalize.canonicalPosition('', 'skater'),'Skater');
  assert.equal(normalize.positionCode('defence'),'D');
  assert.equal(normalize.positionCode('Forward'),'F');
  assert.equal(normalize.positionCode('Goalie'),'G');
  assert.equal(normalize.positionCode('', 'skater'),'S');
});

test('derives save percentage from shots against and goals against',()=>{
  const goalie=normalize.normalizeStandingPlayer({
    player:{id:'40',firstName:'Save',lastName:'Goalie',position:'Goalie'},
    stats:{sa:30,ga:2,min:'48:00',gaa:2}
  },{kind:'goalie',divisionId:'12'});
  assert.equal(goalie.saves,28);
  assert.equal(goalie.svPct,28/30);
});

test('derives missing GAA from goals against, minutes, and inferred division game length',()=>{
  const rows=normalize.completeGoalieMetrics([
    normalize.normalizeStandingPlayer({
      player:{id:'41',firstName:'Reference',lastName:'Goalie',position:'Goalie'},
      stats:{ga:2,sa:30,min:'48:00',gaa:2}
    },{kind:'goalie',divisionId:'12'}),
    normalize.normalizeStandingPlayer({
      player:{id:'42',firstName:'Partial',lastName:'Goalie',position:'Goalie'},
      stats:{ga:1,sa:7,min:'20:00',svPct:.857142857}
    },{kind:'goalie',divisionId:'12'})
  ]);
  const partial=rows.find(player=>player.id==='42');
  assert.ok(Math.abs(partial.gaa-2.4)<1e-9);
  assert.ok(Math.abs(partial.svPct-(6/7))<1e-9);
});

test('game scope can infer standard length from combined goalie minutes',()=>{
  const rows=normalize.completeGoalieMetrics([
    {id:'50',name:'One',kind:'goalie',position:'Goalie',teamId:'V',divisionId:'12',ga:1,sa:13,saves:12,minutes:'24:00',gaa:'—',svPct:'—'},
    {id:'51',name:'Two',kind:'goalie',position:'Goalie',teamId:'V',divisionId:'12',ga:2,sa:14,saves:12,minutes:'24:00',gaa:'—',svPct:'—'}
  ],{scope:'game'});
  assert.equal(rows[0].gameLength,48);
  assert.equal(rows[0].gaa,2);
  assert.equal(rows[1].gaa,4);
});

test('preserves standing-row numeric defaults while using the stable player shape',()=>{
  const player=normalize.normalizeStandingPlayer({
    player:{id:'30',firstName:'Taylor',lastName:'Skater',teamId:'V'},
    teamId:'V',
    stats:{g:2,a:3}
  },{kind:'skater',team:game.visitor,division:game.visitor.division,divisionId:'12'});
  assert.equal(player.teamTitle,'Visitors');
  assert.equal(player.position,'Skater');
  assert.equal(player.g,2);
  assert.equal(player.a,3);
  assert.equal(player.pts,0);
  assert.equal(player.sog,0);
});

test('standing rows retain fallback team and division metadata',()=>{
  const player=normalize.normalizeStandingPlayer({
    player:{id:'31',firstName:'Fallback',lastName:'Player',teamId:'V',position:'defence'},
    teamId:'V',
    division:{id:'12'},
    stats:{pts:4}
  },{kind:'skater',team:game.visitor,division:game.visitor.division,divisionId:'12'});
  assert.equal(player.teamId,'V');
  assert.equal(player.teamTitle,'Visitors');
  assert.equal(player.teamLogo,'v.png');
  assert.equal(player.divisionTitle,'12U A');
  assert.equal(player.position,'Defense');
});

test('extracts a team roster from decoded game data',()=>{
  const roster=normalize.teamRosterFromGame(game,decoded,'H',{divisionId:'12',divisionTitle:'12U A'});
  assert.equal(roster.length,1);
  assert.equal(roster[0].id,'20');
  assert.equal(roster[0].teamId,'H');
  assert.equal(roster[0].teamTitle,'Home');
  assert.equal(roster[0].position,'Defense');
});

test('normalizes player goal and assist events in game order',()=>{
  const events=normalize.playerEvents(decoded,'10');
  assert.equal(events.length,2);
  assert.deepEqual(events[0],{kind:'Goal',period:'P1',time:'12:34',detail:'Goal'});
  assert.deepEqual(events[1],{kind:'Assist',period:'P2',time:'05:12',detail:'Assist on Sam Home'});
});

test('builds recent-game player activity from the same normalized roster source',()=>{
  const activity=normalize.playerGameActivity(game,decoded,{id:'10',teamId:'V'});
  assert.equal(activity.gameId,'fixture-game');
  assert.equal(activity.opponent,'Home');
  assert.equal(activity.location,'Fixture Rink');
  assert.equal(activity.kind,'skater');
  assert.equal(activity.g,2);
  assert.equal(activity.a,1);
  assert.equal(activity.events.length,2);
});

test('recent-game activity can preserve a known goalie classification when game detail omits position',()=>{
  const goalieDecoded=structuredClone(decoded);
  delete goalieDecoded.data.visitor.lineup.players[1].position;
  const activity=normalize.playerGameActivity(game,goalieDecoded,{id:'11',teamId:'V',kind:'goalie',position:'Goalie'});
  assert.equal(activity.kind,'goalie');
  assert.equal(activity.sv,22);
});

test('goalie rate derivation preserves an explicit valid GameSheet value',()=>{
  const goalie=normalize.normalizeStandingPlayer({
    player:{id:'60',firstName:'Explicit',lastName:'Goalie',position:'Goalie'},
    stats:{sa:30,ga:3,min:'60:00',gaa:2.5,savePct:.9}
  },{kind:'goalie',divisionId:'12'});
  assert.equal(goalie.gaa,2.5);
  assert.equal(goalie.svPct,.9);
});

test('goalie rate derivation handles the zero-shot edge case without dividing by zero',()=>{
  const rows=normalize.completeGoalieMetrics([
    {id:'61',name:'Idle',kind:'goalie',position:'Goalie',teamId:'V',divisionId:'12',ga:0,sa:0,saves:0,minutes:5,gaa:'—',svPct:'—'}
  ],{scope:'game'});
  assert.equal(rows[0].svPct,'—');
});

test('goalie rate derivation reports missing data as em dash when components are absent',()=>{
  const rows=normalize.completeGoalieMetrics([
    {id:'62',name:'NoData',kind:'goalie',position:'Goalie',teamId:'V',divisionId:'12',ga:'—',sa:'—',saves:'—',minutes:'—',gaa:'—',svPct:'—'}
  ],{scope:'game'});
  assert.equal(rows[0].gaa,'—');
  assert.equal(rows[0].svPct,'—');
});

test('split-goalie game: each goalie derives GAA/SV% from only their own minutes and shots',()=>{
  const rows=normalize.completeGoalieMetrics([
    {id:'70',name:'Starter',kind:'goalie',position:'Goalie',teamId:'V',divisionId:'9',ga:1,sa:10,minutes:'20:00',gaa:'—',svPct:'—'},
    {id:'71',name:'Reliever',kind:'goalie',position:'Goalie',teamId:'V',divisionId:'9',ga:2,sa:15,minutes:'40:00',gaa:'—',svPct:'—'}
  ],{scope:'game'});
  const starter=rows.find(r=>r.id==='70'),reliever=rows.find(r=>r.id==='71');
  assert.equal(starter.saves,9);
  assert.ok(Math.abs(starter.svPct-9/10)<1e-9);
  assert.equal(reliever.saves,13);
  assert.ok(Math.abs(reliever.svPct-13/15)<1e-9);
  // Standard game length is inferred from combined minutes (60), so each
  // goalie's GAA reflects their own goals-against prorated to that length.
  assert.ok(Math.abs(starter.gaa-3)<1e-9);
  assert.ok(Math.abs(reliever.gaa-3)<1e-9);
});

test('game player table symptom: one goalie missing SV%, another missing GAA both derive fully',()=>{
  const rows=normalize.completeGoalieMetrics([
    {id:'80',name:'HasGaaOnly',kind:'goalie',position:'Goalie',teamId:'V',divisionId:'9',ga:2,sa:20,saves:'—',minutes:'45:00',gaa:2.67,svPct:'—'},
    {id:'81',name:'HasSvPctOnly',kind:'goalie',position:'Goalie',teamId:'H',divisionId:'9',ga:'—',sa:18,saves:16,minutes:'45:00',gaa:'—',svPct:.889}
  ],{scope:'game'});
  const a=rows.find(r=>r.id==='80'),b=rows.find(r=>r.id==='81');
  assert.notEqual(a.svPct,'—');
  assert.ok(Math.abs(a.svPct-18/20)<1e-9);
  assert.notEqual(b.gaa,'—');
});

test('formatGaa and formatSvPct render sensible, bounded precision',()=>{
  assert.equal(normalize.formatGaa(1.59375),'1.59');
  assert.equal(normalize.formatGaa('—'),'—');
  assert.equal(normalize.formatSvPct(.9469135),'.947');
  assert.equal(normalize.formatSvPct(94.69135),'.947');
  assert.equal(normalize.formatSvPct('—'),'—');
});

test('mergePlayerRecord: season stats are authoritative and game stats cannot overwrite them',()=>{
  const season=normalize.mergePlayerRecord({},{id:'90',name:'Player Ninety',g:10,a:12,pts:22,pim:4},{scope:'season'});
  assert.equal(season._hasSeasonStats,true);
  const afterGame=normalize.mergePlayerRecord(season,{id:'90',name:'Player Ninety',g:1,a:0,pts:1,pim:2},{scope:'game'});
  assert.equal(afterGame.g,10);
  assert.equal(afterGame.a,12);
  assert.equal(afterGame.pts,22);
  assert.equal(afterGame.pim,4);
  assert.deepEqual(afterGame._lastGameStats.g,1);
});

test('mergePlayerRecord: a later season record can still overwrite an earlier game-only guess',()=>{
  const fromGame=normalize.mergePlayerRecord({},{id:'91',name:'Player NinetyOne',g:1,a:0,pts:1,pim:2},{scope:'game'});
  assert.equal(fromGame._hasSeasonStats,false);
  assert.equal(fromGame.g,1);
  const fromSeason=normalize.mergePlayerRecord(fromGame,{id:'91',name:'Player NinetyOne',g:14,a:9,pts:23,pim:6},{scope:'season'});
  assert.equal(fromSeason.g,14);
  assert.equal(fromSeason.pts,23);
  assert.equal(fromSeason._hasSeasonStats,true);
});

test('mergePlayerRecord: a season merge does not disturb the tracked last-game snapshot',()=>{
  const fromGame=normalize.mergePlayerRecord({},{id:'93',name:'Player NinetyThree',g:1,a:1,pts:2,pim:0},{scope:'game'});
  assert.deepEqual(fromGame._lastGameStats,{g:1,a:1,pts:2,pim:0});
  const fromSeason=normalize.mergePlayerRecord(fromGame,{id:'93',name:'Player NinetyThree',g:20,a:15,pts:35,pim:8},{scope:'season'});
  assert.deepEqual(fromSeason._lastGameStats,{g:1,a:1,pts:2,pim:0});
  assert.equal(fromSeason.g,20);
});

test('mergePlayerRecord: identity metadata fills gaps regardless of scope',()=>{
  const merged=normalize.mergePlayerRecord(
    {id:'92',name:'Player NinetyTwo',teamId:'',teamTitle:'',position:''},
    {id:'92',name:'Player NinetyTwo',teamId:'T1',teamTitle:'Team One',position:'defence',g:1,a:0},
    {scope:'game'}
  );
  assert.equal(merged.teamId,'T1');
  assert.equal(merged.teamTitle,'Team One');
  assert.equal(merged.position,'Defense');
  assert.equal(merged.g,1);
});

test('dedupe merges complementary position metadata instead of dropping it',()=>{
  const rows=normalize.dedupePlayers([
    {id:'10',name:'Alex Visitor',teamTitle:'Visitors',number:'10',position:'',g:4,a:2,pts:6,kind:'skater'},
    {id:'10',name:'Alex Visitor',teamTitle:'Visitors',number:'10',position:'defence',kind:'skater'},
    {id:'20',name:'Sam Home',kind:'skater'}
  ]);
  assert.equal(rows.length,2);
  assert.equal(rows[0].id,'10');
  assert.equal(rows[0].teamTitle,'Visitors');
  assert.equal(rows[0].g,4);
  assert.equal(rows[0].position,'Defense');
  assert.equal(rows[1].position,'Skater');
});
