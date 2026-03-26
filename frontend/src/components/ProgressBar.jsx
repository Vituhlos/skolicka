import React from 'react'

export default function ProgressBar({ current, total, color = 'var(--color-primary)', label, height = 16 }) {
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
          color: 'var(--color-text-muted)',
          fontWeight: 700,
        }}>
          <span>{label}</span>
          <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>
            {current}/{total}
          </span>
        </div>
      )}
      <div
        className="progress-clay"
        style={{ height: `${height}px` }}
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="progress-clay-fill"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            height: '100%',
            minWidth: percentage > 0 ? '8px' : '0',
          }}
        />
      </div>
    </div>
  )
}
