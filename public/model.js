export function changeDecision(decision, action, actor, isHost) {
  const d = structuredClone(decision);
  const fail = message => { throw new Error(message); };
  if (action.type === 'add') {
    if (d.phase !== 'collect') fail('Suggestions are closed.');
    const title = String(action.title || '').trim();
    if (!title || title.length > 100) fail('Enter a choice of 1–100 characters.');
    if (d.choices.length >= 50) fail('This decision has reached 50 choices.');
    if (d.choices.some(c => c.title.toLowerCase() === title.toLowerCase())) fail('That choice is already on the list.');
    d.choices.push({ id: action.id, title, emoji: '✦', author: actor });
  } else if (action.type === 'phase') {
    if (!isHost) fail('Only the host can change the phase.');
    if (d.phase === 'collect' && action.phase === 'vote') {
      if (d.choices.length < 2) fail('Add at least two choices before voting.');
    } else if (d.phase === 'vote' && action.phase === 'results') {
      if (!d.ballots.length) fail('At least one person needs to vote first.');
    } else fail('That phase change is not available.');
    d.phase = action.phase;
  } else if (action.type === 'vote') {
    if (d.phase !== 'vote') fail('Voting is not open.');
    if (!Array.isArray(action.ranking) || !action.ranking.length || action.ranking.length > d.choices.length || new Set(action.ranking).size !== action.ranking.length || action.ranking.some(id => !d.choices.some(c => c.id === id))) fail('Choose at least one valid choice without duplicates.');
    d.ballots = d.ballots.filter(b => b.actor !== actor);
    d.ballots.push({ actor, ranking: action.ranking });
  } else fail('Unknown action.');
  return d;
}
