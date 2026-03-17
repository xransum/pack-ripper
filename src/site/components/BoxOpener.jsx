import React, { useState, useCallback } from 'react';
import PackReveal from './PackReveal.jsx';
import CaseTracker from './CaseTracker.jsx';
import { openBox } from '@simulator/engine.js';
import {
  loadCaseState,
  saveCaseState,
  advanceCaseState,
  resetCaseState,
  DEFAULT_BOXES_PER_CASE,
} from '@simulator/pity.js';

const MODE_KEY = 'pack-ripper:mode';
const AUTO_KEY = 'pack-ripper:auto-advance';

function loadMode() {
  try { return localStorage.getItem(MODE_KEY) === 'pbp'; } catch { return false; }
}
function saveMode(pbp) {
  try { localStorage.setItem(MODE_KEY, pbp ? 'pbp' : 'all'); } catch {}
}
function loadAuto() {
  try { return localStorage.getItem(AUTO_KEY) === '1'; } catch { return false; }
}
function saveAuto(v) {
  try { localStorage.setItem(AUTO_KEY, v ? '1' : '0'); } catch {}
}

/**
 * BoxOpener -- the main interaction panel.
 * Manages case state, fires the engine, and renders pack results.
 *
 * Props:
 *   setData    - full parsed set JSON object
 *   boxTypeKey - key string (e.g. "hobby_blaster")
 */
export default function BoxOpener({ setData, boxTypeKey }) {
  const [caseState, setCaseState] = useState(() =>
    loadCaseState(setData.id, boxTypeKey)
  );
  const [result, setResult] = useState(null);
  const [opening, setOpening] = useState(false);
  const [packByPack, setPackByPack] = useState(loadMode);
  const [autoAdvance, setAutoAdvance] = useState(loadAuto);
  // How many packs the user has clicked through (0 = none opened yet in pbp mode)
  const [revealedUpTo, setRevealedUpTo] = useState(0);

  // Re-load case state when set or box type changes
  const [lastKey, setLastKey] = useState(`${setData.id}:${boxTypeKey}`);
  const currentKey = `${setData.id}:${boxTypeKey}`;
  if (currentKey !== lastKey) {
    const loaded = loadCaseState(setData.id, boxTypeKey);
    setCaseState(loaded);
    setResult(null);
    setRevealedUpTo(0);
    setLastKey(currentKey);
  }

  const boxConfig = setData.box_types?.[boxTypeKey];
  const boxesPerCase = boxConfig?.boxes_per_case ?? DEFAULT_BOXES_PER_CASE;

  function resolveBox(state) {
    const boxResult = openBox(setData, boxTypeKey, state);
    const nextState = advanceCaseState(state, boxResult.hitFired, boxesPerCase);
    saveCaseState(setData.id, boxTypeKey, nextState);
    setCaseState(nextState);
    return boxResult;
  }

  const handleOpen = useCallback(() => {
    if (opening) return;
    setOpening(true);
    setResult(null);
    setRevealedUpTo(0);

    setTimeout(() => {
      try {
        const boxResult = resolveBox(caseState);
        setResult(boxResult);
        if (packByPack) setRevealedUpTo(1);
      } catch (err) {
        console.error('openBox error:', err);
      }
      setOpening(false);
    }, 80);
  }, [setData, boxTypeKey, caseState, opening, packByPack]);

  const handleReset = useCallback(() => {
    const fresh = resetCaseState(setData.id, boxTypeKey);
    setCaseState(fresh);
    setResult(null);
    setRevealedUpTo(0);
  }, [setData.id, boxTypeKey]);

  // Advance to next pack; if on the last pack open a fresh box
  function handleAdvance() {
    const packs = result?.packs ?? [];
    if (revealedUpTo < packs.length) {
      setRevealedUpTo(revealedUpTo + 1);
    } else {
      // Last pack done -- open another box
      if (opening) return;
      setOpening(true);
      setResult(null);
      setRevealedUpTo(0);
      setTimeout(() => {
        try {
          const boxResult = resolveBox(caseState);
          setResult(boxResult);
          setRevealedUpTo(1);
        } catch (err) {
          console.error('openBox error:', err);
        }
        setOpening(false);
      }, 80);
    }
  }

  function toggleMode(pbp) {
    setPackByPack(pbp);
    saveMode(pbp);
    setResult(null);
    setRevealedUpTo(0);
  }

  function toggleAuto(v) {
    setAutoAdvance(v);
    saveAuto(v);
  }

  const packs = result?.packs ?? [];
  const totalPacks = packs.length;
  const totalCards = packs.reduce((s, p) => s + p.cards.length, 0);
  const hitCards = packs.flatMap((p) => p.cards).filter((c) => c.is_hit);
  const allRevealed = packByPack && revealedUpTo >= totalPacks && totalPacks > 0;
  const currentPackIdx = revealedUpTo - 1; // 0-based index of the pack being opened

  return (
    <div className="flex flex-col gap-6">
      {/* Case tracker */}
      <CaseTracker caseState={caseState} boxesPerCase={boxesPerCase} onReset={handleReset} />

      {/* Mode + auto-advance toggles */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Mode:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs font-semibold">
            <button
              onClick={() => toggleMode(false)}
              className={`px-3 py-1.5 transition-colors ${
                !packByPack
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              Open All
            </button>
            <button
              onClick={() => toggleMode(true)}
              className={`px-3 py-1.5 transition-colors ${
                packByPack
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              Pack by Pack
            </button>
          </div>
        </div>

        {packByPack && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Auto-advance:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs font-semibold">
              <button
                onClick={() => toggleAuto(true)}
                className={`px-3 py-1.5 transition-colors ${
                  autoAdvance
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                On
              </button>
              <button
                onClick={() => toggleAuto(false)}
                className={`px-3 py-1.5 transition-colors ${
                  !autoAdvance
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                Off
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Open button row */}
      <div className="flex items-center gap-4">
        {(!packByPack || !result) && (
          <button
            onClick={handleOpen}
            disabled={opening}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm shadow-lg shadow-indigo-900/30"
          >
            {opening ? 'Opening...' : `Open ${boxConfig?.label ?? 'Box'}`}
          </button>
        )}

        {result && !packByPack && (
          <span className="text-xs text-gray-400">
            {totalPacks} pack{totalPacks !== 1 ? 's' : ''}, {totalCards} cards
            {hitCards.length > 0 && (
              <span className="text-yellow-400 ml-2 font-semibold">
                {hitCards.length} hit{hitCards.length !== 1 ? 's' : ''}!
              </span>
            )}
          </span>
        )}

        {result && packByPack && (
          <span className="text-xs text-gray-400">
            {revealedUpTo} / {totalPacks} packs
            {hitCards.length > 0 && (
              <span className="text-yellow-400 ml-2 font-semibold">
                {hitCards.length} hit{hitCards.length !== 1 ? 's' : ''}!
              </span>
            )}
          </span>
        )}
      </div>

      {/* Open all -- dump every pack */}
      {result && !packByPack && (
        <div className="flex flex-col gap-8">
          {packs.map((pack, idx) => (
            <PackReveal
              key={`${currentKey}-${packs.length}-${idx}`}
              pack={pack}
              packNumber={idx + 1}
            />
          ))}
        </div>
      )}

      {/* Pack by pack -- active pack at top, revealed history below */}
      {result && packByPack && revealedUpTo > 0 && (
        <div className="flex flex-col gap-8">
          {/* Current pack being opened -- interactive */}
          {!allRevealed && (
            <div className="flex flex-col gap-4">
              <PackReveal
                key={`${currentKey}-${packs.length}-${currentPackIdx}`}
                pack={packs[currentPackIdx]}
                packNumber={currentPackIdx + 1}
                onAdvance={handleAdvance}
                autoAdvance={autoAdvance}
              />
              <button
                onClick={handleAdvance}
                className="self-start bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm shadow-lg shadow-indigo-900/30"
              >
                {currentPackIdx + 1 < totalPacks ? 'Open Next Pack' : `Open Another ${boxConfig?.label ?? 'Box'}`}
              </button>
            </div>
          )}

          {/* All packs revealed -- show open another button */}
          {allRevealed && (
            <button
              onClick={handleAdvance}
              className="self-start bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm shadow-lg shadow-indigo-900/30"
            >
              Open Another {boxConfig?.label ?? 'Box'}
              {hitCards.length > 0 && (
                <span className="ml-2 text-yellow-300">
                  ({hitCards.length} hit{hitCards.length !== 1 ? 's' : ''}!)
                </span>
              )}
            </button>
          )}

          {/* Previously revealed packs -- shown below in reverse order so newest is closest */}
          {revealedUpTo > 1 && (
            <div className="flex flex-col gap-8 border-t border-gray-700 pt-6">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Previous Packs</span>
              {(() => {
                const historyEnd = allRevealed ? revealedUpTo : currentPackIdx;
                return packs
                  .slice(0, historyEnd)
                  .reverse()
                  .map((pack, i) => (
                    <PackReveal
                      key={`${currentKey}-history-${historyEnd - 1 - i}`}
                      pack={pack}
                      packNumber={historyEnd - i}
                    />
                  ));
              })()}
            </div>
          )}
        </div>
      )}

      {!result && !opening && (
        <div className="text-gray-500 text-sm">
          Click the button above to open a box.
        </div>
      )}
    </div>
  );
}
