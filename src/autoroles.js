import fs from 'node:fs';
import path from 'node:path';
import { queueDataSync, resolveDataDir } from './github-data.js';

const FILE = path.join(resolveDataDir(), 'autoroles.json');

let configs = null;

function readConfigs() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function getConfigs() {
  if (!configs) {
    configs = new Map(
      Object.entries(readConfigs()).map(([guildId, config]) => [
        guildId,
        normalizeAutoroleConfig(config),
      ])
    );
  }
  return configs;
}

export function normalizeAutoroleConfig(input = {}) {
  const list = Array.isArray(input?.roleIds) ? input.roleIds : [];
  return {
    roleIds: [...new Set(list.map(String).filter(Boolean))],
  };
}

function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const temporary = `${FILE}.tmp`;
  fs.writeFileSync(
    temporary,
    `${JSON.stringify(Object.fromEntries(getConfigs()), null, 2)}\n`
  );
  fs.renameSync(temporary, FILE);
  queueDataSync('Update autoroles');
}

export function getAutoroleConfig(guildId) {
  return normalizeAutoroleConfig(getConfigs().get(String(guildId)));
}

export function setAutoroleRoles(guildId, roleIds) {
  const id = String(guildId || '').trim();
  if (!id) throw new Error('guild ID is required');
  getConfigs().set(id, normalizeAutoroleConfig({ roleIds }));
  persist();
  return getAutoroleConfig(id);
}

export function addAutoroleRole(guildId, roleId) {
  const config = getAutoroleConfig(guildId);
  const roleIds = new Set(config.roleIds);
  roleIds.add(String(roleId));
  return setAutoroleRoles(guildId, [...roleIds]);
}

export function removeAutoroleRole(guildId, roleId) {
  const config = getAutoroleConfig(guildId);
  return setAutoroleRoles(
    guildId,
    config.roleIds.filter((role) => role !== String(roleId))
  );
}
