import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { queueDataSync, resolveDataDir } from './github-data.js';

const FILE = path.join(resolveDataDir(), 'apikeys.json');
const KEY_PREFIX = 'sq_';

let records = null;

function read() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function load() {
  if (!records) records = read();
  return records;
}

function write() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const temporary = `${FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(load(), null, 2)}\n`);
  fs.renameSync(temporary, FILE);
  queueDataSync('Update API keys');
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Strips secrets/hashes so a record is safe to send to the dashboard.
function publicRecord(record) {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    createdAt: record.createdAt,
  };
}

// Creates a key for the given identity snapshot (see apiKeyIdentity in
// server.js). Returns the plaintext key exactly once — it is not stored.
export function createApiKey({ name, identity }) {
  const key = `${KEY_PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
  const record = {
    id: crypto.randomUUID(),
    name: String(name || '').trim().slice(0, 64) || 'Untitled key',
    ownerId: identity.ownerId,
    authType: identity.authType || 'discord',
    accountId: identity.accountId || null,
    username: identity.username || null,
    guildIds: Array.isArray(identity.guildIds) ? identity.guildIds.slice(0, 200) : [],
    keyHash: hashKey(key),
    prefix: key.slice(0, 12),
    createdAt: new Date().toISOString(),
  };
  load().push(record);
  write();
  return { key, record: publicRecord(record) };
}

export function listApiKeys(ownerId) {
  return load()
    .filter((record) => record.ownerId === ownerId)
    .map(publicRecord);
}

export function revokeApiKey(ownerId, id) {
  const list = load();
  const index = list.findIndex(
    (record) => record.ownerId === ownerId && record.id === id
  );
  if (index === -1) return false;
  list.splice(index, 1);
  write();
  return true;
}

// Resolves an Authorization Bearer token to its owner's identity snapshot,
// or null. Used by the server to treat an API key like a logged-in session.
export function authenticateApiKey(token) {
  if (typeof token !== 'string' || !token.startsWith(KEY_PREFIX)) return null;
  const hash = hashKey(token);
  const record = load().find((entry) => entry.keyHash === hash);
  if (!record) return null;
  return {
    authType: record.authType || 'discord',
    id: record.ownerId,
    accountId: record.accountId || null,
    username: record.username || null,
    guildIds: record.guildIds || [],
    apiKey: true,
  };
}
