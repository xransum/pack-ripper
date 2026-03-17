# pack-ripper

A trading card pack opening simulator. Scrapes Beckett checklist pages to get real card lists, parallels, and box configurations, then simulates opening boxes with accurate odds and a pity system that tracks progress across a full case.

Live site: **https://xransum.github.io/pack-ripper/**

## What it does

- Scrapes Beckett checklist articles (HTML, no browser automation needed) and writes structured JSON for each card set
- Simulates opening any supported box type -- Hobby Blaster, Hobby, FOTL, H2, Blaster, Mega, Choice -- with the correct pack count, cards per pack, and guaranteed slot distribution
- Tracks hit probability across a 20-box case with a pity system: starts at 5%, increases by 5% per hitless box, caps at 95%, resets to 5% on a hit, and fully resets at the end of a case
- Persists case state to `localStorage` so progress survives page refreshes
- Reveals cards with a CSS 3D flip animation, staggered per card within each pack
- Gracefully falls back to a placeholder card back for any card without an image

## Project layout

```
pack-ripper/
  bin/pack-ripper.js          CLI entry point (commander)
  src/
    cli/
      scrape.js               scrape subcommand -- shells out to uv run python
      build.js                build subcommand -- wraps vite build
    data/
      sets/                   scraped set JSON files (committed, not generated at build time)
    site/
      vite.config.js
      index.html
      main.jsx
      components/             React UI components
      simulator/
        engine.js             box opening engine -- resolves packs, parallels, hits
        pity.js               case state machine -- hit chance + localStorage persistence
      styles/
        index.css             Tailwind v4 entry + card flip CSS
  scraper/
    scrape.py                 BeautifulSoup scraper -- fetches Beckett pages, writes JSON
  public/
    card-back.svg             fallback card back shown before reveal and on missing images
    images/                   downloaded card images (populated by npm run scrape)
  pyproject.toml              Python dependencies managed by uv
  package.json                Node dependencies + npm scripts
  .github/
    workflows/
      deploy.yml              builds and deploys to GitHub Pages on push to master
```

## Requirements

- Node >= 18 (`.nvmrc` pins Node 25)
- Python >= 3.11
- [uv](https://github.com/astral-sh/uv) for Python dependency management

Install Node dependencies:

```
npm install
```

Python dependencies are handled automatically by `uv` when you run `npm run scrape`. No manual `pip install` or virtualenv setup needed.

## Workflow

Scraping and building are intentionally separate. You scrape locally, commit the output, and CI handles the build and deploy.

### 1. Scrape a set

```
npm run scrape
```

This fetches the default set list (currently 2025 Donruss Optic Football from Beckett), downloads any card images to `public/images/`, rewrites `image_url` fields in the JSON to local paths, and writes the result to `src/data/sets/`.

To scrape a specific URL:

```
node bin/pack-ripper.js scrape --url https://www.beckett.com/news/your-set-here/
```

To skip image downloading:

```
node bin/pack-ripper.js scrape --no-images
```

### 2. Commit the output

```
git add src/data/sets/ public/images/
git commit -m "feat(sets): add 2025 donruss optic football"
git push
```

Pushing to `master` triggers the GitHub Actions workflow which builds the site and deploys it to GitHub Pages. No scraping happens in CI.

### 3. Local development

```
npm run dev
```

Starts the Vite dev server at `http://localhost:5173`.

### 4. Local build

```
npm run build
```

Builds the static site into `dist/`. Requires at least one JSON file in `src/data/sets/`.

## Adding a new set

1. Find the Beckett checklist article URL for the set
2. Run `node bin/pack-ripper.js scrape --url <url>`
3. Inspect `src/data/sets/<slug>.json` and verify the card counts look right
4. Commit `src/data/sets/<slug>.json` and any downloaded images
5. Push -- the new set will appear in the set selector on the next deploy

## Simulation rules

### Box types

Each box type is defined in the set JSON under `box_types`. The engine supports two modes:

- **Pack-based** (Hobby Blaster, Hobby, FOTL, H2): simulates individual packs with guaranteed slot distributions spread across packs
- **Flat** (Blaster, Mega, Choice): returns a single "pack" containing all guaranteed cards for the box

### Hobby Blaster specifics

The Hobby Blaster follows a fixed per-pack layout:

| Pack | Slots |
|------|-------|
| Every pack | 1 base Rated Rookie + 2 base veterans |
| Packs 1, 3, 5 | + 1 Blue Scope Rated Rookie parallel |
| Pack 6 | + 1 insert slot (hit-eligible) |

### Hit system

The insert slot resolution uses the current hit chance from the case state:

- If `Math.random() < hitChance`: pulls from the hit insert pool (Downtown, Downtown Duo, Downtown Legends, Rookie Kings, Sunday Kings, Uptowns)
- Otherwise: pulls from the junk insert pool (My House, 2015 Retro)

### Pity system

| Event | Effect |
|-------|--------|
| Box opened, no hit | `hitChance += 5%` (max 95%) |
| Box opened, hit | `hitChance` resets to 5% |
| Box 20 opened (full case) | full reset to default state |

Case state is stored in `localStorage` keyed by `pack-ripper:case:<setId>:<boxTypeKey>`.

### Parallels

Parallels are weighted by print run -- higher print run = more common. Gold Vinyl /1 cards are excluded from simulation entirely (`excluded_from_sim: true` in the JSON). Base (no parallel) gets 4x the total weight of all parallels combined so most pulls come out base.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Scraper | Python 3.11+, requests, BeautifulSoup4, uv |
| Frontend | React 18, Vite 6, Tailwind CSS v4 |
| Routing | react-router-dom v6 with HashRouter (GitHub Pages compatible) |
| CLI | Node.js, commander |
| Deploy | GitHub Actions, GitHub Pages |

## Deployment

The deploy workflow at `.github/workflows/deploy.yml` runs on every push to `master`:

1. Checks out the repo (set JSON and images are already committed)
2. Installs Node dependencies with `npm ci`
3. Runs `npm run build` (Vite reads the committed JSON at build time)
4. Uploads `dist/` and deploys to GitHub Pages

The repo's Pages source must be set to **GitHub Actions** (not the legacy `gh-pages` branch). This is already configured.
