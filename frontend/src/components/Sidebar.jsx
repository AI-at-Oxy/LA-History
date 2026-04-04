/**
 * Sidebar — shown on the left side of the Map page.
 *
 * Displays:
 *   - Total points earned so far
 *   - How many locations have been visited out of the total
 *   - A scrollable list of all locations, with visited ones highlighted
 *
 * Clicking a location in the list selects it (same as clicking the map marker).
 */

import React from 'react'
import { useAppContext } from '../context/AppContext.jsx'
import LOCATIONS from '../data/locations.js'

// Era label text and color mapping used in the location list
const ERA_STYLES = {
  native:  { label: 'Native',  bg: 'bg-yellow-700' },
  spanish: { label: 'Spanish', bg: 'bg-green-700'  },
  rancho:  { label: 'Rancho',  bg: 'bg-blue-900'   },
  modern:  { label: 'Modern',  bg: 'bg-red-900'    },
}

export default function Sidebar() {
  const { totalPoints, completedIds, setSelectedLocation, selectedLocation } = useAppContext()

  const visitedCount = completedIds.size
  const totalCount   = LOCATIONS.length

  return (
    <aside
      className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full"
      aria-label="Progress sidebar"
    >
      {/* ── Stats header ─────────────────────────────── */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Your Progress
        </h2>

        {/* Points */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Points</span>
          <span className="text-sm font-bold text-yellow-600">{totalPoints}</span>
        </div>

        {/* Visited count + progress bar */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Visited</span>
          <span className="text-sm font-medium text-gray-800">
            {visitedCount} / {totalCount}
          </span>
        </div>
        <div
          className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={visitedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
        >
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${(visitedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Location list ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
          Locations
        </h3>

        {LOCATIONS.map(loc => {
          const era       = ERA_STYLES[loc.era] ?? { label: loc.era, bg: 'bg-gray-600' }
          const visited   = completedIds.has(loc.id)
          const isSelected = selectedLocation?.id === loc.id

          return (
            <button
              key={loc.id}
              onClick={() => setSelectedLocation(loc)}
              className={[
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                isSelected
                  ? 'bg-gray-900 text-white'
                  : 'hover:bg-gray-100 text-gray-800',
              ].join(' ')}
              aria-pressed={isSelected}
              aria-label={`${loc.name}${visited ? ' — visited' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{loc.name}</span>
                {/* Visited checkmark */}
                {visited && (
                  <span className="text-green-500 flex-shrink-0" aria-hidden="true">✓</span>
                )}
              </div>
              {/* Era badge */}
              <span
                className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs text-white ${era.bg}`}
              >
                {era.label}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
