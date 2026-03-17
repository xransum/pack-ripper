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

  // Auto-advance: auto-tear after a brief pause so the pack art is visible
  useEffect(() => {
    if (!onAdvance || !autoAdvance || phase !== 'idle' || advancedRef.current) return;
    const t = setTimeout(() => doAdvance(), 800);
    return () => clearTimeout(t);
  }, [phase, onAdvance, autoAdvance]);

  function doAdvance() {
    if (advancedRef.current || phase !== 'idle') return;
    advancedRef.current = true;
    setPhase('tearing');
    // After tear animation completes, notify parent (modal handles cards)
    // or, in open-all mode, transition to revealed to show inline cards.
    setTimeout(() => {
      if (onAdvance) {
        onAdvance();
      } else {
        setPhase('revealed');
      }
    }, 360);
  }

  const cards = pack?.cards ?? [];
  const hasHit = cards.some((c) => c.is_hit);

  // Pack-by-pack mode: only render the pack art (modal owns the card reveal)
  if (onAdvance) {
    return (
      <PackArt
        brand={brand}
        setName={setName}
        packNumber={packNumber}
        phase={phase}
        onClick={doAdvance}
      />
    );
  }

  // Open-all mode: pack art skipped, render cards inline
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Pack {packNumber}
        </span>
        {hasHit && (
          <span className="text-[10px] font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
            HIT
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {cards.map((card, idx) => (
          <CardSlot
            key={idx}
            card={card}
            staggerIndex={idx}
            revealed={cardsRevealed}
            brand={brand}
          />
        ))}
      </div>
    </div>
  );
}
