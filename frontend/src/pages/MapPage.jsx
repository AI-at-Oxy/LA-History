/**
 * MapPage — the main view, shown at route "/".
 *
 * Layout (left → right):
 *   <Sidebar>       — 256 px wide, fixed, shows progress and location list
 *   <MapContainer>  — fills remaining width, renders Leaflet map
 *   <InfoPanel>     — overlays the right edge when a location is selected
 *
 * The relative positioning on the map area lets InfoPanel use absolute positioning
 * to slide in from the right without disrupting the Sidebar.
 */

import React from 'react'
import Sidebar from '../components/Sidebar.jsx'
import MapContainer from '../components/MapContainer.jsx'
import InfoPanel from '../components/InfoPanel.jsx'

export default function MapPage() {
  return (
    <div className="flex h-full">
      {/* Left: progress sidebar */}
      <Sidebar />

      {/* Right: map + sliding info panel */}
      <div className="relative flex-1">
        {/* Map fills all remaining space */}
        <MapContainer />

        {/* InfoPanel is absolutely positioned over the map's right edge */}
        <InfoPanel />
      </div>
    </div>
  )
}
