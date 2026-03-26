import React from 'react'
import { Star, Flame, Trophy, Target, Zap, Crown, Layers, BookOpen } from 'lucide-react'

const ICON_MAP = {
  Star, Flame, Trophy, Target, Zap, Crown, Layers, BookOpen,
}

function BadgeIcon({ name, size = 32, color = '#2563EB' }) {
  const Icon = ICON_MAP[name] || Star
  return <Icon size={size} color={color} />
}

export default function BadgeGrid({ badges = [], definitions = [] }) {
  if (!definitions.length) return null

  return (
    <div className="badge-grid">
      {definitions.map((def) => {
        const earned = badges.find((b) => b.badge_id === def.id)
        return (
          <div
            key={def.id}
            className={earned ? 'badge-unlocked' : 'badge-locked'}
            style={{
              background: earned ? 'var(--color-surface)' : '#F8FAFC',
              border: `3px solid ${earned ? def.color || '#2563EB' : '#CBD5E1'}`,
              borderRadius: '20px',
              padding: '16px 12px',
              textAlign: 'center',
              boxShadow: earned
                ? `0 4px 0 ${def.colorDark || '#1D4ED8'}, 0 8px 16px rgba(0,0,0,0.06)`
                : '0 4px 0 #CBD5E1',
              transition: 'all 200ms ease',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: earned ? `${def.color || '#2563EB'}20` : '#E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
                border: `2px solid ${earned ? def.color || '#2563EB' : '#CBD5E1'}`,
              }}
            >
              <BadgeIcon
                name={def.icon}
                size={28}
                color={earned ? def.color || '#2563EB' : '#94A3B8'}
              />
            </div>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: earned ? 'var(--color-text)' : 'var(--color-text-muted)',
                marginBottom: '4px',
              }}
            >
              {def.name}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.3,
              }}
            >
              {def.description}
            </div>
            {earned && earned.earned_at && (
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '0.7rem',
                  color: def.color || '#2563EB',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                }}
              >
                {new Date(earned.earned_at).toLocaleDateString('cs-CZ')}
              </div>
            )}
            {!earned && (
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '20px',
                  height: '20px',
                  background: '#E2E8F0',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                }}
              >
                🔒
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
