import React, { useState, useEffect, useRef } from 'react';
import CardSlot from './CardSlot.jsx';

/**
 * PackModal -- fullscreen overlay that slides up to show the cards from a
 * single pack after the tear animation completes.
 *
 * Props:
 *   pack        - { packIndex, cards: Card[] }
 *   packNumber  - 1-indexed pack number
 *   totalPacks  - total packs in the box
 *   boxLabel    - e.g. "Hobby Box"
 *   brand       - set brand object { primary, shimmer[] } or null
 *   onNext      - callback fired when the user taps the advance button
 *   isLastPack  - true when this is the final pack in the box
 */
export default function PackModal({
  pack,
  packNumber,
  totalPacks,
  boxLabel,
  brand,
  onNext,
  isLastPack,
}) {
  const [cardsRevealed, setCardsRevealed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const calledRef = useRef(false);

  // Stagger the card flips in shortly after mount
  useEffect(() => {
    const t = setTimeout(() => setCardsRevealed(true), 60);
    return () => clearTimeout(t);
  }, []);

  const cards = pack?.cards ?? [];
  const hasHit = cards.some((c) => c.is_hit);

  function handleNext() {
    if (calledRef.current) return;
    calledRef.current = true;
    setExiting(true);
    // Wait for exit animation before notifying parent
    setTimeout(() => onNext(), 220);
  }

  const nextLabel = isLastPack
    ? `Open Another ${boxLabel}`
    : 'Open Next Pack';

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.88)' }}>
      {/* Slide-up sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col bg-gray-900 rounded-t-2xl overflow-hidden ${
          exiting ? 'pack-modal-exit' : 'pack-modal-enter'
        }`}
        style={{ maxHeight: '92dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-300">
              Pack {packNumber}
              <span className="text-gray-500 font-normal"> / {totalPacks}</span>
            </span>
            {hasHit && (
              <span className="text-[10px] font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
                HIT
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">{boxLabel}</span>
        </div>

        {/* Card grid -- scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="flex flex-wrap justify-center gap-3">
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

        {/* Footer action */}
        <div className="px-5 pb-6 pt-3 flex-shrink-0 border-t border-gray-800">
          <button
            onClick={handleNext}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors text-sm shadow-lg shadow-indigo-900/40"
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
