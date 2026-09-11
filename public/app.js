import { tally } from './tally.js';
import { changeDecision } from './model.js';

const $ = s => document.querySelector(s);
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = (window.APP_CONFIG?.apiUrl || '').replace(/\/$/, '');
const uid = () => crypto.randomUUID();
let actor = localStorage.getItem('indecisive-actor');
if (!actor) { actor = uid(); localStorage.setItem('indecisive-actor', actor); }
let decision, ranking = [], tab = 'vote', method = 'irv', busy = false, dragged;
let currentId = location.hash.slice(1);
const draftKey = () => `draft-${decision.id}-${actor}`;
const sample = () => ({ id: 'weekend-demo', title: 'What’s the plan this weekend?', description: 'A little adventure, good company, and absolutely no “I’m fine with anything.” Let’s pick something together.', phase: 'vote', host: actor, choices: [
  { id: '1', title: 'Pizza & game night', emoji: '🍕' }, { id: '2', title: 'A day at the beach', emoji: '🏖️' }, { id: '3', title: 'Hit the hiking trails', emoji: '🥾' }, { id: '4', title: 'Try that new ramen place', emoji: '🍜' }, { id: '5', title: 'Movie marathon', emoji: '🎬' }
], ballots: [{ actor: 'demo-a', ranking: ['1', '4', '5', '2', '3'] }, { actor: 'demo-b', ranking: ['2', '3', '1', '4', '5'] }, { actor: 'demo-c', ranking: ['4', '1', '2', '3', '5'] }], version: 0 });
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 4000); }
async function request(path, options = {}) {
  const response = await fetch(api + path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actor}`, ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
function isHost() { return api ? Boolean(localStorage.getItem(`host-${decision.id}`)) : decision.host === actor; }
function saveDraft() { localStorage.setItem(draftKey(), JSON.stringify(ranking)); }
function loadDraft() { ranking = JSON.parse(localStorage.getItem(draftKey()) || 'null') || decision.myBallot || decision.ballots?.find(b => b.actor === actor)?.ranking || []; ranking = ranking.filter(id => decision.choices.some(c => c.id === id)); }
async function load() {
  if (api && currentId) decision = await request(`/decisions/${encodeURIComponent(currentId)}`);
  else if (api) { renderWelcome(); return; }
  else {
    const saved = localStorage.getItem(`decision-${currentId || 'weekend-demo'}`);
    if (currentId && !saved && currentId !== 'weekend-demo') throw new Error('This local decision isn’t on this device. Shared links need a connected API.');
    decision = saved ? JSON.parse(saved) : sample();
    currentId = decision.id;
    localStorage.setItem(`decision-${currentId}`, JSON.stringify(decision));
  }
  loadDraft(); tab = decision.phase === 'results' ? 'results' : 'vote'; render();
}
async function mutate(action) {
  if (busy) return;
  busy = true;
  try {
    if (api) decision = await request(`/decisions/${decision.id}`, { method: 'POST', headers: { 'X-Host-Token': localStorage.getItem(`host-${decision.id}`) || '' }, body: JSON.stringify({ ...action, version: decision.version }) });
    else { decision = changeDecision(decision, action, actor, isHost()); decision.version++; localStorage.setItem(`decision-${decision.id}`, JSON.stringify(decision)); }
    if (action.type === 'vote') toast('Your vote is in! You can edit it until voting closes.');
    if (decision.phase === 'results') tab = 'results';
    render();
  } catch (error) { toast(error.message); }
  finally { busy = false; }
}
function choiceCard(c, index) {
  const ranked = index >= 0;
  return `<li class="choice ${ranked ? 'ranked' : ''}" draggable="true" data-id="${escape(c.id)}">${ranked ? `<span class="rank-number">${index + 1}</span>` : ''}<span class="choice-emoji">${c.emoji || '✦'}</span><span class="choice-title">${escape(c.title)}</span><div class="choice-actions">${ranked ? `<button class="icon-button reorder" data-move="up" data-id="${escape(c.id)}" aria-label="Move ${escape(c.title)} up" ${index === 0 ? 'disabled' : ''}>↑</button><button class="icon-button reorder" data-move="down" data-id="${escape(c.id)}" aria-label="Move ${escape(c.title)} down" ${index === ranking.length - 1 ? 'disabled' : ''}>↓</button>` : ''}<button class="icon-button ${ranked ? 'remove' : 'add'}" data-move="${ranked ? 'remove' : 'add'}" data-id="${escape(c.id)}" aria-label="${ranked ? 'Unrank' : 'Rank'} ${escape(c.title)}">${ranked ? '×' : '+'}</button></div></li>`;
}
function voting() {
  if (decision.phase === 'collect') return `<section class="panel suggestions"><div class="section-label"><span class="step-icon">✦</span><h2>Good ideas start here</h2><span class="count">${decision.choices.length}</span></div><p class="muted">Add an option for the group. Everyone with the link can contribute.</p><form id="choice-form" class="choice-form"><input name="choice" maxlength="100" required placeholder="What do you have in mind?" aria-label="New choice"><button class="button primary">Add choice +</button></form><ul class="choice-list">${decision.choices.map(c => `<li class="choice"><span class="choice-emoji">${c.emoji}</span><span>${escape(c.title)}</span></li>`).join('') || '<li class="empty">A blank slate. Add the first idea!</li>'}</ul></section>`;
  if (decision.phase === 'results') return results();
  const unranked = decision.choices.filter(c => !ranking.includes(c.id));
  const voted = api ? decision.myBallot?.length : decision.ballots.some(b => b.actor === actor);
  return `<div class="voting-heading"><div><h2>Your preferences. Your call.</h2><p>Move the choices you like to <strong>Decided</strong>, then put your favorites first.</p></div><span class="subtle-pill">↕ Drag or tap to rank</span></div><div class="ballot-grid"><section class="panel ballot-panel" data-zone="undecided"><div class="section-label"><span class="step-icon neutral">↔</span><h3>Undecided</h3><span class="count">${unranked.length}</span></div><p class="muted">The possibilities. Tap + to make your pick.</p><ul class="choice-list">${unranked.map(c => choiceCard(c, -1)).join('') || '<li class="empty">All choices ranked. Nicely decided.</li>'}</ul></section><section class="panel ballot-panel decided" data-zone="decided"><div class="section-label"><span class="step-icon">✓</span><h3>Decided</h3><span class="count">${ranking.length}</span><span class="first-label">YOUR #1 AT THE TOP</span></div><p class="muted">Your shortlist, in order of preference.</p><ol class="choice-list">${ranking.map((id, i) => choiceCard(decision.choices.find(c => c.id === id), i)).join('') || '<li class="empty drop-empty"><span>↘</span><strong>Your favorites belong here</strong><p>Tap + on a choice to start your ranking.</p></li>'}</ol>${ranking.length ? '<div class="rank-tip"><span>✧</span> First is your favorite. Leave out choices you don’t want.</div>' : ''}</section></div><div class="submit-bar"><div><span class="privacy-icon">◎</span><div><strong>${voted ? 'Your vote is saved' : 'A little preference goes a long way'}</strong><p>${voted ? 'Make changes and submit again before voting closes.' : 'Your ranking stays private until voting closes.'}</p></div></div><button class="button primary" id="submit-vote" ${!ranking.length ? 'disabled' : ''}>${voted ? 'Update my vote' : 'Submit my vote'} <span>↗</span></button></div>`;
}
function results() {
  if (decision.phase !== 'results') return `<section class="panel waiting"><span class="large-symbol">◎</span><h2>A good decision is worth the wait.</h2><p>Results appear after the host closes voting, so everyone can make up their own mind.</p><span class="subtle-pill">${api ? decision.voteCount : decision.ballots.length} votes submitted</span></section>`;
  const result = tally(decision.choices, decision.ballots, method);
  const names = ids => ids.map(id => escape(decision.choices.find(c => c.id === id)?.title || '')).join(', ');
  const max = Math.max(1, ...Object.values(result.scores));
  return `<section class="panel results-panel"><div class="results-top"><div><span class="eyebrow">THE GROUP HAS SPOKEN</span><h2>${result.unresolved ? 'Too close to call' : result.winners.length > 1 ? 'We have a tie' : 'Meet your group’s favorite'}</h2></div><label class="method-label">Counting method<select id="method"><option value="irv" ${method === 'irv' ? 'selected' : ''}>Ranked choice</option><option value="fptp" ${method === 'fptp' ? 'selected' : ''}>First past the post</option><option value="borda" ${method === 'borda' ? 'selected' : ''}>Borda count</option></select></label></div><div class="winner"><span>✳</span><h3>${result.unresolved ? 'An elimination tie needs a group discussion.' : names(result.winners)}</h3><p>${result.total} ${result.total === 1 ? 'ballot' : 'ballots'} counted</p></div><p class="method-explanation">${method === 'irv' ? 'The lowest choice is eliminated and votes transfer to the next ranked choice until one has a majority of continuing ballots. A tied nonzero elimination pauses the count.' : method === 'fptp' ? 'Only each voter’s first choice counts. The choice with the most votes wins.' : `Each first choice gets ${decision.choices.length} points, second gets ${decision.choices.length - 1}, and so on. Unranked choices get zero.`}</p>${decision.choices.slice().sort((a,b) => result.scores[b.id] - result.scores[a.id]).map(c => `<div class="result-row"><span>${c.emoji} ${escape(c.title)}</span><strong>${result.scores[c.id]} ${method === 'borda' ? 'pts' : 'votes'}</strong><div class="result-track"><div style="width:${result.scores[c.id] / max * 100}%"></div></div></div>`).join('')}${method === 'irv' ? `<details><summary>See the count · ${result.rounds.length} rounds</summary>${result.rounds.map((r,i) => `<div class="round"><strong>Round ${i+1}</strong><p>${Object.entries(r.scores).map(([id,n]) => `${names([id])}: ${n}`).join(' · ')}</p><p>${r.eliminated.length ? `Eliminated: ${names(r.eliminated)}. ` : ''}${r.exhausted} exhausted ballots.</p></div>`).join('')}<p class="muted">The bars show the final round. Eliminated choices appear with zero votes.</p></details>` : ''}</section>`;
}
function renderWelcome() { $('#app').innerHTML = '<section class="welcome"><span class="eyebrow">LESS BACK AND FORTH. MORE DOING.</span><h1>Good things happen<br>when we decide together.</h1><p>Bring the options. Find your favorites. Make a plan.</p><button class="button primary" id="welcome-create">Start a decision ↗</button></section>'; $('#welcome-create').onclick = openCreate; }
function render() {
  const count = api ? decision.voteCount : decision.ballots.length;
  const phaseIndex = ['collect', 'vote', 'results'].indexOf(decision.phase);
  $('#app').innerHTML = `<a href="./" class="back-link">← Your decision space</a><section class="decision-hero"><div class="hero-copy"><div class="hero-meta"><span class="status-pill"><i></i>${['Taking suggestions', 'Voting is open', 'Decision time'][phaseIndex]}</span><span class="room-code">${api ? 'SHARED DECISION' : 'YOUR LOCAL PLAYGROUND'}</span></div><h1>${escape(decision.title)}</h1><p>${escape(decision.description)}</p><div class="people"><span class="avatars"><span>J</span><span>A</span><span>M</span></span><span><strong>${count} ${count === 1 ? 'vote' : 'votes'}</strong> ${decision.phase === 'results' ? 'counted' : 'submitted'}${!api && decision.id === 'weekend-demo' ? ' · includes 3 sample ballots' : ''}</span></div></div><div class="hero-aside"><div class="abstract-art" aria-hidden="true"><span class="art-arrow">↗</span><span class="art-star">✳</span><span class="art-dot"></span></div><button class="button white" id="share">↗ Invite your people</button></div></section><nav class="steps" aria-label="Decision progress">${['Add choices', 'Rank & vote', 'See the results'].map((label,i) => `<div class="step ${i === phaseIndex ? 'active' : ''} ${i < phaseIndex ? 'complete' : ''}"><span>${i < phaseIndex ? '✓' : `0${i+1}`}</span>${label}${i === phaseIndex ? '<small>WE ARE HERE</small>' : ''}</div>`).join('')}</nav><div class="workspace-nav"><div class="tabs"><button class="tab ${tab === 'vote' ? 'selected' : ''}" data-tab="vote">${decision.phase === 'collect' ? 'The choices' : 'Your ballot'}</button><button class="tab ${tab === 'results' ? 'selected' : ''}" data-tab="results">Group results <span>${count}</span></button></div><span class="workspace-note">${api ? '↻ Updates automatically' : '◎ Saved on this device'}</span></div>${tab === 'results' ? results() : voting()}<aside class="bottom-note"><span>✧</span><div><strong>Different opinions. One plan.</strong><p>Rank what you love. We’ll help find the option your group can get behind.</p></div>${isHost() && decision.phase !== 'results' ? `<button class="button outline small" id="advance">${decision.phase === 'collect' ? 'Close choices & start voting' : 'Close voting & reveal results'} →</button>` : '<span class="host-label">Decide together, go together.</span>'}</aside>`;
  $('[id="share"]').onclick = async () => { if (!api) { toast('This is a local demo. Connect the API to invite people on other devices.'); return; } const url = `${location.origin}${location.pathname}#${decision.id}`; try { if (navigator.share) await navigator.share({ title: decision.title, url }); else { await navigator.clipboard.writeText(url); toast('Invite link copied!'); } } catch (e) { if (e.name !== 'AbortError') toast('Copy the address from your browser to invite people.'); } };
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
  $('#advance')?.addEventListener('click', () => { const next = decision.phase === 'collect' ? 'vote' : 'results'; if (confirm(next === 'vote' ? 'Close suggestions and open voting? Choices will be locked.' : 'Close voting and reveal results? No more ballots can be changed.')) mutate({ type: 'phase', phase: next }); });
  $('#choice-form')?.addEventListener('submit', e => { e.preventDefault(); mutate({ type: 'add', id: uid(), title: new FormData(e.target).get('choice') }); });
  $('#submit-vote')?.addEventListener('click', () => mutate({ type: 'vote', ranking }));
  $('#method')?.addEventListener('change', e => { method = e.target.value; render(); });
  document.querySelectorAll('[data-move]').forEach(b => b.onclick = () => move(b.dataset.id, b.dataset.move));
  document.querySelectorAll('[draggable]').forEach(el => { el.ondragstart = e => { dragged = el.dataset.id; e.dataTransfer.setData('text/plain', dragged); e.dataTransfer.effectAllowed = 'move'; }; el.ondragend = () => { dragged = null; document.querySelectorAll('.drag-over').forEach(e => e.classList.remove('drag-over')); }; });
  document.querySelectorAll('[data-zone]').forEach(el => { el.ondragover = e => { e.preventDefault(); el.classList.add('drag-over'); }; el.ondragleave = () => el.classList.remove('drag-over'); el.ondrop = e => { e.preventDefault(); if (!dragged) return; const target = e.target.closest('[data-id]')?.dataset.id; if (el.dataset.zone === 'undecided') ranking = ranking.filter(id => id !== dragged); else if (target !== dragged) { ranking = ranking.filter(id => id !== dragged); const at = ranking.indexOf(target); ranking.splice(at < 0 ? ranking.length : at, 0, dragged); } saveDraft(); render(); }; });
}
function move(id, direction) {
  const index = ranking.indexOf(id);
  if (direction === 'add' && index < 0) ranking.push(id);
  if (direction === 'remove') ranking = ranking.filter(x => x !== id);
  if (direction === 'up' && index > 0) [ranking[index-1], ranking[index]] = [ranking[index], ranking[index-1]];
  if (direction === 'down' && index < ranking.length-1) [ranking[index+1], ranking[index]] = [ranking[index], ranking[index+1]];
  saveDraft(); render();
  const focus = [...document.querySelectorAll('[data-move]')].find(b => b.dataset.id === id && !b.disabled); focus?.focus({ preventScroll: true });
}
function openCreate() { $('#create-note').textContent = api ? 'You’ll get an invite link to share with your group.' : 'Local mode: decisions are saved in this browser. Connect an API to decide across devices.'; $('#create-dialog').showModal(); }
$('#new-decision').onclick = openCreate;
$('#close-dialog').onclick = () => $('#create-dialog').close();
$('#create-form').onsubmit = async e => {
  e.preventDefault(); const data = new FormData(e.target); const button = e.target.querySelector('[type="submit"]'); button.disabled = true;
  try {
    const title = data.get('title').trim(), description = data.get('description').trim();
    if (!title) throw new Error('Give your decision a title.');
    if (api) { const response = await request('/decisions', { method: 'POST', body: JSON.stringify({ title, description }) }); decision = response.decision; localStorage.setItem(`host-${decision.id}`, response.hostToken); }
    else { decision = { id: uid(), title, description, phase: 'collect', choices: [], ballots: [], host: actor, version: 0 }; localStorage.setItem(`decision-${decision.id}`, JSON.stringify(decision)); }
    currentId = decision.id; location.hash = currentId; ranking = []; tab = 'vote'; $('#create-dialog').close(); e.target.reset(); render();
  } catch (error) { toast(error.message); } finally { button.disabled = false; }
};
$('#mode').textContent = api ? 'Shared space' : 'Local demo';
window.addEventListener('hashchange', () => { if (location.hash.slice(1) !== currentId) { currentId = location.hash.slice(1); load().catch(error => toast(error.message)); } });
window.addEventListener('storage', e => { if (!api && e.key === `decision-${currentId}`) { decision = JSON.parse(e.newValue); render(); } });
load().catch(error => { renderWelcome(); toast(error.message); });
setInterval(async () => {
  if (!api || !decision || busy || document.hidden || document.activeElement?.matches('input, textarea, select') || dragged) return;
  try { const fresh = await request(`/decisions/${decision.id}`); if (fresh.version !== decision.version) { decision = fresh; if (decision.phase === 'results') tab = 'results'; render(); } } catch { $('#mode').textContent = 'Connection interrupted'; }
}, 5000);
