import React from 'react'
import { Zap } from 'lucide-react'

export default function DashboardLeaderboard({ leaderboard, leaderboardLoading, leaderboardError }) {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-text)', margin: '0 0 4px' }}>
          Žebříček profilů
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
          Aktivní profily seřazené podle nasbíraných XP.
        </p>
      </div>

      {leaderboardLoading && (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{
            width: '36px', height: '36px',
            border: '3px solid var(--color-border-light)',
            borderTop: '3px solid var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px',
          }} />
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>Načítám žebříček…</p>
        </div>
      )}

      {leaderboardError && (
        <div style={{
          background: '#FEE2E2', border: '2px solid var(--color-error)',
          borderRadius: '14px', padding: '12px 16px',
          color: 'var(--color-error)', fontFamily: 'var(--font-body)',
        }}>
          {leaderboardError}
        </div>
      )}

      {!leaderboardLoading && !leaderboardError && leaderboard.length === 0 && (
        <div className="clay-card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>
            Zatím žádné aktivní profily v žebříčku.
          </p>
        </div>
      )}

      {!leaderboardLoading && !leaderboardError && leaderboard.length > 0 && (
        <div style={{ display: 'grid', gap: '10px' }}>
          {leaderboard.map((entry, index) => {
            const medals = ['🥇', '🥈', '🥉']
            const rank = index < 3 ? medals[index] : `#${index + 1}`
            const avatar = entry.avatar_preset || '👤'
            return (
              <div
                key={entry.id}
                className="clay-card"
                style={{
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  background: index === 0 ? '#FFFBEB' : 'var(--color-surface)',
                  borderColor: index === 0 ? '#F59E0B' : undefined,
                  boxShadow: index === 0 ? '0 4px 0 #F59E0B88, 0 8px 20px rgba(0,0,0,0.06)' : undefined,
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: index < 3 ? '1.6rem' : '1.1rem',
                  minWidth: '40px',
                  textAlign: 'center',
                  color: index < 3 ? undefined : 'var(--color-text-muted)',
                }}>
                  {rank}
                </div>
                <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>{avatar}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: '0 0 2px' }}>
                    {entry.name}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                    Streak: {entry.current_streak} 🔥 · Dny: {entry.days_practiced}
                  </p>
                </div>
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  color: '#F97316',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <Zap size={16} color="#F97316" />
                  {entry.total_xp} XP
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
