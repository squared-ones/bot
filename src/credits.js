import fs from 'node:fs';
import path from 'node:path';
import { queueDataSync, resolveDataDir } from './github-data.js';

const CREDITS_FILE = path.join(resolveDataDir(), 'credits.json');
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// The internal currency. Balances and plan prices are denominated in this.
export const CURRENCY = { name: 'Square', code: 'SQ' };

// Credits awarded to a user for each non-duplicate vote on a bot list.
// Set VOTE_CREDIT_REWARD=0 to disable vote rewards.
const parsedVoteReward = Number(process.env.VOTE_CREDIT_REWARD);
export const VOTE_CREDIT_REWARD = Number.isFinite(parsedVoteReward)
  ? Math.max(0, Math.floor(parsedVoteReward))
  : 50;

// Free servers are limited to this many custom rules (rules are global, so the
// limit is applied against the acting user's highest plan).
export const FREE_CUSTOM_RULE_LIMIT = 10;

export const PLANS = {
  free: {
    key: 'free',
    name: 'Free',
    monthlyCost: 0,
    customRuleLimit: FREE_CUSTOM_RULE_LIMIT,
    description: 'Perfect for getting started',
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    monthlyCost: 500,
    customRuleLimit: null, // unlimited
    description: 'Best for active communities',
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    monthlyCost: null, // not purchasable with credits — contact sales
    customRuleLimit: null, // unlimited
    description: 'For networks and large teams',
  },
};

const PLAN_RANK = { free: 0, pro: 1, enterprise: 2 };

export function formatCredits(amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  return `${n.toLocaleString()} ${CURRENCY.code}`;
}

export function planRequiredError(featureLabel) {
  return `${featureLabel} requires the Pro plan — subscribe with /subscribe or the Billing dashboard (${formatCredits(
    PLANS.pro.monthlyCost
  )}/month).`;
}

let store = null;

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf8'));
    return {
      users:
        parsed && typeof parsed.users === 'object' && !Array.isArray(parsed.users)
          ? parsed.users
          : {},
      guilds:
        parsed && typeof parsed.guilds === 'object' && !Array.isArray(parsed.guilds)
          ? parsed.guilds
          : {},
    };
  } catch {
    return { users: {}, guilds: {} };
  }
}

function getStore() {
  if (!store) store = readStore();
  return store;
}

function saveStore() {
  fs.mkdirSync(path.dirname(CREDITS_FILE), { recursive: true });
  const temporary = `${CREDITS_FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(getStore(), null, 2)}\n`);
  fs.renameSync(temporary, CREDITS_FILE);
  queueDataSync('Update credits');
}

export function loadCredits() {
  store = readStore();
  return store;
}

// ---------- Balances ----------

export function getBalance(userId) {
  const raw = getStore().users[String(userId || '')];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function grantCredits(userId, amount) {
  const id = String(userId || '');
  if (!id) throw new Error('user ID is required');
  const delta = Math.floor(Number(amount));
  if (!Number.isFinite(delta) || delta === 0) throw new Error('invalid amount');
  const next = Math.max(0, getBalance(id) + delta);
  getStore().users[id] = next;
  saveStore();
  return next;
}

// ---------- Subscriptions (per guild) ----------

// Returns the active subscription for a guild, or null when it is free or
// expired. An `expiresAt` of null means the plan never expires (enterprise).
function activeSub(guildId) {
  const sub = getStore().guilds[String(guildId || '')];
  if (!sub || !PLANS[sub.plan]) return null;
  if (typeof sub.expiresAt === 'number' && sub.expiresAt <= Date.now()) {
    return null;
  }
  return sub;
}

export function getGuildPlan(guildId) {
  const sub = activeSub(guildId);
  return sub ? sub.plan : 'free';
}

export function getGuildSubscription(guildId) {
  const sub = activeSub(guildId);
  return sub ? { ...sub, guildId: String(guildId || '') } : null;
}

export function isPaid(guildId) {
  return getGuildPlan(guildId) !== 'free';
}

// Highest plan across every guild the user has subscribed. Used for the global
// custom-rule limit, which is not scoped to a single guild.
export function getUserPlan(userId) {
  const id = String(userId || '');
  let best = 'free';
  for (const [guildId, sub] of Object.entries(getStore().guilds)) {
    if (!sub || sub.ownerId !== id || !PLANS[sub.plan]) continue;
    if (typeof sub.expiresAt === 'number' && sub.expiresAt <= Date.now()) continue;
    if (PLAN_RANK[sub.plan] > PLAN_RANK[best]) best = sub.plan;
  }
  return best;
}

export function subscribeGuild({ userId, guildId, plan = 'pro', months = 1 }) {
  const planInfo = PLANS[plan];
  if (!planInfo) throw new Error('unknown plan');
  if (planInfo.monthlyCost == null) {
    throw new Error('this plan is not purchasable with credits');
  }

  const monthCount = Math.min(12, Math.max(1, Math.floor(Number(months) || 1)));
  const cost = planInfo.monthlyCost * monthCount;
  const uid = String(userId || '');
  const gid = String(guildId || '');
  const balance = getBalance(uid);

  if (balance < cost) {
    return {
      ok: false,
      error: `Insufficient credits — ${planInfo.name} for ${monthCount} month${
        monthCount === 1 ? '' : 's'
      } costs ${formatCredits(cost)}, but you have ${formatCredits(balance)}.`,
    };
  }

  getStore().users[uid] = balance - cost;
  const existing = activeSub(gid);
  const base = existing ? Math.max(Date.now(), existing.expiresAt) : Date.now();
  const expiresAt = base + monthCount * MONTH_MS;
  getStore().guilds[gid] = {
    plan,
    ownerId: uid,
    expiresAt,
    subscribedAt: existing ? existing.subscribedAt : Date.now(),
  };
  saveStore();
  return { ok: true, plan, expiresAt, cost, balance: balance - cost };
}

export function cancelSubscription(guildId) {
  const gid = String(guildId || '');
  if (!getStore().guilds[gid]) return false;
  delete getStore().guilds[gid];
  saveStore();
  return true;
}

// Grants enterprise (never expires) directly — used by the application owner.
export function grantEnterprise(guildId, ownerId) {
  const gid = String(guildId || '');
  const existing = activeSub(gid);
  getStore().guilds[gid] = {
    plan: 'enterprise',
    ownerId: String(ownerId || ''),
    expiresAt: null,
    subscribedAt: existing ? existing.subscribedAt : Date.now(),
    granted: true,
  };
  saveStore();
  return getStore().guilds[gid];
}

export function listGuildSubscriptions() {
  return Object.entries(getStore().guilds).map(([guildId, sub]) => ({
    guildId,
    plan: sub.plan,
    ownerId: sub.ownerId,
    expiresAt: sub.expiresAt,
  }));
}
