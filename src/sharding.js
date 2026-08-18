import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { queueDataSync, resolveDataDir } from './github-data.js';
import { grantCredits } from './credits.js';

const WORKERS_FILE = path.join(resolveDataDir(), 'workers.json');
const WORKER_TOKEN_PREFIX = 'wkr_';

// Credits a worker earns per hour of uptime. Set WORKER_CREDIT_RATE=0 to
// disable community rewards.
const parsedCreditRate = Number(process.env.WORKER_CREDIT_RATE);
export const WORKER_CREDIT_RATE = Number.isFinite(parsedCreditRate)
  ? Math.max(0, Math.floor(parsedCreditRate))
  : 5;

// How long without a heartbeat before a worker is considered offline.
const OFFLINE_TIMEOUT_MS = 90_000;

// Data files that are keyed by guild and can therefore be merged safely
// across shards (each guild belongs to exactly one shard). Workers push these
// back to the server; the server merges them per-guild by shard ownership.
const GUILD_SCOPED_FILES = [
  'levels.json',
  'verification.json',
  'tickets.json',
  'stickies.json',
  'restore.json',
  'autoroles.json',
];

// Files that are never sent to workers (they contain credentials or are
// server-authoritative).
const EXCLUDED_FILES = new Set([
  'users.json',
  'apikeys.json',
  'workers.json',
  'sharding.json',
]);

let store = null;

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(WORKERS_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        workers:
          parsed.workers && typeof parsed.workers === 'object'
            ? parsed.workers
            : {},
      };
    }
  } catch {
    // Start empty when the file does not exist or is invalid.
  }
  return { workers: {} };
}

function getStore() {
  if (!store) store = readStore();
  return store;
}

function saveStore() {
  fs.mkdirSync(path.dirname(WORKERS_FILE), { recursive: true });
  const temporary = `${WORKERS_FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(getStore(), null, 2)}\n`);
  fs.renameSync(temporary, WORKERS_FILE);
  queueDataSync('Update workers');
}

export function loadSharding() {
  store = readStore();
  return store;
}

function onlineWorkers() {
  return Object.values(getStore().workers).filter(
    (worker) => worker.status === 'online'
  );
}

// Total shard count for the whole bot. The server always runs shard 0; each
// online worker adds one more shard. So with no workers the bot runs a single
// unsharded connection, and the count grows (and shrinks) with the network.
export function getShardCount() {
  return 1 + onlineWorkers().length;
}

// Shard IDs run by the main server itself. The server always owns shard 0;
// workers are compacted into shards 1..N. SERVER_SHARDS is honored so an owner
// can pin additional local shards, but the server process itself only runs
// shard 0 (run more processes to host more local shards).
export function getServerShardIds() {
  const raw = String(process.env.SERVER_SHARDS || '0');
  const ids = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return ids.length ? ids : [0];
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Strips secrets/hashes so a record is safe to send to the dashboard.
export function publicWorker(worker) {
  return {
    id: worker.id,
    name: worker.name,
    prefix: worker.prefix,
    shardId: worker.shardId,
    status: worker.status,
    guilds: worker.guilds || 0,
    members: worker.members || 0,
    latency: worker.latency || 0,
    uptimeMs: worker.uptimeMs || 0,
    totalEarned: worker.totalEarned || 0,
    version: worker.version || null,
    lastHeartbeat: worker.lastHeartbeat || null,
    createdAt: worker.createdAt,
  };
}

// Creates a worker token for the given owner. Returns the plaintext token
// exactly once — it is not stored.
export function createWorker({ ownerId, name }) {
  const token = `${WORKER_TOKEN_PREFIX}${crypto
    .randomBytes(24)
    .toString('base64url')}`;
  const id = crypto.randomUUID();
  const record = {
    id,
    name: String(name || '').trim().slice(0, 64) || 'Worker',
    ownerId: String(ownerId || ''),
    tokenHash: hashToken(token),
    prefix: token.slice(0, 12),
    shardId: null,
    status: 'offline',
    guilds: 0,
    members: 0,
    latency: 0,
    uptimeMs: 0,
    totalEarned: 0,
    version: null,
    lastHeartbeat: null,
    createdAt: new Date().toISOString(),
  };
  getStore().workers[id] = record;
  saveStore();
  return { token, worker: publicWorker(record) };
}

export function listWorkers(ownerId) {
  return Object.values(getStore().workers)
    .filter((worker) => worker.ownerId === String(ownerId || ''))
    .map(publicWorker);
}

export function revokeWorker(ownerId, id) {
  const worker = getStore().workers[String(id || '')];
  if (!worker || worker.ownerId !== String(ownerId || '')) return false;
  delete getStore().workers[String(id || '')];
  saveStore();
  return true;
}

// Resolves an Authorization Bearer token to its worker record, or null.
export function authenticateWorker(token) {
  if (typeof token !== 'string' || !token.startsWith(WORKER_TOKEN_PREFIX)) {
    return null;
  }
  const hash = hashToken(token);
  const record = Object.values(getStore().workers).find(
    (worker) => worker.tokenHash === hash
  );
  return record || null;
}

// Compactly assigns shards 1..N to the online workers (the server owns shard
// 0). Workers are ordered by creation time so a worker keeps its slot while
// it stays online; when workers join or leave the remaining ones shift down.
function reassignShards() {
  const online = onlineWorkers().sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt))
  );
  online.forEach((worker, index) => {
    worker.shardId = index + 1;
  });
  return online.length;
}

// Claims a shard for a worker and marks it online. Returns the assignment or
// an error string.
export function claimShard(worker) {
  const now = Date.now();
  worker.status = 'online';
  worker.lastHeartbeat = now;
  const onlineCount = reassignShards();
  saveStore();
  return {
    ok: true,
    shardId: worker.shardId,
    shardCount: 1 + onlineCount,
    // The server issues the bot token to workers so they can connect as the
    // same application under a different shard.
    botToken: process.env.DISCORD_TOKEN || '',
  };
}

// Records a heartbeat and accrues credits for continuous uptime. Returns the
// credits granted in this heartbeat (if any) and the worker's lifetime total.
export function heartbeat(worker, stats = {}) {
  const now = Date.now();
  const last = worker.lastHeartbeat || now;
  const gap = now - last;

  // Only accrue uptime when the gap is small (the worker stayed online).
  // A large gap means the worker reconnected after being offline — reset the
  // accrual window so offline time is never rewarded.
  if (gap > 0 && gap <= OFFLINE_TIMEOUT_MS) {
    worker.uptimeMs = (worker.uptimeMs || 0) + gap;
  }

  worker.status = 'online';
  worker.lastHeartbeat = now;
  worker.guilds = Number.isFinite(stats.guilds) ? Math.max(0, Math.floor(stats.guilds)) : worker.guilds;
  worker.members = Number.isFinite(stats.members) ? Math.max(0, Math.floor(stats.members)) : worker.members;
  worker.latency = Number.isFinite(stats.latency) ? Math.max(0, Math.round(stats.latency)) : worker.latency;
  if (stats.version) worker.version = String(stats.version).slice(0, 32);

  const earned = awardWorkerCredits(worker);
  const onlineCount = reassignShards();
  saveStore();
  return {
    ok: true,
    shardId: worker.shardId,
    shardCount: 1 + onlineCount,
    creditsEarned: earned,
    totalEarned: worker.totalEarned || 0,
  };
}

// Marks a specific worker offline (used on graceful release). Returns the new
// shard count so the server can reconnect if it changed.
export function releaseWorker(worker) {
  if (worker.status === 'online') {
    worker.status = 'offline';
    reassignShards();
    saveStore();
  }
  return getShardCount();
}

// Grants credits for any uptime accrued since the last grant. Returns the
// number of credits granted (0 when nothing new accrued).
function awardWorkerCredits(worker) {
  if (WORKER_CREDIT_RATE <= 0 || !worker.ownerId) return 0;
  const accrued =
    (worker.uptimeMs || 0) -
    (worker.totalEarned || 0) * (3_600_000 / WORKER_CREDIT_RATE);
  if (accrued < 3_600_000 / WORKER_CREDIT_RATE) return 0;
  const credits = Math.floor((accrued * WORKER_CREDIT_RATE) / 3_600_000);
  if (credits <= 0) return 0;
  try {
    grantCredits(worker.ownerId, credits);
    worker.totalEarned = (worker.totalEarned || 0) + credits;
    return credits;
  } catch (error) {
    console.error('[sharding] failed to grant worker credits:', error.message);
    return 0;
  }
}

// Marks workers offline when they have not heartbeated in time. Returns the
// number of workers newly marked offline.
export function markStaleWorkersOffline(now = Date.now()) {
  let changed = 0;
  for (const worker of Object.values(getStore().workers)) {
    if (
      worker.status === 'online' &&
      worker.lastHeartbeat &&
      now - worker.lastHeartbeat > OFFLINE_TIMEOUT_MS
    ) {
      worker.status = 'offline';
      changed++;
    }
  }
  if (changed) {
    reassignShards();
    saveStore();
  }
  return changed;
}

// Snapshot of the data files a worker needs to run the full bot logic. Excludes
// credentials and server-authoritative stores.
export function getWorkerDataFiles() {
  const dataDir = resolveDataDir();
  const out = {};
  let entries = [];
  try {
    entries = fs.readdirSync(dataDir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (!name.endsWith('.json') || EXCLUDED_FILES.has(name)) continue;
    try {
      out[name] = fs.readFileSync(path.join(dataDir, name), 'utf8');
    } catch {
      // Skip files that vanished mid-read.
    }
  }
  return out;
}

// Returns true when a parsed JSON value is an object keyed by guild IDs.
function isGuildKeyedObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => /^\d{17,20}$/.test(key));
}

// Recursively merges a worker's guild-scoped data into the server's copy.
// At every level keyed by guild IDs, a guild's entry is taken from the worker
// only when that guild belongs to the worker's shard; everything else keeps
// the server's value. Non-guild values (arrays, primitives, global stores)
// stay server-authoritative.
function mergeGuildScoped(serverVal, workerVal, shardId, shardCount) {
  if (isGuildKeyedObject(serverVal) || isGuildKeyedObject(workerVal)) {
    const out = { ...(serverVal || {}) };
    for (const [guildId, value] of Object.entries(workerVal || {})) {
      const numeric = BigInt(guildId);
      if (numeric % BigInt(shardCount) === BigInt(shardId)) {
        out[guildId] = value;
      }
    }
    return out;
  }
  if (
    serverVal &&
    workerVal &&
    typeof serverVal === 'object' &&
    typeof workerVal === 'object' &&
    !Array.isArray(serverVal) &&
    !Array.isArray(workerVal)
  ) {
    const out = { ...serverVal };
    for (const key of Object.keys(workerVal)) {
      out[key] = mergeGuildScoped(serverVal[key], workerVal[key], shardId, shardCount);
    }
    return out;
  }
  return serverVal;
}

// Merges guild-scoped data files pushed by a worker into the server's data
// directory. Only files in GUILD_SCOPED_FILES are accepted. Returns the list
// of files that were updated.
export function mergeWorkerData(worker, files = {}) {
  const dataDir = resolveDataDir();
  const updated = [];
  for (const name of GUILD_SCOPED_FILES) {
    const rawWorker = files[name];
    if (typeof rawWorker !== 'string') continue;
    let workerVal;
    try {
      workerVal = JSON.parse(rawWorker);
    } catch {
      continue;
    }
    const filePath = path.join(dataDir, name);
    let serverVal = {};
    try {
      serverVal = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      serverVal = {};
    }
    const merged = mergeGuildScoped(
      serverVal,
      workerVal,
      worker.shardId ?? -1,
      getShardCount()
    );
    const serialized = `${JSON.stringify(merged, null, 2)}\n`;
    if (serialized === rawWorker) continue;
    fs.mkdirSync(dataDir, { recursive: true });
    const temporary = `${filePath}.tmp`;
    fs.writeFileSync(temporary, serialized);
    fs.renameSync(temporary, filePath);
    updated.push(name);
  }
  if (updated.length) {
    queueDataSync('Update worker data');
  }
  return updated;
}

// Aggregated network stats for the dashboard: total shards, server shards,
// online workers, and combined guild/member counts.
export function getNetworkStats() {
  const workers = Object.values(getStore().workers);
  const online = workers.filter((worker) => worker.status === 'online');
  return {
    shardCount: getShardCount(),
    serverShards: getServerShardIds(),
    creditRate: WORKER_CREDIT_RATE,
    workerCount: workers.length,
    onlineWorkers: online.length,
    workerGuilds: online.reduce((sum, worker) => sum + (worker.guilds || 0), 0),
    workerMembers: online.reduce((sum, worker) => sum + (worker.members || 0), 0),
  };
}
