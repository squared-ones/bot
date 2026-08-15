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
  embedForm: $('#embed-form'),
  embedTitle: $('#embed-title'),
  embedColor: $('#embed-color'),
  embedDesc: $('#embed-desc'),
  embedAuthor: $('#embed-author'),
  embedFooter: $('#embed-footer'),
  embedThumbnail: $('#embed-thumbnail'),
  embedImage: $('#embed-image'),
  embedTimestamp: $('#embed-timestamp'),
  embedFields: $('#embed-fields'),
  embedAddField: $('#embed-add-field'),
  embedChannel: $('#embed-channel'),
  embedChannelStatus: $('#embed-channel-status'),
  embedPost: $('#embed-post'),
  embedPreview: $('#embed-preview'),
  serversList: $('#servers-list'),
  modGuild: $('#mod-guild'),
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
  verificationGuild: $('#verification-guild'),
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
  loadChannels();
  loadModerationGuilds();
  loadVerificationGuilds();
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
      }
      if (!vpnBlocklistLoaded) loadVpnBlocklist();
      if (!votesLoaded) loadVotes();
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
  return verificationGuilds.find((g) => g.id === el.verificationGuild.value);
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

    setSelectOptions(
      el.verificationGuild,
      verificationGuilds,
      verificationGuilds.length ? 'Current server' : 'Selected server is not manageable',
      (guild) => guild.name
    );
    el.verificationGuild.disabled = true;
    el.verificationStatus.textContent = data.connected
      ? `${verificationGuilds.length} server${verificationGuilds.length === 1 ? '' : 's'}`
      : 'bot offline';
    el.verificationForm.hidden = true;
    if (verificationGuilds.length) {
      el.verificationGuild.value = verificationGuilds[0].id;
      renderVerificationConfig();
    }
  } catch {
    el.verificationStatus.textContent = 'unavailable';
    el.verificationForm.hidden = true;
  }
}

el.verificationGuild.addEventListener('change', renderVerificationConfig);

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
  const guildId = el.verificationGuild.value;
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

/* ---------- Channels + embed builder ---------- */

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
    const connected = Boolean(data.connected);
    el.embedChannel.innerHTML = '';

    let total = 0;
    for (const g of data.guilds) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = g.name;
      for (const c of g.channels) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = '#' + c.name;
        optgroup.appendChild(opt);
        total++;
      }
      el.embedChannel.appendChild(optgroup);
    }

    el.embedChannelStatus.textContent = connected
      ? total
        ? `${total} channels`
        : 'no channels'
      : 'bot offline';
    el.embedPost.disabled = !connected || total === 0;
    channelsLoaded = connected;
  } catch {
    el.embedChannelStatus.textContent = 'unavailable';
  }
}

function collectEmbedSpec() {
  const fields = [...el.embedFields.querySelectorAll('.embed-field-row')]
    .map((row) => ({
      name: row.querySelector('.f-name').value.trim(),
      value: row.querySelector('.f-value').value.trim(),
      inline: row.querySelector('.f-inline').checked,
    }))
    .filter((f) => f.name || f.value);

  return {
    title: el.embedTitle.value.trim(),
    description: el.embedDesc.value.trim(),
    color: el.embedColor.value,
    author: el.embedAuthor.value.trim(),
    footer: el.embedFooter.value.trim(),
    thumbnail: el.embedThumbnail.value.trim(),
    image: el.embedImage.value.trim(),
    timestamp: el.embedTimestamp.checked,
    fields,
  };
}

function renderEmbedPreview(spec) {
  const color = spec.color || '#e2e8f0';
  const parts = [];

  if (spec.author) {
    parts.push(`<div class="ep-author">${escapeHtml(spec.author)}</div>`);
  }
  if (spec.title) {
    parts.push(`<div class="ep-title">${renderMarkdown(spec.title)}</div>`);
  }
  if (spec.description) {
    parts.push(`<div class="ep-desc">${renderMarkdown(spec.description)}</div>`);
  }
  if (spec.fields && spec.fields.length) {
    const rows = spec.fields
      .map((f) => {
        const inline = f.inline ? ' ep-field-inline' : '';
        return `<div class="ep-field${inline}"><div class="ep-field-name">${renderMarkdown(
          f.name || ''
        )}</div><div class="ep-field-value">${renderMarkdown(
          f.value || ''
        )}</div></div>`;
      })
      .join('');
    parts.push(`<div class="ep-fields">${rows}</div>`);
  }
  if (spec.image) {
    parts.push(
      `<img class="ep-image" src="${escapeHtml(spec.image)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
    );
  }

  const foot = [];
  if (spec.footer) foot.push(`<span>${escapeHtml(spec.footer)}</span>`);
  if (spec.timestamp) {
    foot.push(`<span class="ep-time">Today at ${new Date().toLocaleTimeString()}</span>`);
  }
  if (foot.length) parts.push(`<div class="ep-footer">${foot.join(' · ')}</div>`);

  if (spec.thumbnail) {
    parts.push(
      `<img class="ep-thumb" src="${escapeHtml(spec.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
    );
  }

  if (!parts.length) {
    return '<div class="ep-empty">Your embed preview will appear here…</div>';
  }
  return `<div class="embed-preview-inner" style="border-left-color:${color}">${parts.join('')}</div>`;
}

function updateEmbedPreview() {
  el.embedPreview.innerHTML = renderEmbedPreview(collectEmbedSpec());
}

function addFieldRow(name = '', value = '', inline = false) {
  const row = document.createElement('div');
  row.className = 'embed-field-row';
  row.innerHTML = `
    <div class="ef-inputs">
      <input class="f-name" type="text" maxlength="256" placeholder="Field name" value="${escapeHtml(name)}" />
      <textarea class="f-value" rows="2" maxlength="1024" placeholder="Value (supports markdown)">${escapeHtml(value)}</textarea>
    </div>
    <div class="ef-controls">
      <label class="ef-inline"><input class="f-inline" type="checkbox" ${inline ? 'checked' : ''} /> inline</label>
      <button type="button" class="btn-icon f-remove" title="Remove field">✕</button>
    </div>`;

  row.querySelector('.f-remove').addEventListener('click', () => {
    row.remove();
    updateEmbedPreview();
  });
  row.querySelectorAll('input, textarea').forEach((inp) =>
    inp.addEventListener('input', updateEmbedPreview)
  );
  el.embedFields.appendChild(row);
}

el.embedAddField.addEventListener('click', () => {
  addFieldRow();
  updateEmbedPreview();
});

[
  el.embedTitle,
  el.embedColor,
  el.embedDesc,
  el.embedAuthor,
  el.embedFooter,
  el.embedThumbnail,
  el.embedImage,
].forEach((inp) => inp.addEventListener('input', updateEmbedPreview));
el.embedTimestamp.addEventListener('change', updateEmbedPreview);

el.embedForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const spec = collectEmbedSpec();
  const channelId = el.embedChannel.value;
  if (!channelId) {
    showToast('Select a channel first.', 'err');
    return;
  }
  el.embedPost.disabled = true;
  try {
    const res = await apiFetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, embed: spec }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'failed to post embed');
    showToast('Embed posted.');
  } catch (err) {
    showToast(err.message || 'Failed to post embed.', 'err');
  } finally {
    el.embedPost.disabled = false;
  }
});

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
  return modGuilds.find((g) => g.id === el.modGuild.value);
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

    el.modGuild.innerHTML = '';
    el.modGuild.disabled = true;
    const def = document.createElement('option');
    def.value = '';
    def.textContent = modGuilds.length
      ? 'Current server'
      : 'Selected server cannot be moderated';
    el.modGuild.appendChild(def);
    for (const g of modGuilds) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      el.modGuild.appendChild(opt);
    }

    el.modStatus.textContent = data.connected
      ? `${modGuilds.length} server${modGuilds.length === 1 ? '' : 's'}`
      : 'bot offline';
    el.modBody.hidden = modGuilds.length === 0;
    updateModActions();
  } catch {
    el.modStatus.textContent = 'unavailable';
  }
}

async function searchModMembers(query) {
  const guildId = el.modGuild.value;
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

el.modGuild.addEventListener('change', () => {
  modSelectedUser = null;
  updateModSelected();
  el.modUserList.innerHTML = '';
  el.modUserSearch.value = '';
  populateModChannels(el.modGuild.value);
  updateModActions();
});

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
    guildId: el.modGuild.value,
    action: 'ban',
    userId: modSelectedUser.id,
    reason: el.modReason.value,
  });
});

el.modKick.addEventListener('click', () => {
  if (!modSelectedUser) return;
  if (!confirm(`Kick ${modSelectedUser.name}?`)) return;
  runModAction('kick', {
    guildId: el.modGuild.value,
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
    guildId: el.modGuild.value,
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
    guildId: el.modGuild.value,
    action: 'purge',
    channelId,
    amount,
  });
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
updateEmbedPreview();

loadRules();
loadHealth();
loadServers();
loadVpnBlocklist();
loadVotes();
setInterval(loadHealth, 5000);
