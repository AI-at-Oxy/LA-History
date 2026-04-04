/**
 * NavBar — top navigation bar shown on every page.
 *
 * Renders three navigation links (Map, Progress, About) and the app title.
 * Uses NavLink from React Router so the active route link gets a highlight.
 * Also shows the user's current point total from global state.
 */

import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'

// Helper to build NavLink className — active link gets a white underline
function navClass({ isActive }) {
  return [
    'px-3 py-1 rounded text-sm font-medium transition-colors',
    isActive
      ? 'bg-white text-gray-900'
      : 'text-white/80 hover:text-white hover:bg-white/10',
  ].join(' ')
}

export default function NavBar() {
  const { totalPoints } = useAppContext()

  return (
    <nav
      className="flex items-center justify-between px-6 py-3 bg-gray-900 shadow-md"
      aria-label="Main navigation"
    >
      {/* App title */}
      <span className="text-white font-bold text-lg tracking-wide">
        LA History
      </span>

      {/* Navigation links */}
      <div className="flex gap-2" role="navigation">
        <NavLink to="/"         className={navClass}>Map</NavLink>
        <NavLink to="/progress" className={navClass}>Progress</NavLink>
        <NavLink to="/about"    className={navClass}>About</NavLink>
      </div>

      {/* Points display */}
      <div
        className="text-sm text-yellow-300 font-semibold"
        aria-label={`Total points: ${totalPoints}`}
      >
        {totalPoints} pts
      </div>
    </nav>
  )
}
