import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Star, Flame, Trophy, Target, Zap, Crown, Layers, BookOpen } from 'lucide-react'
import { api } from '../utils/api.js'
import BadgeGrid from '../components/BadgeGrid.jsx'

const GLOBAL_BADGE_DEFS = [
  {
    id: 'first_correct',
    name: 'První správná',
    description: 'Odpovídej správně poprvé',
    icon: 'Star',
    color: '#F59E0B',
    colorDark: '#D97706',
  },
  {
    id: 'streak_3',
    name: '3 dny v řadě',
    description: 'Cvičuj 3 dny za sebou',
    icon: 'Flame',
    color: '#F97316',
    colorDark: '#EA580C',
  },
  {
    id: 'streak_7',
    name: 'Týden v řadě',
    description: 'Cvičuj 7 dní za sebou',
    icon: 'Flame',
    color: '#EF4444',
    colorDark: '#DC2626',
  },
  {
    id: 'streak_30',
    name: 'Měsíc v řadě',
    description: 'Cvičuj 30 dní za sebou',
    icon: 'Trophy',
    color: '#DC2626',
    colorDark: '#B91C1C',
  },
  {
    id: 'answers_100',
    name: '100 odpovědí',
    description: 'Celkem 100 odpovědí',
    icon: 'Target',
    color: '#2563EB',
    colorDark: '#1D4ED8',
  },
  {
    id: 'answers_500',
    name: '500 odpovědí',
    description: 'Celkem 500 odpovědí',
    icon: 'Zap',
    color: '#7C3AED',
    colorDark: '#6D28D9',
  },
  {
    id: 'perfect_session',
    name: 'Perfektní sezení',
    description: 'Sezení bez chyby',
    icon: 'Crown',
    color: '#7C3AED',
    colorDark: '#6D28D9',
  },
  {
    id: 'speed_demon',
    name: 'Rychlopalec',
    description: '10 správných pod 3 sekundy',
    icon: 'Zap',
    color: '#F59E0B',
    colorDark: '#D97706',
  },
  {
    id: 'multi_module',
    name: 'Všestranný',
    description: 'Cvičuj ve 2 modulech',
    icon: 'Layers',
    color: '#0891B2',
    colorDark: '#0E7490',
  },
]

const VSLOV_BADGE_DEFS = [
  ...['b', 'l', 'm', 'p', 's', 'v', 'z'].map((letter) => ({
    id: `vslov_master_${letter}`,
    name: `Mistr písmene ${letter.toUpperCase()}`,
    description: `>80% správných na písmenu ${letter.toUpperCase()}`,
    icon: 'BookOpen',
    color: '#F97316',
    colorDark: '#EA580C',
  })),
  {
    id: 'vslov_boss_defeated',
    name: 'Bossporazitel',
    description: 'Dokončení boss levelu',
    icon: 'Trophy',
    color: '#D97706',
    colorDark: '#B45309',
  },
]

export default function BadgesPage() {
  const { profileId } = useParams()
  const navigate = useNavigate()
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadBadges()
  }, [profileId])

  const loadBadges = async () => {
    try {
      setLoading(true)
      const data = await api.getBadges(profileId)
      setBadges(data.earned || [])
    } catch (err) {
      setError('Nepodařilo se načíst odznaky')
    } finally {
      setLoading(false)
    }
  }

  const earnedCount = badges.length
  const totalCount = GLOBAL_BADGE_DEFS.length + VSLOV_BADGE_DEFS.length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '3px solid var(--color-border-light)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <button
          onClick={() => navigate(`/profil/${profileId}`)}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '8px 12px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <ChevronLeft size={18} />
          Zpět
        </button>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-text)', margin: 0, flex: 1 }}>
          Moje odznaky
        </h1>
        <div style={{
          background: '#FFF7ED',
          border: '2px solid var(--color-cta)',
          borderRadius: '12px',
          padding: '4px 12px',
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '0.9rem',
          color: 'var(--color-cta)',
          boxShadow: '0 2px 0 var(--color-cta-dark)',
        }}>
          {earnedCount}/{totalCount}
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{
              width: '40px', height: '40px',
              border: '3px solid var(--color-border-light)',
              borderTop: '3px solid var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>Načítám odznaky...</p>
          </div>
        )}

        {error && (
          <div style={{
            background: '#FEE2E2', border: '2px solid var(--color-error)',
            borderRadius: '16px', padding: '12px 16px', color: 'var(--color-error)',
            fontFamily: 'var(--font-body)', marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {!loading && (
          <>
            {/* Global badges */}
            <section style={{ marginBottom: '36px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{
                  width: '36px', height: '36px',
                  background: '#EFF6FF',
                  border: '2px solid var(--color-primary)',
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Star size={18} color="var(--color-primary)" />
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)', margin: 0 }}>
                  Globální odznaky
                </h2>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  ({badges.filter(b => GLOBAL_BADGE_DEFS.some(d => d.id === b.key)).length}/{GLOBAL_BADGE_DEFS.length})
                </span>
              </div>
              <BadgeGrid badges={badges} definitions={GLOBAL_BADGE_DEFS} />
            </section>

            {/* Vyjmenovaná slova badges */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{
                  width: '36px', height: '36px',
                  background: '#FFF7ED',
                  border: '2px solid var(--color-cta)',
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <BookOpen size={18} color="var(--color-cta)" />
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)', margin: 0 }}>
                  Vyjmenovaná slova
                </h2>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  ({badges.filter(b => VSLOV_BADGE_DEFS.some(d => d.id === b.key)).length}/{VSLOV_BADGE_DEFS.length})
                </span>
              </div>
              <BadgeGrid badges={badges} definitions={VSLOV_BADGE_DEFS} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
