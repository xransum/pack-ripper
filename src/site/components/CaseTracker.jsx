import React, { useState } from 'react';
import { BOXES_PER_CASE } from '@simulator/pity.js';

/**
 * CaseTracker -- progress bar showing boxes opened in the current case,
 * running hit count, current pity percentage, and a reset button.
 *
 * Props:
 *   caseState   - { boxesOpened, hitsInCase, hitChance }
 *   onReset     - () => void
 */
export default function CaseTracker({ caseState, onReset }) {
  const [confirming, setConfirming] = useState(false);

  const { boxesOpened, hitsInCase, hitChance } = caseState;
  const pct = Math.round(hitChance * 100);
  const progress = Math.min(boxesOpened / BOXES_PER_CASE, 1);

  function handleResetClick() {
    if (confirming) {
      onReset();
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  }

  function handleCancel() {
    setConfirming(false);
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Case Progress</h3>
        <span className="text-xs text-gray-400">
          {boxesOpened} / {BOXES_PER_CASE} boxes
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-xs">
        <div className="flex flex-col items-center">
          <span className="text-gray-400">Hits</span>
          <span className="text-yellow-400 font-bold text-base">{hitsInCase}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-gray-400">Next Hit Chance</span>
          <span className="text-indigo-300 font-bold text-base">{pct}%</span>
        </div>
        <div className="flex flex-col items-center ml-auto">
          {confirming ? (
            <div className="flex gap-2 items-center">
              <span className="text-yellow-400 text-xs">Reset case?</span>
              <button
                onClick={handleResetClick}
                className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded transition-colors"
              >
                Yes
              </button>
              <button
                onClick={handleCancel}
                className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={handleResetClick}
              className="text-xs text-gray-400 hover:text-gray-200 border border-gray-600 hover:border-gray-400 px-3 py-1.5 rounded transition-colors mt-1"
            >
              Reset Case
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
