import test from 'node:test';
import assert from 'node:assert/strict';
import { tally } from '../public/tally.js';
import { changeDecision } from '../public/model.js';
const choices = ['a', 'b', 'c'].map(id => ({ id, title: id }));
const ballots = rankings => rankings.map(ranking => ({ ranking }));
test('first past the post counts only first preferences and reports ties', () => {
  const r = tally(choices, ballots([['a', 'b'], ['b', 'c'], ['c', 'a']]), 'fptp');
  assert.deepEqual(r.scores, { a: 1, b: 1, c: 1 });
  assert.deepEqual(r.winners, ['a', 'b', 'c']);
});
test('Borda awards N through 1 points and zero to omitted choices', () => {
  const r = tally(choices, ballots([['a', 'b'], ['c']]), 'borda');
  assert.deepEqual(r.scores, { a: 3, b: 2, c: 3 });
});
test('ranked choice transfers eliminated votes to elect a majority', () => {
  const r = tally(choices, ballots([['a'], ['a'], ['b'], ['b'], ['c', 'b']]));
  assert.deepEqual(r.winners, ['b']);
  assert.equal(r.rounds.length, 2);
  assert.deepEqual(r.rounds[0].eliminated, ['c']);
  assert.equal(r.scores.b, 3);
});
test('incomplete ranked ballots exhaust and leave the majority denominator', () => {
  const r = tally(choices, ballots([['a'], ['a'], ['a'], ['b'], ['b'], ['c']]));
  assert.deepEqual(r.winners, ['a']);
  assert.equal(r.rounds[1].exhausted, 1);
  assert.equal(r.rounds[1].continuing, 5);
});
test('tied elimination is reported, never arbitrarily broken', () => {
  const r = tally(choices, ballots([['a'], ['a'], ['b'], ['c']]));
  assert.equal(r.unresolved, true);
  assert.deepEqual(r.winners, []);
});
test('empty votes have no winner and invalid choices are ignored', () => {
  assert.deepEqual(tally(choices, []).winners, []);
  assert.equal(tally(choices, ballots([['unknown'], ['a', 'a', 'b']]), 'borda').total, 1);
});
const base = () => ({ choices, ballots: [], phase: 'collect' });
test('only host may advance, and phases cannot be skipped or reopened', () => {
  assert.throws(() => changeDecision(base(), { type: 'phase', phase: 'vote' }, 'guest', false), /host/);
  assert.throws(() => changeDecision(base(), { type: 'phase', phase: 'results' }, 'host', true), /phase/);
  const d = changeDecision(base(), { type: 'phase', phase: 'vote' }, 'host', true);
  assert.equal(d.phase, 'vote');
  assert.throws(() => changeDecision(d, { type: 'phase', phase: 'collect' }, 'host', true), /phase/);
  assert.throws(() => changeDecision(d, { type: 'phase', phase: 'results' }, 'host', true), /vote first/);
});
test('choices are locked during voting and duplicate suggestions rejected', () => {
  assert.throws(() => changeDecision({ ...base(), phase: 'vote' }, { type: 'add', title: 'new' }, 'guest', false), /closed/);
  assert.throws(() => changeDecision(base(), { type: 'add', title: ' A ' }, 'guest', false), /already/);
});
test('ballots replace prior votes, validate choices and cannot change after closing', () => {
  let d = { ...base(), phase: 'vote' };
  for (const ranking of [[], ['a', 'a'], ['invalid']]) assert.throws(() => changeDecision(d, { type: 'vote', ranking }, 'guest', false), /valid/);
  d = changeDecision(d, { type: 'vote', ranking: ['a'] }, 'guest', false);
  d = changeDecision(d, { type: 'vote', ranking: ['b', 'a'] }, 'guest', false);
  assert.equal(d.ballots.length, 1);
  assert.deepEqual(d.ballots[0].ranking, ['b', 'a']);
  d = changeDecision(d, { type: 'phase', phase: 'results' }, 'host', true);
  assert.throws(() => changeDecision(d, { type: 'vote', ranking: ['c'] }, 'guest', false), /not open/);
});
test('at least two choices are required; changes do not mutate original data', () => {
  const d = { ...base(), choices: [] };
  assert.throws(() => changeDecision(d, { type: 'phase', phase: 'vote' }, 'host', true), /two/);
  const updated = changeDecision(d, { type: 'add', id: 'd', title: ' Dinner ' }, 'guest', false);
  assert.equal(d.choices.length, 0);
  assert.equal(updated.choices[0].title, 'Dinner');
});
