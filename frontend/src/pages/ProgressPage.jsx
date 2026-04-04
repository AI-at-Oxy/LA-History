/**
 * ProgressPage — shown at route "/progress".
 *
 * Displays:
 *   - Summary stat cards: total points, locations visited, completion %
 *   - Badge grid: 4 badges, unlocked based on progress milestones
 *   - Table of all locations with visited status and points earned
 */

import React from 'react'
import { useAppContext } from '../context/AppContext.jsx'
import LOCATIONS from '../data/locations.js'

// ── Badge definitions ──────────────────────────────────────────────────────
// Each badge has an unlock condition (a function that takes { completedIds, totalPoints })
const BADGES = [
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Visit your first location',
    icon: '🗺️',
    unlock: ({ completedIds }) => completedIds.size >= 1,
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Visit 3 locations',
    icon: '🔭',
    unlock: ({ completedIds }) => completedIds.size >= 3,
  },
  {
    id: 'historian',
    name: 'Historian',
    description: 'Visit all 5 locations',
    icon: '📜',
    unlock: ({ completedIds }) => completedIds.size >= 5,
  },
  {
    id: 'point_hunter',
    name: 'Point Hunter',
    description: 'Earn 40 or more points',
    icon: '⭐',
    unlock: ({ totalPoints }) => totalPoints >= 40,
  },
]

// ── Stat card sub-component ────────────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1 shadow-sm">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-3xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-sm text-gray-400">{sub}</span>}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const { totalPoints, completedIds } = useAppContext()

  const visitedCount  = completedIds.size
  const totalCount    = LOCATIONS.length
  const completionPct = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Your Progress</h1>

      {/* ── Stat cards ─────────────────────────────── */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">Statistics</h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Points"    value={totalPoints}       sub="keep exploring to earn more" />
          <StatCard label="Locations Found" value={`${visitedCount} / ${totalCount}`} sub="historical sites" />
          <StatCard label="Completion"      value={`${completionPct}%`} sub="of all locations visited" />
        </div>
      </section>

      {/* ── Badges ─────────────────────────────────── */}
      <section aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="text-lg font-semibold text-gray-800 mb-3">Badges</h2>
        <div className="grid grid-cols-4 gap-4">
          {BADGES.map(badge => {
            const unlocked = badge.unlock({ completedIds, totalPoints })
            return (
              <div
                key={badge.id}
                className={[
                  'rounded-xl border p-4 flex flex-col items-center text-center gap-2 transition-opacity',
                  unlocked
                    ? 'bg-white border-yellow-300 shadow-sm'
                    : 'bg-gray-100 border-gray-200 opacity-50',
                ].join(' ')}
                aria-label={`${badge.name} badge — ${unlocked ? 'unlocked' : 'locked'}`}
              >
                <span className="text-3xl" aria-hidden="true">{badge.icon}</span>
                <span className="text-sm font-semibold text-gray-800">{badge.name}</span>
                <span className="text-xs text-gray-500">{badge.description}</span>
                {unlocked && (
                  <span className="text-xs font-medium text-yellow-600">Unlocked!</span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Location table ─────────────────────────── */}
      <section aria-labelledby="locations-heading">
        <h2 id="locations-heading" className="text-lg font-semibold text-gray-800 mb-3">
          All Locations
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Location</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Era</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Points</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {LOCATIONS.map((loc, i) => {
                const visited = completedIds.has(loc.id)
                return (
                  <tr
                    key={loc.id}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{loc.name}</td>
                    <td className="px-4 py-3 capitalize text-gray-600">{loc.era}</td>
                    <td className="px-4 py-3 text-center text-yellow-600 font-medium">
                      {visited ? `+${loc.points}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {visited ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                          <span aria-hidden="true">✓</span> Visited
                        </span>
                      ) : (
                        <span className="text-gray-400">Not yet</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
