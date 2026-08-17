// Squared One worker app
// ----------------------
// Runs one Discord shard of the Squared One bot from your own machine. While
// the worker is online it earns the owner credits (SQ) based on uptime.
//
// Setup:
//   1. Create a worker token in the dashboard (Settings -> Workers).
//   2. Copy worker/.env.example to worker/.env and set WORKER_TOKEN (and
//      WORKER_URL if the server is not at the default address).
//   3. Run:  node worker/index.js
//
// The worker pulls the current data snapshot (rules, configs, levels, …) from
// the server on startup and periodically, and pushes its guild-scoped changes
// back so data stays consistent across shards.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startBot } from '../src/bot.js';
import { resolveDataDir } from '../src/github-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  // If the server reassigned our shard (e.g. shard count changed), reconnect.
  if (
    result.ok &&
    (result.shardId !== shardId || result.shardCount !== shardCount)
  ) {
    console.log(
      `[worker] shard reassigned to ${result.shardId}/${result.shardCount}, reconnecting…`
    );
    process.exit(0);
  }
  if (result.creditsEarned > 0) {
    console.log(
      `[worker] earned ${result.creditsEarned} SQ (total ${result.totalEarned} SQ).`
    );
  }
}

async function run() {
  if (!WORKER_TOKEN) {
    console.error(
      '[worker] WORKER_TOKEN is not set. Create a worker token in the dashboard and add it to worker/.env'
    );
    process.exit(1);
  }

  console.log(`[worker] connecting to ${WORKER_URL}…`);
  const claim = await api('/api/worker/claim', 'POST');
  shardId = claim.shardId;
  shardCount = claim.shardCount;
  console.log(`[worker] claimed shard ${shardId}/${shardCount}.`);

  if (!claim.botToken) {
    console.error(
      '[worker] the server did not provide a bot token — set DISCORD_TOKEN on the server.'
    );
    process.exit(1);
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

  const heartbeatTimer = setInterval(() => {
    sendHeartbeat().catch((error) =>
      console.error(`[worker] heartbeat failed: ${error.message}`)
    );
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();

  const syncTimer = setInterval(() => {
    pushData()
      .catch((error) => console.warn(`[worker] data push failed: ${error.message}`))
      .then(() => pullData().catch(() => {}));
  }, DATA_SYNC_INTERVAL_MS);
  syncTimer.unref?.();

  const shutdown = async (signal) => {
    console.log(`[worker] ${signal} received, shutting down…`);
    try {
      await pushData();
    } catch {
      // Best-effort push on shutdown.
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

run().catch((error) => {
  console.error(`[worker] failed to start: ${error.message}`);
  process.exit(1);
});
