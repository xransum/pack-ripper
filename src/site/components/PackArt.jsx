import React, { useMemo } from 'react';

/**
 * PackArt -- a trading-card-pack graphic with a tear-line animation.
 *
 * Props:
 *   brand      - { primary: string, shimmer: string[] } from set JSON
 *   setName    - display name of the set (e.g. "2025 Donruss Optic Football")
 *   packNumber - 1-indexed pack number
 *   phase      - 'idle' | 'tearing' | 'revealed'
 *   onClick    - called when the pack is clicked in idle phase
 *
 * The pack is 140x220px to match the card scene dimensions.
 * It is split into a flap (~22% = ~48px) and a body (~78% = ~172px) at the
 * tear line. A zigzag SVG clipPath makes the split look like a physical tear.
 */

const PACK_W = 140;
const PACK_H = 220;
const FLAP_H = 48;       // height of the tearable top portion
const TOOTH_W = 14;      // width of each zigzag tooth
const TOOTH_H = 7;       // amplitude of each tooth

/**
 * Build a zigzag polygon across the full pack width at a given y-baseline.
 * direction: 'down' means teeth point downward (flap bottom edge),
 *            'up'   means teeth point upward   (body top edge, mirror).
 * Returns a points string for use in <polygon>.
 */
function zigzagPoints(baseY, direction) {
  const points = [];
  const steps = Math.ceil(PACK_W / TOOTH_W);
  const dy = direction === 'down' ? TOOTH_H : -TOOTH_H;

  // Walk left to right along the zigzag
  for (let i = 0; i <= steps; i++) {
    const x = Math.min(i * TOOTH_W, PACK_W);
    const y = i % 2 === 0 ? baseY : baseY + dy;
    points.push(`${x},${y}`);
  }

  return points;
}

/**
 * Build the <polygon> points string for the flap clip region.
 * The flap occupies the top FLAP_H px, with a zigzag along its bottom edge
 * that points downward. The clip region is a closed polygon.
 */
function flapClipPoints() {
  const zigzag = zigzagPoints(FLAP_H, 'down');
  // Close: go to bottom-right (with slight overshoot), top-right, top-left
  return [
    `0,0`,
    ...zigzag,
    `${PACK_W},0`,
  ].join(' ');
}

/**
 * Build the <polygon> points string for the body clip region.
 * The body occupies from FLAP_H to PACK_H, with a zigzag along its top edge
 * that points upward (mirror of the flap bottom).
 */
function bodyClipPoints() {
  const zigzag = zigzagPoints(FLAP_H, 'up');
  // Close: go to bottom-right, bottom-left
  return [
    `0,${PACK_H}`,
    ...zigzag,
    `${PACK_W},${PACK_H}`,
  ].join(' ');
}

/**
 * Build a CSS linear-gradient string from the shimmer color array.
 * The gradient sweeps at 135deg for that angled foil look.
 */
function shimmerGradient(shimmer) {
  if (!shimmer || shimmer.length === 0) {
    return 'linear-gradient(135deg, #1e3a8a, #4f46e5, #7c3aed)';
  }
  const stops = shimmer.map((color, i) => {
    const pct = Math.round((i / (shimmer.length - 1)) * 100);
    return `${color} ${pct}%`;
  });
  return `linear-gradient(135deg, ${stops.join(', ')})`;
}

export default function PackArt({ brand, setName, packNumber, phase, onClick }) {
  const primary = brand?.primary ?? '#0a0a1e';
  const shimmer = brand?.shimmer ?? ['#1e3a8a', '#4f46e5', '#7c3aed', '#db2777', '#ea580c'];

  const foilGradient = useMemo(() => shimmerGradient(shimmer), [shimmer]);

  // Parse set name into lines: year + brand name / sport
  // e.g. "2025 Donruss Optic Football" -> year="2025", brand="DONRUSS OPTIC", sport="FOOTBALL"
  const yearMatch = setName?.match(/^(\d{4})\s+(.+)$/);
  const year = yearMatch ? yearMatch[1] : '';
  const rest = yearMatch ? yearMatch[2] : (setName ?? '');
  // Split off trailing sport word if present
  const sportMatch = rest.match(/^(.+?)\s+(Football|Basketball|Baseball|Hockey|Soccer)$/i);
  const brandLine = sportMatch ? sportMatch[1].toUpperCase() : rest.toUpperCase();
  const sportLine = sportMatch ? sportMatch[2].toUpperCase() : '';

  const isIdle = phase === 'idle';
  const isTearing = phase === 'tearing';

  const sceneClass = [
    'relative overflow-hidden rounded-xl select-none',
    isIdle ? 'pack-idle' : '',
    isTearing ? 'pack-tearing' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      style={{ width: PACK_W, height: PACK_H }}
      className={sceneClass}
      onClick={isIdle ? onClick : undefined}
      role={isIdle ? 'button' : undefined}
      aria-label={isIdle ? `Open Pack ${packNumber}` : undefined}
    >
      {/* SVG clip path definitions -- zero-size, just defines the shapes */}
      <svg
        width="0"
        height="0"
        style={{ position: 'absolute' }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`pack-flap-clip-${packNumber}`} clipPathUnits="userSpaceOnUse">
            <polygon points={flapClipPoints()} />
          </clipPath>
          <clipPath id={`pack-body-clip-${packNumber}`} clipPathUnits="userSpaceOnUse">
            <polygon points={bodyClipPoints()} />
          </clipPath>
        </defs>
      </svg>

      {/* Flap -- tears upward */}
      <div
        className="pack-flap absolute inset-0"
        style={{ clipPath: `url(#pack-flap-clip-${packNumber})` }}
      >
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{ background: primary }}
        />
        {/* Foil shimmer at reduced opacity */}
        <div
          className="absolute inset-0 opacity-70"
          style={{ background: foilGradient }}
        />
        {/* Gloss streak */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.9) 50%, transparent 80%)',
          }}
        />
        {/* Set name in the flap */}
        <div className="absolute inset-0 flex items-center justify-center px-2">
          <span
            className="text-white font-black text-center leading-none"
            style={{ fontSize: 9, letterSpacing: '0.12em' }}
          >
            {brandLine}
          </span>
        </div>
      </div>

      {/* Body -- stays briefly then fades */}
      <div
        className="pack-body absolute inset-0"
        style={{ clipPath: `url(#pack-body-clip-${packNumber})` }}
      >
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{ background: primary }}
        />
        {/* Full-body foil shimmer */}
        <div
          className="absolute inset-0 opacity-60"
          style={{ background: foilGradient }}
        />
        {/* Diagonal gloss sweep */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            background: 'linear-gradient(120deg, transparent 15%, rgba(255,255,255,0.85) 45%, transparent 75%)',
          }}
        />
        {/* Dark vignette at edges */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
          }}
        />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-between py-4 px-2">
          {/* Year */}
          <span
            className="text-white font-black tracking-widest opacity-90"
            style={{ fontSize: 11, marginTop: FLAP_H - 4 }}
          >
            {year}
          </span>

          {/* Pack number -- centered, large */}
          <div className="flex flex-col items-center gap-0.5">
            <span
              className="text-white/50 uppercase tracking-widest"
              style={{ fontSize: 8 }}
            >
              pack
            </span>
            <span
              className="text-white font-black"
              style={{ fontSize: 38, lineHeight: 1, textShadow: '0 0 20px rgba(255,255,255,0.4)' }}
            >
              {packNumber}
            </span>
          </div>

          {/* Sport label at bottom */}
          <span
            className="text-white/60 font-bold tracking-widest"
            style={{ fontSize: 8 }}
          >
            {sportLine}
          </span>
        </div>

        {/* Bottom card-stack depth shadow */}
        <div
          className="absolute bottom-0 left-0 right-0 opacity-60"
          style={{
            height: 12,
            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
          }}
        />

        {/* Tap hint shown in idle state */}
        {isIdle && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <span
              className="text-white/40 font-medium"
              style={{ fontSize: 8, letterSpacing: '0.1em' }}
            >
              TAP TO OPEN
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
