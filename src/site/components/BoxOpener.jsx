import React, { useState, useCallback } from 'react';
import PackReveal from './PackReveal.jsx';
import CaseTracker from './CaseTracker.jsx';
import { openBox } from '@simulator/engine.js';
import {
  loadCaseState,
  saveCaseState,
  advanceCaseState,
  resetCaseState,
} from '@simulator/pity.js';

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

  // Re-load case state when set or box type changes
  const [lastKey, setLastKey] = useState(`${setData.id}:${boxTypeKey}`);
  const currentKey = `${setData.id}:${boxTypeKey}`;
  if (currentKey !== lastKey) {
    const loaded = loadCaseState(setData.id, boxTypeKey);
    setCaseState(loaded);
    setResult(null);
    setLastKey(currentKey);
  }

  const handleOpen = useCallback(() => {
    if (opening) return;
    setOpening(true);
    setResult(null);

    // Small timeout so the blank state renders before engine runs
    setTimeout(() => {
      try {
        const boxResult = openBox(setData, boxTypeKey, caseState);
        const nextState = advanceCaseState(caseState, boxResult.hitFired);
        saveCaseState(setData.id, boxTypeKey, nextState);
        setCaseState(nextState);
        setResult(boxResult);
      } catch (err) {
        console.error('openBox error:', err);
      }
      setOpening(false);
    }, 80);
  }, [setData, boxTypeKey, caseState, opening]);

  const handleReset = useCallback(() => {
    const fresh = resetCaseState(setData.id, boxTypeKey);
    setCaseState(fresh);
    setResult(null);
  }, [setData.id, boxTypeKey]);

  const boxConfig = setData.box_types?.[boxTypeKey];
  const totalPacks = result?.packs?.length ?? 0;
  const totalCards = result?.packs?.reduce((s, p) => s + p.cards.length, 0) ?? 0;
  const hitCards = result?.packs?.flatMap((p) => p.cards).filter((c) => c.is_hit) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Case tracker */}
      <CaseTracker caseState={caseState} onReset={handleReset} />

      {/* Open button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleOpen}
          disabled={opening}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm shadow-lg shadow-indigo-900/30"
        >
          {opening ? 'Opening...' : `Open ${boxConfig?.label ?? 'Box'}`}
        </button>

        {result && (
          <span className="text-xs text-gray-400">
            {totalPacks} pack{totalPacks !== 1 ? 's' : ''}, {totalCards} cards
            {hitCards.length > 0 && (
              <span className="text-yellow-400 ml-2 font-semibold">
                {hitCards.length} hit{hitCards.length !== 1 ? 's' : ''}!
              </span>
            )}
          </span>
        )}
      </div>

      {/* Pack results */}
      {result && (
        <div className="flex flex-col gap-8">
          {result.packs.map((pack, idx) => (
            <PackReveal
              key={`${currentKey}-${result.packs.length}-${idx}`}
              pack={pack}
              packNumber={idx + 1}
            />
          ))}
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
