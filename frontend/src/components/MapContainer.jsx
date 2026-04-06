/**
 * MapContainer — renders the Leaflet map with all location markers.
 *
 * Uses react-leaflet v4 components:
 *   <MapContainer>     — initializes the Leaflet map instance
 *   <TileLayer>        — loads OpenStreetMap tiles (free, no API key needed)
 *   <LocationMarker>   — one per entry in the locations data
 *
 * The map is centered on downtown Los Angeles at a zoom level that shows the whole basin.
 *
 * NOTE: react-leaflet requires the CSS to be imported globally (done in index.css).
 *       It also requires the map container to have an explicit height (set via Tailwind h-full).
 */

import React from 'react'
import { MapContainer as LeafletMap, TileLayer } from 'react-leaflet'
import LocationMarker from './LocationMarker.jsx'
import LOCATIONS from '../data/locations.js'

// Center of Los Angeles
const LA_CENTER = [34.0522, -118.2437]
const DEFAULT_ZOOM = 11
// Bounds covering the Greater LA area (Valley to Long Beach, Malibu to Pomona)
const LA_BOUNDS = [[33.65, -118.80], [34.45, -117.55]]
const MIN_ZOOM = DEFAULT_ZOOM

export default function MapContainer() {
  return (
    <LeafletMap
      center={LA_CENTER}
      zoom={DEFAULT_ZOOM}
      minZoom={MIN_ZOOM}
      maxBounds={LA_BOUNDS}
      maxBoundsViscosity={1.0}
      className="h-full w-full"
      // Prevent the map from stealing keyboard focus unexpectedly
      keyboard={false}
    >
      {/* OpenStreetMap tile layer — free, no API key required */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* Render one marker per location */}
      {LOCATIONS.map(loc => (
        <LocationMarker key={loc.id} location={loc} />
      ))}
    </LeafletMap>
  )
}
