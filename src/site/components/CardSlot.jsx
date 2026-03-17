import React, { useState, useEffect } from 'react';

const SLOT_LABELS = {
  base: 'Base',
  base_rookie: 'Rated Rookie',
  parallel_rookie: 'Parallel Rookie',
  holo_parallel: 'Holo Parallel',
  numbered_parallel: 'Numbered Parallel',
  insert: 'Insert',
  auto: 'Auto',
};

function parallelBadgeClass(parallel) {
  if (!parallel) return '';
  const p = parallel.toLowerCase();
  if (p.includes('gold vinyl')) return 'bg-yellow-400 text-yellow-900';
  if (p.includes('gold')) return 'bg-yellow-400 text-yellow-900';
  if (p.includes('red')) return 'bg-red-500 text-white';
  if (p.includes('blue')) return 'bg-blue-500 text-white';
  if (p.includes('green')) return 'bg-green-500 text-white';
  if (p.includes('purple')) return 'bg-purple-500 text-white';
  if (p.includes('orange')) return 'bg-orange-500 text-white';
  if (p.includes('pink')) return 'bg-pink-500 text-white';
  if (p.includes('holo') || p.includes('prizm')) return 'bg-indigo-400 text-white';
  return 'bg-gray-400 text-gray-900';
}

/**
 * CardSlot -- renders a single card with a 3D flip reveal animation.
 *
 * Props:
 *   card        - card object from the simulator engine
 *   staggerIndex - integer 0-5 for CSS transition delay class
 *   revealed    - boolean controlling whether the flip has played
 */
export default function CardSlot({ card, staggerIndex = 0, revealed = false }) {
  const [imgError, setImgError] = useState(false);
  const base = import.meta.env.BASE_URL;
  const fallback = `${base}card-back.svg`;

  const staggerClass = `card-stagger-${Math.min(staggerIndex, 5)}`;

  const isHit = card?.is_hit;
  const parallel = card?.parallel;

  // Glow ring for hits and named parallels
  const glowClass = isHit
    ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/40'
    : parallel
    ? 'ring-1 ring-indigo-400 shadow-md shadow-indigo-400/30'
    : '';

  return (
    <div className={`card-scene w-[140px] h-[196px] ${staggerClass}`}>
      <div className={`card-flipper w-full h-full ${revealed ? 'flipped' : ''} ${staggerClass}`}>
        {/* Back face */}
        <div className="card-face card-face-back w-full h-full rounded-xl overflow-hidden">
          <img
            src={fallback}
            alt="Card back"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Front face */}
        <div className={`card-face card-face-front w-full h-full rounded-xl overflow-hidden bg-gray-900 flex flex-col ${glowClass}`}>
          {/* Card image */}
          <div className="flex-1 relative bg-gray-800">
            {card?.image_url && !imgError ? (
              <img
                src={card.image_url}
                alt={card.name}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs text-center px-2">
                {card?.name ?? 'Unknown'}
              </div>
            )}

            {/* Hit badge */}
            {isHit && (
              <div className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded">
                HIT
              </div>
            )}

            {/* Card number */}
            {card?.number != null && (
              <div className="absolute bottom-1 left-1 bg-black/60 text-gray-300 text-[9px] px-1 py-0.5 rounded">
                #{card.number}
              </div>
            )}
          </div>

          {/* Card info footer */}
          <div className="px-1.5 py-1 bg-gray-900 min-h-[48px] flex flex-col justify-center gap-0.5">
            <div className="text-white text-[10px] font-semibold leading-tight truncate">
              {card?.name ?? '--'}
            </div>
            <div className="text-gray-400 text-[9px] truncate">
              {card?.team ?? ''}
            </div>
            <div className="flex flex-wrap gap-0.5 mt-0.5">
              {parallel && (
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${parallelBadgeClass(parallel)}`}>
                  {parallel}
                </span>
              )}
              {card?.slot && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-gray-700 text-gray-300">
                  {SLOT_LABELS[card.slot] ?? card.slot}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
