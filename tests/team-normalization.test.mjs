import test from 'node:test';
import assert from 'node:assert/strict';

await import('../src/app/team-normalization.js');
const normalize = globalThis.MyHockeyHubTeamNormalization;

const TEAM = 'my-team';
const OPP_A = 'opp-a';
const OPP_B = 'opp-b';

function game({ id, days, status = 'final', home, visitor, homePim, visitorPim, homeShots, visitorShots }) {
  const date = new Date('2026-01-01T18:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return {
    gameId: id,
    timeStampZulu: date.toISOString(),
    status,
    location: 'Fixture Rink',
    home: { id: home.id, title: home.title, goals: home.goals, pim: homePim, shots: homeShots },
    visitor: { id: visitor.id, title: visitor.title, goals: visitor.goals, pim: visitorPim, shots: visitorShots }
  };
}

test('completed games contribute to record and GF/GA; scheduled games do not', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const games = [
    game({ id: 'g1', days: 0, status: 'final', home: { id: TEAM, title: 'Mine', goals: 4 }, visitor: { id: OPP_A, title: 'Opp A', goals: 2 } }),
    game({ id: 'g2', days: 20, status: 'scheduled', home: { id: TEAM, title: 'Mine', goals: null }, visitor: { id: OPP_B, title: 'Opp B', goals: null } })
  ];
  const summary = normalize.teamSeasonSummary(TEAM, games, { now });
  assert.equal(summary.gamesPlayed, 1);
  assert.equal(summary.wins, 1);
  assert.equal(summary.goalsFor, 4);
  assert.equal(summary.goalsAgainst, 2);
  assert.equal(summary.goalsForPerGame, 4);
  assert.equal(summary.goalsAgainstPerGame, 2);
});

test('team works correctly whether home or visitor, and GF/GA reflect the team perspective', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const games = [
    game({ id: 'g1', days: 0, home: { id: TEAM, title: 'Mine', goals: 5 }, visitor: { id: OPP_A, title: 'Opp A', goals: 1 } }),
    game({ id: 'g2', days: 1, home: { id: OPP_B, title: 'Opp B', goals: 3 }, visitor: { id: TEAM, title: 'Mine', goals: 2 } })
  ];
  const summary = normalize.teamSeasonSummary(TEAM, games, { now });
  assert.equal(summary.gamesPlayed, 2);
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 1);
  assert.equal(summary.goalsFor, 7);
  assert.equal(summary.goalsAgainst, 4);
});

test('PIM/G handles missing PIM safely (no fabricated values)', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const withoutPim = [
    game({ id: 'g1', days: 0, home: { id: TEAM, title: 'Mine', goals: 3 }, visitor: { id: OPP_A, title: 'Opp A', goals: 1 } })
  ];
  const summaryNoPim = normalize.teamSeasonSummary(TEAM, withoutPim, { now });
  assert.equal(summaryNoPim.pim, null);
  assert.equal(summaryNoPim.pimPerGame, null);
  assert.equal(summaryNoPim.pimGamesCounted, 0);

  const withPim = [
    game({ id: 'g2', days: 0, home: { id: TEAM, title: 'Mine', goals: 3 }, visitor: { id: OPP_A, title: 'Opp A', goals: 1 }, homePim: 6 }),
    game({ id: 'g3', days: 1, home: { id: TEAM, title: 'Mine', goals: 2 }, visitor: { id: OPP_A, title: 'Opp A', goals: 2 }, homePim: 4 })
  ];
  const summaryWithPim = normalize.teamSeasonSummary(TEAM, withPim, { now });
  assert.equal(summaryWithPim.pim, 10);
  assert.equal(summaryWithPim.pimPerGame, 5);
  assert.equal(summaryWithPim.pimGamesCounted, 2);
});

test('no completed games results in sane zero/empty values', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const summary = normalize.teamSeasonSummary(TEAM, [
    game({ id: 'g1', days: 5, status: 'scheduled', home: { id: TEAM, title: 'Mine', goals: null }, visitor: { id: OPP_A, title: 'Opp A', goals: null } })
  ], { now });
  assert.equal(summary.gamesPlayed, 0);
  assert.equal(summary.wins, 0);
  assert.equal(summary.losses, 0);
  assert.equal(summary.ties, 0);
  assert.equal(summary.goalsFor, 0);
  assert.equal(summary.goalsAgainst, 0);
  assert.equal(summary.goalsForPerGame, null);
  assert.equal(summary.goalsAgainstPerGame, null);
  assert.equal(summary.pim, null);
  assert.deepEqual(summary.streak, { result: null, count: 0 });
});

test('a team with no games at all (unknown teamId) returns empty values, not a crash', () => {
  const summary = normalize.teamSeasonSummary('nobody', [], {});
  assert.equal(summary.gamesPlayed, 0);
  assert.equal(summary.nextGame, null);
});

test('next game selects the earliest upcoming relevant game, including a live one', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const games = [
    game({ id: 'g-far', days: 30, status: 'scheduled', home: { id: TEAM, title: 'Mine', goals: null }, visitor: { id: OPP_A, title: 'Opp A', goals: null } }),
    game({ id: 'g-near', days: 15, status: 'scheduled', home: { id: TEAM, title: 'Mine', goals: null }, visitor: { id: OPP_B, title: 'Opp B', goals: null } }),
    game({ id: 'g-past-final', days: -2, status: 'final', home: { id: TEAM, title: 'Mine', goals: 1 }, visitor: { id: OPP_A, title: 'Opp A', goals: 0 } })
  ];
  const summary = normalize.teamSeasonSummary(TEAM, games, { now });
  assert.equal(summary.nextGame.gameId, 'g-near');
});

test('stale live games are not treated as the next game', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const games = [
    game({ id: 'g-stale', days: 0, status: 'live', home: { id: TEAM, title: 'Mine', goals: 1 }, visitor: { id: OPP_A, title: 'Opp A', goals: 1 } }),
    game({ id: 'g-next', days: 15, status: 'scheduled', home: { id: TEAM, title: 'Mine', goals: null }, visitor: { id: OPP_B, title: 'Opp B', goals: null } })
  ];
  const summary = normalize.teamSeasonSummary(TEAM, games, { now });
  assert.equal(summary.nextGame.gameId, 'g-next');
});

test('multiple games are not double-counted even if the input array repeats one', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const g1 = game({ id: 'g1', days: 0, home: { id: TEAM, title: 'Mine', goals: 4 }, visitor: { id: OPP_A, title: 'Opp A', goals: 2 } });
  const summary = normalize.teamSeasonSummary(TEAM, [g1, { ...g1 }, g1], { now });
  assert.equal(summary.gamesPlayed, 1);
  assert.equal(summary.goalsFor, 4);
  assert.equal(summary.goalsAgainst, 2);
});

test('OT/SO-decided finals still count as completed even though status is not the literal word "final"', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const summary = normalize.teamSeasonSummary(TEAM, [
    game({ id: 'g1', days: 0, status: 'Final_OT', home: { id: TEAM, title: 'Mine', goals: 3 }, visitor: { id: OPP_A, title: 'Opp A', goals: 2 } })
  ], { now });
  assert.equal(summary.gamesPlayed, 1);
  assert.equal(summary.wins, 1);
});

test('current streak reflects the most recent consecutive same-result completed games', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const games = [
    game({ id: 'g1', days: 0, home: { id: TEAM, title: 'Mine', goals: 1 }, visitor: { id: OPP_A, title: 'Opp A', goals: 3 } }),
    game({ id: 'g2', days: 1, home: { id: TEAM, title: 'Mine', goals: 4 }, visitor: { id: OPP_A, title: 'Opp A', goals: 1 } }),
    game({ id: 'g3', days: 2, home: { id: TEAM, title: 'Mine', goals: 5 }, visitor: { id: OPP_A, title: 'Opp A', goals: 0 } }),
    game({ id: 'g4', days: 3, home: { id: TEAM, title: 'Mine', goals: 2 }, visitor: { id: OPP_A, title: 'Opp A', goals: 0 } })
  ];
  const summary = normalize.teamSeasonSummary(TEAM, games, { now });
  assert.deepEqual(summary.streak, { result: 'W', count: 3 });
});

test('home/away splits are tracked separately for the deeper stats view', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const games = [
    game({ id: 'g1', days: 0, home: { id: TEAM, title: 'Mine', goals: 3 }, visitor: { id: OPP_A, title: 'Opp A', goals: 1 } }),
    game({ id: 'g2', days: 1, home: { id: OPP_B, title: 'Opp B', goals: 2 }, visitor: { id: TEAM, title: 'Mine', goals: 1 } })
  ];
  const summary = normalize.teamSeasonSummary(TEAM, games, { now });
  assert.equal(summary.home.gamesPlayed, 1);
  assert.equal(summary.home.wins, 1);
  assert.equal(summary.away.gamesPlayed, 1);
  assert.equal(summary.away.losses, 1);
});

test('SOG is tracked the same way as PIM: only counted when reliably present', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const games = [
    game({ id: 'g1', days: 0, home: { id: TEAM, title: 'Mine', goals: 3 }, visitor: { id: OPP_A, title: 'Opp A', goals: 1 }, homeShots: 28 })
  ];
  const summary = normalize.teamSeasonSummary(TEAM, games, { now });
  assert.equal(summary.sog, 28);
  assert.equal(summary.sogPerGame, 28);
  assert.equal(summary.sogGamesCounted, 1);
});
