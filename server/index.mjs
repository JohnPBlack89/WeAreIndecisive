import http from 'node:http';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { changeDecision } from '../public/model.js';

const { MONGODB_URI, MONGODB_DB = 'indecisive', ALLOWED_ORIGIN = 'http://localhost:5173', PORT = '3001' } = process.env;
if (!MONGODB_URI) throw new Error('Set MONGODB_URI to your MongoDB connection string. See README.md.');
const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const collection = client.db(MONGODB_DB).collection('decisions');
await collection.createIndex({ id: 1 }, { unique: true });
const hash = value => createHash('sha256').update(value).digest('hex');
function publicDecision(d, actor) {
  return { id: d.id, title: d.title, description: d.description, phase: d.phase, choices: d.choices.map(({ author, ...choice }) => choice), version: d.version, voteCount: d.ballots.length, myBallot: d.ballots.find(b => b.actor === actor)?.ranking || [], ballots: d.phase === 'results' ? d.ballots.map(b => ({ ranking: b.ranking })) : [] };
}
const limits = new Map();
const limitTimer = setInterval(() => limits.clear(), 60000);
limitTimer.unref();
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Origin');
  const send = (status, body) => res.writeHead(status).end(JSON.stringify(body));
  if (req.headers.origin && req.headers.origin !== ALLOWED_ORIGIN) return send(403, { error: 'Origin is not allowed.' });
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Host-Token');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  const ip = req.socket.remoteAddress;
  const used = (limits.get(ip) || 0) + 1; limits.set(ip, used);
  if (used > 300) return send(429, { error: 'Too many requests. Try again in a minute.' });
  const actor = req.headers.authorization?.replace(/^Bearer /, '');
  if (!actor || !/^[a-zA-Z0-9-]{20,80}$/.test(actor)) return send(401, { error: 'A valid participant token is required.' });
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    let body = {};
    if (req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16384) return send(413, { error: 'Request is too large.' }); }
      try { body = JSON.parse(raw); } catch { return send(400, { error: 'Invalid JSON.' }); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return send(400, { error: 'Invalid request.' });
    }
    if (pathname === '/decisions' && req.method === 'POST') {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120 || (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 500))) return send(400, { error: 'Use a title of 1–120 characters and a description up to 500 characters.' });
      const hostToken = randomUUID() + randomUUID();
      const decision = { id: randomUUID(), title: body.title.trim(), description: (body.description || '').trim(), phase: 'collect', choices: [], ballots: [], version: 0, hostHash: hash(hostToken), createdAt: new Date() };
      await collection.insertOne(decision);
      return send(201, { decision: publicDecision(decision, actor), hostToken });
    }
    const match = pathname.match(/^\/decisions\/([a-zA-Z0-9-]{1,80})$/);
    if (!match) return send(404, { error: 'Not found.' });
    const decision = await collection.findOne({ id: match[1] });
    if (!decision) return send(404, { error: 'This decision could not be found.' });
    if (req.method === 'GET') return send(200, publicDecision(decision, actor));
    if (req.method !== 'POST') return send(405, { error: 'Method not allowed.' });
    if (body.version !== decision.version) return send(409, { error: 'The decision changed. Wait a moment for it to refresh, then try again.' });
    const host = timingSafeEqual(Buffer.from(hash(String(req.headers['x-host-token'] || ''))), Buffer.from(decision.hostHash));
    if (body.type === 'add') body.id = randomUUID();
    let updated;
    try { updated = changeDecision(decision, body, actor, host); } catch (error) { return send(400, { error: error.message }); }
    if (updated.ballots.length > 1000) return send(400, { error: 'This decision has reached 1,000 voters.' });
    const result = await collection.updateOne({ id: decision.id, version: decision.version }, { $set: { choices: updated.choices, ballots: updated.ballots, phase: updated.phase }, $inc: { version: 1 } });
    if (!result.modifiedCount) return send(409, { error: 'Another update arrived first. Wait a moment and try again.' });
    updated.version++;
    send(200, publicDecision(updated, actor));
  } catch (error) { console.error('Request failed:', error.name); send(500, { error: 'The server could not complete your request. Please try again.' }); }
});
server.listen(Number(PORT), () => console.log(`Decision API listening on port ${PORT}`));
async function shutdown() { server.close(); await client.close(); process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
