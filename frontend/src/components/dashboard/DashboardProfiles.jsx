import React from 'react'
import { GripVertical, PauseCircle, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableProfileItem({ profile, onEdit, onTogglePause, onDeleteConfirm, avatarUrl }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: profile.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : (profile.is_paused ? 0.75 : 1),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="clay-card"
      {...attributes}
    >
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {/* Drag handle */}
        <div
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--color-text-muted)', flexShrink: 0, touchAction: 'none' }}
          title="Přetáhnout"
        >
          <GripVertical size={20} />
        </div>

        {/* Avatar */}
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          flexShrink: 0,
          overflow: 'hidden',
          border: `3px solid ${profile.color || 'var(--color-primary)'}`,
          background: avatarUrl ? 'transparent' : (profile.avatar_preset ? `${profile.color || '#2563EB'}22` : profile.color || '#2563EB'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: profile.avatar_preset ? '1.6rem' : '1.3rem',
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          color: '#fff',
        }}>
          {avatarUrl
            ? <img src={avatarUrl} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (profile.avatar_preset || (profile.name?.[0] || '?').toUpperCase())}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: '140px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
              {profile.name}
            </h3>
            {profile.is_paused && (
              <span style={{
                background: '#FEF3C7',
                color: '#92400E',
                border: '1px solid #D97706',
                borderRadius: '8px',
                padding: '1px 8px',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
              }}>
                Pozastavený
              </span>
            )}
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            {[
              profile.school_class,
              `Streak: ${profile.current_streak || 0} 🔥`,
              profile.last_active_date && `Naposledy: ${new Date(profile.last_active_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}`,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn-clay btn-clay-secondary"
            style={{ padding: '7px 14px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => onEdit(profile)}
          >
            <Pencil size={13} />
            Upravit
          </button>
          <button
            className="btn-clay btn-clay-secondary"
            style={{ padding: '7px 14px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => onTogglePause(profile)}
          >
            {profile.is_paused ? <Play size={13} /> : <PauseCircle size={13} />}
            {profile.is_paused ? 'Obnovit' : 'Pozastavit'}
          </button>
          <button
            className="btn-clay btn-clay-danger"
            style={{ padding: '7px 14px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => onDeleteConfirm(profile)}
          >
            <Trash2 size={13} />
            Smazat
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardProfiles({ profiles, token, dndSensors, onDragEnd, onEdit, onTogglePause, onDeleteConfirm, onAddProfile, profileNotice, onCloseNotice, BASE_API_URL }) {
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-text)', margin: '0 0 4px' }}>
            Správa profilů
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Uprav, vytvoř nebo odstraň profily dětí.
          </p>
        </div>
        <button
          className="btn-clay btn-clay-primary"
          style={{ padding: '10px 20px', borderRadius: '14px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={onAddProfile}
        >
          <Plus size={16} />
          Nový profil
        </button>
      </div>

      {/* Notice */}
      {profileNotice && (
        <div style={{
          background: profileNotice.type === 'error' ? '#FEE2E2' : '#ECFDF5',
          border: `2px solid ${profileNotice.type === 'error' ? 'var(--color-error)' : '#16A34A'}`,
          borderRadius: '14px',
          padding: '12px 16px',
          color: profileNotice.type === 'error' ? 'var(--color-error)' : '#166534',
          fontFamily: 'var(--font-body)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <span>{profileNotice.message}</span>
          <button
            className="btn-clay btn-clay-secondary"
            style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '0.8rem', flexShrink: 0 }}
            onClick={onCloseNotice}
          >Zavřít</button>
        </div>
      )}

      {/* Profile cards */}
      {profiles.length === 0 ? (
        <div className="clay-card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Zatím žádné profily.
          </p>
          <button
            className="btn-clay btn-clay-primary"
            style={{ padding: '10px 24px', borderRadius: '14px' }}
            onClick={onAddProfile}
          >
            Vytvořit první profil
          </button>
        </div>
      ) : (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={profiles.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'grid', gap: '12px' }}>
              {profiles.map((profile) => {
                const avatarUrl = profile.avatar_url ? `${BASE_API_URL}${profile.avatar_url}` : null
                return (
                  <SortableProfileItem
                    key={profile.id}
                    profile={profile}
                    avatarUrl={avatarUrl}
                    onEdit={onEdit}
                    onTogglePause={onTogglePause}
                    onDeleteConfirm={onDeleteConfirm}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
