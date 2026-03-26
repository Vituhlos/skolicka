import React from 'react'
import ProgressBar from './ProgressBar.jsx'

export default function XPBar({ xp = 0, level = 1, xpToNext = 100 }) {
  const xpInCurrentLevel = xp % (xpToNext || 100)
  const progress = xpToNext > 0 ? xpInCurrentLevel : 0

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '2px solid #CBD5E1',
        borderRadius: '16px',
        padding: '12px 16px',
        boxShadow: '0 2px 0 #CBD5E1',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: 'var(--color-cta)',
              color: 'white',
              border: '2px solid var(--color-cta-dark)',
              borderRadius: '10px',
              padding: '2px 10px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.85rem',
              boxShadow: '0 2px 0 var(--color-cta-dark)',
            }}
          >
            Úroveň {level}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '0.9rem',
            color: 'var(--color-text-muted)',
          }}
        >
          {xp} XP
        </span>
      </div>
      <ProgressBar
        current={progress}
        total={xpToNext}
        color="var(--color-cta)"
        height={12}
      />
      <div style={{
        textAlign: 'right',
        fontSize: '0.75rem',
        color: 'var(--color-text-muted)',
        marginTop: '4px',
        fontFamily: 'var(--font-body)',
      }}>
        {xpToNext - progress} XP do další úrovně
      </div>
    </div>
  )
}
