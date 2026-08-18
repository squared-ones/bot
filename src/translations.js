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
  // Dashboard chrome (topbar, nav, overview stats).
  'web.dash.topbar.current-server': 'Current server',
  'web.dash.topbar.change': 'change',
  'web.dash.topbar.logout': 'logout',
  'web.dash.topbar.translate': 'Translate',
  'web.dash.nav.overview': 'Overview',
  'web.dash.nav.servers': 'Servers',
  'web.dash.nav.moderation': 'Moderation',
  'web.dash.nav.verification': 'Verification',
  'web.dash.nav.vpn-blocklist': 'VPN Blocklist',
  'web.dash.nav.appeals': 'Appeals',
  'web.dash.nav.rules': 'Rules',
  'web.dash.nav.voting': 'Voting',
  'web.dash.nav.leveling': 'Leveling',
  'web.dash.nav.tickets': 'Tickets',
  'web.dash.nav.automation': 'Automation',
  'web.dash.nav.billing': 'Billing',
  'web.dash.nav.account': 'Account',
  'web.dash.nav.community': 'Community',
  'web.dash.nav.settings': 'Settings',
  'web.dash.group.dashboard': 'Dashboard',
  'web.dash.group.tools': 'Tools',
  'web.dash.group.review': 'Review',
  'web.dash.group.engagement': 'Engagement',
  'web.dash.group.support': 'Support',
  'web.dash.group.automation': 'Automation',
  'web.dash.group.plan': 'Plan',
  'web.dash.group.account': 'Account',
  'web.dash.stat.status': 'Bot status',
  'web.dash.stat.servers': 'Servers',
  'web.dash.stat.members': 'Members',
  'web.dash.stat.rules': 'Rules',
  'web.dash.stat.uptime': 'Uptime',
  'web.dash.stat.votes-total': 'Total votes',
  'web.dash.stat.votes-weighted': 'Weighted votes',
  'web.dash.stat.votes-topgg': 'Top.gg',
  'web.dash.stat.votes-dbl': 'Discord Bot List',
  'web.dash.stat.balance': 'Your balance',
  'web.dash.stat.signed-in-as': 'Signed in as',
  'web.dash.vote.webhooks-help':
    'Configure these URLs in the Top.gg and Discord Bot List dashboards. Keep the webhook secrets in your environment variables.',
  'web.dash.vote.rewards-help':
    'Voters receive a private DM reminder after their 12-hour cooldown. Vote rewards are currently disabled.',
  'web.dash.rules.title': 'Title',
  'web.dash.rules.title-placeholder': 'e.g. No mic spam',
  'web.dash.rules.desc': 'Description',
  'web.dash.rules.desc-placeholder': 'Supports **bold**, *italic*, `code`, etc.',
  'web.dash.rules.deploy': 'Deploy rule',
  'web.dash.verify.help':
    'Configure verification independently for every server. Saving without a verified role disables verification for that server.',
  'web.dash.verify.role': 'Verified role',
  'web.dash.verify.block-vpn': 'Block VPN, proxy, Tor, and known datacenter networks',
  'web.dash.verify.min-age': 'Minimum account age (days)',
  'web.dash.verify.action': 'Flagged member action',
  'web.dash.verify.require-avatar': "Flag members using Discord's default avatar",
  'web.dash.verify.burst': 'Join burst threshold (0 = off)',
  'web.dash.verify.window': 'Join burst window (seconds)',
  'web.dash.verify.log-channel': 'Detection log channel',
  'web.dash.verify.save': 'Save configuration',
  'web.dash.vpn.help':
    'Flag an exact IPv4 or IPv6 address. Manually flagged addresses are blocked for every server during web verification and synced to the private data repository.',
  'web.dash.vpn.ip': 'IP address',
  'web.dash.vpn.flag': 'Flag as VPN',
  'web.dash.mod.member': 'Member',
  'web.dash.mod.search-placeholder': 'Search members…',
  'web.dash.mod.selected': 'Selected',
  'web.dash.mod.reason': 'Reason',
  'web.dash.mod.reason-placeholder': 'Optional reason',
  'web.dash.mod.ban': 'Ban',
  'web.dash.mod.kick': 'Kick',
  'web.dash.mod.timeout': 'Timeout',
  'web.dash.mod.duration': 'Timeout duration',
  'web.dash.mod.duration-placeholder': '30s / 10m / 1h / 2d',
  'web.dash.mod.channel': 'Channel (purge)',
  'web.dash.mod.amount': 'Amount',
  'web.dash.mod.purge': 'Purge',
  'web.dash.mod.message': 'Message',
  'web.dash.mod.message-placeholder': 'Message to send to the selected member…',
  'web.dash.mod.send': 'Send DM',
  'web.dash.field.current-server': 'Current server',
  'web.dash.automation.restore': "Restore a member's roles when they rejoin",
  'web.dash.automation.autoroles': 'Autoroles (assigned to new members)',
  'web.dash.automation.save': 'Save automation',
  'web.dash.tickets.category': 'Ticket category',
  'web.dash.tickets.staffrole': 'Staff role',
  'web.dash.tickets.save': 'Save ticket config',
  'web.dash.leveling.channel': 'Level-up channel',
  'web.dash.leveling.announce': 'Announce level-ups in the selected channel',
  'web.dash.leveling.voicexp': 'Voice XP per minute',
  'web.dash.leveling.save': 'Save leveling config',
  'web.dash.leveling.reset': 'Reset all XP',
  'web.dash.billing.grant-label': 'Grant credits (owner)',
  'web.dash.billing.grant-user-placeholder': 'Discord user ID',
  'web.dash.billing.amount': 'Amount',
  'web.dash.billing.grant': 'Grant',
  'web.dash.account.username': 'Username',
  'web.dash.account.update-username': 'Update username',
  'web.dash.account.current-password': 'Current password',
  'web.dash.account.new-password': 'New password',
  'web.dash.account.change-password': 'Change password',
  'web.dash.account.password': 'Password',
  'web.dash.account.setup-help':
    'Add a username and password so you can sign in even without Discord.',
  'web.dash.account.create-credentials': 'Create credentials',
  'web.dash.modal.server-help':
    'Choose the server you want to manage. This selection is used across moderation and verification tools.',
  'web.dash.nav.apikeys': 'API keys',
  'web.dash.group.developer': 'Developer',
  'web.dash.apikeys.help':
    "Create a key so another bot or app can talk to Squared One's API with your permissions. Keys have full control — treat them like a password. The full key is shown only once.",
  'web.dash.apikeys.name': 'Key name',
  'web.dash.apikeys.name-placeholder': 'My bot',
  'web.dash.apikeys.create': 'Create key',
  'web.dash.apikeys.reveal-note': 'Copy this key now — it will not be shown again.',
  'web.dash.apikeys.copy': 'Copy',
  'web.dash.nav.review-translations': 'Review translations',
  'web.dash.review.owner-only':
    'Only the application owner can approve or reject translations.',
  'web.dash.nav.workers': 'Workers',
  'web.dash.workers.network-shards': 'Network shards',
  'web.dash.workers.online': 'Online workers',
  'web.dash.workers.credit-rate': 'Credit rate',
  'web.dash.workers.help':
    'Create a worker token to run one of the bot\'s Discord shards from your own machine. Every hour of uptime earns you credits. The full token is shown only once.',
  'web.dash.workers.name': 'Worker name',
  'web.dash.workers.name-placeholder': 'My PC',
  'web.dash.workers.create': 'Create worker',
  'web.dash.workers.reveal-note': 'Copy this token now — it will not be shown again.',
  'web.dash.workers.copy': 'Copy',
  'web.dash.workers.run-help':
    'Download the worker app for your platform, extract it, paste your token into the .env file, and run it. Every hour of uptime earns you credits.',
  'web.dash.workers.windows': 'Windows',
  'web.dash.workers.linux': 'Linux',
  'web.dash.workers.macos': 'macOS',
  'web.dash.nav.discordbotclient': 'DiscordBotClient',
  'web.dash.group.client': 'Client',
  'web.dash.botclient.about':
    'DiscordBotClient signs into Discord with a bot token and uses it like a regular account — view and manage guilds and channels, read and send messages — right in your browser.',
  'web.dash.botclient.open': 'Open web client',
  'web.dash.botclient.features':
    'Sharding · guild & channel management · messages (send, history, embeds, components, reactions, polls) · voice · nitro · direct messages.',
  'web.dash.botclient.tos':
    'Heads up: third-party clients are discouraged and against the Discord Terms of Service. Use at your own risk.',
  'web.dash.botclient.setup-help':
    "Open the web client and sign in with your bot token. Enable the MessageContent intent (other intents are optional) — enable all intents if you want the member list and statuses.",
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
