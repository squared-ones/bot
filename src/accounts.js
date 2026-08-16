import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { queueDataSync, resolveDataDir } from './github-data.js';

const USERS_FILE = path.join(resolveDataDir(), 'users.json');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

let store = null;

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Start empty when the file does not exist or is invalid.
  }
  return {};
}

function getStore() {
  if (!store) store = readStore();
  return store;
}

function saveStore() {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  const temporary = `${USERS_FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(getStore(), null, 2)}\n`);
  fs.renameSync(temporary, USERS_FILE);
  queueDataSync('Update users');
}

export function loadAccounts() {
  store = readStore();
  return store;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// Strip secrets before an account leaves this module.
function sanitize(account) {
  const { salt, passwordHash, ...rest } = account;
  return rest;
}

export function isValidUsername(username) {
  return typeof username === 'string' && USERNAME_RE.test(username.trim());
}

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

export function getAccount(id) {
  const account = getStore()[String(id || '')];
  return account ? { id: String(id || ''), ...sanitize(account) } : null;
}

export function getAccountByUsername(username) {
  const needle = String(username || '').trim().toLowerCase();
  for (const [id, account] of Object.entries(getStore())) {
    if (String(account.username || '').toLowerCase() === needle) {
      return { id, ...account };
    }
  }
  return null;
}

export function getAccountByDiscordId(discordId) {
  for (const [id, account] of Object.entries(getStore())) {
    if (account.discordId === String(discordId)) return { id, ...account };
  }
  return null;
}

export function createAccount(username, password) {
  const name = String(username || '').trim();
  if (!isValidUsername(name)) {
    return {
      ok: false,
      error: 'Username must be 3–32 characters (letters, numbers, underscores).',
    };
  }
  if (!isValidPassword(password)) {
    return { ok: false, error: 'Password must be 8–128 characters.' };
  }
  if (getAccountByUsername(name)) {
    return { ok: false, error: 'That username is already taken.' };
  }

  const id = crypto.randomUUID();
  const { salt, hash } = hashPassword(password);
  const account = {
    username: name,
    salt,
    passwordHash: hash,
    discordId: null,
    discordUsername: null,
    avatar: null,
    guildIds: [],
    createdAt: new Date().toISOString(),
  };
  getStore()[id] = account;
  saveStore();
  return { ok: true, account: { id, ...sanitize(account) } };
}

export function verifyLogin(username, password) {
  const account = getAccountByUsername(username);
  if (!account) return null;
  if (!verifyPassword(password, account.salt, account.passwordHash)) return null;
  return { id: account.id, ...sanitize(account) };
}

export function changeUsername(id, username) {
  const name = String(username || '').trim();
  if (!isValidUsername(name)) return { ok: false, error: 'Invalid username.' };
  const existing = getAccountByUsername(name);
  if (existing && existing.id !== String(id)) {
    return { ok: false, error: 'That username is already taken.' };
  }
  const account = getStore()[String(id || '')];
  if (!account) return { ok: false, error: 'Account not found.' };
  account.username = name;
  saveStore();
  return { ok: true, account: { id: String(id), ...sanitize(account) } };
}

export function changePassword(id, currentPassword, newPassword) {
  const account = getStore()[String(id || '')];
  if (!account) return { ok: false, error: 'Account not found.' };
  if (!verifyPassword(currentPassword, account.salt, account.passwordHash)) {
    return { ok: false, error: 'Current password is incorrect.' };
  }
  if (!isValidPassword(newPassword)) {
    return { ok: false, error: 'New password must be 8–128 characters.' };
  }
  const { salt, hash } = hashPassword(newPassword);
  account.salt = salt;
  account.passwordHash = hash;
  saveStore();
  return { ok: true };
}

export function linkDiscord(id, { discordId, username, avatar, guildIds }) {
  const account = getStore()[String(id || '')];
  if (!account) return { ok: false, error: 'Account not found.' };
  const did = String(discordId || '');
  if (!did) return { ok: false, error: 'Discord account is required.' };
  const existing = getAccountByDiscordId(did);
  if (existing && existing.id !== String(id)) {
    return { ok: false, error: 'That Discord account is already linked to another account.' };
  }
  account.discordId = did;
  account.discordUsername = username || null;
  account.avatar = avatar || null;
  account.guildIds = Array.isArray(guildIds) ? guildIds.slice(0, 200) : [];
  saveStore();
  return { ok: true, account: { id: String(id), ...sanitize(account) } };
}

export function unlinkDiscord(id) {
  const account = getStore()[String(id || '')];
  if (!account) return { ok: false, error: 'Account not found.' };
  account.discordId = null;
  account.discordUsername = null;
  account.avatar = null;
  account.guildIds = [];
  saveStore();
  return { ok: true, account: { id: String(id), ...sanitize(account) } };
}
