import fs from 'node:fs';
import path from 'node:path';
import { queueDataSync, resolveDataDir } from './github-data.js';

const STICKIES_FILE = path.join(resolveDataDir(), 'stickies.json');

// Shape: { [guildId]: { [channelId]: { content, messageId, interval } } }
let store = null;

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STICKIES_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Start with an empty store when the file does not exist or is invalid.
  }
  return {};
}

function getStore() {
  if (!store) store = readStore();
  return store;
}

function saveStore({ sync = true } = {}) {
  fs.mkdirSync(path.dirname(STICKIES_FILE), { recursive: true });
  const temporary = `${STICKIES_FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(getStore(), null, 2)}\n`);
  fs.renameSync(temporary, STICKIES_FILE);
  if (sync) queueDataSync('Update stickies');
}

export function getSticky(guildId, channelId) {
  const guild = getStore()[String(guildId || '')];
  const sticky = guild ? guild[String(channelId || '')] : null;
  return sticky ? { ...sticky, channelId: String(channelId || '') } : null;
}

export function setSticky(guildId, channelId, { content, messageId = null, interval = 1 }) {
  const gid = String(guildId || '');
  const cid = String(channelId || '');
  if (!gid || !cid) throw new Error('guild and channel IDs are required');
  const guilds = getStore();
  guilds[gid] = guilds[gid] || {};
  guilds[gid][cid] = {
    content: String(content || '').slice(0, 2000),
    messageId: messageId ? String(messageId) : null,
    interval: Math.min(50, Math.max(1, Math.floor(Number(interval) || 1))),
    updatedAt: new Date().toISOString(),
  };
  saveStore();
  return { ...guilds[gid][cid], channelId: cid };
}

// Transient bookkeeping (the posted message id) — written locally but not
// synced to GitHub, since it changes on every repost.
export function updateStickyMessageId(guildId, channelId, messageId) {
  const gid = String(guildId || '');
  const cid = String(channelId || '');
  const guild = getStore()[gid];
  if (!guild || !guild[cid]) return false;
  guild[cid].messageId = String(messageId);
  saveStore({ sync: false });
  return true;
}

export function removeSticky(guildId, channelId) {
  const gid = String(guildId || '');
  const cid = String(channelId || '');
  const guild = getStore()[gid];
  if (!guild || !guild[cid]) return false;
  delete guild[cid];
  if (!Object.keys(guild).length) delete getStore()[gid];
  saveStore();
  return true;
}

export function listStickies(guildId) {
  return Object.entries(getStore()[String(guildId || '')] || {}).map(
    ([channelId, sticky]) => ({ channelId, ...sticky })
  );
}
