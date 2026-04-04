/**
 * InfoPanel — slides in from the right when a map marker is clicked.
 *
 * Shows:
 *   - Location name and era badge
 *   - Short description
 *   - Points value
 *   - "Mark Visited" button (disabled once already visited)
 *   - Close button (×) to dismiss the panel
 *
 * Reads selectedLocation from context.
 * Returns null when no location is selected (panel is hidden).
 */

import React from 'react'
import { useAppContext } from '../context/AppContext.jsx'

// Era display labels and color classes
const ERA_META = {
  native:  { label: 'Tongva / Native Era',    color: 'text-yellow-700 bg-yellow-100' },
  spanish: { label: 'Spanish Colonial Era',   color: 'text-green-800 bg-green-100'  },
  rancho:  { label: 'Rancho Period',          color: 'text-blue-900 bg-blue-100'    },
  modern:  { label: 'Modern Era',             color: 'text-red-900 bg-red-100'      },
}

export default function InfoPanel() {
  const { selectedLocation, setSelectedLocation, completedIds, markVisited } = useAppContext()

  // Nothing selected — render nothing
  if (!selectedLocation) return null

  const era     = ERA_META[selectedLocation.era] ?? { label: selectedLocation.era, color: 'text-gray-700 bg-gray-100' }
  const visited = completedIds.has(selectedLocation.id)

  return (
    <aside
      className="slide-in absolute right-0 top-0 h-full w-80 bg-white shadow-xl border-l border-gray-200 flex flex-col z-[1000]"
      aria-label="Location information panel"
    >
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">
            {selectedLocation.name}
          </h2>
          {/* Era badge */}
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${era.color}`}>
            {era.label}
          </span>
        </div>

        {/* Close button */}
        <button
          onClick={() => setSelectedLocation(null)}
          className="ml-3 mt-0.5 text-gray-400 hover:text-gray-700 text-xl leading-none flex-shrink-0"
          aria-label="Close information panel"
        >
          ×
        </button>
      </div>

      {/* ── Body ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          {selectedLocation.short_description}
        </p>

        {/* Points value */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="text-yellow-500 text-base" aria-hidden="true">★</span>
          <span>
            Worth <strong className="text-gray-800">{selectedLocation.points} points</strong> on first visit
          </span>
        </div>

        {/* Visited status */}
        {visited && (
          <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
            <span aria-hidden="true">✓</span>
            <span>You have visited this location</span>
          </div>
        )}
      </div>

      {/* ── Footer: action button ─────────────────── */}
      <div className="p-5 border-t border-gray-100">
        <button
          onClick={() => markVisited(selectedLocation)}
          disabled={visited}
          className={[
            'w-full py-2 px-4 rounded-lg text-sm font-semibold transition-colors',
            visited
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:bg-gray-700 active:bg-gray-800',
          ].join(' ')}
          aria-disabled={visited}
        >
          {visited ? 'Already Visited' : 'Mark as Visited'}
        </button>
      </div>
    </aside>
  )
}
