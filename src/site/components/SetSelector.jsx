import React from 'react';

/**
 * SetSelector -- dropdown to choose which card set to simulate.
 *
 * Props:
 *   sets        - array of set data objects
 *   selectedId  - currently selected set id string
 *   onChange    - (id) => void
 */
export default function SetSelector({ sets, selectedId, onChange }) {
  if (!sets || sets.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No sets available. Run <code className="text-indigo-400">npm run scrape</code> first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Card Set
      </label>
      <select
        value={selectedId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      >
        {sets.map((set) => (
          <option key={set.id} value={set.id}>
            {set.name}
          </option>
        ))}
      </select>
    </div>
  );
}
