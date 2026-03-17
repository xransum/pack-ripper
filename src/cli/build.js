/**
 * build command -- generates the static site into dist/.
 *
 * Wraps `vite build` with the correct config path and base URL.
 * The VITE_BASE_PATH env var controls the GitHub Pages subpath
 * (defaults to /pack-ripper/).
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const DATA_SETS_DIR = resolve(ROOT, 'src/data/sets');

export function runBuild(opts = {}) {
  if (!existsSync(DATA_SETS_DIR)) {
    console.error('\nERROR: src/data/sets/ not found.');
    console.error('Run "pack-ripper scrape" first to generate set data files.\n');
    process.exit(1);
  }

  const setFiles = readdirSync(DATA_SETS_DIR).filter((f) => f.endsWith('.json'));

  if (setFiles.length === 0) {
    console.error('\nERROR: No set JSON files found in src/data/sets/.');
    console.error('Run "pack-ripper scrape" first to generate set data files.\n');
    process.exit(1);
  }

  const basePath = opts.base || process.env.VITE_BASE_PATH || '/pack-ripper/';

  console.log('\npack-ripper build');
  console.log('='.repeat(50));
  console.log(`  Base path: ${basePath}`);
  console.log(`  Sets:      ${setFiles.length} file(s)`);
  setFiles.forEach((f) => console.log(`    - ${f}`));
  console.log(`  Output:    ${resolve(ROOT, 'dist')}\n`);

  try {
    execSync(`node "${resolve(ROOT, 'node_modules/.bin/vite')}" build --base "${basePath}"`, {
      cwd: resolve(__dirname, '../site'),
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_BASE_PATH: basePath,
      },
    });
    console.log('\nBuild complete. Deploy dist/ to your gh-pages branch:\n');
    console.log('  npx gh-pages -d dist\n');
  } catch {
    console.error('\nBuild failed.');
    process.exit(1);
  }
}
