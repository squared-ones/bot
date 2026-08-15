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
    if (data.bot?.connected && !channelsLoaded) loadChannels();
  } catch (err) {
    setBotStatus(false);
    el.statUptime.textContent = '--';
  }
}

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

async function loadChannels() {
  try {
    const res = await apiFetch('/api/channels');
    if (!res.ok) throw new Error('failed to load channels');
    const data = await res.json();
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
loadChannels();
updateEmbedPreview();

loadRules();
loadHealth();
setInterval(loadHealth, 5000);
