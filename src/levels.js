import fs from 'node:fs';
import path from 'node:path';
import { queueDataSync, resolveDataDir } from './github-data.js';

const FILE = path.join(resolveDataDir(), 'levels.json');

const DEFAULT_CONFIG = {
  levelUpChannelId: null,
  announce: true,
  voiceXpPerMinute: 5,
};

export const MESSAGE_XP_MIN = 10;
export const MESSAGE_XP_MAX = 20;
export const MESSAGE_COOLDOWN_MS = 60_000;

let store = null;

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { config: {}, users: {} };
    }
    return {
      config:
        parsed.config && typeof parsed.config === 'object' ? parsed.config : {},
      users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
    };
  } catch {
    return { config: {}, users: {} };
  }
}

function getStore() {
  if (!store) store = readStore();
  return store;
}

function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const temporary = `${FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(getStore(), null, 2)}\n`);
  fs.renameSync(temporary, FILE);
  queueDataSync('Update levels');
}

// ---- Level math ----
// level = floor(sqrt(xp / 100)): level 1 at 100 XP, 2 at 400, 3 at 900, ...
export function levelForXp(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}

export function xpForLevel(level) {
  return 100 * level * level;
}

export function xpProgress(xp) {
  const level = levelForXp(xp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    xp,
    progressXp: xp - current,
    neededXp: next - current,
  };
}

// ---- Config ----
function normalizeConfig(input = {}) {
  input = input && typeof input === 'object' ? input : {};
  const voiceXp = Number(input.voiceXpPerMinute);
  return {
    levelUpChannelId:
      typeof input.levelUpChannelId === 'string' && input.levelUpChannelId.trim()
        ? input.levelUpChannelId.trim()
        : null,
    announce: input.announce !== false,
    voiceXpPerMinute: Number.isFinite(voiceXp)
      ? Math.max(0, Math.min(100, Math.floor(voiceXp)))
      : DEFAULT_CONFIG.voiceXpPerMinute,
  };
}

export function getLevelConfig(guildId) {
  return normalizeConfig(getStore().config[String(guildId)]);
}

export function setLevelConfig(guildId, input) {
  const id = String(guildId || '').trim();
  if (!id) throw new Error('guild ID is required');
  const existing = getLevelConfig(id);
  const config = normalizeConfig({
    ...existing,
    ...(input && typeof input === 'object' ? input : {}),
  });
  getStore().config[id] = config;
  persist();
  return config;
}

// ---- Users / XP ----
function userRecord(guildId, userId, create = false) {
  const users = getStore().users;
  const guildUsers = (users[String(guildId)] ||= {});
  let record = guildUsers[String(userId)];
  if (!record && create) {
    record = { xp: 0, lastMessageXpAt: 0 };
    guildUsers[String(userId)] = record;
  }
  return record;
}

export function getUserXp(guildId, userId) {
  const record = userRecord(guildId, userId);
  return record ? record.xp || 0 : 0;
}

export function addXp(guildId, userId, amount) {
  const id = String(guildId);
  const uid = String(userId);
  const record = userRecord(id, uid, true);
  const before = record.xp || 0;
  record.xp = before + Math.max(0, Math.floor(amount));
  const previousLevel = levelForXp(before);
  const level = levelForXp(record.xp);
  persist();
  return { xp: record.xp, level, previousLevel, leveledUp: level > previousLevel };
}

// Awards a random amount of message XP, enforcing a per-user cooldown.
export function addMessageXp(guildId, userId, now = Date.now()) {
  const id = String(guildId);
  const uid = String(userId);
  const record = userRecord(id, uid);
  if (
    record &&
    record.lastMessageXpAt &&
    now - record.lastMessageXpAt < MESSAGE_COOLDOWN_MS
  ) {
    return null;
  }
  const amount =
    MESSAGE_XP_MIN +
    Math.floor(Math.random() * (MESSAGE_XP_MAX - MESSAGE_XP_MIN + 1));
  const target = userRecord(id, uid, true);
  target.lastMessageXpAt = now;
  return addXp(id, uid, amount);
}

export function getLeaderboard(guildId, limit = 10) {
  const users = getStore().users[String(guildId)] || {};
  return Object.entries(users)
    .map(([userId, record]) => ({
      userId,
      xp: record.xp || 0,
      level: levelForXp(record.xp || 0),
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

export function getRank(guildId, userId) {
  const users = getStore().users[String(guildId)] || {};
  const sorted = Object.entries(users)
    .map(([uid, record]) => ({ userId: uid, xp: record.xp || 0 }))
    .sort((a, b) => b.xp - a.xp);
  const index = sorted.findIndex((entry) => entry.userId === String(userId));
  return index === -1 ? null : index + 1;
}

export function resetUserXp(guildId, userId) {
  const users = getStore().users[String(guildId)];
  if (!users) return false;
  const existed = Object.prototype.hasOwnProperty.call(users, String(userId));
  delete users[String(userId)];
  if (Object.keys(users).length === 0) delete getStore().users[String(guildId)];
  if (existed) persist();
  return existed;
}

export function resetGuildXp(guildId) {
  const existed = Boolean(getStore().users[String(guildId)]);
  delete getStore().users[String(guildId)];
  if (existed) persist();
  return existed;
}
