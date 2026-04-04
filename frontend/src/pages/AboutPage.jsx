/**
 * AboutPage — shown at route "/about".
 *
 * Static informational page explaining:
 *   - What the app is
 *   - How the era system works
 *   - How points and badges are earned
 *   - Technology credits
 *
 * No state needed — purely presentational.
 */

import React from 'react'

// Era info cards displayed in the era section
const ERAS = [
  {
    name: 'Tongva / Native Era',
    period: 'Before 1769',
    color: 'border-yellow-600 bg-yellow-50',
    labelColor: 'text-yellow-700',
    description:
      'The Tongva people inhabited the Los Angeles basin for thousands of years before European contact, building villages, trade routes, and ceremonies centered on the land.',
  },
  {
    name: 'Spanish Colonial Era',
    period: '1769 – 1821',
    color: 'border-green-700 bg-green-50',
    labelColor: 'text-green-800',
    description:
      'Spanish missionaries and soldiers established missions, presidios, and pueblos across California, reshaping the landscape and disrupting Indigenous ways of life.',
  },
  {
    name: 'Rancho Period',
    period: '1821 – 1848',
    color: 'border-blue-900 bg-blue-50',
    labelColor: 'text-blue-900',
    description:
      'After Mexican independence, vast land grants created sprawling ranchos. Cattle ranching drove the economy until the American takeover following the Mexican-American War.',
  },
  {
    name: 'Modern Era',
    period: '1848 – Present',
    color: 'border-red-900 bg-red-50',
    labelColor: 'text-red-900',
    description:
      'Rapid growth driven by railroads, oil, Hollywood, and aerospace transformed Los Angeles into one of the world\'s largest cities over just 150 years.',
  },
]

export default function AboutPage() {
  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-10">

        {/* ── App intro ─────────────────────────────── */}
        <section>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">About LA History</h1>
          <p className="text-gray-700 leading-relaxed">
            LA History is an interactive learning experience that takes you through thousands of
            years of Los Angeles history — from the Tongva people who called this land home, through
            Spanish colonization and the rancho era, to the sprawling modern metropolis of today.
          </p>
          <p className="text-gray-700 leading-relaxed mt-3">
            Explore the map, click on historical locations to learn their stories, and earn points
            as you build your knowledge of the city.
          </p>
        </section>

        {/* ── How to play ───────────────────────────── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">How It Works</h2>
          <ol className="space-y-3 list-decimal list-inside text-gray-700">
            <li>Open the <strong>Map</strong> view and explore the markers around Los Angeles.</li>
            <li>Click any marker to open the information panel on the right.</li>
            <li>Read about the location's history, then click <strong>Mark as Visited</strong>.</li>
            <li>Earn points for each new location you visit.</li>
            <li>Check the <strong>Progress</strong> page to see your badges and stats.</li>
          </ol>
        </section>

        {/* ── Eras ──────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Historical Eras</h2>
          <div className="space-y-3">
            {ERAS.map(era => (
              <div
                key={era.name}
                className={`rounded-xl border-l-4 p-4 ${era.color}`}
              >
                <div className="flex items-baseline gap-3 mb-1">
                  <h3 className={`font-semibold ${era.labelColor}`}>{era.name}</h3>
                  <span className="text-xs text-gray-500">{era.period}</span>
                </div>
                <p className="text-sm text-gray-700">{era.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Points ────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Points & Badges</h2>
          <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
            <li>Earn <strong>10 points</strong> each time you visit a new location.</li>
            <li>Unlock <strong>First Steps</strong> after your first visit.</li>
            <li>Unlock <strong>Explorer</strong> after visiting 3 locations.</li>
            <li>Unlock <strong>Historian</strong> after visiting all 5 locations.</li>
            <li>Unlock <strong>Point Hunter</strong> after earning 40 points.</li>
          </ul>
        </section>

        {/* ── Tech stack ────────────────────────────── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Built With</h2>
          <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
            <li>React 18 + Vite — fast, modern frontend tooling</li>
            <li>Tailwind CSS — utility-first styling</li>
            <li>React Leaflet — interactive maps (OpenStreetMap tiles)</li>
            <li>React Router v6 — client-side navigation</li>
            <li>Flask + SQLAlchemy — Python backend and database</li>
          </ul>
        </section>

      </div>
    </div>
  )
}
