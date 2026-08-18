// Squared One worker — standalone app packaging
// ---------------------------------------------
// Bundles the worker (including discord.js) into a single file, compiles it
// into native executables with @yao-pkg/pkg, and wraps them in platform
// archives ready to attach to a GitHub release:
//
//   squared-one-worker-windows-x64.zip   (contains .exe)
//   squared-one-worker-linux-x64.tar.gz
//   squared-one-worker-linux-arm64.tar.gz
//   squared-one-worker-macos-x64.tar.gz
//   squared-one-worker-macos-arm64.tar.gz
//
// The packaged app keeps its `.env` and `data/` folder next to the
// executable (see worker/index.js and src/github-data.js).
//
// Options:
//   --targets <os1,os2,…>   only build these platforms (windows|linux|macos)
//   --codesign              ad-hoc sign macOS binaries with codesign (run on
//                           a macOS machine — required for the executables to
//                           launch; Linux can't produce valid signatures)
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outRoot = path.join(root, 'dist', 'worker-release');
const buildDir = path.join(outRoot, '.build');
const binDir = path.join(outRoot, 'bin');

// (platform, arch, pkg target) -> archive name. Archive names are the GitHub
// release asset names the dashboard links to. Targets must match base binaries
// published in the yao-pkg/pkg-fetch release (node22 is the newest LTS line
// with all five platform/arch combos).
const TARGETS = [
  { os: 'windows', arch: 'x64', target: 'node22-win-x64', exe: true },
  { os: 'linux', arch: 'x64', target: 'node22-linux-x64', exe: false },
  { os: 'linux', arch: 'arm64', target: 'node22-linux-arm64', exe: false },
  { os: 'macos', arch: 'x64', target: 'node22-macos-x64', exe: false },
  { os: 'macos', arch: 'arm64', target: 'node22-macos-arm64', exe: false },
];

function archiveName(t) {
  const ext = t.os === 'windows' ? 'zip' : 'tar.gz';
  return `squared-one-worker-${t.os}-${t.arch}.${ext}`;
}

// Unique per-target executable name (pkg would otherwise overwrite a shared
// output path when compiling several targets in sequence).
function binaryName(t) {
  return t.exe
    ? `squared-one-worker-${t.os}-${t.arch}.exe`
    : `squared-one-worker-${t.os}-${t.arch}`;
}

// The name the executable gets inside its archive.
function archiveBinaryName(t) {
  return t.exe ? 'squared-one-worker.exe' : 'squared-one-worker';
}

function pkgBin() {
  const bin = path.join(root, 'node_modules', '@yao-pkg', 'pkg', 'lib-es5', 'bin.js');
  if (!existsSync(bin)) throw new Error('@yao-pkg/pkg is not installed — run `npm install` first');
  return bin;
}

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

function runZip(outFile, files, cwd) {
  // Junk paths so the archive extracts straight into the current folder.
  run('zip', ['-j', '-q', outFile, ...files], cwd);
}

function runTarGz(outFile, files, cwd) {
  run(
    'tar',
    ['-czf', outFile, ...files.map((f) => path.basename(f))],
    cwd
  );
}

async function bundle() {
  console.log('[worker-pkg] bundling worker with all dependencies…');
  await mkdir(buildDir, { recursive: true });
  await build({
    entryPoints: [path.join(root, 'worker', 'index.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    outfile: path.join(buildDir, 'worker.js'),
    minify: true,
    // `import.meta.url` isn't available in CJS — point it at the bundle file.
    banner: {
      js: 'const __importMetaUrl = require("url").pathToFileURL(__filename).href;',
    },
    define: { 'import.meta.url': '__importMetaUrl' },
  });
  return path.join(buildDir, 'worker.js');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { targets: null, codesign: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--codesign') {
      out.codesign = true;
    } else if (arg === '--targets') {
      out.targets = (args[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--targets=')) {
      out.targets = arg.slice('--targets='.length).split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return out;
}

// Ad-hoc sign macOS binaries so the kernel accepts them. Only meaningful on
// a macOS machine — `codesign` doesn't exist elsewhere, which is fine for
// linux/windows-only builds.
function codesignMacos(targets) {
  if (!targets.some((t) => t.os === 'macos')) return;
  try {
    for (const t of targets.filter((x) => x.os === 'macos')) {
      execFileSync('codesign', ['--sign', '-', path.join(binDir, binaryName(t))], { stdio: 'ignore' });
      console.log(`[worker-pkg]   ad-hoc signed ${binaryName(t)}`);
    }
  } catch (error) {
    console.warn('[worker-pkg] codesign unavailable — macOS binaries left unsigned:', error.message);
  }
}

async function main() {
  const opts = parseArgs();
  let targets = TARGETS;
  if (opts.targets) {
    const wanted = new Set(opts.targets);
    targets = TARGETS.filter((t) => wanted.has(t.os));
    const missing = [...wanted].filter((os) => !TARGETS.some((t) => t.os === os));
    if (missing.length) throw new Error(`unknown platform(s): ${missing.join(', ')} (expected windows|linux|macos)`);
  }

  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const version = pkg.version || '1.0.0';

  await rm(outRoot, { recursive: true, force: true });
  const bundlePath = await bundle();

  await mkdir(binDir, { recursive: true });
  // README + .env template ride along in every archive, flattened next to
  // the executable so the archive extracts into a usable folder.
  await cp(path.join(root, 'worker', 'README.md'), path.join(binDir, 'README.md'));
  await cp(path.join(root, 'worker', '.env.example'), path.join(binDir, '.env.example'));

  console.log('[worker-pkg] compiling executables with pkg (first run downloads Node runtimes)…');
  for (const t of targets) {
    const out = path.join(binDir, binaryName(t));
    console.log(`[worker-pkg]   ${t.target} → ${binaryName(t)}`);
    run('node', [pkgBin(), '--targets', t.target, '--compress', 'GZip', '--output', out, bundlePath], root);
  }

  if (opts.codesign) codesignMacos(targets);

  console.log('[worker-pkg] creating archives…');
  const docFiles = ['README.md', '.env.example'].map((f) => path.join(binDir, f));
  const pkgDir = path.join(binDir, '.package');
  for (const t of targets) {
    await rm(pkgDir, { recursive: true, force: true });
    await mkdir(pkgDir, { recursive: true });
    // Stage the per-target binary under its friendly name, next to the docs,
    // so every archive extracts into a ready-to-run folder.
    await cp(path.join(binDir, binaryName(t)), path.join(pkgDir, archiveBinaryName(t)));
    await cp(path.join(binDir, 'README.md'), path.join(pkgDir, 'README.md'));
    await cp(path.join(binDir, '.env.example'), path.join(pkgDir, '.env.example'));

    const outFile = path.join(outRoot, archiveName(t));
    if (t.os === 'windows') {
      runZip(outFile, ['squared-one-worker.exe', 'README.md', '.env.example'], pkgDir);
    } else {
      runTarGz(outFile, ['squared-one-worker', 'README.md', '.env.example'], pkgDir);
    }
    console.log(`[worker-pkg]   ${archiveName(t)} (${(await readFile(outFile)).length / 1024 / 1024 | 0} MB)`);
  }
  await rm(pkgDir, { recursive: true, force: true });

  await rm(buildDir, { recursive: true, force: true });
  console.log(`[worker-pkg] done → ${outRoot} (worker app v${version})`);
}

main().catch((err) => {
  console.error('[worker-pkg] failed:', err.message);
  process.exit(1);
});
