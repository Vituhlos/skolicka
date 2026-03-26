import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Users } from 'lucide-react'
import { api } from '../utils/api.js'
import ProfileCard from '../components/ProfileCard.jsx'
import PinModal from '../components/PinModal.jsx'

const AVATAR_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#DC2626',
  '#D97706', '#16A34A', '#0891B2', '#9333EA',
]

const AVATAR_PRESETS = ['🦊', '🐻', '🐼', '🐯', '🦁', '🐸', '🐬', '🦄']
const CLASS_OPTIONS = ['Předškolák', '1. třída', '2. třída', '3. třída', '4. třída', '5. třída']

function StatusNotice({ notice, onClose }) {
  if (!notice) return null

  const palette = notice.type === 'error'
    ? { bg: '#FEE2E2', border: 'var(--color-error)', text: 'var(--color-error)' }
    : { bg: '#ECFDF5', border: '#16A34A', text: '#166534' }

  return (
    <div style={{
      background: palette.bg,
      border: `2px solid ${palette.border}`,
      borderRadius: '16px',
      padding: '14px 16px',
      color: palette.text,
      fontFamily: 'var(--font-body)',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    }}>
      <span>{notice.message}</span>
      <button
        onClick={onClose}
        className="btn-clay btn-clay-secondary"
        style={{ padding: '6px 10px', borderRadius: '10px', fontSize: '0.85rem' }}
      >
        Zavřít
      </button>
    </div>
  )
}

function ProfileForm({ onSave, onCancel, initialData, token }) {
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
                border: '3px solid #CBD5E1',
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
                    border: color === value ? '3px solid #1E293B' : '2px solid #E2E8F0',
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
                  border: '3px solid #CBD5E1',
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
                  border: '3px solid #CBD5E1',
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
                border: '3px solid #CBD5E1',
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
            border: '2px solid #CBD5E1',
            borderRadius: '14px',
            background: '#F8FAFC',
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

export default function HomePage() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinAction, setPinAction] = useState(null)
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [editingProfile, setEditingProfile] = useState(null)
  const [pendingManagedProfile, setPendingManagedProfile] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('parent_token'))

  const loadProfiles = async () => {
    try {
      setLoading(true)
      const data = await api.getProfiles()
      setProfiles(data.profiles || data || [])
    } catch {
      setError('Nepodařilo se načíst profily')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  const mostRecentProfileId = useMemo(() => {
    const activeProfiles = profiles.filter((profile) => profile.last_active_date)
    if (activeProfiles.length === 0) return null

    return activeProfiles.reduce((latest, profile) => (
      !latest || profile.last_active_date > latest.last_active_date ? profile : latest
    ), null)?.id || null
  }, [profiles])

  const handleSelectProfile = (profile) => {
    if (profile.is_paused) return
    localStorage.setItem('current_profile_id', profile.id)
    navigate(`/profil/${profile.id}`)
  }

  const handleParentClick = () => {
    if (token) {
      navigate('/rodic')
    } else {
      setPinAction('parent')
      setShowPinModal(true)
    }
  }

  const openProfileForm = (profile = null) => {
    setEditingProfile(profile)
    setShowProfileForm(true)
  }

  const handleAddProfileClick = () => {
    if (token) {
      openProfileForm(null)
    } else {
      setPinAction('add')
      setShowPinModal(true)
    }
  }

  const handleEditProfile = (profile) => {
    if (token) {
      openProfileForm(profile)
    } else {
      setPendingManagedProfile(profile)
      setPinAction('edit')
      setShowPinModal(true)
    }
  }

  const handleArchiveProfile = async (profileId, authToken = token) => {
    await api.deleteProfile(profileId, authToken)
    await loadProfiles()
    setNotice({ type: 'success', message: 'Profil byl archivován.' })
  }

  const handleTogglePause = async (profile, authToken = token) => {
    const nextPaused = !profile.is_paused

    try {
      await api.updateProfile(profile.id, { is_paused: nextPaused }, authToken)
      await loadProfiles()
      setNotice({
        type: 'success',
        message: nextPaused ? 'Profil byl pozastaven.' : 'Profil byl znovu aktivován.',
      })
    } catch (err) {
      setNotice({ type: 'error', message: err.message || 'Nepodařilo se změnit stav profilu.' })
    }
  }

  const requestArchiveProfile = (profile) => {
    if (token) {
      handleArchiveProfile(profile.id)
    } else {
      setPendingManagedProfile(profile)
      setPinAction('archive')
      setShowPinModal(true)
    }
  }

  const requestTogglePause = (profile) => {
    if (token) {
      handleTogglePause(profile)
    } else {
      setPendingManagedProfile(profile)
      setPinAction('pause')
      setShowPinModal(true)
    }
  }

  const handlePinSuccess = async (newToken) => {
    setToken(newToken)
    setShowPinModal(false)

    if (pinAction === 'parent') {
      navigate('/rodic')
    } else if (pinAction === 'add') {
      openProfileForm(null)
    } else if (pinAction === 'edit' && pendingManagedProfile) {
      openProfileForm(pendingManagedProfile)
      setPendingManagedProfile(null)
    } else if (pinAction === 'archive' && pendingManagedProfile) {
      await handleArchiveProfile(pendingManagedProfile.id, newToken)
      setPendingManagedProfile(null)
    } else if (pinAction === 'pause' && pendingManagedProfile) {
      await handleTogglePause(pendingManagedProfile, newToken)
      setPendingManagedProfile(null)
    }
  }

  const handleFormSave = async (message) => {
    setShowProfileForm(false)
    setEditingProfile(null)
    await loadProfiles()
    setNotice({ type: 'success', message })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '0' }}>
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '3px solid #E2E8F0',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            background: 'var(--color-primary)',
            border: '3px solid var(--color-primary-dark)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 0 var(--color-primary-dark)',
          }}>
            <BookOpen size={22} color="white" />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '1.6rem',
            color: 'var(--color-text)',
            margin: 0,
          }}>
            Skolicka
          </h1>
        </div>

        <button
          onClick={handleParentClick}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Users size={16} />
          Rodice
        </button>
      </header>

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '1.4rem',
          color: 'var(--color-text)',
          marginBottom: '12px',
        }}>
          Kdo bude dnes cvicit?
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', marginTop: 0, marginBottom: '24px' }}>
          Vyber profil a pokračuj v učení. U profilu hned uvidíš cíl, streak, třídu i poslední aktivitu.
        </p>

        <StatusNotice notice={notice} onClose={() => setNotice(null)} />

        {loading && (
          <div className="profile-grid">
            {[1, 2, 3].map((index) => (
              <div key={index} style={{ height: '260px', borderRadius: '24px' }} className="skeleton" />
            ))}
          </div>
        )}

        {error && (
          <div style={{
            background: '#FEE2E2',
            border: '2px solid var(--color-error)',
            borderRadius: '16px',
            padding: '16px',
            color: 'var(--color-error)',
            fontFamily: 'var(--font-body)',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {!loading && (
          <div className="profile-grid">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onSelect={handleSelectProfile}
                onEdit={handleEditProfile}
                onArchive={requestArchiveProfile}
                onTogglePause={requestTogglePause}
                isRecentlyActive={profile.id === mostRecentProfileId}
              />
            ))}

            <div
              onClick={handleAddProfileClick}
              style={{
                background: 'var(--color-surface)',
                border: '3px dashed #CBD5E1',
                borderRadius: '24px',
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                minHeight: '260px',
                gap: '12px',
                transition: 'all 200ms ease-out',
                color: 'var(--color-text-muted)',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = 'var(--color-primary)'
                event.currentTarget.style.background = '#EFF6FF'
                event.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = '#CBD5E1'
                event.currentTarget.style.background = 'var(--color-surface)'
                event.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                border: '2px dashed #CBD5E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Plus size={28} />
              </div>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem' }}>
                Pridat dite
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', textAlign: 'center', maxWidth: '180px' }}>
                Vytvoř nový profil a nastav mu barvu, avatar i další detaily.
              </span>
            </div>
          </div>
        )}
      </main>

      {showPinModal && (
        <PinModal
          isOpen={showPinModal}
          onSuccess={handlePinSuccess}
          onClose={() => {
            setShowPinModal(false)
            setPendingManagedProfile(null)
          }}
        />
      )}

      {showProfileForm && (
        <ProfileForm
          onSave={handleFormSave}
          onCancel={() => {
            setShowProfileForm(false)
            setEditingProfile(null)
          }}
          initialData={editingProfile}
          token={token}
        />
      )}
    </div>
  )
}
