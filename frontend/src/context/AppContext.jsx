/**
 * AppContext — global state for the LA History app.
 *
 * Keeps three pieces of state that multiple pages need:
 *   selectedLocation   — the location object the user last clicked on the map (or null)
 *   completedIds       — Set of location IDs the user has marked as visited
 *   totalPoints        — running point total earned by the user
 *
 * Provides two action helpers:
 *   setSelectedLocation(location | null) — update which marker is "active"
 *   markVisited(location)                — add the location to completed set and award points
 */

import React, { createContext, useContext, useState } from 'react'

// Create the context with a default value of null (populated by the Provider below)
const AppContext = createContext(null)

/**
 * AppProvider wraps the whole app so any component can call useAppContext().
 * Place it high in the tree — currently in App.jsx around <Routes>.
 */
export function AppProvider({ children }) {
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [completedIds, setCompletedIds] = useState(new Set())
  const [totalPoints, setTotalPoints] = useState(0)

  // Award points and record the visit when the user clicks "Mark Visited"
  function markVisited(location) {
    if (completedIds.has(location.id)) return // already visited — no double-counting

    setCompletedIds(prev => new Set([...prev, location.id]))
    setTotalPoints(prev => prev + location.points)
  }

  return (
    <AppContext.Provider
      value={{ selectedLocation, setSelectedLocation, completedIds, totalPoints, markVisited }}
    >
      {children}
    </AppContext.Provider>
  )
}

/**
 * Custom hook — use this instead of importing AppContext directly.
 * Example: const { totalPoints } = useAppContext()
 */
export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside <AppProvider>')
  return ctx
}
