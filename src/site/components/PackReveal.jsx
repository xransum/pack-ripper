import React, { useState, useEffect, useRef } from 'react';
import CardSlot from './CardSlot.jsx';
import PackArt from './PackArt.jsx';

/**
 * PackReveal -- renders one pack.
 *
 * In pack-by-pack mode (onAdvance provided), the pack starts as a PackArt
 * graphic. Clicking or auto-advancing plays a tear animation, then flips the
 * cards in with the existing stagger animation.
 *
 * In open-all mode (no onAdvance), the pack skips straight to cards.
 *
 * Props:
 *   pack        - { packIndex, cards: Card[] }
 *   packNumber  - 1-indexed pack number for display
 *   brand       - set brand object { primary, shimmer } for pack art
 *   setName     - full set name for pack art label
 *   onAdvance   - optional callback fired after tear completes
 *   autoAdvance - boolean; auto-tears after last card's flip duration
 */
export default function PackReveal({
  pack,
  packNumber,
  brand,
  setName,
  onAdvance,
  autoAdvance = false,
}) {
  // phase: 'idle' | 'tearing' | 'revealed'
  // When onAdvance is not provided (open-all mode), skip straight to revealed.
  const [phase, setPhase] = useState(() => (onAdvance ? 'idle' : 'revealed'));
  const [cardsRevealed, setCardsRevealed] = useState(() => !onAdvance);
  const advancedRef = useRef(false);

  // When the phase transitions to revealed, trigger the card flip stagger
  useEffect(() => {
    if (phase !== 'revealed') return;
    const t = setTimeout(() => setCardsRevealed(true), 60);
    return () => clearTimeout(t);
  }, [phase]);

  // Auto-advance: fires 1400ms after cards start flipping (last stagger ~600ms + 600ms flip + 200ms buffer)
  useEffect(() => {
    if (!onAdvance || !autoAdvance || phase !== 'idle' || advancedRef.current) return;
    // 1400ms (card reveal) + 350ms (tear) = 1750ms from mount
    const t = setTimeout(() => doAdvance(), 1750);
    return () => clearTimeout(t);
  }, [phase, onAdvance, autoAdvance]);

  function doAdvance() {
    if (advancedRef.current || phase !== 'idle') return;
    advancedRef.current = true;
    setPhase('tearing');
    // After tear animation completes, reveal cards and notify parent
    setTimeout(() => {
      setPhase('revealed');
      if (onAdvance) onAdvance();
    }, 360);
  }

  const cards = pack?.cards ?? [];
  const hasHit = cards.some((c) => c.is_hit);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Pack {packNumber}
        </span>
        {hasHit && phase === 'revealed' && (
          <span className="text-[10px] font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
            HIT
          </span>
        )}
      </div>

      {phase !== 'revealed' ? (
        <PackArt
          brand={brand}
          setName={setName}
          packNumber={packNumber}
          phase={phase}
          onClick={doAdvance}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          {cards.map((card, idx) => (
            <CardSlot
              key={idx}
              card={card}
              staggerIndex={idx}
              revealed={cardsRevealed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
