import React, { useState, useEffect } from 'react';
import CardSlot from './CardSlot.jsx';

/**
 * PackReveal -- renders all cards in one pack, staggered flip animations.
 *
 * Props:
 *   pack        - { packIndex, cards: Card[] }
 *   packNumber  - 1-indexed pack number for display
 */
export default function PackReveal({ pack, packNumber }) {
  const [revealed, setRevealed] = useState(false);

  // Auto-flip cards after a brief mount delay so the back shows first
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(t);
  }, []);

  const cards = pack?.cards ?? [];
  const hasHit = cards.some((c) => c.is_hit);

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
            revealed={revealed}
          />
        ))}
      </div>
    </div>
  );
}
