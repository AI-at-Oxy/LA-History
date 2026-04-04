/**
 * LocationMarker — a single colored circle on the Leaflet map.
 *
 * Uses react-leaflet's <CircleMarker> component.
 * Color is determined by the location's era.
 * Clicking the marker calls setSelectedLocation to open the InfoPanel.
 *
 * Props:
 *   location — one entry from src/data/locations.js
 */

import React from 'react'
import { CircleMarker, Tooltip } from 'react-leaflet'
import { useAppContext } from '../context/AppContext.jsx'

// Map era names to hex colors (matching the Tailwind config and Flask design system)
const ERA_COLORS = {
  native:  '#8B6914',
  spanish: '#2D6A4F',
  rancho:  '#1A3A5C',
  modern:  '#8B1A1A',
}

export default function LocationMarker({ location }) {
  const { setSelectedLocation, selectedLocation, completedIds } = useAppContext()

  const color     = ERA_COLORS[location.era] ?? '#555555'
  const isSelected = selectedLocation?.id === location.id
  const isVisited  = completedIds.has(location.id)

  return (
    <CircleMarker
      center={[location.latitude, location.longitude]}
      radius={isSelected ? 14 : 10}             // selected marker is bigger
      pathOptions={{
        color:       isSelected ? '#facc15' : color, // yellow ring when selected
        fillColor:   color,
        fillOpacity: isVisited ? 0.9 : 0.6,          // visited markers are more opaque
        weight:      isSelected ? 3 : 1.5,
      }}
      eventHandlers={{
        click: () => setSelectedLocation(location),
      }}
      aria-label={location.name}
    >
      {/* Tooltip appears on hover without requiring a click */}
      <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
        <span className="text-sm font-medium">{location.name}</span>
      </Tooltip>
    </CircleMarker>
  )
}
