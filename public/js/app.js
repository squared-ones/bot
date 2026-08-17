const $ = (sel) => document.querySelector(sel);

const el = {
  statusDot: $('#status-dot'),
  statusText: $('#status-text'),
  statStatus: $('#stat-status'),
  statServers: $('#stat-servers'),
  statMembers: $('#stat-members'),
  statRules: $('#stat-rules'),
  statUptime: $('#stat-uptime'),
  achievementsCount: $('#achievements-count'),
  achievementsUnlocked: $('#achievements-unlocked'),
  achievementsHighlight: $('#achievements-highlight'),
  achievementsList: $('#achievements-list'),
  rulesList: $('#rules-list'),
  rulesCount: $('#rules-count'),
  form: $('#add-rule-form'),
  title: $('#rule-title'),
  desc: $('#rule-desc'),
  submit: $('#add-rule-form .btn-primary'),
  footerTime: $('#footer-time'),
  userChip: $('#user-chip'),
  userName: $('#user-name'),
  logoutLink: $('#logout-link'),
  detailUser: $('#detail-user'),
  serverSwitcher: $('#server-switcher'),
  serverSwitcherName: $('#server-switcher-name'),
  serverModal: $('#server-modal'),
  serverModalClose: $('#server-modal-close'),
  onboardingModal: $('#onboarding-modal'),
  onboardingStatusText: $('#onboard-status-text'),
  onboardingStatusIcon: $('#onboard-status-icon'),
  onboardingBarFill: $('#onboard-bar-fill'),
  onboardingStart: $('#onboarding-start'),
  serverPickerList: $('#server-picker-list'),
  serversList: $('#servers-list'),
  modBody: $('#mod-body'),
  modStatus: $('#mod-status'),
  modUserSearch: $('#mod-user-search'),
  modUserList: $('#mod-user-list'),
  modSelected: $('#mod-selected'),
  modSelectedName: $('#mod-selected-name'),
  modReason: $('#mod-reason'),
  modDuration: $('#mod-duration'),
  modChannel: $('#mod-channel'),
  modAmount: $('#mod-amount'),
  modBan: $('#mod-ban'),
  modKick: $('#mod-kick'),
  modTimeout: $('#mod-timeout'),
  modPurge: $('#mod-purge'),
  modMessageText: $('#mod-message-text'),
  modMessage: $('#mod-message'),
  verificationForm: $('#verification-form'),
  verificationStatus: $('#verification-status'),
  verificationRole: $('#verification-role'),
  verificationBlockVpn: $('#verification-block-vpn'),
  verificationMinAge: $('#verification-min-age'),
  verificationAction: $('#verification-action'),
  verificationRequireAvatar: $('#verification-require-avatar'),
  verificationJoinBurst: $('#verification-join-burst'),
  verificationJoinWindow: $('#verification-join-window'),
  verificationLogChannel: $('#verification-log-channel'),
  verificationSave: $('#verification-save'),
  vpnBlocklistForm: $('#vpn-blocklist-form'),
  vpnIp: $('#vpn-ip'),
  vpnFlag: $('#vpn-flag'),
  vpnBlocklist: $('#vpn-blocklist'),
  vpnBlocklistStatus: $('#vpn-blocklist-status'),
  voteTotal: $('#vote-total'),
  voteWeighted: $('#vote-weighted'),
  voteTopgg: $('#vote-topgg'),
  voteDbl: $('#vote-dbl'),
  voteStatus: $('#vote-status'),
  voteRecent: $('#vote-recent'),
  automationGuild: $('#automation-guild'),
  automationForm: $('#automation-form'),
  automationStatus: $('#automation-status'),
  automationRestore: $('#automation-restore'),
  automationRoles: $('#automation-roles'),
  automationSave: $('#automation-save'),
  ticketsGuild: $('#tickets-guild'),
  ticketsForm: $('#tickets-form'),
  ticketsStatus: $('#tickets-status'),
  ticketsCategory: $('#tickets-category'),
  ticketsStaffRole: $('#tickets-staffrole'),
  ticketsSave: $('#tickets-save'),
  appealsGuild: $('#appeals-guild'),
  appealsStatus: $('#appeals-status'),
  appealsList: $('#appeals-list'),
  levelingGuild: $('#leveling-guild'),
  levelingForm: $('#leveling-form'),
  levelingStatus: $('#leveling-status'),
  levelingChannel: $('#leveling-channel'),
  levelingAnnounce: $('#leveling-announce'),
  levelingVoiceXp: $('#leveling-voicexp'),
  levelingSave: $('#leveling-save'),
  levelingReset: $('#leveling-reset'),
  levelingLeaderboard: $('#leveling-leaderboard'),
  billingStatus: $('#billing-status'),
  billingCurrency: $('#billing-currency'),
  billingBalance: $('#billing-balance'),
  billingOwner: $('#billing-owner'),
  billingGrantForm: $('#billing-grant-form'),
  billingGrantUser: $('#billing-grant-user'),
  billingGrantAmount: $('#billing-grant-amount'),
  billingGuilds: $('#billing-guilds'),
  accountStatus: $('#account-status'),
  accountIdentity: $('#account-identity'),
  accountAuthTag: $('#account-auth-tag'),
  accountLocalPanel: $('#account-local-panel'),
  accountDiscordPanel: $('#account-discord-panel'),
  accountDiscordStatus: $('#account-discord-status'),
  accountDiscordCopy: $('#account-discord-copy'),
  accountDiscordActions: $('#account-discord-actions'),
  accountUsername: $('#account-username'),
  accountUsernameForm: $('#account-username-form'),
  accountPasswordForm: $('#account-password-form'),
  accountCurrentPassword: $('#account-current-password'),
  accountNewPassword: $('#account-new-password'),
  accountSetupForm: $('#account-setup-form'),
  accountSetupUsername: $('#account-setup-username'),
  accountSetupPassword: $('#account-setup-password'),
  apikeyForm: $('#apikey-form'),
  apikeyName: $('#apikey-name'),
  apikeyReveal: $('#apikey-reveal'),
  apikeyValue: $('#apikey-value'),
  apikeyCopy: $('#apikey-copy'),
  apikeyList: $('#apikey-list'),
  reviewOwnerNote: $('#review-owner-note'),
  reviewTranslationsList: $('#review-translations-list'),
};

// Fetch wrapper that bounces to the login page when the session expires.
async function apiFetch(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('unauthorized');
  }
  return res;
}

async function loadSession() {
  try {
    const res = await apiFetch('/api/session');
    if (!res.ok) return;
    const data = await res.json();
    if (data.user && data.user.username) {
      el.userName.textContent = data.user.username;
      el.detailUser.textContent = data.user.username;
      el.userChip.hidden = false;
      el.logoutLink.hidden = false;
      initOnboarding();
    }
  } catch {
    // Unauthorized redirect is handled by apiFetch.
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Minimal Discord-style markdown renderer (safe: HTML is escaped first).
function renderMarkdown(text) {
  let s = escapeHtml(text);

  // Fenced + inline code blocks are extracted first so their contents
  // aren't touched by the inline formatting rules below.
  const blocks = [];
  s = s.replace(/```([\s\S]*?)```/g, (m, code) => {
    const i = blocks.push(`<pre><code>${code.trim()}</code></pre>`) - 1;
    return `\u0000B${i}\u0000`;
  });
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (m, code) => {
    const i = codes.push(`<code>${code}</code>`) - 1;
    return `\u0000I${i}\u0000`;
  });

  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<u>$1</u>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );

  s = s
    .replace(/\u0000B(\d+)\u0000/g, (m, i) => blocks[+i])
    .replace(/\u0000I(\d+)\u0000/g, (m, i) => codes[+i]);

  return s.replace(/\n/g, '<br>');
}

function formatUptime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// Thin wrapper over the shared notification system (public/notifications.js).
// `kind` is 'ok' (success), 'err' (error), or any Notify variant.
function showToast(message, kind = 'ok') {
  const variant = kind === 'err' ? 'error' : kind === 'ok' ? 'success' : kind;
  window.Notify.show({ description: message, variant });
}

function setBotStatus(connected) {
  el.statusDot.className = 'dot ' + (connected ? 'online' : 'offline');
  el.statusText.textContent = connected ? 'ONLINE' : 'OFFLINE';
  el.statStatus.textContent = connected ? 'ONLINE' : 'OFFLINE';
  el.statStatus.style.color = connected ? 'var(--green)' : 'var(--red)';
}

// Animated number counter (motion/react CountingNumber adapted to vanilla JS).
// Tweens from the last shown value to `target` with an easeInOut curve, keeps
// the value stable across repeated polls, and respects reduced motion.
// `suffix` is appended after the formatted number (e.g. a currency code).
function animateCount(el, target, duration = 3000, suffix = '') {
  if (!el) return;
  target = Number(target) || 0;
  const from = typeof el._countValue === 'number' ? el._countValue : 0;
  const fmt = (n) => n.toLocaleString() + suffix;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el._countValue = target;
    el.textContent = fmt(target);
    return;
  }
  if (target === from) {
    el.textContent = fmt(target);
    return;
  }
  if (el._raf) cancelAnimationFrame(el._raf);
  const start = performance.now();
  const easeInOut = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const value = Math.round(from + (target - from) * easeInOut(t));
    el.textContent = fmt(value);
    el._countValue = value;
    if (t < 1) {
      el._raf = requestAnimationFrame(frame);
    } else {
      el._countValue = target;
      el.textContent = fmt(target);
    }
  }
  el._raf = requestAnimationFrame(frame);
}

// Restart the Overview stat counters from zero using their last known targets.
function replayCount(el) {
  if (!el || typeof el._countValue !== 'number') return;
  const target = el._countValue;
  el._countValue = 0;
  animateCount(el, target);
}

function replayOverviewCounters() {
  replayCount(el.statServers);
  replayCount(el.statMembers);
  replayCount(el.statRules);
}

let availableServers = [];
let selectedGuildId = localStorage.getItem('squared-one-selected-guild') || '';

function selectedServer() {
  return availableServers.find((server) => server.id === selectedGuildId) || null;
}

function updateServerSwitcher() {
  const server = selectedServer();
  el.serverSwitcherName.textContent = server?.name || 'Choose a server…';
  el.serverSwitcher.classList.toggle('has-selection', Boolean(server));
}

function renderServerPicker() {
  if (!availableServers.length) {
    el.serverPickerList.innerHTML =
      '<div class="empty">No servers are available. Make sure the bot is connected and you share a server with it.</div>';
    return;
  }
  el.serverPickerList.innerHTML = availableServers
    .map((server) => {
      const selected = server.id === selectedGuildId ? ' selected' : '';
      const letter = escapeHtml((server.name || '?').charAt(0).toUpperCase());
      return `
        <button type="button" class="server-picker-option${selected}" data-server-id="${escapeHtml(server.id)}">
          <span class="server-picker-letter">${letter}</span>
          <span class="server-picker-copy">
            <strong>${escapeHtml(server.name)}</strong>
            <small>${escapeHtml(server.id)}</small>
          </span>
          <span class="server-picker-check">${selected ? '✓' : '→'}</span>
        </button>`;
    })
    .join('');
}

function openServerPicker() {
  renderServerPicker();
  el.serverModal.hidden = false;
}

function closeServerPicker() {
  if (selectedServer()) el.serverModal.hidden = true;
}

function loadSelectedServerData() {
  if (!selectedGuildId) return;
  channelsLoaded = false;
  channelsData = null;
  modGuildsLoaded = false;
  verificationGuildsLoaded = false;
  automationGuildsLoaded = false;
  ticketsGuildsLoaded = false;
  appealsGuildsLoaded = false;
  levelingGuildsLoaded = false;
  loadChannels();
  loadModerationGuilds();
  loadVerificationGuilds();
  loadAutomationGuilds();
  loadTicketsGuilds();
  loadAppealsGuilds();
  loadLevelingGuilds();
}

function selectServer(guildId) {
  if (!availableServers.some((server) => server.id === guildId)) return;
  selectedGuildId = guildId;
  localStorage.setItem('squared-one-selected-guild', guildId);
  updateServerSwitcher();
  closeServerPicker();
  loadSelectedServerData();
}

function initializeServerContext(servers) {
  availableServers = servers || [];
  if (!availableServers.some((server) => server.id === selectedGuildId)) {
    selectedGuildId = '';
    localStorage.removeItem('squared-one-selected-guild');
  }
  updateServerSwitcher();
  if (selectedGuildId) {
    closeServerPicker();
    loadSelectedServerData();
  } else {
    openServerPicker();
  }
}

el.serverSwitcher.addEventListener('click', openServerPicker);
el.serverPickerList.addEventListener('click', (event) => {
  const option = event.target.closest('.server-picker-option');
  if (option) selectServer(option.dataset.serverId);
});
document.querySelectorAll('[data-close-server-modal]').forEach((element) => {
  element.addEventListener('click', closeServerPicker);
});

/* ---------- Onboarding (first login) ---------- */
const ONBOARDING_KEY = 'squared-one-onboarded';
let onboardingInit = false;

function closeOnboarding() {
  if (el.onboardingModal) el.onboardingModal.hidden = true;
}

function showOnboarding() {
  if (!el.onboardingModal) return;
  el.onboardingModal.hidden = false;

  const labels = ['Welcome aboard', 'Setting up your dashboard', "You're all set"];
  const icon = el.onboardingStatusIcon;
  const text = el.onboardingStatusText;
  const bar = el.onboardingBarFill;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (icon) icon.classList.remove('done');
  if (text) text.textContent = labels[0];
  if (bar) bar.style.width = '0%';

  if (reduced) {
    if (bar) bar.style.width = '100%';
    if (icon) icon.classList.add('done');
    if (text) text.textContent = labels[2];
  } else {
    const start = performance.now();
    const duration = 3000;
    const easeInOut = (t) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = easeInOut(t);
      if (bar) bar.style.width = (eased * 100).toFixed(1) + '%';
      if (text) {
        text.textContent = t < 0.5 ? labels[0] : t < 1 ? labels[1] : labels[2];
      }
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        if (icon) icon.classList.add('done');
        if (text) text.textContent = labels[2];
      }
    }
    requestAnimationFrame(tick);
  }

  try {
    localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    /* storage may be unavailable */
  }
}

function initOnboarding() {
  if (onboardingInit || !el.onboardingModal) return;
  onboardingInit = true;
  if (el.onboardingStart) {
    el.onboardingStart.addEventListener('click', closeOnboarding);
  }
  document.querySelectorAll('[data-close-onboarding]').forEach((element) => {
    element.addEventListener('click', closeOnboarding);
  });
  let seen = false;
  try {
    seen = localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    /* ignore */
  }
  if (!seen) showOnboarding();
}

let rules = [];

function renderRules() {
  if (rules.length === 0) {
    el.rulesList.innerHTML =
      '<div class="empty">No rules loaded. Add one below or restart to load defaults.</div>';
    el.rulesCount.textContent = '0 entries';
    el.statRules._countValue = 0;
    el.statRules.textContent = '0';
    return;
  }

  el.rulesList.innerHTML = rules
    .map((r, i) => {
      const tag = r.custom
        ? '<span class="tag custom">CUSTOM</span>'
        : '<span class="tag default">DEFAULT</span>';
      const del = r.custom
        ? `<button class="btn-icon" data-id="${escapeHtml(r.id)}" title="Delete rule">✕ REMOVE</button>`
        : '';
      return `
        <div class="rule-card ${r.custom ? 'custom' : ''}">
          <div class="rule-idx">${String(i + 1).padStart(2, '0')}</div>
          <div class="rule-body">
            <div class="rule-title-row">
              <span class="rule-title">${renderMarkdown(r.title)}</span>
              ${tag}
            </div>
            <p class="rule-desc">${renderMarkdown(r.description)}</p>
          </div>
          <div class="rule-actions">${del}</div>
        </div>`;
    })
    .join('');

  el.rulesCount.textContent = `${rules.length} entries`;
  animateCount(el.statRules, rules.length);
}

async function loadRules() {
  try {
    const res = await apiFetch('/api/rules');
    if (!res.ok) throw new Error('failed to load rules');
    rules = await res.json();
    renderRules();
  } catch (err) {
    showToast('Failed to load rules.', 'err');
  }
}

/* ---------- Achievements / badges ---------- */
let knownBadgeIds = null;

function achievementBadge(entry) {
  const locked = !entry.achieved;
  return `
    <div class="achievement-badge${locked ? ' locked' : ''}" title="${escapeHtml(
      entry.description
    )}">
      <span class="achievement-badge-icon">${escapeHtml(entry.icon)}</span>
      <span class="achievement-badge-name">${escapeHtml(entry.name)}</span>
    </div>`;
}

function renderAchievements(data) {
  const highlighted = data.highlighted || [];
  const list = data.achievements || [];
  const unlocked = data.unlocked || 0;
  const total = data.total || list.length;

  // Toast for badges unlocked since the page loaded (first load just records
  // the baseline so existing badges don't re-announce).
  const unlockedIds = new Set(
    list.filter((entry) => entry.achieved).map((entry) => entry.id)
  );
  if (knownBadgeIds === null) {
    knownBadgeIds = unlockedIds;
  } else {
    for (const entry of list) {
      if (entry.achieved && !knownBadgeIds.has(entry.id)) {
        showToast(`🏅 Badge unlocked: ${entry.name}`, 'ok');
      }
    }
    knownBadgeIds = unlockedIds;
  }

  el.achievementsUnlocked.textContent = String(unlocked);
  el.achievementsCount.textContent = `${unlocked}/${total} unlocked`;

  el.achievementsHighlight.innerHTML = highlighted.length
    ? highlighted.map(achievementBadge).join('')
    : '<div class="empty">No badges yet — vote, chat, or translate to unlock your first badge.</div>';

  el.achievementsList.innerHTML = list.length
    ? list
        .map((entry) => {
          const locked = !entry.achieved;
          const pct = Math.round((entry.progress || 0) * 100);
          const rarity = '★'.repeat(entry.rarity || 0);
          const date = entry.achievedAt
            ? `<span class="achievement-item-date">${escapeHtml(
                new Date(entry.achievedAt).toLocaleDateString()
              )}</span>`
            : '';
          return `
          <div class="achievement-item${locked ? ' locked' : ''}">
            <span class="achievement-badge-icon">${escapeHtml(entry.icon)}</span>
            <div class="achievement-item-body">
              <div class="achievement-item-name">
                ${escapeHtml(entry.name)}
                <span class="achievement-item-rarity">${rarity}</span>${date}
              </div>
              <div class="achievement-item-desc">${escapeHtml(
                entry.description
              )}</div>
              <div class="achievement-item-progress"><span style="width:${pct}%"></span></div>
            </div>
          </div>`;
        })
        .join('')
    : '<div class="empty">No achievements available.</div>';
}

async function loadAchievements() {
  try {
    const res = await apiFetch('/api/achievements');
    if (!res.ok) throw new Error('failed to load achievements');
    renderAchievements(await res.json());
  } catch {
    el.achievementsCount.textContent = 'unavailable';
    el.achievementsList.innerHTML =
      '<div class="empty">Unable to load achievements.</div>';
  }
}

async function loadHealth() {
  try {
    const res = await fetch('/health');
    if (!res.ok) throw new Error('health check failed');
    const data = await res.json();
    setBotStatus(Boolean(data.bot?.connected));
    animateCount(el.statServers, data.bot?.guildCount ?? 0);
    animateCount(el.statMembers, data.bot?.memberCount ?? 0);
    el.statUptime.textContent = formatUptime(data.uptime ?? 0);
    el.footerTime.textContent = new Date(data.timestamp).toLocaleTimeString();
    if (data.bot?.connected) {
      if (!serversLoaded) loadServers();
      if (selectedGuildId) {
        if (!channelsLoaded) loadChannels();
        if (!modGuildsLoaded) loadModerationGuilds();
        if (!verificationGuildsLoaded) loadVerificationGuilds();
        if (!automationGuildsLoaded) loadAutomationGuilds();
        if (!ticketsGuildsLoaded) loadTicketsGuilds();
        if (!appealsGuildsLoaded) loadAppealsGuilds();
        if (!levelingGuildsLoaded) loadLevelingGuilds();
      }
      if (!vpnBlocklistLoaded) loadVpnBlocklist();
      if (!votesLoaded) loadVotes();
      if (!billingLoaded) loadBilling();
    }
  } catch (err) {
    setBotStatus(false);
    el.statUptime.textContent = '--';
  }
}

/* ---------- Navigation (two-level sidebar) ---------- */
const NAV_SECTIONS = [
  {
    id: 'overview',
    title: 'Overview',
    icon: 'icon-home',
    groups: [
      {
        title: 'Dashboard',
        items: [
          { view: 'overview', label: 'Overview', icon: 'icon-home' },
          { view: 'servers', label: 'Servers', icon: 'icon-home' },
        ],
      },
    ],
  },
  {
    id: 'moderation',
    title: 'Moderation',
    icon: 'icon-shield',
    groups: [
      {
        title: 'Tools',
        items: [
          { view: 'moderation', label: 'Moderation', icon: 'icon-shield' },
          { view: 'verification', label: 'Verification', icon: 'icon-shield' },
          { view: 'vpn-blocklist', label: 'VPN Blocklist', icon: 'icon-shield' },
        ],
      },
      {
        title: 'Review',
        items: [{ view: 'appeals', label: 'Appeals', icon: 'icon-bell' }],
      },
    ],
  },
  {
    id: 'community',
    title: 'Community',
    icon: 'icon-users',
    groups: [
      {
        title: 'Engagement',
        items: [
          { view: 'rules', label: 'Rules', icon: 'icon-help' },
          { view: 'voting', label: 'Voting', icon: 'icon-bell' },
          { view: 'leveling', label: 'Leveling', icon: 'icon-gear' },
        ],
      },
      {
        title: 'Support',
        items: [{ view: 'tickets', label: 'Tickets', icon: 'icon-help' }],
      },
    ],
  },
  {
    id: 'automation',
    title: 'Automation',
    icon: 'icon-gear',
    groups: [
      {
        title: 'Automation',
        items: [{ view: 'automation', label: 'Automation', icon: 'icon-gear' }],
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    icon: 'icon-chart',
    groups: [
      {
        title: 'Plan',
        items: [{ view: 'billing', label: 'Billing', icon: 'icon-chart' }],
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: 'icon-gear',
    groups: [
      {
        title: 'Account',
        items: [{ view: 'account', label: 'Account', icon: 'icon-user' }],
      },
      {
        title: 'Developer',
        items: [
          { view: 'apikeys', label: 'API keys', icon: 'icon-key' },
          { view: 'review-translations', label: 'Review translations', icon: 'icon-bell' },
        ],
      },
    ],
  },
];

const railNav = $('#rail-nav');
const railFooter = $('#rail-footer');
const detailNav = $('#detail-nav');
const detailTitle = $('#detail-title');
const detailCollapse = $('#detail-collapse');
const sideDetail = $('#side-detail');
const navSearch = $('#nav-search');

let activeSectionId = 'overview';
let currentView = 'overview';

function sectionForView(view) {
  return NAV_SECTIONS.find((s) =>
    s.groups.some((g) => g.items.some((i) => i.view === view))
  );
}

function railButtons() {
  return [
    ...railNav.querySelectorAll('.rail-btn'),
    ...railFooter.querySelectorAll('.rail-btn'),
  ];
}

function renderRail() {
  const top = NAV_SECTIONS.filter((s) => s.id !== 'settings');
  const settings = NAV_SECTIONS.find((s) => s.id === 'settings');
  railNav.innerHTML = top
    .map(
      (s) =>
        `<button class="rail-btn${s.id === activeSectionId ? ' active' : ''}"
          type="button" data-section="${s.id}" title="${s.title}" aria-label="${s.title}">
          <svg class="nav-svg" aria-hidden="true"><use href="#${s.icon}"/></svg>
        </button>`
    )
    .join('');
  railFooter.innerHTML = `<button class="rail-btn${
    settings.id === activeSectionId ? ' active' : ''
  }"
    type="button" data-section="${settings.id}" title="${settings.title}" aria-label="${settings.title}">
    <svg class="nav-svg" aria-hidden="true"><use href="#${settings.icon}"/></svg>
  </button>`;
  railButtons().forEach((btn) => {
    btn.addEventListener('click', () => setSection(btn.dataset.section));
  });
}

function groupKey(title) {
  return 'web.dash.group.' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function navItemHtml(item) {
  return `<button class="nav-item${item.view === currentView ? ' active' : ''}" data-view="${item.view}" type="button">
    <span class="nav-icon"><svg class="nav-svg" aria-hidden="true"><use href="#${item.icon}"/></svg></span>
    <span class="nav-label" data-i18n="web.dash.nav.${item.view}">${item.label}</span>
  </button>`;
}

function renderDetail() {
  const section = NAV_SECTIONS.find((s) => s.id === activeSectionId);
  if (!section) return;
  detailTitle.textContent = section.title;
  detailTitle.setAttribute('data-i18n', `web.dash.nav.${section.id}`);
  const q = (navSearch.value || '').trim().toLowerCase();
  const html = section.groups
    .map((group) => {
      const items = group.items.filter(
        (i) => !q || i.label.toLowerCase().includes(q)
      );
      if (!items.length) return '';
      return `<div class="detail-group">
        <div class="detail-group-title" data-i18n="${groupKey(group.title)}">${group.title}</div>
        ${items.map(navItemHtml).join('')}
      </div>`;
    })
    .join('');
  detailNav.innerHTML = html || '<div class="empty">No matching sections.</div>';
  if (window.I18N && typeof window.I18N.apply === 'function') {
    window.I18N.apply();
  }
}

function switchView(view) {
  currentView = view;
  document
    .querySelectorAll('.view')
    .forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  document
    .querySelectorAll('.nav-item')
    .forEach((n) => n.classList.toggle('active', n.dataset.view === view));
  if (view === 'overview') replayOverviewCounters();
}

function setSection(sectionId, activate) {
  activeSectionId = sectionId;
  railButtons().forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.section === sectionId)
  );
  renderDetail();
  if (activate !== false) {
    const section = NAV_SECTIONS.find((s) => s.id === sectionId);
    const first = section && section.groups[0] && section.groups[0].items[0];
    if (first) switchView(first.view);
  }
}

function activateView(view) {
  const section = sectionForView(view);
  if (section) setSection(section.id, false);
  switchView(view);
}

function toggleDetailCollapsed() {
  sideDetail.classList.toggle('collapsed');
  detailCollapse.setAttribute(
    'aria-expanded',
    String(!sideDetail.classList.contains('collapsed'))
  );
}

detailCollapse.addEventListener('click', toggleDetailCollapsed);
navSearch.addEventListener('input', renderDetail);
detailNav.addEventListener('click', (event) => {
  const btn = event.target.closest('.nav-item');
  if (btn) switchView(btn.dataset.view);
});

// Support ?view=account and ?error=message from auth redirects.
(function () {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const error = params.get('error');
  if (view) activateView(view);
  if (error) setTimeout(() => showToast(decodeURIComponent(error), 'err'), 400);
})();

renderRail();
setSection('overview', false);
switchView('overview');

// Start collapsed on narrow screens so the two panels don't crowd the content.
if (window.matchMedia('(max-width: 900px)').matches) {
  sideDetail.classList.add('collapsed');
  detailCollapse.setAttribute('aria-expanded', 'false');
}

/* ---------- Servers view ---------- */
async function loadServers() {
  try {
    const res = await fetch('/api/servers');
    if (!res.ok) throw new Error('failed to load servers');
    const data = await res.json();
    serversLoaded = data.connected;
    initializeServerContext(data.servers || []);

    if (!data.connected) {
      el.serversList.innerHTML =
        '<div class="empty">Bot offline — your servers will appear here once it connects.</div>';
      return;
    }
    if (!data.servers || data.servers.length === 0) {
      el.serversList.innerHTML =
        '<div class="empty">The bot is not in any servers you belong to.</div>';
      return;
    }

    el.serversList.innerHTML = data.servers
      .map((s) => {
        const letter = escapeHtml((s.name || '?').charAt(0).toUpperCase());
        const avatar = s.icon
          ? `<img class="server-avatar" src="${escapeHtml(
              s.icon
            )}" alt="" loading="lazy" onerror="this.remove()" />`
          : '';
        return `
          <div class="server-card">
            <span class="server-avatar-wrap">
              <span class="server-avatar-fallback">${letter}</span>
              ${avatar}
            </span>
            <div class="server-info">
              <div class="server-name">${escapeHtml(s.name)}</div>
              <div class="server-id">${escapeHtml(s.id)}</div>
            </div>
          </div>`;
      })
      .join('');
  } catch {
    el.serversList.innerHTML =
      '<div class="empty">Failed to load servers.</div>';
  }
}

/* ---------- Vote tracking ---------- */
let votesLoaded = false;

async function loadVotes() {
  try {
    const res = await apiFetch('/api/votes');
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    votesLoaded = true;
    animateCount(el.voteTotal, data.total || 0);
    animateCount(el.voteWeighted, data.weightedTotal || 0);
    animateCount(el.voteTopgg, data.byProvider?.topgg?.votes || 0);
    animateCount(el.voteDbl, data.byProvider?.discordbotlist?.votes || 0);
    el.voteStatus.textContent = `${data.total || 0} vote${data.total === 1 ? '' : 's'}`;
    const recent = data.recent || [];
    el.voteRecent.innerHTML = recent.length
      ? recent
          .map(
            (vote) => `
              <div class="vote-recent-entry">
                <span class="vote-provider">${escapeHtml(vote.provider === 'topgg' ? 'TOP.GG' : 'DISCORD BOT LIST')}</span>
                <span class="vote-user">${escapeHtml(vote.username || vote.userId)}</span>
                <span class="vote-date">${escapeHtml(new Date(vote.createdAt).toLocaleString())}</span>
              </div>`
          )
          .join('')
      : '<div class="empty">No votes received yet.</div>';
  } catch {
    el.voteStatus.textContent = 'unavailable';
    el.voteRecent.innerHTML = '<div class="empty">Unable to load vote tracking.</div>';
  }
}

/* ---------- Verification configuration ---------- */
let verificationGuilds = [];
let verificationGuildsLoaded = false;

function verificationGuildInfo() {
  return verificationGuilds.find((g) => g.id === selectedGuildId);
}

function setSelectOptions(select, options, emptyLabel, getLabel) {
  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = emptyLabel;
  select.appendChild(empty);
  for (const option of options) {
    const item = document.createElement('option');
    item.value = option.id;
    item.textContent = getLabel(option);
    select.appendChild(item);
  }
}

function renderVerificationConfig() {
  const guild = verificationGuildInfo();
  const config = guild?.config || {};
  el.verificationForm.hidden = !guild;
  if (!guild) return;

  setSelectOptions(
    el.verificationRole,
    guild.roles || [],
    'No role (disabled)',
    (role) => `${role.name} (${role.id})`
  );
  setSelectOptions(
    el.verificationLogChannel,
    guild.channels || [],
    'No logging channel',
    (channel) => `#${channel.name}`
  );
  el.verificationRole.value = config.roleId || '';
  el.verificationBlockVpn.checked = config.blockVpn === true;
  el.verificationMinAge.value = String(config.minAccountAgeDays ?? 0);
  el.verificationAction.value = config.action || 'none';
  el.verificationRequireAvatar.checked = config.requireAvatar === true;
  el.verificationJoinBurst.value = String(config.joinBurst ?? 0);
  el.verificationJoinWindow.value = String(config.joinBurstWindow ?? 10);
  el.verificationLogChannel.value = config.logChannelId || '';
  el.verificationStatus.textContent = guild.configured ? 'enabled' : 'disabled';
  el.verificationStatus.className = `count-chip ${guild.configured ? 'config-enabled' : ''}`;
}

async function loadVerificationGuilds() {
  try {
    const res = await apiFetch('/api/verification/guilds');
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    const manageableGuilds = data.guilds || [];
    verificationGuilds = selectedGuildId
      ? manageableGuilds.filter((guild) => guild.id === selectedGuildId)
      : manageableGuilds;
    verificationGuildsLoaded = data.connected;

    el.verificationStatus.textContent = data.connected
      ? `${verificationGuilds.length} server${verificationGuilds.length === 1 ? '' : 's'}`
      : 'bot offline';
    el.verificationForm.hidden = true;
    if (verificationGuilds.length) {
      renderVerificationConfig();
    }
  } catch {
    el.verificationStatus.textContent = 'unavailable';
    el.verificationForm.hidden = true;
  }
}

let vpnBlocklistLoaded = false;

function renderVpnBlocklist(entries) {
  el.vpnBlocklistStatus.textContent = `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`;
  if (!entries.length) {
    el.vpnBlocklist.innerHTML = '<div class="empty">No manually flagged IP addresses.</div>';
    return;
  }
  el.vpnBlocklist.innerHTML = entries
    .map(
      (entry) => `
        <div class="vpn-blocklist-entry">
          <code>${escapeHtml(entry.ip)}</code>
          <span class="vpn-blocklist-meta">${escapeHtml(entry.addedBy || 'dashboard')}</span>
          <button type="button" class="btn-icon vpn-remove" data-ip="${escapeHtml(entry.ip)}">✕ REMOVE</button>
        </div>`
    )
    .join('');
}

async function loadVpnBlocklist() {
  try {
    const res = await apiFetch('/api/vpn-blocklist');
    const data = await res.json().catch(() => ({}));
    vpnBlocklistLoaded = res.status !== 503;
    if (!res.ok) {
      el.vpnBlocklistStatus.textContent = res.status === 403 ? 'owner only' : 'unavailable';
      el.vpnBlocklist.innerHTML = `<div class="empty">${escapeHtml(data.error || 'Unable to load the VPN blocklist.')}</div>`;
      return;
    }
    renderVpnBlocklist(data.entries || []);
  } catch {
    el.vpnBlocklistStatus.textContent = 'unavailable';
    el.vpnBlocklist.innerHTML = '<div class="empty">Unable to load the VPN blocklist.</div>';
  }
}

el.vpnBlocklistForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const ip = el.vpnIp.value.trim();
  if (!ip) return;
  el.vpnFlag.disabled = true;
  try {
    const res = await apiFetch('/api/vpn-blocklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to flag IP.');
    el.vpnIp.value = '';
    showToast('IP flagged as VPN.');
    await loadVpnBlocklist();
  } catch (error) {
    showToast(error.message || 'Failed to flag IP.', 'err');
  } finally {
    el.vpnFlag.disabled = false;
  }
});

el.vpnBlocklist.addEventListener('click', async (event) => {
  const button = event.target.closest('.vpn-remove');
  if (!button) return;
  const ip = button.dataset.ip;
  if (!confirm(`Remove ${ip} from the VPN blocklist?`)) return;
  button.disabled = true;
  try {
    const res = await apiFetch('/api/vpn-blocklist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to remove IP.');
    showToast('IP removed from the VPN blocklist.');
    await loadVpnBlocklist();
  } catch (error) {
    showToast(error.message || 'Failed to remove IP.', 'err');
    button.disabled = false;
  }
});

el.verificationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const guildId = selectedGuildId;
  if (!guildId) return;

  el.verificationSave.disabled = true;
  try {
    const res = await apiFetch(`/api/verification/config/${encodeURIComponent(guildId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roleId: el.verificationRole.value || null,
        blockVpn: el.verificationBlockVpn.checked,
        minAccountAgeDays: parseInt(el.verificationMinAge.value, 10),
        requireAvatar: el.verificationRequireAvatar.checked,
        joinBurst: parseInt(el.verificationJoinBurst.value, 10),
        joinBurstWindow: parseInt(el.verificationJoinWindow.value, 10),
        action: el.verificationAction.value,
        logChannelId: el.verificationLogChannel.value || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to save configuration');
    const guild = verificationGuildInfo();
    if (guild) {
      guild.config = data.config;
      guild.configured = data.configured;
    }
    renderVerificationConfig();
    showToast(data.configured ? 'Verification configuration saved.' : 'Verification disabled.');
  } catch (error) {
    showToast(error.message || 'Failed to save configuration.', 'err');
  } finally {
    el.verificationSave.disabled = false;
  }
});

el.rulesList.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-icon');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!confirm('Delete this custom rule?')) return;
  try {
    const res = await apiFetch(`/api/rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('delete failed');
    showToast('Rule removed.');
    await loadRules();
  } catch (err) {
    showToast('Failed to remove rule.', 'err');
  }
});

el.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = el.title.value.trim();
  const description = el.desc.value.trim();
  if (!title || !description) return;

  el.submit.disabled = true;
  try {
    const res = await apiFetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    if (!res.ok) throw new Error('create failed');
    el.title.value = '';
    el.desc.value = '';
    showToast('Rule deployed.');
    await loadRules();
  } catch (err) {
    showToast('Failed to add rule.', 'err');
  } finally {
    el.submit.disabled = false;
  }
});

/* ---------- Channels ---------- */

let channelsLoaded = false;
let serversLoaded = false;
let channelsData = null;
let modGuildsLoaded = false;

async function loadChannels() {
  if (!selectedGuildId) return;
  try {
    const res = await apiFetch(`/api/channels?guildId=${encodeURIComponent(selectedGuildId)}`);
    if (!res.ok) throw new Error('failed to load channels');
    const data = await res.json();
    channelsData = data;
    channelsLoaded = Boolean(data.connected);
    populateModChannels(selectedGuildId);
  } catch {
    channelsLoaded = false;
  }
}

/* ---------- Moderation ---------- */
let modGuilds = [];
let modSelectedUser = null;
let modSearchTimer = null;

function updateModSelected() {
  if (modSelectedUser) {
    el.modSelected.hidden = false;
    el.modSelectedName.textContent = modSelectedUser.name;
  } else {
    el.modSelected.hidden = true;
  }
}

function modGuildInfo() {
  return modGuilds.find((g) => g.id === selectedGuildId);
}

function updateModActions() {
  const g = modGuildInfo();
  const p = g?.permissions || {};
  el.modBan.disabled = !p.ban || !modSelectedUser;
  el.modKick.disabled = !p.kick || !modSelectedUser;
  el.modTimeout.disabled = !p.timeout || !modSelectedUser;
  el.modPurge.disabled = !p.purge || !el.modChannel.value;
  el.modMessage.disabled =
    !p.message || !modSelectedUser || !el.modMessageText.value.trim();
}

function populateModChannels(guildId) {
  el.modChannel.innerHTML = '';
  const g = channelsData?.guilds?.find((x) => x.id === guildId);
  const channels = g?.channels || [];
  const def = document.createElement('option');
  def.value = '';
  def.textContent = channels.length ? 'Select a channel…' : 'No channels';
  el.modChannel.appendChild(def);
  for (const c of channels) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = '#' + c.name;
    el.modChannel.appendChild(opt);
  }
  updateModActions();
}

async function loadModerationGuilds() {
  try {
    const res = await apiFetch('/api/moderation/guilds');
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    const manageableGuilds = data.guilds || [];
    modGuilds = selectedGuildId
      ? manageableGuilds.filter((guild) => guild.id === selectedGuildId)
      : manageableGuilds;
    modGuildsLoaded = data.connected;

    const modFree = modGuilds.length === 1 && modGuilds[0].plan === 'free';
    el.modStatus.textContent = data.connected
      ? (modFree
        ? 'Pro required'
        : `${modGuilds.length} server${modGuilds.length === 1 ? '' : 's'}`)
      : 'bot offline';
    el.modBody.hidden = modGuilds.length === 0 || modFree;
    updateModActions();
  } catch {
    el.modStatus.textContent = 'unavailable';
  }
}

async function searchModMembers(query) {
  const guildId = selectedGuildId;
  if (!guildId) return;
  try {
    const res = await apiFetch(
      `/api/moderation/members?guildId=${encodeURIComponent(
        guildId
      )}&query=${encodeURIComponent(query)}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      el.modUserList.innerHTML = `<div class="empty">${escapeHtml(
        data.error || 'Failed to load members.'
      )}</div>`;
      return;
    }
    const members = data.members || [];
    if (!members.length) {
      el.modUserList.innerHTML = '<div class="empty">No members found.</div>';
      return;
    }
    el.modUserList.innerHTML = members
      .map((m) => {
        const name = m.displayName || m.username;
        const meta = `${m.bot ? 'BOT' : ''}${
          m.username !== name ? ' @' + m.username : ''
        }`.trim();
        return `
          <button type="button" class="mod-user-item" data-id="${escapeHtml(
            m.id
          )}" data-name="${escapeHtml(name)}">
            <span class="mod-user-avatar-wrap">
              <span class="mod-user-fallback">${escapeHtml(
                (name || '?').charAt(0).toUpperCase()
              )}</span>
              ${
                m.avatar
                  ? `<img class="mod-user-avatar" src="${escapeHtml(
                      m.avatar
                    )}" alt="" loading="lazy" onerror="this.remove()" />`
                  : ''
              }
            </span>
            <span class="mod-user-name">${escapeHtml(name)}</span>
            <span class="mod-user-meta">${escapeHtml(meta)}</span>
          </button>`;
      })
      .join('');
  } catch {
    el.modUserList.innerHTML =
      '<div class="empty">Failed to load members.</div>';
  }
}

async function runModAction(action, body) {
  const btn = {
    ban: el.modBan,
    kick: el.modKick,
    timeout: el.modTimeout,
    purge: el.modPurge,
    message: el.modMessage,
  }[action];
  if (btn) btn.disabled = true;
  try {
    const res = await apiFetch('/api/moderation/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Action failed.');

    if (action === 'purge') {
      showToast(
        `Purged ${data.deleted} message${data.deleted === 1 ? '' : 's'}.`
      );
    } else if (action === 'message') {
      el.modMessageText.value = '';
      showToast(`📬 DM sent to ${modSelectedUser.name}.`);
      modSelectedUser = null;
      updateModSelected();
      searchModMembers(el.modUserSearch.value.trim());
    } else {
      showToast(
        `${action[0].toUpperCase() + action.slice(1)} succeeded${
          data.duration ? ' (' + data.duration + ')' : ''
        }.`
      );
      modSelectedUser = null;
      updateModSelected();
      searchModMembers(el.modUserSearch.value.trim());
    }
  } catch (err) {
    showToast(err.message || 'Action failed.', 'err');
  } finally {
    updateModActions();
  }
}

el.modUserSearch.addEventListener('input', () => {
  clearTimeout(modSearchTimer);
  modSearchTimer = setTimeout(
    () => searchModMembers(el.modUserSearch.value.trim()),
    250
  );
});

el.modUserList.addEventListener('click', (e) => {
  const item = e.target.closest('.mod-user-item');
  if (!item) return;
  modSelectedUser = { id: item.dataset.id, name: item.dataset.name };
  updateModSelected();
  updateModActions();
});

el.modBan.addEventListener('click', () => {
  if (!modSelectedUser) return;
  if (!confirm(`Ban ${modSelectedUser.name}?`)) return;
  runModAction('ban', {
    guildId: selectedGuildId,
    action: 'ban',
    userId: modSelectedUser.id,
    reason: el.modReason.value,
  });
});

el.modKick.addEventListener('click', () => {
  if (!modSelectedUser) return;
  if (!confirm(`Kick ${modSelectedUser.name}?`)) return;
  runModAction('kick', {
    guildId: selectedGuildId,
    action: 'kick',
    userId: modSelectedUser.id,
    reason: el.modReason.value,
  });
});

el.modTimeout.addEventListener('click', () => {
  if (!modSelectedUser) return;
  const duration = el.modDuration.value.trim();
  if (!duration) {
    showToast('Enter a duration, e.g. 10m.', 'err');
    return;
  }
  if (!confirm(`Timeout ${modSelectedUser.name} for ${duration}?`)) return;
  runModAction('timeout', {
    guildId: selectedGuildId,
    action: 'timeout',
    userId: modSelectedUser.id,
    duration,
    reason: el.modReason.value,
  });
});

el.modChannel.addEventListener('change', updateModActions);

el.modPurge.addEventListener('click', () => {
  const channelId = el.modChannel.value;
  const amount = parseInt(el.modAmount.value, 10);
  const channelName =
    el.modChannel.selectedOptions[0]?.textContent?.replace(/^#/, '') || '';
  if (!channelId) {
    showToast('Select a channel first.', 'err');
    return;
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    showToast('Amount must be 1–100.', 'err');
    return;
  }
  if (
    !confirm(
      `Delete ${amount} message${amount === 1 ? '' : 's'} from #${channelName}?`
    )
  ) {
    return;
  }
  runModAction('purge', {
    guildId: selectedGuildId,
    action: 'purge',
    channelId,
    amount,
  });
});

el.modMessageText.addEventListener('input', updateModActions);

el.modMessage.addEventListener('click', () => {
  if (!modSelectedUser) return;
  const message = el.modMessageText.value.trim();
  if (!message) {
    showToast('Enter a message first.', 'err');
    return;
  }
  if (!confirm(`Send a DM to ${modSelectedUser.name}?`)) return;
  runModAction('message', {
    guildId: selectedGuildId,
    action: 'message',
    userId: modSelectedUser.id,
    message,
  });
});

/* ---------- Automation (autorole + role restore) ---------- */
let automationGuilds = [];
let automationGuildsLoaded = false;

function automationGuildInfo() {
  return automationGuilds.find((guild) => guild.id === el.automationGuild.value);
}

function renderAutomation() {
  const guild = automationGuildInfo();
  el.automationForm.hidden = !guild;
  if (!guild) return;
  el.automationRestore.checked = guild.restoreEnabled === true;
  const roles = guild.roles || [];
  const autoroles = guild.autoroles || [];
  el.automationRoles.innerHTML = roles.length
    ? roles
        .map((role) => {
          const checked = autoroles.includes(role.id) ? ' checked' : '';
          return `<label class="checkbox-row automation-role">
            <input type="checkbox" value="${escapeHtml(role.id)}"${checked} />
            <span>${escapeHtml(role.name)}</span>
          </label>`;
        })
        .join('')
    : '<div class="empty">No assignable roles in this server.</div>';
  el.automationStatus.textContent =
    autoroles.length + ' autorole' + (autoroles.length === 1 ? '' : 's');
}

async function loadAutomationGuilds() {
  try {
    const res = await apiFetch('/api/automation/guilds');
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    const manageableGuilds = data.guilds || [];
    automationGuilds = selectedGuildId
      ? manageableGuilds.filter((guild) => guild.id === selectedGuildId)
      : manageableGuilds;
    automationGuildsLoaded = data.connected;

    setSelectOptions(
      el.automationGuild,
      automationGuilds,
      automationGuilds.length ? 'Current server' : 'Selected server is not manageable',
      (guild) => guild.name
    );
    el.automationGuild.disabled = true;
    const automationFree =
      automationGuilds.length === 1 && automationGuilds[0].plan === 'free';
    el.automationStatus.textContent = data.connected
      ? (automationFree
        ? 'Pro required'
        : `${automationGuilds.length} server${automationGuilds.length === 1 ? '' : 's'}`)
      : 'bot offline';
    el.automationForm.hidden = true;
    if (automationGuilds.length && !automationFree) {
      el.automationGuild.value = automationGuilds[0].id;
      renderAutomation();
    }
  } catch {
    el.automationStatus.textContent = 'unavailable';
    el.automationForm.hidden = true;
  }
}

el.automationGuild.addEventListener('change', renderAutomation);

el.automationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const guildId = el.automationGuild.value;
  if (!guildId) return;
  const autoroles = [
    ...el.automationRoles.querySelectorAll('input[type="checkbox"]:checked'),
  ].map((checkbox) => checkbox.value);
  el.automationSave.disabled = true;
  try {
    const res = await apiFetch(`/api/automation/${encodeURIComponent(guildId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        autoroles,
        restoreEnabled: el.automationRestore.checked,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to save automation');
    const guild = automationGuildInfo();
    if (guild) {
      guild.autoroles = data.autoroles;
      guild.restoreEnabled = data.restoreEnabled;
    }
    renderAutomation();
    showToast('Automation saved.');
  } catch (error) {
    showToast(error.message || 'Failed to save automation.', 'err');
  } finally {
    el.automationSave.disabled = false;
  }
});

/* ---------- Tickets ---------- */
let ticketsGuilds = [];
let ticketsGuildsLoaded = false;

function ticketsGuildInfo() {
  return ticketsGuilds.find((guild) => guild.id === el.ticketsGuild.value);
}

function renderTickets() {
  const guild = ticketsGuildInfo();
  el.ticketsForm.hidden = !guild;
  if (!guild) return;
  setSelectOptions(
    el.ticketsCategory,
    guild.categories || [],
    'No category (disabled)',
    (category) => category.name
  );
  setSelectOptions(
    el.ticketsStaffRole,
    guild.roles || [],
    'No staff role',
    (role) => role.name
  );
  el.ticketsCategory.value = guild.config?.categoryId || '';
  el.ticketsStaffRole.value = guild.config?.staffRoleId || '';
  const configured = Boolean(guild.config?.categoryId && guild.config?.staffRoleId);
  el.ticketsStatus.textContent = configured ? 'configured' : 'not configured';
  el.ticketsStatus.className = `count-chip ${configured ? 'config-enabled' : ''}`;
}

async function loadTicketsGuilds() {
  try {
    const res = await apiFetch('/api/tickets/guilds');
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    const manageableGuilds = data.guilds || [];
    ticketsGuilds = selectedGuildId
      ? manageableGuilds.filter((guild) => guild.id === selectedGuildId)
      : manageableGuilds;
    ticketsGuildsLoaded = data.connected;

    setSelectOptions(
      el.ticketsGuild,
      ticketsGuilds,
      ticketsGuilds.length ? 'Current server' : 'Selected server is not manageable',
      (guild) => guild.name
    );
    el.ticketsGuild.disabled = true;
    const ticketsFree = ticketsGuilds.length === 1 && ticketsGuilds[0].plan === 'free';
    el.ticketsStatus.textContent = data.connected
      ? (ticketsFree
        ? 'Pro required'
        : `${ticketsGuilds.length} server${ticketsGuilds.length === 1 ? '' : 's'}`)
      : 'bot offline';
    el.ticketsForm.hidden = true;
    if (ticketsGuilds.length && !ticketsFree) {
      el.ticketsGuild.value = ticketsGuilds[0].id;
      renderTickets();
    }
  } catch {
    el.ticketsStatus.textContent = 'unavailable';
    el.ticketsForm.hidden = true;
  }
}

el.ticketsGuild.addEventListener('change', renderTickets);

el.ticketsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const guildId = el.ticketsGuild.value;
  if (!guildId) return;
  el.ticketsSave.disabled = true;
  try {
    const res = await apiFetch(`/api/tickets/${encodeURIComponent(guildId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: el.ticketsCategory.value || null,
        staffRoleId: el.ticketsStaffRole.value || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to save ticket config');
    const guild = ticketsGuildInfo();
    if (guild) guild.config = data.config;
    renderTickets();
    showToast('Ticket configuration saved.');
  } catch (error) {
    showToast(error.message || 'Failed to save ticket config.', 'err');
  } finally {
    el.ticketsSave.disabled = false;
  }
});

/* ---------- Appeals ---------- */
let appealsGuilds = [];
let appealsGuildsLoaded = false;

function renderAppeals(appeals) {
  el.appealsStatus.textContent = `${appeals.length} appeal${appeals.length === 1 ? '' : 's'}`;
  if (!appeals.length) {
    el.appealsList.innerHTML = '<div class="empty">No appeals for this server.</div>';
    return;
  }
  el.appealsList.innerHTML = appeals
    .map((appeal) => {
      const reviewed = appeal.status !== 'pending';
      const actions = reviewed
        ? ''
        : `<div class="appeal-actions">
            <button class="btn btn-primary btn-sm appeal-review" data-id="${escapeHtml(
              appeal.id
            )}" data-decision="approve">Approve</button>
            <button class="btn btn-secondary btn-sm appeal-review" data-id="${escapeHtml(
              appeal.id
            )}" data-decision="deny">Deny</button>
          </div>`;
      const meta = [
        appeal.username || 'Unknown',
        appeal.userId ? 'ID ' + appeal.userId : '',
        new Date(appeal.createdAt).toLocaleString(),
        appeal.status.toUpperCase(),
        appeal.id,
      ]
        .filter(Boolean)
        .join(' · ');
      return `<div class="appeal-entry">
        <div class="appeal-meta">${escapeHtml(meta)}</div>
        <p class="appeal-reason">${escapeHtml(appeal.reason)}</p>
        ${
          appeal.note
            ? `<p class="appeal-note">Note: ${escapeHtml(appeal.note)}</p>`
            : ''
        }
        ${actions}
      </div>`;
    })
    .join('');
}

async function loadAppeals() {
  const guildId = el.appealsGuild.value;
  if (!guildId) {
    el.appealsList.innerHTML =
      '<div class="empty">Select a server to review appeals.</div>';
    return;
  }
  try {
    const res = await apiFetch(
      `/api/appeals?guildId=${encodeURIComponent(guildId)}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      el.appealsList.innerHTML = `<div class="empty">${escapeHtml(
        data.error || 'Failed to load appeals.'
      )}</div>`;
      return;
    }
    renderAppeals(data.appeals || []);
  } catch {
    el.appealsList.innerHTML = '<div class="empty">Failed to load appeals.</div>';
  }
}

async function loadAppealsGuilds() {
  try {
    const res = await apiFetch('/api/appeals/guilds');
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    const manageableGuilds = data.guilds || [];
    appealsGuilds = selectedGuildId
      ? manageableGuilds.filter((guild) => guild.id === selectedGuildId)
      : manageableGuilds;
    appealsGuildsLoaded = data.connected;

    setSelectOptions(
      el.appealsGuild,
      appealsGuilds,
      appealsGuilds.length ? 'Current server' : 'Selected server is not manageable',
      (guild) => guild.name
    );
    el.appealsGuild.disabled = true;
    const appealsFree = appealsGuilds.length === 1 && appealsGuilds[0].plan === 'free';
    if (appealsGuilds.length && !appealsFree) {
      el.appealsGuild.value = appealsGuilds[0].id;
      await loadAppeals();
    } else {
      el.appealsStatus.textContent = appealsFree
        ? 'Pro required'
        : data.connected
          ? '0 servers'
          : 'bot offline';
      el.appealsList.innerHTML = appealsFree
        ? '<div class="empty">Appeals require the Pro plan.</div>'
        : '<div class="empty">No manageable servers.</div>';
    }
  } catch {
    el.appealsStatus.textContent = 'unavailable';
    el.appealsList.innerHTML = '<div class="empty">Failed to load appeals.</div>';
  }
}

el.appealsGuild.addEventListener('change', loadAppeals);

el.appealsList.addEventListener('click', async (event) => {
  const button = event.target.closest('.appeal-review');
  if (!button) return;
  const id = button.dataset.id;
  const decision = button.dataset.decision;
  if (!confirm(`Are you sure you want to ${decision} appeal ${id}?`)) return;
  button.disabled = true;
  try {
    const res = await apiFetch(`/api/appeals/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to review appeal.');
    showToast(`Appeal ${decision === 'approve' ? 'approved' : 'denied'}.`);
    await loadAppeals();
  } catch (error) {
    showToast(error.message || 'Failed to review appeal.', 'err');
    button.disabled = false;
  }
});

/* ---------- Leveling ---------- */
let levelingGuilds = [];
let levelingGuildsLoaded = false;

function levelingGuildInfo() {
  return levelingGuilds.find((guild) => guild.id === el.levelingGuild.value);
}

function renderLevelingLeaderboard(board) {
  if (!board.length) {
    el.levelingLeaderboard.innerHTML =
      '<div class="empty">No XP earned yet — start chatting!</div>';
    return;
  }
  el.levelingLeaderboard.innerHTML = board
    .map(
      (entry, i) => `<div class="appeal-entry">
        <div class="appeal-meta">#${i + 1} · LEVEL ${entry.level} · ${entry.xp.toLocaleString()} XP</div>
        <p class="appeal-reason">${escapeHtml(entry.username || entry.userId)}</p>
      </div>`
    )
    .join('');
}

function renderLeveling() {
  const guild = levelingGuildInfo();
  el.levelingForm.hidden = !guild;
  if (!guild) return;
  setSelectOptions(
    el.levelingChannel,
    guild.channels || [],
    'No channel (announcements off)',
    (channel) => `#${channel.name}`
  );
  const config = guild.config || {};
  el.levelingChannel.value = config.levelUpChannelId || '';
  el.levelingAnnounce.checked = config.announce !== false;
  el.levelingVoiceXp.value = String(config.voiceXpPerMinute ?? 5);
  el.levelingStatus.textContent = config.announce === false ? 'silent' : 'announcing';
  el.levelingStatus.className = `count-chip ${config.announce !== false ? 'config-enabled' : ''}`;
  renderLevelingLeaderboard(guild.leaderboard || []);
}

async function loadLevelingGuilds() {
  try {
    const res = await apiFetch('/api/leveling/guilds');
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    const manageableGuilds = data.guilds || [];
    levelingGuilds = selectedGuildId
      ? manageableGuilds.filter((guild) => guild.id === selectedGuildId)
      : manageableGuilds;
    levelingGuildsLoaded = data.connected;

    setSelectOptions(
      el.levelingGuild,
      levelingGuilds,
      levelingGuilds.length ? 'Current server' : 'Selected server is not manageable',
      (guild) => guild.name
    );
    el.levelingGuild.disabled = true;
    const levelingFree =
      levelingGuilds.length === 1 && levelingGuilds[0].plan === 'free';
    el.levelingStatus.textContent = data.connected
      ? (levelingFree
        ? 'Pro required'
        : `${levelingGuilds.length} server${levelingGuilds.length === 1 ? '' : 's'}`)
      : 'bot offline';
    el.levelingForm.hidden = true;
    el.levelingLeaderboard.innerHTML = '';
    if (levelingGuilds.length && !levelingFree) {
      el.levelingGuild.value = levelingGuilds[0].id;
      renderLeveling();
    }
  } catch {
    el.levelingStatus.textContent = 'unavailable';
    el.levelingForm.hidden = true;
  }
}

el.levelingGuild.addEventListener('change', renderLeveling);

el.levelingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const guildId = el.levelingGuild.value;
  if (!guildId) return;
  el.levelingSave.disabled = true;
  try {
    const res = await apiFetch(`/api/leveling/${encodeURIComponent(guildId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        levelUpChannelId: el.levelingChannel.value || null,
        announce: el.levelingAnnounce.checked,
        voiceXpPerMinute: parseInt(el.levelingVoiceXp.value, 10) || 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to save leveling config');
    const guild = levelingGuildInfo();
    if (guild) guild.config = data.config;
    renderLeveling();
    showToast('Leveling configuration saved.');
  } catch (error) {
    showToast(error.message || 'Failed to save leveling config.', 'err');
  } finally {
    el.levelingSave.disabled = false;
  }
});

el.levelingReset.addEventListener('click', async () => {
  const guildId = el.levelingGuild.value;
  if (!guildId) return;
  if (!confirm('Reset ALL XP in this server? This cannot be undone.')) return;
  el.levelingReset.disabled = true;
  try {
    const res = await apiFetch(`/api/leveling/${encodeURIComponent(guildId)}/reset`, {
      method: 'POST',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to reset XP');
    const guild = levelingGuildInfo();
    if (guild) guild.leaderboard = [];
    renderLeveling();
    showToast('XP reset for the server.');
  } catch (error) {
    showToast(error.message || 'Failed to reset XP.', 'err');
  } finally {
    el.levelingReset.disabled = false;
  }
});

/* ---------- Billing ---------- */
let billingLoaded = false;
let billingData = null;

function renderBilling() {
  const data = billingData || {};
  const cur = data.currency || { name: 'Square', code: 'SQ' };
  el.billingCurrency.textContent = `${cur.name} (${cur.code})`;
  animateCount(el.billingBalance, data.balance || 0, 3000, ` ${cur.code}`);
  el.billingStatus.textContent = `${cur.code} credits`;
  el.billingOwner.hidden = !data.isOwner;

  const guilds = data.guilds || [];
  if (!guilds.length) {
    el.billingGuilds.innerHTML =
      '<div class="empty">No manageable servers — make sure the bot is online and you manage a server it is in.</div>';
    return;
  }
  const proCost = data.plans?.pro?.monthlyCost ?? 500;
  el.billingGuilds.innerHTML = guilds
    .map((g) => {
      const expiry = g.expiresAt
        ? ` · expires ${new Date(g.expiresAt).toLocaleDateString()}`
        : g.plan === 'enterprise'
          ? ' · no expiry'
          : '';
      const tagClass = g.plan === 'free' ? '' : 'custom';
      const actions =
        g.plan === 'free'
          ? `<button class="btn btn-secondary btn-sm billing-subscribe" data-guild="${escapeHtml(
              g.id
            )}">Subscribe Pro — ${proCost.toLocaleString()} ${cur.code}/mo</button>`
          : g.plan === 'pro'
            ? `<button class="btn btn-secondary btn-sm billing-subscribe" data-guild="${escapeHtml(
                g.id
              )}">Extend 1 month</button>
               <button class="btn btn-secondary btn-sm billing-cancel" data-guild="${escapeHtml(
                 g.id
               )}">Cancel</button>`
            : '';
      return `
        <div class="billing-guild">
          <div class="billing-guild-info">
            <span class="billing-guild-name">${escapeHtml(g.name)}</span>
            <span class="tag ${tagClass}">${escapeHtml(g.plan.toUpperCase())}</span>
            <span class="billing-guild-meta">${escapeHtml(expiry)}</span>
          </div>
          <div class="billing-guild-actions">${actions}</div>
        </div>`;
    })
    .join('');
}

async function loadBilling() {
  try {
    const res = await apiFetch('/api/billing');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to load billing');
    billingData = data;
    billingLoaded = true;
    renderBilling();
  } catch {
    el.billingStatus.textContent = 'unavailable';
  }
}

async function billingSubscribe(guildId) {
  try {
    const res = await apiFetch('/api/billing/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, plan: 'pro', months: 1 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to subscribe');
    showToast('Server subscribed to Pro.');
    await loadBilling();
  } catch (err) {
    showToast(err.message || 'Failed to subscribe.', 'err');
  }
}

async function billingCancel(guildId) {
  try {
    const res = await apiFetch('/api/billing/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to cancel');
    showToast('Subscription cancelled.');
    await loadBilling();
  } catch (err) {
    showToast(err.message || 'Failed to cancel.', 'err');
  }
}

el.billingGuilds.addEventListener('click', (event) => {
  const sub = event.target.closest('.billing-subscribe');
  const cancel = event.target.closest('.billing-cancel');
  if (sub) billingSubscribe(sub.dataset.guild);
  else if (cancel) billingCancel(cancel.dataset.guild);
});

el.billingGrantForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const userId = el.billingGrantUser.value.trim();
  const amount = parseInt(el.billingGrantAmount.value, 10);
  if (!userId || !Number.isInteger(amount) || amount < 1) return;
  try {
    const res = await apiFetch('/api/billing/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to grant');
    el.billingGrantUser.value = '';
    showToast('Credits granted.');
    await loadBilling();
  } catch (err) {
    showToast(err.message || 'Failed to grant.', 'err');
  }
});

/* ---------- Account ---------- */
function renderAccount(account) {
  if (!account) return;
  const isLocal = account.authType === 'local';
  el.accountIdentity.textContent =
    account.username || account.discordUsername || account.id || '—';
  el.accountAuthTag.textContent = isLocal ? 'USERNAME + PASSWORD' : 'DISCORD';
  el.accountAuthTag.className = 'tag ' + (isLocal ? '' : 'custom');

  if (isLocal) {
    el.accountStatus.textContent = account.discordLinked
      ? 'discord linked'
      : 'local only';
    el.accountLocalPanel.hidden = false;
    el.accountUsername.value = account.username || '';
    el.accountDiscordPanel.hidden = false;
    el.accountSetupForm.hidden = true;

    if (account.discordLinked) {
      el.accountDiscordStatus.textContent = 'linked';
      el.accountDiscordCopy.textContent = account.discordUsername
        ? `Linked to Discord as ${account.discordUsername} (${account.id}).`
        : `Linked to Discord account ${account.id}.`;
      el.accountDiscordActions.innerHTML =
        '<button type="button" class="btn btn-secondary" id="account-unlink">Unlink Discord account</button>';
    } else {
      el.accountDiscordStatus.textContent = 'not linked';
      el.accountDiscordCopy.textContent =
        'Link your Discord account to manage your servers and use Discord-only features.';
      el.accountDiscordActions.innerHTML =
        '<a class="btn btn-primary" href="/auth/discord/link">Link Discord account</a>';
    }
  } else {
    el.accountStatus.textContent = 'discord session';
    el.accountLocalPanel.hidden = true;
    el.accountDiscordPanel.hidden = false;
    el.accountDiscordStatus.textContent = 'linked';
    el.accountDiscordCopy.textContent = `Signed in as Discord user ${account.username}.`;
    el.accountDiscordActions.innerHTML = '';
    el.accountSetupForm.hidden = Boolean(account.localLinked);
  }
}

async function loadAccount() {
  try {
    const res = await apiFetch('/api/account');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to load account');
    renderAccount(data.account);
  } catch (err) {
    el.accountStatus.textContent = 'unavailable';
    el.accountDiscordCopy.textContent = err.message || 'Unable to load account.';
  }
}

el.accountUsernameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = el.accountUsername.value.trim();
  if (!username) return;
  const btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/account/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to update username');
    showToast('Username updated.');
    await loadAccount();
    await loadSession();
  } catch (error) {
    showToast(error.message || 'Failed to update username.', 'err');
  } finally {
    btn.disabled = false;
  }
});

el.accountPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const currentPassword = el.accountCurrentPassword.value;
  const newPassword = el.accountNewPassword.value;
  if (!currentPassword || !newPassword) return;
  const btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to change password');
    el.accountCurrentPassword.value = '';
    el.accountNewPassword.value = '';
    showToast('Password changed.');
  } catch (error) {
    showToast(error.message || 'Failed to change password.', 'err');
  } finally {
    btn.disabled = false;
  }
});

el.accountSetupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = el.accountSetupUsername.value.trim();
  const password = el.accountSetupPassword.value;
  if (!username || !password) return;
  const btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/account/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to create credentials');
    showToast('Credentials created — you can now sign in with username and password.');
    await loadAccount();
    await loadSession();
  } catch (error) {
    showToast(error.message || 'Failed to create credentials.', 'err');
  } finally {
    btn.disabled = false;
  }
});

el.accountDiscordActions.addEventListener('click', async (event) => {
  const unlink = event.target.closest('#account-unlink');
  if (!unlink) return;
  if (!confirm('Unlink your Discord account?')) return;
  unlink.disabled = true;
  try {
    const res = await apiFetch('/api/account/unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to unlink');
    showToast('Discord account unlinked.');
    await loadAccount();
    await loadSession();
  } catch (error) {
    showToast(error.message || 'Failed to unlink.', 'err');
    unlink.disabled = false;
  }
});

// ---------- API keys ----------
async function loadApiKeys() {
  try {
    const res = await apiFetch('/api/apikeys');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to load keys');
    const keys = data.keys || [];
    el.apikeyList.innerHTML = keys.length
      ? keys
          .map(
            (k) => `
        <div class="apikey-row">
          <div class="apikey-info">
            <span class="apikey-name">${escapeHtml(k.name)}</span>
            <span class="apikey-meta">${escapeHtml(
              k.prefix
            )}… · created ${escapeHtml(
              new Date(k.createdAt).toLocaleDateString()
            )}</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm apikey-revoke" data-id="${escapeHtml(
            k.id
          )}">Revoke</button>
        </div>`
          )
          .join('')
      : '<div class="empty">No API keys yet.</div>';
  } catch {
    el.apikeyList.innerHTML = '<div class="empty">Could not load API keys.</div>';
  }
}

el.apikeyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = el.apikeyName.value.trim();
  if (!name) return;
  const btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to create key');
    el.apikeyName.value = '';
    el.apikeyValue.textContent = data.key;
    el.apikeyReveal.hidden = false;
    showToast('API key created.');
    await loadApiKeys();
  } catch (error) {
    showToast(error.message || 'Failed to create API key.', 'err');
  } finally {
    btn.disabled = false;
  }
});

el.apikeyCopy.addEventListener('click', async () => {
  const key = el.apikeyValue.textContent;
  if (!key) return;
  try {
    await navigator.clipboard.writeText(key);
    showToast('Copied to clipboard.');
  } catch {
    showToast('Copy failed — select the key and copy it manually.', 'err');
  }
});

el.apikeyList.addEventListener('click', async (event) => {
  const btn = event.target.closest('.apikey-revoke');
  if (!btn) return;
  if (!confirm('Revoke this API key? Any app using it will lose access.')) return;
  btn.disabled = true;
  try {
    const res = await apiFetch(`/api/apikeys/${btn.dataset.id}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to revoke key');
    showToast('API key revoked.');
    await loadApiKeys();
  } catch (error) {
    showToast(error.message || 'Failed to revoke key.', 'err');
    btn.disabled = false;
  }
});

// ---------- Review translations ----------
async function loadReviewTranslations() {
  try {
    const res = await apiFetch('/api/i18n/review');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to load');
    el.reviewOwnerNote.hidden = data.isOwner;
    if (!data.isOwner) {
      el.reviewTranslationsList.innerHTML = '';
      return;
    }
    const pending = data.pending || [];
    el.reviewTranslationsList.innerHTML = pending.length
      ? pending
          .map(
            (entry) => `
        <div class="review-item">
          <div class="review-item-meta">${escapeHtml(
            entry.locale
          )} · ${escapeHtml(entry.key)} · ${escapeHtml(
            entry.contributorId || 'anonymous'
          )}</div>
          <div class="review-item-value">${escapeHtml(entry.value)}</div>
          <div class="review-item-actions">
            <button type="button" class="btn btn-primary btn-sm review-approve" data-id="${escapeHtml(
              entry.id
            )}">Approve</button>
            <button type="button" class="btn btn-secondary btn-sm review-reject" data-id="${escapeHtml(
              entry.id
            )}">Reject</button>
          </div>
        </div>`
          )
          .join('')
      : '<div class="empty">No pending translations.</div>';
  } catch {
    el.reviewOwnerNote.hidden = false;
    el.reviewTranslationsList.innerHTML = '';
  }
}

el.reviewTranslationsList.addEventListener('click', async (event) => {
  const approve = event.target.closest('.review-approve');
  const reject = event.target.closest('.review-reject');
  if (!approve && !reject) return;
  const btn = approve || reject;
  btn.disabled = true;
  try {
    const res = await apiFetch(
      approve ? '/api/i18n/approve' : '/api/i18n/reject',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: btn.dataset.id }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed');
    showToast(approve ? 'Translation approved.' : 'Translation rejected.');
    await loadReviewTranslations();
  } catch (error) {
    showToast(error.message || 'Failed.', 'err');
    btn.disabled = false;
  }
});

loadSession();
loadRules();
loadAchievements();
loadHealth();
loadServers();
loadVpnBlocklist();
loadVotes();
loadBilling();
loadAccount();
loadApiKeys();
loadReviewTranslations();
setInterval(loadHealth, 5000);
setInterval(loadAchievements, 30000);
