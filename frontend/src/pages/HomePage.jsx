import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Users } from 'lucide-react'
import { api, BASE_API_URL } from '../utils/api.js'
import ProfileCard from '../components/ProfileCard.jsx'
import PinModal from '../components/PinModal.jsx'
import Button from '../components/Button.jsx'

const AVATAR_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#DC2626',
  '#D97706', '#16A34A', '#0891B2', '#9333EA',
]

function ProfileForm({ onSave, onCancel, initialData, token }) {
  const [name, setName] = useState(initialData?.name || '')
  const [color, setColor] = useState(initialData?.color || AVATAR_COLORS[0])
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!initialData?.id

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Zadej jméno'); return }
    setLoading(true)
    setError('')
    try {
      let profile
      if (isEdit) {
        profile = await api.updateProfile(initialData.id, { name: name.trim(), color }, token)
      } else {
        profile = await api.createProfile({ name: name.trim(), color }, token)
      }
      if (avatarFile && profile?.id) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        await api.uploadAvatar(profile.id, fd, token)
      }
      onSave()
    } catch (err) {
      setError(err.message || 'Chyba při ukládání')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="clay-card p-8 w-full max-w-sm mx-4 bounce-in">
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.4rem', marginBottom: '1.5rem', color: 'var(--color-text)' }}>
          {isEdit ? 'Upravit profil' : 'Nový profil'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text)' }}>
              Jméno dítěte
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: c,
                    border: color === c ? '3px solid #1E293B' : '2px solid #E2E8F0',
                    cursor: 'pointer',
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all 150ms ease',
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text)' }}>
              Fotka (volitelné)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {avatarPreview
                ? <img src={avatarPreview} alt="náhled" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${color}`, flexShrink: 0 }} />
                : <div style={{ width: 56, height: 56, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.4rem', color: '#fff', flexShrink: 0 }}>
                    {name ? name[0].toUpperCase() : '?'}
                  </div>
              }
              <label style={{ cursor: 'pointer', flex: 1 }}>
                <input type="file" accept="image/jpeg,image/png" onChange={handleAvatarChange} style={{ display: 'none' }} />
                <span className="btn-clay btn-clay-secondary" style={{ display: 'block', padding: '8px 14px', borderRadius: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                  {avatarFile ? '✓ ' + avatarFile.name.slice(0, 20) : 'Vybrat fotku'}
                </span>
              </label>
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--color-error)', fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: '12px' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onCancel}
              className="btn-clay btn-clay-secondary"
              style={{ flex: 1, padding: '10px', borderRadius: '14px' }}
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-clay btn-clay-primary"
              style={{ flex: 1, padding: '10px', borderRadius: '14px' }}
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
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinAction, setPinAction] = useState(null) // 'parent' | 'add' | 'edit'
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [editingProfile, setEditingProfile] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('parent_token'))

  const loadProfiles = async () => {
    try {
      setLoading(true)
      const data = await api.getProfiles()
      setProfiles(data.profiles || data || [])
    } catch (err) {
      setError('Nepodařilo se načíst profily')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  const handleSelectProfile = (profile) => {
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

  const handleAddProfileClick = () => {
    if (token) {
      setEditingProfile(null)
      setShowProfileForm(true)
    } else {
      setPinAction('add')
      setShowPinModal(true)
    }
  }

  const handleEditProfile = (profile) => {
    if (token) {
      setEditingProfile(profile)
      setShowProfileForm(true)
    } else {
      setPinAction('edit')
      setShowPinModal(true)
    }
  }

  const handleDeleteProfile = async (profileId) => {
    if (!token) return
    try {
      await api.deleteProfile(profileId, token)
      await loadProfiles()
    } catch (err) {
      setError('Nepodařilo se smazat profil')
    }
  }

  const handlePinSuccess = (newToken) => {
    setToken(newToken)
    setShowPinModal(false)
    if (pinAction === 'parent') {
      navigate('/rodic')
    } else if (pinAction === 'add') {
      setEditingProfile(null)
      setShowProfileForm(true)
    } else if (pinAction === 'edit' && editingProfile) {
      setShowProfileForm(true)
    }
  }

  const handleFormSave = async () => {
    setShowProfileForm(false)
    setEditingProfile(null)
    await loadProfiles()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '0' }}>
      {/* Header */}
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
            Školička
          </h1>
        </div>

        <button
          onClick={handleParentClick}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Users size={16} />
          Rodiče
        </button>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '1.4rem',
          color: 'var(--color-text)',
          marginBottom: '24px',
        }}>
          Kdo bude dnes cvičit?
        </h2>

        {loading && (
          <div className="profile-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: '180px', borderRadius: '24px' }} className="skeleton" />
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
                onDelete={handleDeleteProfile}
                token={token}
              />
            ))}

            {/* Add profile card */}
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
                minHeight: '150px',
                gap: '12px',
                transition: 'all 200ms ease-out',
                color: 'var(--color-text-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.background = '#EFF6FF'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#CBD5E1'
                e.currentTarget.style.background = 'var(--color-surface)'
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: '2px dashed #CBD5E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Plus size={24} />
              </div>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem' }}>
                Přidat dítě
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showPinModal && (
        <PinModal
          isOpen={showPinModal}
          onSuccess={handlePinSuccess}
          onClose={() => setShowPinModal(false)}
        />
      )}

      {showProfileForm && (
        <ProfileForm
          onSave={handleFormSave}
          onCancel={() => { setShowProfileForm(false); setEditingProfile(null) }}
          initialData={editingProfile}
          token={token}
        />
      )}
    </div>
  )
}
