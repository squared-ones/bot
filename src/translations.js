import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Locale } from 'discord.js';
import { queueDataSync, resolveDataDir } from './github-data.js';
import { grantCredits } from './credits.js';

const TRANSLATIONS_FILE = path.join(resolveDataDir(), 'translations.json');
const MAX_VALUE_LENGTH = 1000;

// SQ credits awarded to a contributor for each approved translation string.
// Set TRANSLATION_REWARD=0 to disable rewards.
const parsedReward = Number(process.env.TRANSLATION_REWARD);
export const TRANSLATION_REWARD = Number.isFinite(parsedReward)
  ? Math.max(0, Math.floor(parsedReward))
  : 5;

// Discord's fixed set of locales used for slash-command localization. Web
// translations may use any locale code — these are just the guaranteed set.
export const DISCORD_LOCALES = Object.freeze([...Object.values(Locale)].sort());

// Starter catalog of reply strings. Slash-command names/descriptions are
// registered automatically from the command definitions in bot.js.
const SEED_CATALOG = {
  'reply.ping': '🏓 Pong! WebSocket: **{ws}ms** · Round-trip: **{rt}ms**',
  'reply.language.set': 'Your language is now **{locale}**.',
  'reply.language.list':
    'Supported locales: {locales}. Use `/language <locale>` to switch.',
  'reply.translate.submitted':
    'Thanks! Your translation was submitted for review and earns **{reward} SQ** once approved.',
  'reply.translate.help':
    'Submit a human translation and earn SQ when it is approved. Translations are reviewed by a person — no machine translation.',
  // Web UI strings (used by public/i18n.js via [data-i18n] attributes).
  'web.nav.pricing': 'Pricing',
  'web.nav.support': 'Support',
  'web.nav.dashboard': 'Open dashboard',
  'web.nav.translate': 'Translate',
  'web.nav.invite': 'Add to Discord',
  'web.hero.sub':
    'Squared One is the multitool Discord bot — moderation, rules, verification, tickets, leveling, and more, all managed from one red-hot dashboard.',
  'web.hero.cta.dashboard': 'Open dashboard',
  'web.hero.cta.features': 'See features',
};

let store = null;

function emptyStore() {
  return { catalog: {}, translations: {}, pending: [], users: {} };
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(TRANSLATIONS_FILE, 'utf8'));
    return {
      catalog:
        parsed && typeof parsed.catalog === 'object' && !Array.isArray(parsed.catalog)
          ? parsed.catalog
          : {},
      translations:
        parsed && typeof parsed.translations === 'object' && !Array.isArray(parsed.translations)
          ? parsed.translations
          : {},
      pending: Array.isArray(parsed?.pending) ? parsed.pending : [],
      users:
        parsed && typeof parsed.users === 'object' && !Array.isArray(parsed.users)
          ? parsed.users
          : {},
    };
  } catch {
    return emptyStore();
  }
}

function getStore() {
  if (!store) store = readStore();
  return store;
}

function saveStore() {
  fs.mkdirSync(path.dirname(TRANSLATIONS_FILE), { recursive: true });
  const temporary = `${TRANSLATIONS_FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(getStore(), null, 2)}\n`);
  fs.renameSync(temporary, TRANSLATIONS_FILE);
  queueDataSync('Update translations');
}

export function loadTranslations() {
  store = readStore();
  registerCatalog(SEED_CATALOG);
  return store;
}

function normalizeLocale(locale) {
  const raw = String(locale || '').trim();
  // BCP 47 tag, e.g. "en", "fr", "pt-BR", "zh-CN". Open set — any valid tag.
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(raw)) return null;
  return raw;
}

// ---------- Catalog ----------

// Merges key → English source strings into the catalog without overwriting
// existing entries. Returns the full catalog.
export function registerCatalog(entries) {
  const catalog = getStore().catalog;
  let changed = false;
  for (const [key, value] of Object.entries(entries || {})) {
    if (!key || typeof value !== 'string' || !value.trim()) continue;
    if (catalog[key] == null) {
      catalog[key] = value;
      changed = true;
    }
  }
  if (changed) saveStore();
  return { ...catalog };
}

export function getCatalog() {
  return { ...getStore().catalog };
}

export function getCatalogKeys() {
  return Object.keys(getStore().catalog).sort();
}

// ---------- Lookup ----------

// Translates a key for a locale, falling back to the English source. Never
// machine-translates — missing translations simply fall back to English.
export function t(locale, key, vars) {
  const store = getStore();
  const source = store.catalog[key];
  if (source == null) return key;
  const translated = store.translations[locale]?.[key];
  const text =
    typeof translated === 'string' && translated.trim() ? translated : source;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

export function getTranslation(locale, key) {
  const value = getStore().translations[locale]?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export function listLocales() {
  const set = new Set(DISCORD_LOCALES);
  for (const locale of Object.keys(getStore().translations)) {
    if (normalizeLocale(locale)) set.add(locale);
  }
  return [...set].sort();
}

// ---------- User locale preferences ----------

export function getUserLocale(userId) {
  const id = String(userId || '');
  const locale = getStore().users[id];
  return typeof locale === 'string' ? locale : null;
}

export function setUserLocale(userId, locale) {
  const normalized = normalizeLocale(locale);
  if (!normalized) throw new Error('invalid locale');
  getStore().users[String(userId || '')] = normalized;
  saveStore();
  return normalized;
}

// ---------- Contributions ----------

export function submitTranslation({ locale, key, value, contributorId }) {
  const normalized = normalizeLocale(locale);
  if (!normalized) throw new Error('invalid locale');
  if (!getStore().catalog[key]) throw new Error('unknown string key');
  const text = String(value || '').trim();
  if (!text) throw new Error('translation is empty');
  if (text.length > MAX_VALUE_LENGTH) throw new Error('translation is too long');

  const entry = {
    id: crypto.randomUUID(),
    locale: normalized,
    key,
    value: text,
    contributorId: String(contributorId || ''),
    submittedAt: new Date().toISOString(),
  };
  getStore().pending.push(entry);
  saveStore();
  return { ok: true, entry: { ...entry } };
}

export function approveTranslation(id) {
  const pending = getStore().pending;
  const index = pending.findIndex((entry) => entry.id === id);
  if (index === -1) throw new Error('pending translation not found');

  const entry = pending[index];
  pending.splice(index, 1);
  const translations = getStore().translations;
  translations[entry.locale] ??= {};
  translations[entry.locale][entry.key] = entry.value;
  saveStore();

  let reward = 0;
  if (entry.contributorId && TRANSLATION_REWARD > 0) {
    reward = grantCredits(entry.contributorId, TRANSLATION_REWARD);
  }
  return { ok: true, entry: { ...entry }, reward };
}

export function rejectTranslation(id) {
  const pending = getStore().pending;
  const index = pending.findIndex((entry) => entry.id === id);
  if (index === -1) throw new Error('pending translation not found');
  pending.splice(index, 1);
  saveStore();
  return { ok: true };
}

export function listPendingTranslations() {
  return getStore().pending.map((entry) => ({ ...entry }));
}

// Returns every string for a locale as { key: text }, falling back to the
// English source. Used by the client-side i18n loader.
export function getStringsForLocale(locale) {
  const store = getStore();
  const strings = { ...store.catalog };
  const translations = store.translations[locale] || {};
  for (const key of Object.keys(strings)) {
    if (typeof translations[key] === 'string' && translations[key].trim()) {
      strings[key] = translations[key];
    }
  }
  return strings;
}
