import React, { useState, useEffect } from 'react';
import CardSlot from './CardSlot.jsx';

/**
 * PackReveal -- renders all cards in one pack, staggered flip animations.
 *
 * Props:
 *   pack        - { packIndex, cards: Card[] }
 *   packNumber  - 1-indexed pack number for display
 *   onAdvance   - optional callback; when provided, clicking the pack calls it
 *   autoAdvance - boolean; when true + onAdvance provided, auto-calls onAdvance
 *                 after the last card finishes flipping
 */
export default function PackReveal({ pack, packNumber, onAdvance, autoAdvance = false }) {
  const [revealed, setRevealed] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Auto-advance after last card flips (stagger 5 = 600ms delay + 600ms flip = 1200ms, +200ms buffer)
  useEffect(() => {
    if (!onAdvance || !autoAdvance || !revealed || advanced) return;
    const t = setTimeout(() => {
      setAdvanced(true);
      onAdvance();
    }, 1400);
    return () => clearTimeout(t);
  }, [revealed, onAdvance, autoAdvance, advanced]);

  function handleClick() {
    if (!onAdvance || advanced) return;
    setAdvanced(true);
    onAdvance();
  }

  const cards = pack?.cards ?? [];
  const hasHit = cards.some((c) => c.is_hit);
  const clickable = !!onAdvance && !advanced;

  return (
    <div
      className={`flex flex-col gap-3 ${clickable ? 'cursor-pointer select-none' : ''}`}
      onClick={clickable ? handleClick : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Pack {packNumber}
        </span>
        {hasHit && (
          <span className="text-[10px] font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
            HIT
          </span>
        )}
        {clickable && (
          <span className="text-[10px] text-gray-500 ml-auto">
            click to continue
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {cards.map((card, idx) => (
          <CardSlot
            key={idx}
            card={card}
            staggerIndex={idx}
            revealed={revealed}
          />
        ))}
      </div>
    </div>
  );
}
