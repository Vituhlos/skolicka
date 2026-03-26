import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, BookOpen, Trophy } from 'lucide-react'
import { api } from '../utils/api.js'
import StreakBadge from '../components/StreakBadge.jsx'
import XPBar from '../components/XPBar.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import registeredModules from '../modules/registry.js'

export default function ModuleSelectPage() {
  const { profileId } = useParams()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [streak, setStreak] = useState(null)
  const [xpData, setXpData] = useState(null)
  const [apiModules, setApiModules] = useState([])
  const [bossStatuses, setBossStatuses] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [profileId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [profiles, streakData, xp, modulesData] = await Promise.allSettled([
        api.getProfiles(),
        api.getStreak(profileId),
        api.getXP(profileId),
        api.getModules(),
      ])

      if (profiles.status === 'fulfilled') {
        const all = profiles.value.profiles || profiles.value || []
        const found = all.find((p) => String(p.id) === String(profileId))
        setProfile(found || null)
      }

      if (streakData.status === 'fulfilled') {
        setStreak(streakData.value)
      }

      if (xp.status === 'fulfilled') {
        setXpData(xp.value)
      }

      if (modulesData.status === 'fulfilled') {
        setApiModules(modulesData.value.modules || modulesData.value || [])
      }

      // Fetch boss statuses for registered modules
      const bossPromises = registeredModules.map(async (mod) => {
        try {
          const status = await api.getBossStatus(mod.id, profileId)
          return [mod.id, status]
        } catch {
          return [mod.id, null]
        }
      })
      const bossResults = await Promise.allSettled(bossPromises)
      const statusMap = {}
      bossResults.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          statusMap[r.value[0]] = r.value[1]
        }
      })
      setBossStatuses(statusMap)
    } catch (err) {
      setError('Nepodařilo se načíst data')
    } finally {
      setLoading(false)
    }
  }

  const handleModuleSelect = (moduleId) => {
    navigate(`/cviceni/${moduleId}/${profileId}`)
  }

  const todayAnswers = streak?.today_answers || 0
  const dailyGoal = streak?.daily_goal || 15

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #E2E8F0',
            borderTop: '4px solid var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>Načítám...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '3px solid #E2E8F0',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <button
          onClick={() => navigate('/')}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '8px 12px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <ChevronLeft size={18} />
          Zpět
        </button>

        <div style={{ flex: 1 }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '1.2rem',
            color: 'var(--color-text)',
            margin: 0,
          }}>
            {profile?.name || 'Profil'}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <StreakBadge count={streak?.current_streak || profile?.streak || 0} size="sm" />
          <div className="xp-pill">
            {xpData?.total_xp || profile?.total_xp || 0} XP
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        {error && (
          <div style={{
            background: '#FEE2E2',
            border: '2px solid var(--color-error)',
            borderRadius: '16px',
            padding: '12px 16px',
            color: 'var(--color-error)',
            marginBottom: '16px',
            fontFamily: 'var(--font-body)',
          }}>
            {error}
          </div>
        )}

        {/* Daily progress */}
        <div className="clay-card" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              background: '#EFF6FF',
              border: '2px solid var(--color-primary)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <BookOpen size={18} color="var(--color-primary)" />
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', margin: 0, color: 'var(--color-text)' }}>
              Dnešní pokrok
            </h2>
          </div>
          <ProgressBar
            current={todayAnswers}
            total={dailyGoal}
            color="var(--color-primary)"
            label={`Dnes: ${todayAnswers}/${dailyGoal} odpovědí`}
            height={14}
          />
          {todayAnswers >= dailyGoal && (
            <p style={{ color: 'var(--color-success)', fontFamily: 'var(--font-heading)', fontWeight: 700, marginTop: '8px', fontSize: '0.95rem' }}>
              Skvele! Splnil jsi denní cíl!
            </p>
          )}
        </div>

        {/* XP bar */}
        {xpData && (
          <div style={{ marginBottom: '24px' }}>
            <XPBar
              xp={xpData.total_xp || 0}
              level={xpData.level || 1}
              xpToNext={xpData.xp_to_next_level || 100}
            />
          </div>
        )}

        {/* Module cards */}
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-text)', marginBottom: '16px' }}>
          Vyberte cvičení
        </h2>

        <div className="module-grid">
          {registeredModules.map((mod) => {
            const boss = bossStatuses[mod.id]
            const bossUnlocked = boss?.unlocked || false
            const apiMod = apiModules.find((m) => m.id === mod.id)

            return (
              <div
                key={mod.id}
                className="clay-card"
                style={{
                  padding: '24px',
                  borderColor: mod.color,
                  boxShadow: `0 4px 0 ${mod.color}99, 0 8px 24px rgba(0,0,0,0.08)`,
                  cursor: 'pointer',
                  transition: 'all 200ms ease-out',
                }}
                onClick={() => handleModuleSelect(mod.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    background: `${mod.color}20`,
                    border: `3px solid ${mod.color}`,
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 3px 0 ${mod.color}66`,
                  }}>
                    <BookOpen size={26} color={mod.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      color: 'var(--color-text)',
                      margin: '0 0 6px',
                    }}>
                      {mod.name}
                    </h3>
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.9rem',
                      color: 'var(--color-text-muted)',
                      margin: '0 0 12px',
                      lineHeight: 1.4,
                    }}>
                      {mod.description}
                    </p>
                    <button
                      className="btn-clay btn-clay-cta"
                      style={{ padding: '8px 20px', fontSize: '0.9rem', borderRadius: '14px' }}
                      onClick={(e) => { e.stopPropagation(); handleModuleSelect(mod.id) }}
                    >
                      Cvičit
                    </button>
                  </div>
                </div>

                {bossUnlocked && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px dashed #E2E8F0' }}>
                    <button
                      className="btn-clay"
                      style={{
                        background: '#FEF3C7',
                        color: '#92400E',
                        border: '2px solid #D97706',
                        borderRadius: '12px',
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 700,
                        boxShadow: '0 3px 0 #D97706',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        width: '100%',
                        justifyContent: 'center',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/cviceni/${mod.id}-boss/${profileId}`)
                      }}
                    >
                      <Trophy size={16} color="#D97706" />
                      Boss Level
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Badges link */}
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <button
            onClick={() => navigate(`/odznaky/${profileId}`)}
            className="btn-clay btn-clay-secondary"
            style={{ padding: '10px 24px', borderRadius: '16px', fontSize: '0.95rem' }}
          >
            Moje odznaky
          </button>
        </div>
      </main>
    </div>
  )
}
