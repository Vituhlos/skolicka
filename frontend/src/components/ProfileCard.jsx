import React, { useState } from 'react'
import { Settings, Trash2, Check, X } from 'lucide-react'
import { api, BASE_API_URL } from '../utils/api.js'
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

function AvatarDisplay({ profile, size = 80 }) {
  const [imgError, setImgError] = useState(false)
  const color = getColorForProfile(profile)
  const initial = (profile.name || '?')[0].toUpperCase()

  if (!imgError && profile.has_avatar) {
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
        color: color,
      }}
    >
      {initial}
    </div>
  )
}

export default function ProfileCard({ profile, onSelect, onEdit, onDelete, token }) {
  const [showActions, setShowActions] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const color = getColorForProfile(profile)

  const handleSettingsClick = (e) => {
    e.stopPropagation()
    if (!token) {
      onEdit(profile)
      return
    }
    setShowActions(!showActions)
    setConfirmDelete(false)
  }

  const handleEdit = (e) => {
    e.stopPropagation()
    setShowActions(false)
    onEdit(profile)
  }

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    setConfirmDelete(true)
  }

  const handleDeleteConfirm = async (e) => {
    e.stopPropagation()
    try {
      await onDelete(profile.id)
    } catch (err) {
      console.error(err)
    }
    setConfirmDelete(false)
    setShowActions(false)
  }

  const handleDeleteCancel = (e) => {
    e.stopPropagation()
    setConfirmDelete(false)
    setShowActions(false)
  }

  return (
    <div
      className="clay-card"
      style={{
        padding: '20px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        borderColor: color,
        boxShadow: `0 4px 0 ${color}99, 0 8px 24px rgba(0,0,0,0.08)`,
        position: 'relative',
        transition: 'all 200ms ease-out',
      }}
      onClick={() => onSelect(profile)}
    >
      {/* Settings button */}
      {token && (
        <button
          onClick={handleSettingsClick}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: '#F1F5F9',
            border: '2px solid #CBD5E1',
            borderRadius: '10px',
            padding: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            zIndex: 2,
          }}
        >
          <Settings size={15} />
        </button>
      )}

      {/* Actions dropdown */}
      {showActions && !confirmDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '40px',
            right: '10px',
            background: 'var(--color-surface)',
            border: '2px solid #CBD5E1',
            borderRadius: '14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 10,
            overflow: 'hidden',
            minWidth: '130px',
          }}
        >
          <button
            onClick={handleEdit}
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
              color: 'var(--color-text)',
              textAlign: 'left',
            }}
          >
            <Settings size={14} />
            Upravit
          </button>
          <div style={{ height: '1px', background: '#E2E8F0' }} />
          <button
            onClick={handleDeleteClick}
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
              color: 'var(--color-error)',
              textAlign: 'left',
            }}
          >
            <Trash2 size={14} />
            Smazat
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '40px',
            right: '10px',
            background: 'var(--color-surface)',
            border: '2px solid var(--color-error)',
            borderRadius: '14px',
            padding: '12px',
            zIndex: 10,
            textAlign: 'left',
            minWidth: '160px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text)', marginBottom: '10px', fontFamily: 'var(--font-body)' }}>
            Opravdu smazat?
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDeleteConfirm}
              style={{
                flex: 1,
                background: 'var(--color-error)',
                color: 'white',
                border: '2px solid var(--color-error-dark)',
                borderRadius: '10px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={14} />
            </button>
            <button
              onClick={handleDeleteCancel}
              style={{
                flex: 1,
                background: '#F1F5F9',
                color: 'var(--color-text)',
                border: '2px solid #CBD5E1',
                borderRadius: '10px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
        <AvatarDisplay profile={profile} size={80} />
      </div>

      <h3 style={{
        fontFamily: 'var(--font-heading)',
        fontWeight: 700,
        fontSize: '1.1rem',
        color: 'var(--color-text)',
        margin: '0 0 8px',
      }}>
        {profile.name}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <StreakBadge count={profile.streak || 0} size="sm" />
        <div className="xp-pill" style={{ fontSize: '0.8rem', padding: '2px 8px' }}>
          {profile.total_xp || 0} XP
        </div>
      </div>
    </div>
  )
}
