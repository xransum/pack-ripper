/**
 * Simulation engine -- resolves a full box opening into an array of packs,
 * each pack being an array of pulled cards.
 *
 * openBox(setData, boxTypeKey, caseState) -> Pack[]
 *
 * Pack: { cards: Card[] }
 * Card: { number, name, team, is_rookie, image_url, parallel, slot, is_hit }
 */

// ---------------------------------------------------------------------------
// Weighted random helpers
// ---------------------------------------------------------------------------

/**
 * Pick one item from an array at random (uniform).
 */
export function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Weighted pick. items is an array of { ...data, weight }.
 * Falls back to uniform if no weights present.
 */
export function weightedPick(items) {
  if (!items || items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight ?? 1;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
// Parallel resolution
// ---------------------------------------------------------------------------

/**
 * Build a weighted list of parallels from the set's parallel definitions.
 * Higher print runs = more common = higher weight.
 * Cards with excluded_from_sim are never included.
 */
function buildParallelPool(parallels) {
  const eligible = parallels.filter((p) => !p.excluded_from_sim);
  return eligible.map((p) => ({
    ...p,
    // No print run = base holo = most common. Use 10000 as a stand-in weight.
    weight: p.print_run === null ? 10000 : Math.max(1, p.print_run),
  }));
}

/**
 * Roll for a parallel on a card. Returns the parallel name, or null for base.
 * Base (no parallel) gets the majority of weight.
 */
function rollParallel(parallels, forceParallel = null) {
  if (forceParallel) return forceParallel;
  if (!parallels || parallels.length === 0) return null;

  const pool = buildParallelPool(parallels);
  // Add a heavy "base" option so most cards come out base
  const baseWeight = pool.reduce((s, p) => s + p.weight, 0) * 4;
  const withBase = [{ name: null, weight: baseWeight }, ...pool];
  const picked = weightedPick(withBase);
  return picked?.name ?? null;
}

// ---------------------------------------------------------------------------
// Card pool pickers
// ---------------------------------------------------------------------------

function pickFromPool(setData, pool, parallelOverride = null) {
  let cards = [];
  if (pool === 'base') cards = setData.cards.base ?? [];
  else if (pool === 'rated_rookies') cards = setData.cards.rated_rookies ?? [];
  else if (pool === 'autographs') {
    // Flatten all auto arrays from inserts
    cards = Object.values(setData.cards.inserts ?? {}).flat();
  }

  const card = pickRandom(cards);
  if (!card) return null;

  const parallelDefs =
    pool === 'rated_rookies'
      ? setData.cards.parallels?.rated_rookies ?? []
      : setData.cards.parallels?.base ?? [];

  const parallel = rollParallel(parallelDefs, parallelOverride);

  return {
    ...card,
    parallel,
    is_hit: false,
    slot: pool,
  };
}

// ---------------------------------------------------------------------------
// Hit insert resolution
// ---------------------------------------------------------------------------

/**
 * Build a weighted pool of hit insert cards across all hit insert categories.
 * Rarer categories (fewer cards) get less total weight so the distribution
 * stays realistic.
 */
function buildHitPool(setData) {
  const hitKeys = setData.cards.hit_inserts ?? [];
  const pool = [];

  for (const key of hitKeys) {
    const cards = setData.cards.inserts?.[key] ?? [];
    if (cards.length === 0) continue;
    // Each card in the category gets equal weight within that category.
    // Category weight is proportional to its card count (larger sets = more
    // pulls), with a slight bias toward rarer smaller sets (Downtown etc.).
    const categoryWeight = Math.max(1, cards.length);
    for (const card of cards) {
      pool.push({ ...card, _category: key, weight: categoryWeight });
    }
  }

  return pool;
}

function buildJunkPool(setData) {
  const junkKeys = setData.cards.junk_inserts ?? [];
  const pool = [];
  for (const key of junkKeys) {
    const cards = setData.cards.inserts?.[key] ?? [];
    for (const card of cards) {
      pool.push({ ...card, _category: key, weight: 1 });
    }
  }
  return pool;
}

/**
 * Resolve the insert slot for a pack.
 * Returns a card marked is_hit=true if the hit fires, otherwise a junk insert.
 */
function resolveInsertSlot(setData, hitChance) {
  const hitRoll = Math.random();

  if (hitRoll < hitChance) {
    const hitPool = buildHitPool(setData);
    if (hitPool.length === 0) return null;
    const card = weightedPick(hitPool);
    return card
      ? { ...card, parallel: null, is_hit: true, slot: 'insert' }
      : null;
  }

  // No hit -- pull a junk insert
  const junkPool = buildJunkPool(setData);
  if (junkPool.length === 0) return null;
  const card = pickRandom(junkPool);
  return card
    ? { ...card, parallel: null, is_hit: false, slot: 'insert' }
    : null;
}

// ---------------------------------------------------------------------------
// Hobby blaster pack builder
//
// 6 packs x 4 cards:
//   Every pack:      1 base rookie + 2 base veterans
//   Packs 1, 3, 5:  + 1 Blue Scope Rated Rookie parallel
//   Pack 6:         + 1 insert slot (hit-eligible)
// ---------------------------------------------------------------------------

function buildHobbyBlasterBox(setData, caseState) {
  const packs = [];
  let hitFiredThisBox = false;

  for (let i = 0; i < 6; i++) {
    const cards = [];

    // Base rookie
    const rookie = pickFromPool(setData, 'rated_rookies');
    if (rookie) cards.push({ ...rookie, slot: 'base_rookie' });

    // 2 base veterans
    for (let j = 0; j < 2; j++) {
      const base = pickFromPool(setData, 'base');
      if (base) cards.push({ ...base, slot: 'base' });
    }

    // Blue Scope Rated Rookie on packs 0, 2, 4 (every other pack)
    if (i % 2 === 0) {
      const scope = pickFromPool(setData, 'rated_rookies', 'Blue Scope');
      if (scope) cards.push({ ...scope, slot: 'parallel_rookie' });
    }

    // Insert slot on the last pack
    if (i === 5) {
      const insert = resolveInsertSlot(setData, caseState.hitChance);
      if (insert) {
        cards.push(insert);
        if (insert.is_hit) hitFiredThisBox = true;
      }
    }

    packs.push({ packIndex: i, cards });
  }

  return { packs, hitFiredThisBox };
}

// ---------------------------------------------------------------------------
// Generic pack-based box builder (hobby, FOTL, H2)
// Uses the guarantees object from box config to build one flat pool of cards
// spread evenly across packs.
// ---------------------------------------------------------------------------

function buildGenericPackBox(setData, boxConfig, caseState) {
  const packsPerBox = boxConfig.packs_per_box ?? 20;
  const cardsPerPack = boxConfig.cards_per_pack ?? 4;
  const guarantees = boxConfig.guarantees ?? {};
  const packs = [];
  let hitFiredThisBox = false;

  // Pre-resolve guaranteed hits/autos
  const autoCount = guarantees['Autographs'] ?? 0;
  const insertCount = guarantees['Inserts'] ?? 0;
  const baseRookieCount = guarantees['Base Rated Rookies'] ?? 0;
  const holoCount = guarantees['Holo Parallels'] ?? 0;

  // Assign guaranteed slots spread across packs
  const slots = [];
  for (let i = 0; i < autoCount; i++) slots.push('auto');
  for (let i = 0; i < insertCount; i++) slots.push('insert');
  for (let i = 0; i < holoCount; i++) slots.push('holo');
  for (let i = 0; i < baseRookieCount; i++) slots.push('base_rookie');

  // Shuffle slots
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  let slotIdx = 0;

  for (let i = 0; i < packsPerBox; i++) {
    const cards = [];
    const packCapacity = cardsPerPack;

    // Fill guaranteed slots for this pack first
    while (slotIdx < slots.length && cards.length < packCapacity) {
      const s = slots[slotIdx++];
      if (s === 'auto') {
        // Autos are guaranteed hits -- always pull from the hit pool.
        // They do NOT affect the pity system because there is no uncertainty:
        // every box of this type contains an auto by definition.
        const insert = resolveInsertSlot(setData, 1.0);
        if (insert) cards.push(insert);
      } else if (s === 'insert') {
        const insert = resolveInsertSlot(setData, caseState.hitChance);
        if (insert) {
          // Only pity-gated inserts (not guaranteed autos) should drive the
          // hit chance reset in the case state machine.
          if (insert.is_hit) hitFiredThisBox = true;
          cards.push(insert);
        }
      } else if (s === 'holo') {
        const card = pickFromPool(setData, 'base', 'Holo');
        if (card) cards.push({ ...card, slot: 'holo_parallel' });
      } else if (s === 'base_rookie') {
        const card = pickFromPool(setData, 'rated_rookies');
        if (card) cards.push({ ...card, slot: 'base_rookie' });
      }
    }

    // Pad with base cards
    while (cards.length < packCapacity) {
      const base = pickFromPool(setData, 'base');
      if (base) cards.push(base);
      else break;
    }

    packs.push({ packIndex: i, cards });
  }

  return { packs, hitFiredThisBox };
}

// ---------------------------------------------------------------------------
// Flat box builder (blaster, mega, choice)
// Returns a single "pack" containing all guaranteed cards.
// ---------------------------------------------------------------------------

function buildFlatBox(setData, boxConfig, caseState) {
  const guarantees = boxConfig.guarantees ?? {};
  const cards = [];
  let hitFiredThisBox = false;

  for (const [label, count] of Object.entries(guarantees)) {
    const labelLower = label.toLowerCase();
    for (let i = 0; i < count; i++) {
      if (/auto|memorabilia|mem/.test(labelLower)) {
        const insert = resolveInsertSlot(setData, 1.0);
        if (insert) {
          if (insert.is_hit) hitFiredThisBox = true;
          cards.push(insert);
        }
      } else if (/rated rookie/.test(labelLower)) {
        const parallelMatch = label.match(/^(.+?)\s+Rated Rookie/i);
        const parallel = parallelMatch ? parallelMatch[1].trim() : null;
        const card = pickFromPool(setData, 'rated_rookies', parallel);
        if (card) cards.push({ ...card, slot: 'base_rookie' });
      } else if (/holo/.test(labelLower)) {
        const card = pickFromPool(setData, 'base', 'Holo');
        if (card) cards.push({ ...card, slot: 'holo_parallel' });
      }
    }
  }

  return { packs: [{ packIndex: 0, cards }], hitFiredThisBox };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open one box and return the result.
 *
 * @param {object} setData   - parsed set JSON
 * @param {string} boxTypeKey - e.g. "hobby_blaster"
 * @param {object} caseState  - { hitChance, boxesOpened, hitsInCase }
 * @returns {{ packs: Pack[], hitFired: boolean }}
 */
export function openBox(setData, boxTypeKey, caseState) {
  const boxConfig = setData.box_types?.[boxTypeKey];
  if (!boxConfig) {
    throw new Error(`Unknown box type: ${boxTypeKey}`);
  }

  const tier = boxConfig.tier ?? 'pack';

  if (boxTypeKey === 'hobby_blaster') {
    const { packs, hitFiredThisBox } = buildHobbyBlasterBox(setData, caseState);
    return { packs, hitFired: hitFiredThisBox };
  }

  if (tier === 'pack') {
    const { packs, hitFiredThisBox } = buildGenericPackBox(setData, boxConfig, caseState);
    return { packs, hitFired: hitFiredThisBox };
  }

  // flat
  const { packs, hitFiredThisBox } = buildFlatBox(setData, boxConfig, caseState);
  return { packs, hitFired: hitFiredThisBox };
}
