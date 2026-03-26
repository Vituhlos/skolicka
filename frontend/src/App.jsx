import React, { Suspense, lazy, useEffect, useState } from 'react'
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

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#1E293B',
      color: '#F1F5F9',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      fontFamily: 'var(--font-body)',
      fontSize: '0.9rem',
      zIndex: 9999,
      boxShadow: '0 -2px 12px rgba(0,0,0,0.3)',
    }}>
      <span style={{ fontSize: '1.1rem' }}>📶</span>
      Jsi offline — cvičení funguje, ale data se neuloží.
    </div>
  )
}

function InstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa_install_dismissed') === '1')

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  const handleInstall = async () => {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setPrompt(null)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('pwa_install_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--color-surface)',
      border: '3px solid var(--color-border-strong)',
      borderRadius: '20px',
      padding: '14px 18px',
      boxShadow: '0 4px 0 var(--color-border-strong), 0 8px 24px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 9998,
      maxWidth: 'calc(100vw - 32px)',
      width: '380px',
    }}>
      <img src="/icon-192.png" alt="" style={{ width: 40, height: 40, borderRadius: '10px', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
          Přidat Školičku na plochu
        </p>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          Rychlý přístup bez prohlížeče
        </p>
      </div>
      <button
        className="btn-clay btn-clay-primary"
        style={{ padding: '7px 14px', borderRadius: '12px', fontSize: '0.85rem', flexShrink: 0 }}
        onClick={handleInstall}
      >
        Přidat
      </button>
      <button
        className="btn-clay btn-clay-secondary"
        style={{ padding: '7px 10px', borderRadius: '12px', fontSize: '0.85rem', flexShrink: 0 }}
        onClick={handleDismiss}
        title="Zavřít"
      >
        ✕
      </button>
    </div>
  )
}

export default function App() {
  useEffect(() => { applyStoredTheme() }, [])

  return (
    <>
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
    <OfflineBanner />
    <InstallPrompt />
    </>
  )
}
