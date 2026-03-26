import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Users } from 'lucide-react'
import { api } from '../utils/api.js'
import ProfileCard from '../components/ProfileCard.jsx'
import PinModal from '../components/PinModal.jsx'
import ProfileForm from '../components/ProfileForm.jsx'

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
