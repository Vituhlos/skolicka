import React from 'react'
import { Flame } from 'lucide-react'

export default function StreakBadge({ count = 0, size = 'md' }) {
  const isActive = count > 0
  const sizes = {
    sm: { icon: 16, text: '0.8rem', padding: '3px 8px', borderRadius: '10px' },
    md: { icon: 20, text: '1rem', padding: '4px 10px', borderRadius: '12px' },
    lg: { icon: 24, text: '1.2rem', padding: '6px 14px', borderRadius: '14px' },
  }
  const s = sizes[size] || sizes.md

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: isActive ? '#FFF7ED' : '#F8FAFC',
        border: `2px solid ${isActive ? '#F97316' : '#CBD5E1'}`,
        borderRadius: s.borderRadius,
        padding: s.padding,
        boxShadow: `0 2px 0 ${isActive ? '#EA580C' : '#CBD5E1'}`,
      }}
    >
      <span className={isActive ? 'pulse-flame' : ''}>
        <Flame
          size={s.icon}
          style={{ color: isActive ? '#F97316' : '#94A3B8' }}
          fill={isActive ? '#F97316' : 'none'}
        />
      </span>
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: s.text,
          color: isActive ? '#EA580C' : '#94A3B8',
        }}
      >
        {count}
      </span>
    </div>
  )
}
