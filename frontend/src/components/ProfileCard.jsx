import React, { useState } from 'react'
import { Archive, Calendar, Flag, PauseCircle, Play, Settings, Sparkles, StickyNote, Users } from 'lucide-react'
import { BASE_API_URL } from '../utils/api.js'
import StreakBadge from './StreakBadge.jsx'

const AVATAR_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#DC2626',
  '#D97706', '#16A34A', '#0891B2', '#9333EA',
]

function getColorForProfile(profile) {
  if (profile.color) return profile.color
  const idx = profile.id ? profile.id % AVATAR_COLORS.length : 0
  return AVATAR_COLORS[idx]
}

function formatLastActive(dateValue) {
  if (!dateValue) return 'Zatím bez aktivity'

  const today = new Date()
  const target = new Date(`${dateValue}T00:00:00`)
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today - target) / 86400000)

  if (diffDays === 0) return 'Aktivní dnes'
  if (diffDays === 1) return 'Aktivní včera'
  return `Naposledy ${new Date(dateValue).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}`
}

function AvatarDisplay({ profile, size = 80 }) {
  const [imgError, setImgError] = useState(false)
  const color = getColorForProfile(profile)
  const initial = (profile.name || '?')[0].toUpperCase()

  if (!imgError && profile.avatar_url) {
    return (
      <img
        src={`${BASE_API_URL}/api/profiles/${profile.id}/avatar`}
        alt={profile.name}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: `3px solid ${color}`,
          boxShadow: `0 3px 0 ${color}99`,
        }}
      />
    )
  }

  if (profile.avatar_preset) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `${color}18`,
          border: `3px solid ${color}`,
          boxShadow: `0 3px 0 ${color}99`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${size * 0.42}px`,
        }}
      >
        {profile.avatar_preset}
      </div>
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `${color}22`,
        border: `3px solid ${color}`,
        boxShadow: `0 3px 0 ${color}99`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-heading)',
        fontWeight: 700,
        fontSize: `${size * 0.4}px`,
        color,
      }}
    >
      {initial}
    </div>
  )
}

function InfoChip({ icon: Icon, label, value, accent = '#CBD5E1', background = '#F8FAFC' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 10px',
      borderRadius: '12px',
      border: `2px solid ${accent}`,
      background,
    }}>
      <Icon size={14} color={accent} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          {label}
        </p>
        <p style={{ margin: '1px 0 0', fontFamily: 'var(--font-heading)', fontSize: '0.86rem', color: 'var(--color-text)' }}>
          {value}
        </p>
      </div>
    </div>
  )
}

export default function ProfileCard({ profile, onSelect, onEdit, onArchive, onTogglePause, isRecentlyActive, streak }) {
  const color = getColorForProfile(profile)
  const lastActiveLabel = formatLastActive(profile.last_active_date)
  const [showActions, setShowActions] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const isPaused = !!profile.is_paused

  return (
    <div
      className="clay-card"
      style={{
        padding: '20px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        borderColor: color,
        boxShadow: isRecentlyActive
          ? `0 5px 0 ${color}, 0 14px 28px rgba(37, 99, 235, 0.16)`
          : `0 4px 0 ${color}99, 0 8px 24px rgba(0,0,0,0.08)`,
        position: 'relative',
        transition: 'transform 180ms ease, box-shadow 180ms ease, background 180ms ease',
        background: isRecentlyActive ? 'linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%)' : 'var(--color-surface)',
        opacity: isPaused ? 0.78 : 1,
      }}
      onClick={() => !isPaused && onSelect(profile)}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)'
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setShowActions(false)
          setConfirmArchive(false)
        }
      }}
    >
      <button
        onClick={(event) => {
          event.stopPropagation()
          setShowActions((current) => !current)
          setConfirmArchive(false)
        }}
        className="btn-clay btn-clay-secondary"
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '6px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
        aria-label={`Spravovat profil ${profile.name}`}
      >
        <Settings size={15} />
      </button>

      {showActions && !confirmArchive && (
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            position: 'absolute',
            top: '44px',
            right: '10px',
            background: 'var(--color-surface)',
            border: '2px solid #CBD5E1',
            borderRadius: '14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 10,
            overflow: 'hidden',
            minWidth: '160px',
            textAlign: 'left',
          }}
        >
          <button
            onClick={(event) => {
              event.stopPropagation()
              setShowActions(false)
              onEdit(profile)
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              color: 'var(--color-text)',
              textAlign: 'left',
            }}
          >
            Upravit profil
          </button>
          <div style={{ height: '1px', background: '#E2E8F0' }} />
          <button
            onClick={(event) => {
              event.stopPropagation()
              setShowActions(false)
              onTogglePause(profile)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              color: '#475569',
              textAlign: 'left',
            }}
          >
            <PauseCircle size={14} />
            {isPaused ? 'Obnovit profil' : 'Pozastavit profil'}
          </button>
          <div style={{ height: '1px', background: '#E2E8F0' }} />
          <button
            onClick={(event) => {
              event.stopPropagation()
              setConfirmArchive(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              color: '#C2410C',
              textAlign: 'left',
            }}
          >
            <Archive size={14} />
            Archivovat profil
          </button>
        </div>
      )}

      {showActions && confirmArchive && (
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            position: 'absolute',
            top: '44px',
            right: '10px',
            background: 'var(--color-surface)',
            border: '2px solid #FDBA74',
            borderRadius: '14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 10,
            minWidth: '210px',
            textAlign: 'left',
            padding: '12px',
          }}
        >
          <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: 'var(--color-text)' }}>
            Opravdu archivovat tento profil?
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={(event) => {
                event.stopPropagation()
                setShowActions(false)
                setConfirmArchive(false)
                onArchive(profile)
              }}
              className="btn-clay btn-clay-primary"
              style={{ flex: 1, padding: '8px 10px', borderRadius: '12px', background: '#F97316', borderColor: '#C2410C' }}
            >
              Ano
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation()
                setConfirmArchive(false)
              }}
              className="btn-clay btn-clay-secondary"
              style={{ flex: 1, padding: '8px 10px', borderRadius: '12px' }}
            >
              Zpět
            </button>
          </div>
        </div>
      )}

      {isRecentlyActive && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          borderRadius: '999px',
          border: '2px solid #BFDBFE',
          background: '#EFF6FF',
          color: '#1D4ED8',
          fontFamily: 'var(--font-heading)',
          fontSize: '0.76rem',
          fontWeight: 700,
        }}>
          <Sparkles size={12} />
          Naposledy aktivní
        </div>
      )}

      {isPaused && (
        <div style={{
          position: 'absolute',
          top: isRecentlyActive ? '42px' : '10px',
          left: '10px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          borderRadius: '999px',
          border: '2px solid #CBD5E1',
          background: '#F8FAFC',
          color: '#475569',
          fontFamily: 'var(--font-heading)',
          fontSize: '0.76rem',
          fontWeight: 700,
        }}>
          <PauseCircle size={12} />
          Pozastavený
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', marginTop: isRecentlyActive || isPaused ? '22px' : 0 }}>
        <AvatarDisplay profile={profile} size={80} />
      </div>

      <h3 style={{
        fontFamily: 'var(--font-heading)',
        fontWeight: 700,
        fontSize: '1.1rem',
        color: 'var(--color-text)',
        margin: '0 0 10px',
      }}>
        {profile.name}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <StreakBadge count={profile.current_streak || profile.streak || 0} size="sm" />
        <div className="xp-pill" style={{ fontSize: '0.8rem', padding: '2px 8px' }}>
          {profile.total_xp || 0} XP
        </div>
      </div>

      <div style={{ display: 'grid', gap: '8px', marginBottom: '14px', textAlign: 'left' }}>
        {profile.school_class ? (
          <InfoChip
            icon={Users}
            label="Třída"
            value={profile.school_class}
            accent="#7C3AED"
            background="#F5F3FF"
          />
        ) : null}
        <InfoChip
          icon={Flag}
          label="Denní cíl"
          value={`${profile.daily_goal || 15} odpovědí`}
          accent="#C2410C"
          background="#FFF7ED"
        />
        <InfoChip
          icon={Calendar}
          label="Poslední aktivita"
          value={lastActiveLabel}
          accent={isRecentlyActive ? '#2563EB' : '#64748B'}
          background={isRecentlyActive ? '#EFF6FF' : '#F8FAFC'}
        />
        {profile.parent_note ? (
          <InfoChip
            icon={StickyNote}
            label="Poznámka"
            value={profile.parent_note}
            accent="#0F766E"
            background="#F0FDFA"
          />
        ) : null}
      </div>

      {streak != null && !isPaused && (() => {
        const today = streak.today_answers || 0
        const goal = streak.daily_goal || profile.daily_goal || 15
        const pct = Math.min(100, Math.round((today / goal) * 100))
        const done = today >= goal
        const barColor = done ? 'var(--color-success)' : 'var(--color-primary)'
        return (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Dnes
              </span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.78rem', color: done ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                {today} / {goal} {done ? '✓' : ''}
              </span>
            </div>
            <div className="progress-clay" style={{ height: '8px' }}>
              <div className="progress-clay-fill" style={{ width: `${pct}%`, background: barColor }} />
            </div>
          </div>
        )
      })()}

      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        padding: '10px 12px',
        borderRadius: '14px',
        border: `2px solid ${color}`,
        background: `${color}12`,
        fontFamily: 'var(--font-heading)',
        fontWeight: 700,
        color,
      }}>
        {isPaused ? <PauseCircle size={15} /> : <Play size={15} />}
        {isPaused ? 'Profil je pozastavený' : 'Začít cvičit'}
      </div>
    </div>
  )
}
