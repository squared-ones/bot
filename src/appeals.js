import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { queueDataSync, resolveDataDir } from './github-data.js';

const FILE = path.join(resolveDataDir(), 'appeals.json');
const MAX_APPEALS = 5000;
const STATUSES = new Set(['pending', 'approved', 'denied']);

let store = null;

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (parsed && Array.isArray(parsed.appeals)) return { appeals: parsed.appeals };
    if (Array.isArray(parsed)) return { appeals: parsed };
  } catch {
    // Start empty when the file is missing or invalid.
  }
  return { appeals: [] };
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
  queueDataSync('Update appeals');
}

export function createAppeal({ guildId, guildName, userId, username, reason }) {
  if (typeof guildId !== 'string' || !guildId.trim()) {
    throw new Error('guild is required');
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new Error('reason is required');
  }
  const appeal = {
    id: crypto.randomUUID().slice(0, 8),
    guildId: guildId.trim(),
    guildName: guildName ? String(guildName).slice(0, 100) : null,
    userId: userId ? String(userId).trim() : null,
    username: username ? String(username).trim().slice(0, 100) : null,
    reason: reason.trim().slice(0, 2000),
    status: 'pending',
    createdAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    note: null,
  };
  const appeals = getStore().appeals;
  appeals.push(appeal);
  if (appeals.length > MAX_APPEALS) appeals.splice(0, appeals.length - MAX_APPEALS);
  persist();
  return { ...appeal };
}

export function getAppeal(id) {
  const found = getStore().appeals.find((appeal) => appeal.id === id);
  return found ? { ...found } : null;
}

export function listAppeals({ guildId = null, status = null } = {}) {
  return getStore()
    .appeals.filter(
      (appeal) =>
        (!guildId || appeal.guildId === String(guildId)) &&
        (!status || appeal.status === status)
    )
    .slice()
    .reverse()
    .map((appeal) => ({ ...appeal }));
}

export function reviewAppeal(id, { status, reviewedBy = null, note = null }) {
  if (!STATUSES.has(status)) throw new Error('invalid status');
  const appeal = getStore().appeals.find((entry) => entry.id === id);
  if (!appeal) return null;
  appeal.status = status;
  appeal.reviewedBy = reviewedBy ? String(reviewedBy).slice(0, 100) : null;
  appeal.reviewedAt = new Date().toISOString();
  appeal.note = note ? String(note).trim().slice(0, 1000) : null;
  persist();
  return { ...appeal };
}
