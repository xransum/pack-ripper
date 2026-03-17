import React, { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * UpdatePrompt -- shows a banner at the bottom of the screen when a new
 * service worker is waiting. Clicking "Update" activates it and reloads.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-indigo-700 text-white text-sm px-4 py-3 rounded-xl shadow-xl shadow-black/40">
      <span>A new version is available.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="bg-white text-indigo-700 font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
      >
        Update
      </button>
    </div>
  );
}
