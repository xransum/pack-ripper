/**
 * Case state machine -- tracks pity across a 20-box case.
 *
 * State is persisted to localStorage so the page can be refreshed without
 * losing progress through a case.
 *
 * Key format: "pack-ripper:case:<setId>:<boxTypeKey>"
 */

const BOXES_PER_CASE = 20;
const HIT_CHANCE_START = 0.05;
const HIT_CHANCE_INCREMENT = 0.05;
const HIT_CHANCE_MAX = 0.95;

function storageKey(setId, boxTypeKey) {
  return `pack-ripper:case:${setId}:${boxTypeKey}`;
}

function defaultState() {
  return {
    boxesOpened: 0,
    hitsInCase: 0,
    hitChance: HIT_CHANCE_START,
  };
}

/**
 * Load case state from localStorage. Returns default state if nothing stored.
 */
export function loadCaseState(setId, boxTypeKey) {
  try {
    const raw = localStorage.getItem(storageKey(setId, boxTypeKey));
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // Validate shape
    if (
      typeof parsed.boxesOpened === 'number' &&
      typeof parsed.hitsInCase === 'number' &&
      typeof parsed.hitChance === 'number'
    ) {
      return parsed;
    }
  } catch {
    // corrupted storage -- start fresh
  }
  return defaultState();
}

/**
 * Persist case state to localStorage.
 */
export function saveCaseState(setId, boxTypeKey, state) {
  try {
    localStorage.setItem(storageKey(setId, boxTypeKey), JSON.stringify(state));
  } catch {
    // storage quota exceeded or unavailable -- ignore
  }
}

/**
 * Advance the case state after opening one box.
 *
 * Rules:
 *   - If a hit fired: hitChance resets to HIT_CHANCE_START
 *   - If no hit: hitChance += HIT_CHANCE_INCREMENT (capped at HIT_CHANCE_MAX)
 *   - boxesOpened increments by 1
 *   - If boxesOpened reaches BOXES_PER_CASE: full reset
 *
 * Returns the new state.
 */
export function advanceCaseState(current, hitFired) {
  const next = { ...current };

  if (hitFired) {
    next.hitsInCase = current.hitsInCase + 1;
    next.hitChance = HIT_CHANCE_START;
  } else {
    next.hitChance = Math.min(
      current.hitChance + HIT_CHANCE_INCREMENT,
      HIT_CHANCE_MAX
    );
  }

  next.boxesOpened = current.boxesOpened + 1;

  // Full case consumed -- reset everything
  if (next.boxesOpened >= BOXES_PER_CASE) {
    return defaultState();
  }

  return next;
}

/**
 * Hard reset the case state for a given set + box type.
 */
export function resetCaseState(setId, boxTypeKey) {
  const fresh = defaultState();
  saveCaseState(setId, boxTypeKey, fresh);
  return fresh;
}

export { BOXES_PER_CASE, HIT_CHANCE_START };
