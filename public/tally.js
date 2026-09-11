// Unranked choices receive no points; incomplete ballots are allowed.
export function tally(choices, ballots, method = 'irv') {
  const ids = choices.map(c => c.id);
  const clean = ballots.map(b => [...new Set(b.ranking)].filter(id => ids.includes(id))).filter(b => b.length);
  const counts = Object.fromEntries(ids.map(id => [id, 0]));
  if (!clean.length) return { scores: counts, winners: [], rounds: [], total: 0 };
  if (method !== 'irv') {
    for (const ballot of clean) {
      if (method === 'fptp') counts[ballot[0]]++;
      else ballot.forEach((id, i) => { counts[id] += ids.length - i; });
    }
    const max = Math.max(...Object.values(counts));
    return { scores: counts, winners: ids.filter(id => counts[id] === max), rounds: [], total: clean.length };
  }
  let active = [...ids];
  const rounds = [];
  while (active.length) {
    const scores = Object.fromEntries(active.map(id => [id, 0]));
    let continuing = 0;
    for (const ballot of clean) {
      const first = ballot.find(id => active.includes(id));
      if (first) { scores[first]++; continuing++; }
    }
    const max = Math.max(...Object.values(scores));
    const min = Math.min(...Object.values(scores));
    const leaders = active.filter(id => scores[id] === max);
    const round = { scores, continuing, exhausted: clean.length - continuing, eliminated: [] };
    rounds.push(round);
    if (max > continuing / 2 || active.length === 1 || max === min) {
      return { scores: { ...counts, ...scores }, winners: leaders, rounds, total: clean.length };
    }
    // Stop on a tied elimination boundary instead of choosing an arbitrary loser.
    const lowest = active.filter(id => scores[id] === min);
    if (lowest.length > 1 && min > 0) {
      return { scores: { ...counts, ...scores }, winners: [], rounds, total: clean.length, unresolved: true };
    }
    round.eliminated = lowest;
    active = active.filter(id => !lowest.includes(id));
  }
}
