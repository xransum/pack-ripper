import React from 'react';

/**
 * BoxTypeSelector -- grid of box type buttons for the selected set.
 *
 * Props:
 *   boxTypes        - object keyed by box type key (from set JSON)
 *   selectedKey     - currently selected box type key
 *   onChange        - (key) => void
 */
export default function BoxTypeSelector({ boxTypes, selectedKey, onChange }) {
  if (!boxTypes || Object.keys(boxTypes).length === 0) {
    return <div className="text-sm text-gray-500">No box types available for this set.</div>;
  }

  const entries = Object.entries(boxTypes);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Box Type
      </label>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, config]) => {
          const isSelected = key === selectedKey;
          const guarantees = config.guarantees ?? {};
          const highlights = [];
          if (guarantees['Autographs']) highlights.push(`${guarantees['Autographs']} auto`);
          else if (guarantees['Base Rated Rookies']) highlights.push(`${guarantees['Base Rated Rookies']} RR`);

          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={[
                'flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all',
                isSelected
                  ? 'border-indigo-500 bg-indigo-900/50 text-white shadow-lg shadow-indigo-900/30'
                  : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400 hover:bg-gray-700',
              ].join(' ')}
            >
              <span className="text-sm font-semibold">{config.label ?? key}</span>
              {config.packs_per_box && config.cards_per_pack && (
                <span className="text-[10px] text-gray-400 mt-0.5">
                  {config.packs_per_box}pk x {config.cards_per_pack}
                  {highlights.length > 0 ? ` | ${highlights.join(', ')}` : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
