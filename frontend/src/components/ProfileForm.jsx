import React, { useState } from 'react'
import { api } from '../utils/api.js'

const AVATAR_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#DC2626',
  '#D97706', '#16A34A', '#0891B2', '#9333EA',
]

const AVATAR_PRESETS = ['🦊', '🐻', '🐼', '🐯', '🦁', '🐸', '🐬', '🦄']
const CLASS_OPTIONS = ['Předškolák', '1. třída', '2. třída', '3. třída', '4. třída', '5. třída']

export default function ProfileForm({ onSave, onCancel, initialData, token }) {
  const [name, setName] = useState(initialData?.name || '')
  const [color, setColor] = useState(initialData?.color || AVATAR_COLORS[0])
  const [dailyGoal, setDailyGoal] = useState(initialData?.daily_goal || 15)
  const [schoolClass, setSchoolClass] = useState(initialData?.school_class || '')
  const [parentNote, setParentNote] = useState(initialData?.parent_note || '')
  const [avatarPreset, setAvatarPreset] = useState(initialData?.avatar_preset || '')
  const [isPaused, setIsPaused] = useState(!!initialData?.is_paused)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!initialData?.id

  const handleAvatarChange = (event) => {
    const file = event.target.files[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreset('')
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Zadej jméno')
      return
    }

    setLoading(true)
    setError('')

    try {
      let profile
      const payload = {
        name: name.trim(),
        color,
        daily_goal: Number(dailyGoal),
        school_class: schoolClass || null,
        parent_note: parentNote,
        avatar_preset: avatarPreset || null,
        is_paused: isPaused,
      }
      if (isEdit) {
        profile = await api.updateProfile(initialData.id, payload, token)
      } else {
        profile = await api.createProfile(payload, token)
      }

      if (avatarFile && profile?.id) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        await api.uploadAvatar(profile.id, fd, token)
      }

      onSave(isEdit ? 'Profil byl upraven.' : 'Profil byl vytvořen.')
    } catch (err) {
      setError(err.message || 'Chyba při ukládání')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="clay-card p-8 w-full max-w-lg mx-4 bounce-in" style={{ maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.4rem', marginBottom: '0.35rem', color: 'var(--color-text)' }}>
          {isEdit ? 'Upravit profil' : 'Nový profil'}
        </h2>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
          {isEdit ? 'Uprav údaje dítěte a potvrď změny.' : 'Vytvoř nový profil pro dnešní cvičení.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text)' }}>
              Jméno dítěte
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="např. Honzík"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '3px solid var(--color-border-medium)',
                borderRadius: '14px',
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text)' }}>
              Barva profilu
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {AVATAR_COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setColor(value)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: value,
                    border: color === value ? '3px solid var(--color-border-strong)' : '2px solid var(--color-border-light)',
                    cursor: 'pointer',
                    transform: color === value ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all 150ms ease',
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text)' }}>
              Přednastavený avatar
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAvatarPreset(preset)
                    setAvatarFile(null)
                    setAvatarPreview(null)
                  }}
                  className="btn-clay btn-clay-secondary"
                  style={{
                    padding: '10px 0',
                    borderRadius: '14px',
                    fontSize: '1.3rem',
                    borderColor: avatarPreset === preset ? color : undefined,
                    background: avatarPreset === preset ? `${color}18` : undefined,
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text)' }}>
              Fotka (volitelné)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="náhled" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${color}`, flexShrink: 0 }} />
              ) : avatarPreset ? (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${color}22`, border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>
                  {avatarPreset}
                </div>
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.4rem', color: '#fff', flexShrink: 0 }}>
                  {name ? name[0].toUpperCase() : '?'}
                </div>
              )}
              <label style={{ cursor: 'pointer', flex: 1 }}>
                <input type="file" accept="image/jpeg,image/png" onChange={handleAvatarChange} style={{ display: 'none' }} />
                <span className="btn-clay btn-clay-secondary" style={{ display: 'block', padding: '8px 14px', borderRadius: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                  {avatarFile ? `✓ ${avatarFile.name.slice(0, 20)}` : 'Vybrat fotku'}
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text)' }}>
                Třída
              </label>
              <select
                value={schoolClass}
                onChange={(event) => setSchoolClass(event.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '3px solid var(--color-border-medium)',
                  borderRadius: '14px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                }}
              >
                <option value="">Nevybráno</option>
                {CLASS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text)' }}>
                Denní cíl
              </label>
              <input
                type="number"
                min="5"
                max="200"
                value={dailyGoal}
                onChange={(event) => setDailyGoal(event.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '3px solid var(--color-border-medium)',
                  borderRadius: '14px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text)' }}>
              Poznámka pro rodiče
            </label>
            <textarea
              value={parentNote}
              onChange={(event) => setParentNote(event.target.value)}
              rows={3}
              placeholder="Např. procvičit měkké a tvrdé i/y nebo trénovat kratší bloky."
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '3px solid var(--color-border-medium)',
                borderRadius: '14px',
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                resize: 'vertical',
              }}
            />
          </div>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '20px',
            padding: '12px 14px',
            border: '2px solid var(--color-border-medium)',
            borderRadius: '14px',
            background: 'var(--color-bg)',
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text)',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={isPaused}
              onChange={(event) => setIsPaused(event.target.checked)}
            />
            Pozastavit profil a dočasně ho vyřadit z běžného cvičení
          </label>

          {error && (
            <p style={{ color: 'var(--color-error)', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: '12px' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onCancel}
              className="btn-clay btn-clay-secondary"
              style={{ flex: 1, padding: '10px', borderRadius: '14px', minWidth: '120px' }}
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-clay btn-clay-primary"
              style={{ flex: 1, padding: '10px', borderRadius: '14px', minWidth: '120px' }}
            >
              {loading ? 'Ukládám...' : 'Uložit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
