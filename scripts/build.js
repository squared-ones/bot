import { build } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

function obfuscate(code) {
  return JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.3,
    stringArray: true,
    stringArrayThreshold: 0.75,
    stringArrayEncoding: ['base64'],
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    selfDefending: true,
    target: 'browser',
  }).getObfuscatedCode();
}

async function obfuscateFrontend(publicDir) {
  console.log('[build] obfuscating browser scripts only…');
  const entries = await readdir(publicDir, { withFileTypes: true });
  for (const entry of entries) {
    const file = path.join(publicDir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.js')) {
      await writeFile(file, obfuscate(await readFile(file, 'utf8')));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      const obfuscated = html.replace(
        /(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/gi,
        (match, open, code, close) => `${open}${obfuscate(code)}${close}`
      );
      await writeFile(file, obfuscated);
    }
  }
}

async function main() {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

  console.log('[build] cleaning dist/');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  console.log('[build] bundling src/index.js (CJS, dependencies external)…');
  await build({
    entryPoints: [path.join(root, 'src', 'index.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    packages: 'external',
    outfile: path.join(dist, 'index.js'),
    minify: false,
    // `import.meta.url` isn't available in CJS, so replace it with a shim
    // based on Node's built-in `__filename` (points at dist/index.js).
    banner: {
      js: 'const __importMetaUrl = require("url").pathToFileURL(__filename).href;',
    },
    define: { 'import.meta.url': '__importMetaUrl' },
  });

  console.log('[build] bundling worker app (worker/index.js)…');
  await mkdir(path.join(dist, 'worker'), { recursive: true });
  await build({
    entryPoints: [path.join(root, 'worker', 'index.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    packages: 'external',
    outfile: path.join(dist, 'worker', 'index.js'),
    minify: false,
    banner: {
      js: 'const __importMetaUrl = require("url").pathToFileURL(__filename).href;',
    },
    define: { 'import.meta.url': '__importMetaUrl' },
  });
  await cp(path.join(root, 'worker', 'README.md'), path.join(dist, 'worker', 'README.md'));
  await cp(path.join(root, 'worker', '.env.example'), path.join(dist, 'worker', '.env.example'));
  const workerPkg = {
    name: 'squared-one-worker',
    version: pkg.version,
    description: 'Squared One worker app — run a Discord shard and earn SQ credits.',
    main: 'index.js',
    scripts: { start: 'node index.js' },
    engines: pkg.engines,
    dependencies: {
      'discord.js': pkg.dependencies['discord.js'],
      dotenv: pkg.dependencies.dotenv,
    },
  };
  await writeFile(
    path.join(dist, 'worker', 'package.json'),
    JSON.stringify(workerPkg, null, 2) + '\n'
  );

  console.log('[build] copying static assets…');
  await cp(path.join(root, 'public'), path.join(dist, 'public'), {
    recursive: true,
  });
  await obfuscateFrontend(path.join(dist, 'public'));
  await mkdir(path.join(dist, 'data'), { recursive: true });

  console.log('[build] copying DiscordBotClient web app…');
  if (existsSync(path.join(root, 'build'))) {
    await cp(path.join(root, 'build'), path.join(dist, 'build'), {
      recursive: true,
    });
  }
  if (existsSync(path.join(root, 'assets'))) {
    await cp(path.join(root, 'assets'), path.join(dist, 'assets'), {
      recursive: true,
    });
  }

  if (existsSync(path.join(root, '.env.example'))) {
    await cp(
      path.join(root, '.env.example'),
      path.join(dist, '.env.example')
    );
  }

  const distPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    main: 'index.js',
    scripts: { start: 'node index.js' },
    engines: pkg.engines,
    dependencies: pkg.dependencies,
  };
  await writeFile(
    path.join(dist, 'package.json'),
    JSON.stringify(distPkg, null, 2) + '\n'
  );

  console.log('[build] done → dist/');
  console.log(
    '  Deploy:  cd dist && npm install --omit=dev && cp .env.example .env && npm start'
  );
}

main().catch((err) => {
  console.error('[build] failed:', err);
  process.exit(1);
});
