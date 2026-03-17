/**
 * scrape command -- shells out to the Python scraper via uv and writes set
 * JSON files to src/data/sets/.
 *
 * uv handles the virtual environment and dependency installation
 * automatically using scraper/pyproject.toml. No manual pip install needed.
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const SCRAPER = resolve(ROOT, 'scraper/scrape.py');

function checkUv() {
  try {
    execSync('uv --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function runScrape(opts = {}) {
  const outDir = resolve(ROOT, opts.outDir || 'src/data/sets');
  const imagesDir = resolve(ROOT, opts.imagesDir || 'public/images');
  const baseUrl = opts.baseUrl || '/pack-ripper/images/';

  if (!existsSync(SCRAPER)) {
    console.error('\nERROR: scraper/scrape.py not found.');
    process.exit(1);
  }

  if (!checkUv()) {
    console.error('\nERROR: uv is not installed or not on PATH.');
    console.error('Install it from https://github.com/astral-sh/uv\n');
    process.exit(1);
  }

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const args = [`--out "${outDir}"`];
  if (opts.url) {
    args.push(`--url "${opts.url}"`);
  }
  if (opts.noImages) {
    args.push('--no-images');
  } else {
    args.push(`--images-dir "${imagesDir}"`);
    args.push(`--base-url "${baseUrl}"`);
  }

  console.log('\npack-ripper scrape');
  console.log('='.repeat(50));
  console.log(`  Runner:     uv run`);
  console.log(`  Scraper:    ${SCRAPER}`);
  console.log(`  Output:     ${outDir}`);
  console.log(`  Images:     ${opts.noImages ? 'disabled' : imagesDir}`);
  if (opts.url) {
    console.log(`  URL:        ${opts.url}`);
  } else {
    console.log('  Mode:       all default sets');
  }
  console.log('');

  try {
    // uv run uses the root pyproject.toml / uv.lock -- no manual venv needed.
    execSync(`uv run python "${SCRAPER}" ${args.join(' ')}`, {
      cwd: ROOT,
      stdio: 'inherit',
    });

    const files = existsSync(outDir)
      ? readdirSync(outDir).filter((f) => f.endsWith('.json'))
      : [];

    console.log(`\nScrape complete. ${files.length} set file(s) in ${outDir}`);
    if (files.length > 0) {
      files.forEach((f) => console.log(`  - ${f}`));
    }
    console.log('\nCommit the updated src/data/sets/ and public/images/ files when done.\n');
  } catch {
    console.error('\nScrape failed. Check output above for details.');
    process.exit(1);
  }
}
