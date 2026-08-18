import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '..');
const DEFAULT_DATA_DIR = path.join(APP_ROOT, 'data');
const DEFAULT_REPOSITORY = 'squared-ones/data';
const API_VERSION = '2022-11-28';

function isValidRepoPart(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 100 &&
    /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(value)
  );
}

function resolveSafeDataDir(candidate) {
  if (typeof candidate !== 'string' || candidate.trim() === '') return null;
  const resolved = path.resolve(candidate);
  const relative = path.relative(APP_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

export function resolveDataDir() {
  // When compiled into the standalone worker app, the source tree isn't
  // available — keep runtime data next to the executable instead.
  if (process.pkg) {
    return path.join(path.dirname(process.execPath), 'data');
  }
  const safeRoot = path.resolve(HERE, '..', 'data');
  const envDataDir = process.env.DATA_DIR;
  if (envDataDir) {
    const resolvedEnvDir = path.resolve(envDataDir);
    if (resolvedEnvDir === safeRoot || resolvedEnvDir.startsWith(`${safeRoot}${path.sep}`)) {
      return resolvedEnvDir;
    }
  }
  const localDataDir = path.resolve(HERE, 'data');
  if (fs.existsSync(localDataDir)) return localDataDir;
  return safeRoot;
}

const DATA_DIR = resolveDataDir();

function githubSettings() {
  const repository = process.env.GITHUB_DATA_REPO || DEFAULT_REPOSITORY;
  const match = repository.match(/^([^/]+)\/([^/]+)$/);
  const owner = match?.[1] || null;
  const repo = match?.[2] || null;
  return {
    token: process.env.GITHUB_TOKEN || '',
    owner: isValidRepoPart(owner) ? owner : null,
    repo: isValidRepoPart(repo) ? repo : null,
    branch: process.env.GITHUB_DATA_BRANCH || 'main',
  };
}

function isConfigured() {
  const settings = githubSettings();
  return Boolean(settings.token && settings.owner && settings.repo);
}

function encodePath(filePath) {
  return filePath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function contentsUrl(filePath = '') {
  const { owner, repo } = githubSettings();
  const suffix = filePath ? `/${encodePath(filePath)}` : '';
  return `https://api.github.com/repos/${owner}/${repo}/contents${suffix}`;
}

async function githubRequest(url, options = {}) {
  const settings = githubSettings();
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${settings.token}`,
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'squared-one-data-sync',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      body?.message || `GitHub API request failed (${response.status})`
    );
    error.status = response.status;
    throw error;
  }
  return body;
}

async function getRemoteContent(filePath) {
  const settings = githubSettings();
  return githubRequest(
    `${contentsUrl(filePath)}?ref=${encodeURIComponent(settings.branch)}`
  );
}

async function listRemoteFiles(directory = '') {
  const contents = await getRemoteContent(directory);
  if (!Array.isArray(contents)) {
    return contents?.type === 'file' ? [contents] : [];
  }

  const files = [];
  for (const entry of contents) {
    if (entry.type === 'file') {
      files.push(entry);
    } else if (entry.type === 'dir') {
      files.push(...(await listRemoteFiles(entry.path)));
    }
  }
  return files;
}

async function writeRemoteFile(filePath, content, message, sha = null) {
  const settings = githubSettings();
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: settings.branch,
  };
  if (sha) body.sha = sha;

  return githubRequest(contentsUrl(filePath), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readLocalFiles(directory, relative = '') {
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const localPath = path.join(directory, entry.name);
    const remotePath = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readLocalFiles(localPath, remotePath)));
    } else if (entry.isFile()) {
      files.push({ path: remotePath, content: await fsp.readFile(localPath) });
    }
  }
  return files;
}

async function clearLocalData() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const entries = await fsp.readdir(DATA_DIR, { withFileTypes: true });
  await Promise.all(
    entries.map((entry) =>
      fsp.rm(path.join(DATA_DIR, entry.name), { recursive: true, force: true })
    )
  );
}

function safeRemotePath(filePath) {
  const normalized = path.posix.normalize(`/${filePath}`).slice(1);
  return normalized && normalized !== '.' && !normalized.startsWith('../')
    ? normalized
    : null;
}

export async function loadDataFromGitHub() {
  if (!isConfigured()) {
    console.warn('[data] GitHub sync disabled — set GITHUB_TOKEN to use the private data repository.');
    return false;
  }

  try {
    let remoteFiles;
    try {
      remoteFiles = await listRemoteFiles();
    } catch (error) {
      // GitHub returns 409 for a repository with no commits yet.
      if (error.status !== 409) throw error;
      remoteFiles = [];
    }
    if (remoteFiles.length === 0) {
      console.log('[data] GitHub data repository is empty; seeding it from local data.');
      await syncDataFolder('Seed data repository');
      return true;
    }

    await clearLocalData();
    for (const remote of remoteFiles) {
      const relativePath = safeRemotePath(remote.path);
      if (!relativePath) continue;
      // Directory listings return file metadata without file contents. Fetch
      // each file explicitly before replacing the local runtime data.
      const file = await getRemoteContent(relativePath);
      if (typeof file?.content !== 'string') continue;
      // Accept both the documented repository-root layout and an older
      // data/ subfolder layout so existing private repositories migrate cleanly.
      const localPath = relativePath.startsWith('data/')
        ? relativePath.slice('data/'.length)
        : relativePath;
      if (!localPath) continue;
      const target = path.join(DATA_DIR, ...localPath.split('/'));
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, Buffer.from(file.content.replace(/\s/g, ''), 'base64'));
    }
    console.log(`[data] loaded ${remoteFiles.length} file${remoteFiles.length === 1 ? '' : 's'} from GitHub.`);
    return true;
  } catch (error) {
    console.error(`[data] failed to load GitHub data: ${error.message}`);
    console.warn('[data] continuing with the local data directory.');
    return false;
  }
}

export async function syncDataFolder(message = 'Sync data') {
  if (!isConfigured()) return false;
  const localFiles = await readLocalFiles(DATA_DIR);
  for (const file of localFiles) {
    let remote = null;
    try {
      remote = await getRemoteContent(file.path);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    await writeRemoteFile(file.path, file.content, `${message}: ${file.path}`, remote?.sha);
  }
  console.log(`[data] synced ${localFiles.length} file${localFiles.length === 1 ? '' : 's'} to GitHub.`);
  return true;
}

let syncQueue = Promise.resolve();

export function flushDataSync() {
  return syncQueue;
}

export function queueDataSync(message) {
  if (!isConfigured()) return syncQueue;
  syncQueue = syncQueue
    .then(() => syncDataFolder(message))
    .catch((error) => {
      console.error(`[data] failed to sync GitHub data: ${error.message}`);
    });
  return syncQueue;
}
