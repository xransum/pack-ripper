#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf8')
);

program
  .name('pack-ripper')
  .description('Trading card pack opening simulator -- scrape Beckett checklists and rip virtual boxes')
  .version(pkg.version);

program
  .command('scrape')
  .description(
    'Scrape Beckett checklist pages and write card set JSON to src/data/sets/. ' +
    'Run once per set, then commit the output.'
  )
  .option('--url <url>', 'Scrape a specific Beckett checklist URL instead of all defaults')
  .option('--out <dir>', 'Output directory for set JSON files', 'src/data/sets')
  .action(async (opts) => {
    const { runScrape } = await import('../src/cli/scrape.js');
    await runScrape({ url: opts.url, outDir: opts.out });
  });

program
  .command('build')
  .description(
    'Build the static site into dist/ using Vite. ' +
    'Requires at least one set JSON in src/data/sets/ (run scrape first).'
  )
  .option(
    '--base <path>',
    'Base URL path for GitHub Pages (default: /pack-ripper/)',
    '/pack-ripper/'
  )
  .action(async (opts) => {
    const { runBuild } = await import('../src/cli/build.js');
    runBuild({ base: opts.base });
  });

program.parse();
