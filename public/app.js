const $ = (sel) => document.querySelector(sel);

const el = {
  statusDot: $('#status-dot'),
  statusText: $('#status-text'),
  statStatus: $('#stat-status'),
  statServers: $('#stat-servers'),
  statMembers: $('#stat-members'),
  statRules: $('#stat-rules'),
  statUptime: $('#stat-uptime'),
  rulesList: $('#rules-list'),
  rulesCount: $('#rules-count'),
  form: $('#add-rule-form'),
  title: $('#rule-title'),
  desc: $('#rule-desc'),
  submit: $('#add-rule-form .btn-primary'),
  toast: $('#toast'),
  footerTime: $('#footer-time'),
  userChip: $('#user-chip'),
  userName: $('#user-name'),
  logoutLink: $('#logout-link'),
  serverSwitcher: $('#server-switcher'),
  serverSwitcherName: $('#server-switcher-name'),
  serverModal: $('#server-modal'),
  serverModalClose: $('#server-modal-close'),
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
      el.userChip.hidden = false;
      el.logoutLink.hidden = false;
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

function showToast(message, kind = 'ok') {
  el.toast.textContent = message;
  el.toast.className = `toast show ${kind}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.toast.className = 'toast';
  }, 3200);
}

function setBotStatus(connected) {
  el.statusDot.className = 'dot ' + (connected ? 'online' : 'offline');
  el.statusText.textContent = connected ? 'ONLINE' : 'OFFLINE';
  el.statStatus.textContent = connected ? 'ONLINE' : 'OFFLINE';
  el.statStatus.style.color = connected ? 'var(--green)' : 'var(--red)';
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

let rules = [];

function renderRules() {
  if (rules.length === 0) {
    el.rulesList.innerHTML =
      '<div class="empty">No rules loaded. Add one below or restart to load defaults.</div>';
    el.rulesCount.textContent = '0 entries';
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
  el.statRules.textContent = String(rules.length);
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

async function loadHealth() {
  try {
    const res = await fetch('/health');
    if (!res.ok) throw new Error('health check failed');
    const data = await res.json();
    setBotStatus(Boolean(data.bot?.connected));
    el.statServers.textContent = String(data.bot?.guildCount ?? 0);
    el.statMembers.textContent = String(data.bot?.memberCount ?? 0);
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

/* ---------- Sidebar navigation ---------- */
const navItems = [...document.querySelectorAll('.nav-item')];
const views = [...document.querySelectorAll('.view')];

navItems.forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    navItems.forEach((n) => n.classList.toggle('active', n === btn));
    views.forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  });
});

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
    el.voteTotal.textContent = String(data.total || 0);
    el.voteWeighted.textContent = String(data.weightedTotal || 0);
    el.voteTopgg.textContent = String(data.byProvider?.topgg?.votes || 0);
    el.voteDbl.textContent = String(data.byProvider?.discordbotlist?.votes || 0);
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
  el.billingBalance.textContent = `${(data.balance || 0).toLocaleString()} ${cur.code}`;
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

/* ---------- Particle background ---------- */
function initBackground() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  class Dot {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.r = Math.random() * 1.5 + 0.5;
    }
    step() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > W) this.vx *= -1;
      if (this.y < 0 || this.y > H) this.vy *= -1;
    }
  }

  const DOTS = Array.from({ length: 55 }, () => new Dot());

  function frame() {
    ctx.fillStyle = 'rgba(5,0,0,0.22)';
    ctx.fillRect(0, 0, W, H);

    DOTS.forEach((d) => d.step());
    for (let i = 0; i < DOTS.length; i++) {
      for (let j = i + 1; j < DOTS.length; j++) {
        const dx = DOTS[i].x - DOTS[j].x;
        const dy = DOTS[i].y - DOTS[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.strokeStyle = `rgba(255,0,0,${(1 - dist / 110) * 0.35})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(DOTS[i].x, DOTS[i].y);
          ctx.lineTo(DOTS[j].x, DOTS[j].y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(255,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(DOTS[i].x, DOTS[i].y, DOTS[i].r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reduced) requestAnimationFrame(frame);
  }
  frame();
}

initBackground();

loadSession();
loadRules();
loadHealth();
loadServers();
loadVpnBlocklist();
loadVotes();
loadBilling();
setInterval(loadHealth, 5000);
