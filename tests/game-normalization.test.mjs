import test from 'node:test';
import assert from 'node:assert/strict';

await import('../src/app/game-normalization.js');
const normalize=globalThis.MyHockeyHubGameNormalization;

test('decodes Firestore REST value wrappers',()=>{
  const decoded=normalize.firestoreDocument({
    fields:{
      title:{stringValue:'Fixture Game'},
      count:{integerValue:'7'},
      ratio:{doubleValue:0.625},
      active:{booleanValue:true},
      nested:{mapValue:{fields:{name:{stringValue:'Nested'},nil:{nullValue:null}}}},
      rows:{arrayValue:{values:[{integerValue:'1'},{stringValue:'two'}]}}
    }
  });
  assert.deepEqual(decoded,{
    title:'Fixture Game',
    count:7,
    ratio:0.625,
    active:true,
    nested:{name:'Nested',nil:null},
    rows:[1,'two']
  });
});

test('normalizes decoded game detail into stable box-score and event shapes',()=>{
  const game={
    gameId:'fixture-1',
    visitor:{id:'V',title:'Visitors',logo:'visitor.png',goals:2},
    home:{id:'H',title:'Home',logo:'home.png',goals:1}
  };
  const decoded={
    computed:{
      scoreboard:{total:{visitor:2,home:1}},
      shots:{total:{visitor:17,home:20}}
    },
    data:{
      visitor:{
        details:{title:'Visitors'},
        lineup:{players:[
          {id:'10',firstName:'Alex',lastName:'Visitor',number:'10',position:'F',stats:{g:1,a:1,pim:0}},
          {id:'11',firstName:'Casey',lastName:'Assist',number:'11',position:'F',stats:{g:0,a:1,pim:0}}
        ]}
      },
      home:{
        details:{title:'Home'},
        lineup:{players:[
          {id:'20',firstName:'Sam',lastName:'Home',number:'20',position:'D',stats:{g:1,a:0,pim:2}}
        ]}
      }
    },
    events:{
      goal1:{
        type:'HockeyGoal',
        time:{clock:'1:12:34'},
        for:{team:{id:'V'},scorer:{id:'10',firstName:'Alex',lastName:'Visitor'},assist:[{id:'11',firstName:'Casey',lastName:'Assist'}]}
      },
      penalty1:{
        type:'HockeyPenalty',
        time:{clock:'2:05:00'},
        for:{team:{id:'H'},player:{id:'20',firstName:'Sam',lastName:'Home'}},
        penalty:{label:'Tripping',length:'2'}
      }
    }
  };

  const box=normalize.gameBox(game,decoded);
  assert.equal(box.visitor.finalScore,2);
  assert.equal(box.home.finalScore,1);
  assert.equal(box.visitor.sog,17);
  assert.equal(box.home.sog,20);
  assert.equal(box.home.pim,2);
  assert.equal(box.visitor.roster.players[0].pts,2);

  const goals=box.tables.goalsByPeriod.flatMap(group=>group.periodEvents);
  assert.equal(goals.length,1);
  assert.equal(goals[0].periodLabel,'P1');
  assert.equal(goals[0].time,'12:34');
  assert.equal(goals[0].teamSide,'visitor');
  assert.equal(goals[0].goalScorer.id,'10');
  assert.equal(goals[0].assist1By.id,'11');

  const penalties=box.tables.penaltiesByPeriod.flatMap(group=>group.periodEvents);
  assert.equal(penalties.length,1);
  assert.equal(penalties[0].periodLabel,'P2');
  assert.equal(penalties[0].teamSide,'home');
  assert.equal(penalties[0].penaltyType.title,'Tripping');
  assert.equal(penalties[0].penaltyType.minutes,2);
});

test('normalizes directly from a Firestore REST document',()=>{
  const game={visitor:{id:'V',title:'Visitors'},home:{id:'H',title:'Home'}};
  const document={fields:{
    computed:{mapValue:{fields:{
      scoreboard:{mapValue:{fields:{total:{mapValue:{fields:{visitor:{integerValue:'3'},home:{integerValue:'2'}}}}}}},
      shots:{mapValue:{fields:{total:{mapValue:{fields:{visitor:{integerValue:'21'},home:{integerValue:'19'}}}}}}}
    }}},
    data:{mapValue:{fields:{
      visitor:{mapValue:{fields:{lineup:{mapValue:{fields:{players:{arrayValue:{values:[]}}}}}}}},
      home:{mapValue:{fields:{lineup:{mapValue:{fields:{players:{arrayValue:{values:[]}}}}}}}}
    }}},
    events:{mapValue:{fields:{}}}
  }};

  const box=normalize.gameBoxFromFirestore(game,document);
  assert.equal(box.visitor.finalScore,3);
  assert.equal(box.home.finalScore,2);
  assert.equal(box.visitor.sog,21);
  assert.equal(box.home.sog,19);
});

test('penalty parsing tolerates numeric and clock-like durations',()=>{
  assert.equal(normalize.penaltyMinutes(2),2);
  assert.equal(normalize.penaltyMinutes('2'),2);
  assert.equal(normalize.penaltyMinutes('2:30'),2.5);
  assert.equal(normalize.penaltyMinutes('5 min major'),5);
  assert.equal(normalize.penaltyMinutes(''),0);
});
