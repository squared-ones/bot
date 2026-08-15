import fs from 'node:fs';
import path from 'node:path';
import { queueDataSync, resolveDataDir } from './github-data.js';

const FILE = path.join(resolveDataDir(), 'tickets.json');

let store = null;

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { config: {}, tickets: {} };
    }
    return {
      config:
        parsed.config && typeof parsed.config === 'object' ? parsed.config : {},
      tickets:
        parsed.tickets && typeof parsed.tickets === 'object'
          ? parsed.tickets
          : {},
    };
  } catch {
    return { config: {}, tickets: {} };
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
  queueDataSync('Update tickets');
}

export function normalizeTicketConfig(input = {}) {
  input = input && typeof input === 'object' ? input : {};
  return {
    categoryId:
      typeof input.categoryId === 'string' && input.categoryId.trim()
        ? input.categoryId.trim()
        : null,
    staffRoleId:
      typeof input.staffRoleId === 'string' && input.staffRoleId.trim()
        ? input.staffRoleId.trim()
        : null,
    panelChannelId:
      typeof input.panelChannelId === 'string' && input.panelChannelId.trim()
        ? input.panelChannelId.trim()
        : null,
    panelMessageId:
      typeof input.panelMessageId === 'string' && input.panelMessageId.trim()
        ? input.panelMessageId.trim()
        : null,
  };
}

export function getTicketConfig(guildId) {
  return normalizeTicketConfig(getStore().config[String(guildId)]);
}

export function setTicketConfig(guildId, input) {
  const id = String(guildId || '').trim();
  if (!id) throw new Error('guild ID is required');
  const existing = getTicketConfig(id);
  const config = normalizeTicketConfig({
    ...existing,
    ...(input && typeof input === 'object' ? input : {}),
  });
  getStore().config[id] = config;
  persist();
  return config;
}

export function savePanel(guildId, channelId, messageId) {
  const config = getTicketConfig(guildId);
  return setTicketConfig(guildId, {
    ...config,
    panelChannelId: String(channelId),
    panelMessageId: String(messageId),
  });
}

export function trackTicket(guildId, channelId, ownerId) {
  const tickets = getStore().tickets;
  const guildTickets = (tickets[String(guildId)] ||= {});
  guildTickets[String(channelId)] = {
    ownerId: String(ownerId),
    createdAt: new Date().toISOString(),
  };
  persist();
}

export function untrackTicket(guildId, channelId) {
  const tickets = getStore().tickets[String(guildId)];
  if (!tickets) return false;
  const existed = Object.prototype.hasOwnProperty.call(
    tickets,
    String(channelId)
  );
  delete tickets[String(channelId)];
  if (Object.keys(tickets).length === 0) delete getStore().tickets[String(guildId)];
  if (existed) persist();
  return existed;
}

export function getOpenTickets(guildId) {
  return { ...(getStore().tickets[String(guildId)] || {}) };
}
