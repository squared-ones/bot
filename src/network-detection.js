import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { queueDataSync, resolveDataDir } from './github-data.js';

const LIST_SOURCES = [
  {
    url: 'https://check.torproject.org/torbulkexitlist',
    reason: 'Tor exit node',
  },
  {
    url: 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv4.txt',
    reason: 'known VPN or datacenter network',
  },
  {
    url: 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv6.txt',
    reason: 'known VPN or datacenter network',
  },
];
const LIST_TTL = 60 * 60 * 1000;
const MANUAL_BLOCKLIST_FILE = path.join(resolveDataDir(), 'vpn-blocklist.json');

let manualBlocklist = null;
let exactIps = new Map();
let cidrs = [];
let loadedAt = 0;
let refreshPromise = null;

export function normalizeIp(value) {
  let ip = String(value || '').trim().toLowerCase();
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? mapped[1] : ip;
}

function readManualBlocklist() {
  if (manualBlocklist) return manualBlocklist;
  try {
    const raw = JSON.parse(fs.readFileSync(MANUAL_BLOCKLIST_FILE, 'utf8'));
    manualBlocklist = Array.isArray(raw)
      ? raw.filter((entry) => entry && typeof entry.ip === 'string' && net.isIP(entry.ip))
      : [];
  } catch {
    manualBlocklist = [];
  }
  return manualBlocklist;
}

function saveManualBlocklist() {
  fs.mkdirSync(path.dirname(MANUAL_BLOCKLIST_FILE), { recursive: true });
  const temporary = `${MANUAL_BLOCKLIST_FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(readManualBlocklist(), null, 2)}\n`);
  fs.renameSync(temporary, MANUAL_BLOCKLIST_FILE);
  queueDataSync('Update VPN blocklist');
}

export function getManualBlocklist() {
  return readManualBlocklist().map((entry) => ({ ...entry }));
}

export function addManualBlockedIp(ip, addedBy = 'dashboard') {
  const normalized = normalizeIp(ip);
  if (!net.isIP(normalized)) throw new Error('enter a valid IPv4 or IPv6 address');
  const list = readManualBlocklist();
  if (list.some((entry) => entry.ip === normalized)) return list.find((entry) => entry.ip === normalized);
  const entry = { ip: normalized, addedAt: new Date().toISOString(), addedBy: String(addedBy) };
  list.push(entry);
  saveManualBlocklist();
  return entry;
}

export function removeManualBlockedIp(ip) {
  const normalized = normalizeIp(ip);
  const list = readManualBlocklist();
  const index = list.findIndex((entry) => entry.ip === normalized);
  if (index === -1) return false;
  list.splice(index, 1);
  saveManualBlocklist();
  return true;
}

function isManualBlocked(ip) {
  return readManualBlocklist().some((entry) => entry.ip === ip);
}

function parseIpv4(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const values = parts.map(Number);
  if (values.some((part) => part < 0 || part > 255)) return null;
  return values.reduce((value, part) => value * 256 + part, 0) >>> 0;
}

function parseIpv6(ip) {
  const normalized = normalizeIp(ip);
  if (normalized.includes('.')) return null;
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (left.some((part) => !/^[0-9a-f]{1,4}$/.test(part)) || right.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) {
    return null;
  }
  const groups = halves.length === 2
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    : left;
  if (groups.length !== 8) return null;
  return groups.reduce((value, group) => (value << 16n) | BigInt(parseInt(group, 16)), 0n);
}

function parseNetwork(value) {
  const raw = String(value || '').trim().split(/\s+/)[0];
  if (!raw) return null;
  const [address, prefixText] = raw.split('/');
  const normalized = normalizeIp(address);
  const version = net.isIP(normalized);
  if (!version) return null;
  const maxPrefix = version === 4 ? 32 : 128;
  const prefix = prefixText == null ? maxPrefix : Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) return null;
  return { address: normalized, version, prefix };
}

function addNetwork(network, reason) {
  if (network.prefix === (network.version === 4 ? 32 : 128)) {
    exactIps.set(network.address, reason);
  } else {
    const value = network.version === 4 ? parseIpv4(network.address) : parseIpv6(network.address);
    if (value == null) return;
    cidrs.push({ ...network, value, reason });
  }
}

function ipv4Matches(ip, network) {
  const value = parseIpv4(ip);
  const base = parseIpv4(network.address);
  if (value == null || base == null) return false;
  if (network.prefix === 0) return true;
  const mask = (0xffffffff << (32 - network.prefix)) >>> 0;
  return (value & mask) === (base & mask);
}

function ipv6Matches(ip, network) {
  const value = parseIpv6(ip);
  const base = network.value;
  if (value == null || base == null) return false;
  if (network.prefix === 0) return true;
  const shift = BigInt(128 - network.prefix);
  return (value >> shift) === (base >> shift);
}

async function fetchList(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'squared-one-network-detection' },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function refreshLists() {
  const nextExact = new Map();
  const nextCidrs = [];
  const results = await Promise.allSettled(LIST_SOURCES.map(fetchList));
  let loaded = 0;

  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') {
      console.warn(`[network] failed to refresh ${LIST_SOURCES[index].reason} list.`);
      return;
    }
    loaded++;
    for (const line of result.value.split(/\r?\n/)) {
      const network = parseNetwork(line);
      if (!network) continue;
      if (network.prefix === (network.version === 4 ? 32 : 128)) {
        nextExact.set(network.address, LIST_SOURCES[index].reason);
      } else {
        const value = network.version === 4
          ? parseIpv4(network.address)
          : parseIpv6(network.address);
        if (value != null) nextCidrs.push({ ...network, value, reason: LIST_SOURCES[index].reason });
      }
    }
  });

  exactIps = nextExact;
  cidrs = nextCidrs;
  loadedAt = Date.now();
  console.log(`[network] loaded ${loaded} network blocklist source${loaded === 1 ? '' : 's'} (${exactIps.size + cidrs.length} entries).`);
}

export async function refreshNetworkLists(force = false) {
  if (!force && loadedAt && Date.now() - loadedAt < LIST_TTL) return;
  if (!refreshPromise) {
    refreshPromise = refreshLists().finally(() => {
      refreshPromise = null;
    });
  }
  await refreshPromise;
}

export function getClientIp(req) {
  return normalizeIp(req.ip || req.socket?.remoteAddress || '');
}

export async function inspectIp(ip, useNetworkLists = true) {
  const normalized = normalizeIp(ip);
  if (!net.isIP(normalized)) return { blocked: false, reason: null };
  if (isManualBlocked(normalized)) {
    return { blocked: true, reason: 'manually flagged VPN IP' };
  }
  if (!useNetworkLists) return { blocked: false, reason: null };
  await refreshNetworkLists();

  const exactReason = exactIps.get(normalized);
  if (exactReason) return { blocked: true, reason: exactReason };

  const network = cidrs.find((entry) =>
    entry.version === 4
      ? ipv4Matches(normalized, entry)
      : ipv6Matches(normalized, entry)
  );
  return network
    ? { blocked: true, reason: network.reason }
    : { blocked: false, reason: null };
}
