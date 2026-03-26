import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import ModuleSelectPage from './pages/ModuleSelectPage.jsx'
import ExercisePage from './pages/ExercisePage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import BadgesPage from './pages/BadgesPage.jsx'
import ParentDashboard from './pages/ParentDashboard.jsx'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('parent_token')
  if (!token) {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
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
          <ProtectedRoute>
            <ParentDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
