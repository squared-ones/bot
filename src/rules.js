import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { queueDataSync, resolveDataDir } from './github-data.js';

const DATA_DIR = resolveDataDir();
const RULES_FILE = path.join(DATA_DIR, 'rules.json');

// Default rules ship with the bot and can never be removed.
const DEFAULT_RULES = [
  {
    id: 'default-1',
    title: '📜 Community Rules & Guidelines',
    description:
    'Welcome to our Discord community. By joining this server, you agree to follow all rules outlined below. These rules are in place to ensure that everyone can enjoy a safe, welcoming, respectful, and enjoyable environment. Failure to comply with these rules may result in moderation actions, including warnings, mutes, kicks, temporary bans, permanent bans, or any other action deemed appropriate by the moderation team.' +
    'The moderation team reserves the right to interpret these rules and make decisions in situations not explicitly covered below. Attempting to exploit loopholes or technicalities within these rules will not exempt members from moderation.',
  },
  {
    id: 'default-2',
    title: '1. Respect All Members',
    description:
      'Every member deserves to be treated with respect regardless of their age, nationality, race, ethnicity, religion, gender, sexual orientation, identity, opinions, or experience.' +
      'Members must:' +
      'Remain polite and respectful.' +
    '- Accept differing opinions.' +
    '- Engage in civil discussions.' + 
    '- Avoid unnecessary arguments.' +
    '- Treat newcomers with kindness.' +
    '- Respect moderators and staff members.',

  },
  {
    id: 'default-3',
    title: 'No NSFW content',
    description:
      'Keep all content safe for work. NSFW material is strictly prohibited.',
  },
  {
    id: 'default-4',
    title: 'No advertising',
    description:
      'Do not advertise other servers, products, or services in this server.',
  },
  {
    id: 'default-5',
    title: 'Follow Discord ToS',
    description:
      'Abide by Discord\u2019s Terms of Service and Community Guidelines at all times.',
  },
  {
    id: 'default-6',
    title: 'Listen to moderators',
    description: 'Follow instructions from moderators and staff members.',
  },
];

let customRules = [];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveRules() {
  ensureDataDir();
  fs.writeFileSync(RULES_FILE, JSON.stringify({ customRules }, null, 2));
  queueDataSync('Update rules');
}

export function loadRules() {
  ensureDataDir();
  if (fs.existsSync(RULES_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
      customRules = Array.isArray(raw.customRules) ? raw.customRules : [];
    } catch {
      customRules = [];
    }
  }
  return getAllRules();
}

export function getAllRules() {
  return [...DEFAULT_RULES, ...customRules];
}

export function getCustomRules() {
  return [...customRules];
}

export function addCustomRule(title, description) {
  const rule = {
    id: crypto.randomUUID(),
    title: String(title).trim(),
    description: String(description).trim(),
    custom: true,
    createdAt: new Date().toISOString(),
  };
  customRules.push(rule);
  saveRules();
  return rule;
}

export function removeCustomRule(id) {
  const idx = customRules.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  customRules.splice(idx, 1);
  saveRules();
  return true;
}

export function isDefaultRule(id) {
  return DEFAULT_RULES.some((r) => r.id === id);
}
