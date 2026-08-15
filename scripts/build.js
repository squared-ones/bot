import { build } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

async function main() {
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
    minify: true,
    // `import.meta.url` isn't available in CJS, so replace it with a shim
    // based on Node's built-in `__filename` (points at dist/index.js).
    banner: {
      js: 'const __importMetaUrl = require("url").pathToFileURL(__filename).href;',
    },
    define: { 'import.meta.url': '__importMetaUrl' },
  });

  console.log('[build] obfuscating dist/index.js…');
  const code = await readFile(path.join(dist, 'index.js'), 'utf8');
  const result = JavaScriptObfuscator.obfuscate(code, {
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
    target: 'node',
  });
  await writeFile(path.join(dist, 'index.js'), result.getObfuscatedCode());

  console.log('[build] copying static assets…');
  await cp(path.join(root, 'public'), path.join(dist, 'public'), {
    recursive: true,
  });
  await mkdir(path.join(dist, 'data'), { recursive: true });

  if (existsSync(path.join(root, '.env.example'))) {
    await cp(
      path.join(root, '.env.example'),
      path.join(dist, '.env.example')
    );
  }

  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
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
