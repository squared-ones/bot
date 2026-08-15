import fs from 'node:fs';
import path from 'node:path';
import { queueDataSync, resolveDataDir } from './github-data.js';

const DATA_DIR = resolveDataDir();
const CONFIG_FILE = path.join(DATA_DIR, 'verification.json');
const ACTIONS = ['none', 'kick', 'ban'];
const DEFAULT_CONFIG = {
  roleId: null,
  minAccountAgeDays: 0,
  requireAvatar: false,
  joinBurst: 0,
  joinBurstWindow: 10,
  action: 'none',
  logChannelId: null,
};

function toNonNegativeInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function readConfigs() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

let configs = null;

function getConfigs() {
  if (!configs) {
    configs = new Map(
      Object.entries(readConfigs()).map(([guildId, config]) => [
        guildId,
        normalizeVerificationConfig(config),
      ])
    );
  }
  return configs;
}

export function normalizeVerificationConfig(input = {}) {
  input = input && typeof input === 'object' ? input : {};
  const action = String(input.action || DEFAULT_CONFIG.action).toLowerCase();
  return {
    roleId: typeof input.roleId === 'string' && input.roleId.trim()
      ? input.roleId.trim()
      : null,
    minAccountAgeDays: Math.min(
      3650,
      toNonNegativeInt(input.minAccountAgeDays, DEFAULT_CONFIG.minAccountAgeDays)
    ),
    requireAvatar: input.requireAvatar === true,
    joinBurst: Math.min(
      10000,
      toNonNegativeInt(input.joinBurst, DEFAULT_CONFIG.joinBurst)
    ),
    joinBurstWindow: Math.min(
      86400,
      Math.max(
        1,
        toNonNegativeInt(input.joinBurstWindow, DEFAULT_CONFIG.joinBurstWindow)
      )
    ),
    action: ACTIONS.includes(action) ? action : DEFAULT_CONFIG.action,
    logChannelId: typeof input.logChannelId === 'string' && input.logChannelId.trim()
      ? input.logChannelId.trim()
      : null,
  };
}

export function getVerificationConfig(guildId) {
  return normalizeVerificationConfig(getConfigs().get(String(guildId)) || DEFAULT_CONFIG);
}

export function getAllVerificationConfigs() {
  return Object.fromEntries(getConfigs());
}

export function saveVerificationConfig(guildId, input) {
  const id = String(guildId || '').trim();
  if (!id) throw new Error('guild ID is required');
  const config = normalizeVerificationConfig(input);
  getConfigs().set(id, config);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporary = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(Object.fromEntries(getConfigs()), null, 2)}\n`);
  fs.renameSync(temporary, CONFIG_FILE);
  queueDataSync('Update verification');
  return config;
}

export function isVerificationConfigured(config) {
  return Boolean(config?.roleId);
}

// Returns an array of detection reason strings for a joining member.
export function detectFlags(member, config) {
  const flags = [];
  if (config.minAccountAgeDays > 0) {
    const ageDays = (Date.now() - member.user.createdTimestamp) / 86400000;
    if (ageDays < config.minAccountAgeDays) {
      flags.push(
        `account created ${Math.max(0, Math.floor(ageDays))}d ago (< ${
          config.minAccountAgeDays
        }d)`
      );
    }
  }
  if (config.requireAvatar && !member.user.avatar) {
    flags.push('using the default avatar');
  }
  return flags;
}

// Join-burst (raid) tracking: returns true when the latest join pushes the
// recent-join count past the configured threshold.
const joinTimes = new Map(); // guildId -> number[] (epoch ms)

export function isJoinBurst(guildId, config) {
  if (!config.joinBurst || config.joinBurst <= 0) return false;
  const now = Date.now();
  const window = Math.max(1, config.joinBurstWindow) * 1000;
  const times = (joinTimes.get(guildId) || []).filter((t) => now - t <= window);
  times.push(now);
  joinTimes.set(guildId, times);
  return times.length >= config.joinBurst;
}
