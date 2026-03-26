import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getModule } from '../modules/registry.js'

export default function ExercisePage() {
  const { moduleId, profileId } = useParams()
  const navigate = useNavigate()

  const isBoss = moduleId.endsWith('-boss')
  const actualModuleId = isBoss ? moduleId.slice(0, -5) : moduleId
  const module = getModule(actualModuleId)

  if (!module) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: 'var(--color-text)' }}>
          Modul nenalezen
        </p>
        <button
          onClick={() => navigate(`/profil/${profileId}`)}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '10px 24px', borderRadius: '16px' }}
        >
          Zpět
        </button>
      </div>
    )
  }

  const ExerciseComponent = module.ExerciseComponent

  const handleFinish = (results) => {
    navigate(`/vysledky/${moduleId}/${profileId}`, { state: { results } })
  }

  return (
    <ExerciseComponent
      profileId={profileId}
      onFinish={handleFinish}
      boss={isBoss}
    />
  )
}
