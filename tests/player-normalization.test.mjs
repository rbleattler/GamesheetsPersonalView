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

test('preserves standing-row numeric defaults while using the stable player shape',()=>{
  const player=normalize.normalizeStandingPlayer({
    player:{id:'30',firstName:'Taylor',lastName:'Skater',teamId:'V'},
    teamId:'V',
    stats:{g:2,a:3}
  },{kind:'skater',team:game.visitor,division:game.visitor.division,divisionId:'12'});
  assert.equal(player.teamTitle,'Visitors');
  assert.equal(player.g,2);
  assert.equal(player.a,3);
  assert.equal(player.pts,0);
  assert.equal(player.sog,0);
});

test('standing rows retain fallback team and division metadata',()=>{
  const player=normalize.normalizeStandingPlayer({
    player:{id:'31',firstName:'Fallback',lastName:'Player',teamId:'V'},
    teamId:'V',
    division:{id:'12'},
    stats:{pts:4}
  },{kind:'skater',team:game.visitor,division:game.visitor.division,divisionId:'12'});
  assert.equal(player.teamId,'V');
  assert.equal(player.teamTitle,'Visitors');
  assert.equal(player.teamLogo,'v.png');
  assert.equal(player.divisionTitle,'12U A');
});

test('extracts a team roster from decoded game data',()=>{
  const roster=normalize.teamRosterFromGame(game,decoded,'H',{divisionId:'12',divisionTitle:'12U A'});
  assert.equal(roster.length,1);
  assert.equal(roster[0].id,'20');
  assert.equal(roster[0].teamId,'H');
  assert.equal(roster[0].teamTitle,'Home');
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

test('dedupes players by id and keeps the richer record',()=>{
  const rows=normalize.dedupePlayers([
    {id:'10',name:'Alex Visitor',teamTitle:''},
    {id:'10',name:'Alex Visitor',teamTitle:'Visitors',number:'10'},
    {id:'20',name:'Sam Home'}
  ]);
  assert.equal(rows.length,2);
  assert.equal(rows[0].id,'10');
  assert.equal(rows[0].teamTitle,'Visitors');
});
