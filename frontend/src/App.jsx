/**
 * App.jsx — root component.
 *
 * Sets up:
 *   - AppProvider  : global state available to all pages
 *   - BrowserRouter: client-side routing via React Router v6
 *   - NavBar       : top navigation rendered on every page
 *   - Routes       : three pages — Map (/), Progress (/progress), About (/about)
 */

import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext.jsx'
import NavBar from './components/NavBar.jsx'
import MapPage from './pages/MapPage.jsx'
import ProgressPage from './pages/ProgressPage.jsx'
import AboutPage from './pages/AboutPage.jsx'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        {/* NavBar stays at the top across all pages */}
        <div className="flex flex-col h-screen bg-gray-50">
          <NavBar />

          {/* Page content fills the remaining vertical space */}
          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/"         element={<MapPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/about"    element={<AboutPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AppProvider>
  )
}
