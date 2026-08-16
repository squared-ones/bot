import fs from 'node:fs';
import path from 'node:path';
import { queueDataSync, resolveDataDir } from './github-data.js';

const FILE = path.join(resolveDataDir(), 'achievements.json');
const DAY_MS = 24 * 60 * 60 * 1000;

// Achievement catalog. Each entry has a `trigger` that decides how progress
// advances:
//   metric  — driven by a monotonic counter (`metric` + `target`), e.g. votes.
//   streak  — driven by consecutive daily activity (`metric` = source key).
//   api     — unlocked explicitly via unlockAchievement(), no counter.
// `rarity` is 1 (common) through 4 (legendary).
export const ACHIEVEMENTS = [
  // Metric — votes
  {
    id: 'first-vote',
    name: 'First Vote',
    description: 'Cast your first vote for Squared One.',
    trigger: 'metric',
    metric: 'votes',
    target: 1,
    icon: '🗳️',
    rarity: 1,
  },
  {
    id: 'loyal-voter',
    name: 'Loyal Voter',
    description: 'Cast 5 votes for Squared One.',
    trigger: 'metric',
    metric: 'votes',
    target: 5,
    icon: '⭐',
    rarity: 2,
  },
  {
    id: 'vote-champion',
    name: 'Vote Champion',
    description: 'Cast 25 votes for Squared One.',
    trigger: 'metric',
    metric: 'votes',
    target: 25,
    icon: '👑',
    rarity: 3,
  },
  // Streak — daily voting
  {
    id: 'vote-streak-7',
    name: 'Dedicated Voter',
    description: 'Vote 7 days in a row.',
    trigger: 'streak',
    metric: 'vote',
    target: 7,
    icon: '🔥',
    rarity: 3,
  },
  {
    id: 'vote-streak-30',
    name: 'Marathon Voter',
    description: 'Vote 30 days in a row.',
    trigger: 'streak',
    metric: 'vote',
    target: 30,
    icon: '💎',
    rarity: 4,
  },
  // Metric — translations
  {
    id: 'translator',
    name: 'Translator',
    description: 'Have a translation approved.',
    trigger: 'metric',
    metric: 'translations',
    target: 1,
    icon: '🌐',
    rarity: 2,
  },
  {
    id: 'polyglot',
    name: 'Polyglot',
    description: 'Have 10 translations approved.',
    trigger: 'metric',
    metric: 'translations',
    target: 10,
    icon: '🏅',
    rarity: 3,
  },
  // Metric — messages
  {
    id: 'chatterbox',
    name: 'Chatterbox',
    description: 'Send 100 messages.',
    trigger: 'metric',
    metric: 'messages',
    target: 100,
    icon: '💬',
    rarity: 2,
  },
  {
    id: 'socialite',
    name: 'Socialite',
    description: 'Send 1,000 messages.',
    trigger: 'metric',
    metric: 'messages',
    target: 1000,
    icon: '📣',
    rarity: 3,
  },
  // Metric — level
  {
    id: 'level-5',
    name: 'Level 5',
    description: 'Reach level 5.',
    trigger: 'metric',
    metric: 'level',
    target: 5,
    icon: '📈',
    rarity: 2,
  },
  {
    id: 'level-20',
    name: 'Level 20',
    description: 'Reach level 20.',
    trigger: 'metric',
    metric: 'level',
    target: 20,
    icon: '🚀',
    rarity: 3,
  },
  {
    id: 'level-50',
    name: 'Level 50',
    description: 'Reach level 50.',
    trigger: 'metric',
    metric: 'level',
    target: 50,
    icon: '🏆',
    rarity: 4,
  },
  // API-triggered
  {
    id: 'account-linked',
    name: 'Linked Up',
    description: 'Link your Discord account to the dashboard.',
    trigger: 'api',
    icon: '🔗',
    rarity: 2,
  },
  {
    id: 'pro-subscriber',
    name: 'Going Pro',
    description: 'Subscribe a server to the Pro plan.',
    trigger: 'api',
    icon: '💳',
    rarity: 3,
  },
];

let store = null;

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return {
      users:
        parsed && typeof parsed.users === 'object' && !Array.isArray(parsed.users)
          ? parsed.users
          : {},
    };
  } catch {
    return { users: {} };
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
  queueDataSync('Update achievements');
}

function userRecord(userId, create = false) {
  const users = getStore().users;
  const id = String(userId || '');
  let record = users[id];
  if (!record && create) {
    record = { metrics: {}, streaks: {}, achieved: {} };
    users[id] = record;
  }
  return record;
}

function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function previousDayKey(ts) {
  return new Date(ts - DAY_MS).toISOString().slice(0, 10);
}

function unlock(record, def) {
  record.achieved[def.id] = new Date().toISOString();
  return def.id;
}

// Advances a metric to at least `nextValue`, unlocking any metric achievements
// whose target is now met. Returns the ids newly unlocked by this call.
function applyProgress(userId, key, nextValue) {
  const id = String(userId || '');
  if (!id) return [];
  const next = Math.max(0, Math.floor(Number(nextValue) || 0));
  const record = userRecord(id, true);
  const prev = Math.max(0, Math.floor(Number(record.metrics[key]) || 0));
  if (next <= prev) return [];

  record.metrics[key] = next;
  const unlocked = [];
  for (const def of ACHIEVEMENTS) {
    if (
      def.trigger !== 'metric' ||
      def.metric !== key ||
      next < def.target ||
      record.achieved[def.id]
    ) {
      continue;
    }
    unlocked.push(unlock(record, def));
  }
  persist();
  return unlocked;
}

// Sets a metric's value to `value` (monotonic — never decreases).
export function recordMetric(userId, key, value) {
  return applyProgress(userId, key, value);
}

// Adds `amount` to a metric's current value.
export function incrementMetric(userId, key, amount = 1) {
  const id = String(userId || '');
  if (!id) return [];
  const current = Number(userRecord(id)?.metrics?.[key]) || 0;
  return applyProgress(id, key, current + Math.max(0, Math.floor(Number(amount) || 0)));
}

// Records one day of activity for a streak source (e.g. 'vote'). Consecutive
// days extend the streak; a missed day resets it. Returns newly unlocked ids.
export function recordStreak(userId, source, now = Date.now()) {
  const id = String(userId || '');
  const key = String(source || '');
  if (!id || !key) return [];

  const record = userRecord(id, true);
  record.streaks = record.streaks || {};
  const entry = record.streaks[key] || { last: null, current: 0, best: 0 };
  const today = dayKey(now);

  // Already counted today — nothing to do (and nothing to persist).
  if (entry.last === today) return [];

  if (entry.last === previousDayKey(now)) {
    entry.current += 1;
  } else {
    entry.current = 1;
  }
  entry.last = today;
  entry.best = Math.max(entry.best || 0, entry.current);
  record.streaks[key] = entry;

  const unlocked = [];
  for (const def of ACHIEVEMENTS) {
    if (
      def.trigger !== 'streak' ||
      def.metric !== key ||
      entry.current < def.target ||
      record.achieved[def.id]
    ) {
      continue;
    }
    unlocked.push(unlock(record, def));
  }
  persist();
  return unlocked;
}

// Explicitly unlocks an api-triggered achievement. Returns true when it was
// newly unlocked (false if unknown, non-api, or already unlocked).
export function unlockAchievement(userId, achievementId) {
  const id = String(userId || '');
  if (!id) return false;
  const def = ACHIEVEMENTS.find((entry) => entry.id === achievementId);
  if (!def || def.trigger !== 'api') return false;
  const record = userRecord(id, true);
  if (record.achieved[def.id]) return false;
  unlock(record, def);
  persist();
  return true;
}

// Full per-user list with progress and unlock state, in catalog order.
export function getUserAchievements(userId) {
  const record = userRecord(userId);
  const metrics = record?.metrics || {};
  const streaks = record?.streaks || {};
  const achieved = record?.achieved || {};
  return ACHIEVEMENTS.map((def) => {
    const unlocked = Boolean(achieved[def.id]);
    let metricValue = 0;
    let progress = 0;
    if (def.trigger === 'api') {
      progress = unlocked ? 1 : 0;
    } else if (def.trigger === 'streak') {
      metricValue = Math.max(0, Math.floor(Number(streaks[def.metric]?.current) || 0));
      progress = Math.min(1, metricValue / def.target);
    } else {
      metricValue = Math.max(0, Math.floor(Number(metrics[def.metric]) || 0));
      progress = Math.min(1, metricValue / def.target);
    }
    return {
      ...def,
      metricValue,
      progress,
      achieved: unlocked,
      achievedAt: unlocked ? achieved[def.id] : null,
    };
  });
}

// Summary for the dashboard: unlocked count, up to 3 highlighted (most recent)
// unlocked badges, and the full list (unlocked first, most recent first).
export function getUserSummary(userId) {
  const list = getUserAchievements(userId);
  const unlocked = list
    .filter((entry) => entry.achieved)
    .sort((a, b) => new Date(b.achievedAt) - new Date(a.achievedAt));
  const locked = list.filter((entry) => !entry.achieved);
  return {
    unlocked: unlocked.length,
    total: list.length,
    highlighted: unlocked.slice(0, 3),
    achievements: [...unlocked, ...locked],
  };
}
