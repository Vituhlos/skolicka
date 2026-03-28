import React from 'react'

export default function BadgeGrid({ badges = [], definitions = [] }) {
  if (!definitions.length) return null

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap: '12px',
    }}>
      {definitions.map((def) => {
        const earned = badges.find((b) => b.key === def.id)
        const emoji = earned?.icon || def.icon || '🏅'

        return (
          <div
            key={def.id}
            style={{
              background: earned ? 'var(--color-surface)' : 'var(--color-bg)',
              border: `3px solid ${earned ? def.color || '#2563EB' : 'var(--color-border-light)'}`,
              borderRadius: '20px',
              padding: '16px 10px 12px',
              textAlign: 'center',
              boxShadow: earned
                ? `0 4px 0 ${def.colorDark || '#1D4ED8'}, 0 8px 16px rgba(0,0,0,0.06)`
                : `0 4px 0 var(--color-border-light)`,
              transition: 'all 200ms ease',
              position: 'relative',
              opacity: earned ? 1 : 0.55,
            }}
          >
            {/* Emoji icon */}
            <div style={{
              fontSize: earned ? '2.2rem' : '1.8rem',
              marginBottom: '8px',
              lineHeight: 1,
              filter: earned ? 'none' : 'grayscale(1)',
              transition: 'all 200ms ease',
            }}>
              {earned ? emoji : (def.icon || '🏅')}
            </div>

            {/* Name */}
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.8rem',
              color: earned ? 'var(--color-text)' : 'var(--color-text-muted)',
              marginBottom: '4px',
              lineHeight: 1.2,
            }}>
              {def.name}
            </div>

            {/* Description */}
            <div style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.7rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1.3,
            }}>
              {def.description}
            </div>

            {/* Earned date */}
            {earned?.earned_at && (
              <div style={{
                marginTop: '6px',
                fontSize: '0.65rem',
                color: def.color || '#2563EB',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
              }}>
                {new Date(earned.earned_at).toLocaleDateString('cs-CZ')}
              </div>
            )}

            {/* Lock indicator */}
            {!earned && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                fontSize: '10px',
                opacity: 0.5,
              }}>
                🔒
              </div>
            )}

            {/* Earned checkmark */}
            {earned && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '18px',
                height: '18px',
                background: def.color || '#2563EB',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
