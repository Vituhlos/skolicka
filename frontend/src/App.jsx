import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { applyStoredTheme } from './utils/theme.js'
import HomePage from './pages/HomePage.jsx'
import ModuleSelectPage from './pages/ModuleSelectPage.jsx'
import ExercisePage from './pages/ExercisePage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import BadgesPage from './pages/BadgesPage.jsx'

const ParentDashboard = lazy(() => import('./pages/ParentDashboard.jsx'))

function RouteLoading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--color-surface)',
        border: '2px solid #E2E8F0',
        borderRadius: '18px',
        padding: '20px 24px',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '999px',
          border: '3px solid #DBEAFE',
          borderTopColor: 'var(--color-primary)',
          animation: 'route-loading-spin 0.9s linear infinite',
        }} />
        <div>
          <p style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-text)' }}>
            Načítám rodičovský přehled
          </p>
          <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Statistiky a grafy budou za okamžik připravené.
          </p>
        </div>
      </div>
      <style>{'@keyframes route-loading-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('parent_token')
  if (!token) {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  useEffect(() => { applyStoredTheme() }, [])

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/profil/:profileId" element={<ModuleSelectPage />} />
      <Route path="/cviceni/:moduleId/:profileId" element={<ExercisePage />} />
      <Route path="/vysledky/:moduleId/:profileId" element={<ResultsPage />} />
      <Route path="/odznaky/:profileId" element={<BadgesPage />} />
      <Route
        path="/rodic"
        element={
          <Suspense fallback={<RouteLoading />}>
            <ProtectedRoute>
              <ParentDashboard />
            </ProtectedRoute>
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
