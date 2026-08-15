import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { queueDataSync, resolveDataDir } from './github-data.js';

const VOTES_FILE = path.join(resolveDataDir(), 'votes.json');
const MAX_VOTES = 10000;
const VOTE_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const PROVIDERS = new Set(['topgg', 'discordbotlist']);

let store = null;

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));
    if (Array.isArray(parsed)) return { votes: parsed };
    if (parsed && Array.isArray(parsed.votes)) return { votes: parsed.votes };
  } catch {
    // Start with an empty store when the file does not exist or is invalid.
  }
  return { votes: [] };
}

function getStore() {
  if (!store) store = readStore();
  return store;
}

function saveStore() {
  fs.mkdirSync(path.dirname(VOTES_FILE), { recursive: true });
  const temporary = `${VOTES_FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(getStore(), null, 2)}\n`);
  fs.renameSync(temporary, VOTES_FILE);
  queueDataSync('Update votes');
}

function timestamp(value, fallback = Date.now()) {
  if (value == null) return fallback;
  const parsed = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function recordVote({
  provider,
  userId,
  username = null,
  eventId = null,
  weight = 1,
  createdAt = Date.now(),
  expiresAt = null,
}) {
  if (!PROVIDERS.has(provider)) throw new Error('unsupported vote provider');
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('vote user ID is required');

  const votes = getStore().votes;
  const createdTimestamp = timestamp(createdAt);
  const normalizedUserId = userId.trim();
  const existing = eventId
    ? votes.find((vote) => vote.provider === provider && vote.eventId === String(eventId))
    : provider === 'discordbotlist'
      ? votes.find(
          (vote) =>
            vote.provider === provider &&
            vote.userId === normalizedUserId &&
            Math.abs(timestamp(vote.createdAt) - createdTimestamp) < 60 * 1000
        )
      : null;

  if (existing) return { vote: { ...existing }, duplicate: true };

  const vote = {
    id: crypto.randomUUID(),
    eventId: eventId ? String(eventId) : null,
    provider,
    userId: normalizedUserId,
    username: username ? String(username).slice(0, 100) : null,
    weight: Math.max(1, Number.parseInt(weight, 10) || 1),
    createdAt: new Date(createdTimestamp).toISOString(),
    expiresAt: expiresAt
      ? new Date(timestamp(expiresAt, createdTimestamp + VOTE_COOLDOWN_MS)).toISOString()
      : new Date(createdTimestamp + VOTE_COOLDOWN_MS).toISOString(),
    remindedAt: null,
  };

  votes.push(vote);
  if (votes.length > MAX_VOTES) votes.splice(0, votes.length - MAX_VOTES);
  saveStore();
  return { vote: { ...vote }, duplicate: false };
}

export function getVoteStats() {
  const votes = getStore().votes;
  const byProvider = {
    topgg: { votes: 0, weighted: 0 },
    discordbotlist: { votes: 0, weighted: 0 },
  };
  for (const vote of votes) {
    const stats = byProvider[vote.provider];
    if (!stats) continue;
    stats.votes++;
    stats.weighted += Number(vote.weight) || 1;
  }
  return {
    total: votes.length,
    weightedTotal: Object.values(byProvider).reduce((sum, item) => sum + item.weighted, 0),
    byProvider,
    recent: votes
      .slice(-25)
      .reverse()
      .map((vote) => ({ ...vote })),
  };
}

export function getDueVoteReminders(now = Date.now()) {
  return getStore().votes
    .filter((vote) => !vote.remindedAt && timestamp(vote.expiresAt) <= now)
    .map((vote) => ({ ...vote }));
}

export function markVoteReminded(voteId) {
  const vote = getStore().votes.find((entry) => entry.id === voteId);
  if (!vote || vote.remindedAt) return false;
  vote.remindedAt = new Date().toISOString();
  saveStore();
  return true;
}
