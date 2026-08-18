// Squared One worker app
// ----------------------
// Runs one Discord shard of the Squared One bot from your own machine. While
// the worker is online it earns the owner credits (SQ) based on uptime.
//
// Setup (standalone app):
//   1. Create a worker token in the dashboard (Settings -> Workers).
//   2. Create a file named `.env` next to the app and set WORKER_TOKEN (and
//      WORKER_URL if the server is not at the default address).
//   3. Run the app — the bundled app keeps its data in a `data/` folder next
//      to the executable.
//
// Setup (from source):
//   1. Copy worker/.env.example to worker/.env and set WORKER_TOKEN.
//   2. Run:  node worker/index.js
//
// The worker pulls the current data snapshot (rules, configs, levels, …) from
// the server on startup and periodically, and pushes its guild-scoped changes
// back so data stays consistent across shards.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { startBot } from '../src/bot.js';
import { resolveDataDir } from '../src/github-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Standalone app: `.env` and `data/` live next to the executable. From
// source: they live in the worker/ folder (and the repo data/ folder).
const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
if (fs.existsSync(path.join(APP_DIR, '.env'))) {
  dotenv.config({ path: path.join(APP_DIR, '.env') });
} else if (process.pkg) {
  console.warn('[worker] no .env found next to the app — creating a template. Add your WORKER_TOKEN and restart.');
  fs.writeFileSync(
    path.join(APP_DIR, '.env'),
    '# Squared One worker\nWORKER_TOKEN=\nWORKER_URL=https://squared-one.onrender.com\n'
  );
}

// Single-instance lock: running the same worker twice makes two Discord
// connections with the same token and shard, so both receive the same
// interactions and Discord rejects the second reply (error 40060). The lock
// file lives next to the app and records the PID; a stale lock (after a
// crash) is taken over automatically.
const LOCK_FILE = path.join(APP_DIR, '.worker.lock');

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function acquireLock() {
  try {
    const existing = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
    if (existing && isProcessAlive(existing.pid)) {
      console.error(
        `[worker] another instance is already running (PID ${existing.pid}). ` +
          'Only one instance may run per worker token — close the other window first.'
      );
      return false;
    }
  } catch {
    // No lock or unreadable lock — safe to take over.
  }
  try {
    fs.writeFileSync(
      LOCK_FILE,
      `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`
    );
  } catch {
    // Lock file not writable (e.g. read-only folder) — don't block startup.
  }
  return true;
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    // Nothing to clean up.
  }
}

const WORKER_URL = (process.env.WORKER_URL || 'https://squared-one.onrender.com').replace(/\/+$/, '');
const WORKER_TOKEN = process.env.WORKER_TOKEN || '';
const HEARTBEAT_INTERVAL_MS = 30_000;
const DATA_SYNC_INTERVAL_MS = 5 * 60_000;

// Guild-scoped files the worker is allowed to push back to the server.
const GUILD_SCOPED_FILES = [
  'levels.json',
  'verification.json',
  'tickets.json',
  'stickies.json',
  'restore.json',
  'autoroles.json',
];

let client = null;
let shardId = null;
let shardCount = 1;
let stopping = false;
let heartbeatTimer = null;
let syncTimer = null;

async function api(pathname, method = 'GET', body) {
  const res = await fetch(`${WORKER_URL}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WORKER_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data.error || '';
    } catch {
      // Non-JSON error body.
    }
    throw new Error(`${method} ${pathname} -> ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}

function dataDir() {
  return resolveDataDir();
}

function writeDataFiles(files) {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
}

function readGuildScopedFiles() {
  const dir = dataDir();
  const out = {};
  for (const name of GUILD_SCOPED_FILES) {
    try {
      out[name] = fs.readFileSync(path.join(dir, name), 'utf8');
    } catch {
      // File does not exist locally yet — nothing to push.
    }
  }
  return out;
}

async function pullData() {
  const { files } = await api('/api/worker/data');
  writeDataFiles(files);
  console.log(`[worker] pulled ${Object.keys(files).length} data file(s).`);
}

async function pushData() {
  const files = readGuildScopedFiles();
  if (!Object.keys(files).length) return;
  await api('/api/worker/data', 'POST', { files });
  console.log('[worker] pushed guild data back to the server.');
}

async function sendHeartbeat() {
  if (!client || !client.isReady()) return;
  const guilds = client.guilds.cache.size;
  const members = client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);
  const result = await api('/api/worker/heartbeat', 'POST', {
    guilds,
    members,
    latency: client.ws.ping,
    version: '1.0.0',
  });
  // If the server reassigned our shard (e.g. the shard count changed because
  // another worker joined or left), destroy the client so the main loop
  // re-claims a shard and reconnects with the new count.
  if (
    result.ok &&
    (result.shardId !== shardId || result.shardCount !== shardCount)
  ) {
    console.log(
      `[worker] shard reassigned to ${result.shardId}/${result.shardCount}, reconnecting…`
    );
    await client.destroy().catch(() => {});
    client = null;
    return;
  }
  if (result.creditsEarned > 0) {
    console.log(
      `[worker] earned ${result.creditsEarned} SQ (total ${result.totalEarned} SQ).`
    );
  }
}

function stopTimers() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (syncTimer) clearInterval(syncTimer);
  heartbeatTimer = null;
  syncTimer = null;
}

// Runs one claim + connect cycle. Returns when the client disconnects (e.g.
// a shard reassignment) or the process is asked to stop.
async function runCycle() {
  console.log(`[worker] connecting to ${WORKER_URL}…`);
  const claim = await api('/api/worker/claim', 'POST');
  shardId = claim.shardId;
  shardCount = claim.shardCount;
  console.log(`[worker] claimed shard ${shardId}/${shardCount}.`);

  if (!claim.botToken) {
    throw new Error(
      'the server did not provide a bot token — set DISCORD_TOKEN on the server'
    );
  }

  try {
    await pullData();
  } catch (error) {
    console.warn(`[worker] could not pull data snapshot: ${error.message}`);
  }

  client = await startBot(claim.botToken, {
    shardId,
    shardCount,
    registerCommands: false,
  });

  heartbeatTimer = setInterval(() => {
    sendHeartbeat().catch((error) =>
      console.error(`[worker] heartbeat failed: ${error.message}`)
    );
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();

  syncTimer = setInterval(() => {
    pushData()
      .catch((error) => console.warn(`[worker] data push failed: ${error.message}`))
      .then(() => pullData().catch(() => {}));
  }, DATA_SYNC_INTERVAL_MS);
  syncTimer.unref?.();

  // Wait until the client is gone (destroyed on reassignment or shutdown).
  while (!stopping && client) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  stopTimers();
  if (client) {
    await client.destroy().catch(() => {});
    client = null;
  }
}

async function main() {
  if (!WORKER_TOKEN) {
    console.error(
      `[worker] WORKER_TOKEN is not set. Create a worker token in the dashboard and add it to ${path.join(APP_DIR, '.env')}`
    );
    process.exit(1);
  }

  if (!acquireLock()) {
    process.exit(1);
  }

  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`[worker] ${signal} received, shutting down…`);
    try {
      await pushData();
    } catch {
      // Best-effort push on shutdown.
    }
    try {
      await api('/api/worker/release', 'POST');
    } catch {
      // The server will mark us offline via the timeout anyway.
    }
    releaseLock();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  while (!stopping) {
    try {
      await runCycle();
    } catch (error) {
      console.error(`[worker] error: ${error.message}`);
      stopTimers();
      if (client) {
        await client.destroy().catch(() => {});
        client = null;
      }
      if (stopping) break;
      console.log('[worker] retrying in 5s…');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

main().catch((error) => {
  console.error(`[worker] fatal: ${error.message}`);
  releaseLock();
  process.exit(1);
});
