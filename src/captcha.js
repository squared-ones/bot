import crypto from 'node:crypto';

// Unambiguous characters only (no 0/O, 1/I/l).
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TTL = 5 * 60 * 1000; // 5 minutes

const store = new Map(); // id -> { text, exp }

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cleanup() {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.exp <= now) store.delete(id);
  }
}

// Generates a captcha and returns its id + an SVG string (no external deps).
export function createCaptcha(length = 5) {
  cleanup();
  const text = Array.from(
    { length },
    () => CHARS[rand(0, CHARS.length - 1)]
  ).join('');
  const id = crypto.randomBytes(16).toString('hex');
  const width = 180;
  const height = 60;

  const parts = [];
  const step = width / (length + 1);
  for (let i = 0; i < length; i++) {
    const x = step * (i + 1);
    const y = height / 2 + rand(-8, 8);
    const rotate = rand(-28, 28);
    const size = rand(26, 34);
    const color = ['#8b0000', '#1a1a1a', '#003366', '#4a0033'][rand(0, 3)];
    parts.push(
      `<text x="${x}" y="${y}" font-family="monospace" font-size="${size}" font-weight="700" fill="${color}" transform="rotate(${rotate} ${x} ${y})" text-anchor="middle">${text[i]}</text>`
    );
  }

  const noise = [];
  for (let i = 0; i < 5; i++) {
    noise.push(
      `<line x1="${rand(0, width)}" y1="${rand(0, height)}" x2="${rand(
        0,
        width
      )}" y2="${rand(0, height)}" stroke="rgba(0,0,0,0.2)" stroke-width="1" />`
    );
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="captcha">` +
    `<rect width="100%" height="100%" fill="#f7f2f2" />` +
    noise.join('') +
    parts.join('') +
    `</svg>`;

  store.set(id, { text, exp: Date.now() + TTL });
  return { id, svg };
}

// Case-insensitive, single-use check.
export function verifyCaptcha(id, answer) {
  cleanup();
  const entry = store.get(String(id || ''));
  if (!entry) return false;
  store.delete(id);
  return entry.text.toLowerCase() === String(answer || '').trim().toLowerCase();
}
