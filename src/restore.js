import fs from 'node:fs';
import path from 'node:path';
import { queueDataSync, resolveDataDir } from './github-data.js';

const FILE = path.join(resolveDataDir(), 'restore.json');

let store = null;

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { config: {}, roles: {} };
    }
    return {
      config:
        parsed.config && typeof parsed.config === 'object' ? parsed.config : {},
      roles: parsed.roles && typeof parsed.roles === 'object' ? parsed.roles : {},
    };
  } catch {
    return { config: {}, roles: {} };
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
  queueDataSync('Update role restore');
}

export function isRestoreEnabled(guildId) {
  return getStore().config[String(guildId)] === true;
}

export function setRestoreEnabled(guildId, enabled) {
  const id = String(guildId || '').trim();
  if (!id) throw new Error('guild ID is required');
  if (enabled) getStore().config[id] = true;
  else delete getStore().config[id];
  persist();
  return Boolean(enabled);
}

export function saveMemberRoles(guildId, userId, roleIds) {
  const roles = getStore().roles;
  const guildRoles = (roles[String(guildId)] ||= {});
  guildRoles[String(userId)] = [
    ...new Set(roleIds.map(String).filter(Boolean)),
  ];
  persist();
}

export function takeMemberRoles(guildId, userId) {
  const roles = getStore().roles[String(guildId)];
  if (!roles) return [];
  const saved = roles[String(userId)] || [];
  delete roles[String(userId)];
  if (Object.keys(roles).length === 0) delete getStore().roles[String(guildId)];
  persist();
  return [...saved];
}
