import React, { useState, useMemo } from 'react';
import SetSelector from './SetSelector.jsx';
import BoxTypeSelector from './BoxTypeSelector.jsx';
import BoxOpener from './BoxOpener.jsx';

/**
 * Eagerly import all set JSON files at build time using Vite's import.meta.glob.
 * Files are expected at src/data/sets/*.json.
 */
const SET_MODULES = import.meta.glob('@data/sets/*.json', { eager: true });

function loadSets() {
  return Object.values(SET_MODULES).map((mod) => mod.default ?? mod);
}

export default function App() {
  const sets = useMemo(() => loadSets(), []);

  const [selectedSetId, setSelectedSetId] = useState(sets[0]?.id ?? null);
  const [selectedBoxKey, setSelectedBoxKey] = useState(null);

  const selectedSet = useMemo(
    () => sets.find((s) => s.id === selectedSetId) ?? null,
    [sets, selectedSetId]
  );

  // When the set changes, reset box key to first available
  function handleSetChange(id) {
    const set = sets.find((s) => s.id === id);
    setSelectedSetId(id);
    const firstBox = set ? Object.keys(set.box_types ?? {})[0] ?? null : null;
    setSelectedBoxKey(firstBox);
  }

  // Default box key when set first loads
  const resolvedBoxKey =
    selectedBoxKey ?? (selectedSet ? Object.keys(selectedSet.box_types ?? {})[0] ?? null : null);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="text-xl font-bold text-white tracking-tight">Pack Ripper</div>
          <div className="text-xs text-gray-500 mt-0.5">card pack simulator</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
        {sets.length === 0 ? (
          <div className="text-center py-20 flex flex-col gap-3 items-center">
            <div className="text-4xl font-bold text-gray-600">No Sets Found</div>
            <div className="text-gray-500">
              Run{' '}
              <code className="text-indigo-400 bg-gray-800 px-1.5 py-0.5 rounded text-sm">
                npm run scrape
              </code>{' '}
              to generate set data.
            </div>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-5">
              <SetSelector
                sets={sets}
                selectedId={selectedSetId}
                onChange={handleSetChange}
              />

              {selectedSet && (
                <BoxTypeSelector
                  boxTypes={selectedSet.box_types ?? {}}
                  selectedKey={resolvedBoxKey}
                  onChange={setSelectedBoxKey}
                />
              )}
            </div>

            {/* Simulator */}
            {selectedSet && resolvedBoxKey && (
              <BoxOpener
                key={`${selectedSet.id}:${resolvedBoxKey}`}
                setData={selectedSet}
                boxTypeKey={resolvedBoxKey}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
