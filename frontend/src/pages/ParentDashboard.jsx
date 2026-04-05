import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, ChevronLeft, Download, KeyRound, ListPlus, TrendingUp, Trophy, Users,
} from 'lucide-react'
import SentenceManager from '../components/SentenceManager.jsx'
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import ProfileForm from '../components/ProfileForm.jsx'
import { api, BASE_API_URL } from '../utils/api.js'
import {
  normalizeTimeline, buildSessionTimeline, parseNumber, formatLongDate, formatDuration, formatResponseTime,
  calculateAccuracy,
} from '../utils/dashboardUtils.js'
import DashboardGlobal from '../components/dashboard/DashboardGlobal.jsx'
import DashboardVyjmenovana from '../components/dashboard/DashboardVyjmenovana.jsx'
import DashboardProfiles from '../components/dashboard/DashboardProfiles.jsx'
import DashboardLeaderboard from '../components/dashboard/DashboardLeaderboard.jsx'


function SessionDetailModal({ session, loading, onClose }) {
  if (!session) return null

  const mistakes = Array.isArray(session.answers)
    ? session.answers.filter((answer) => !parseNumber(answer.is_correct))
    : []
  const summaryItems = [
    ['Datum', formatLongDate(session.started_at)],
    ['Modul', session.moduleLabel],
    ['Začátek', new Date(session.started_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })],
    ['Konec', session.ended_at ? new Date(session.ended_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : 'Rozpracované'],
    ['Otázky', String(session.totalAnswers)],
    ['Správně', `${session.correctAnswers} z ${session.totalAnswers}`],
    ['Přesnost', session.totalAnswers ? `${session.accuracy}%` : '—'],
    ['Délka', formatDuration(session.durationMinutes)],
    ['Stav', session.ended_at ? 'Dokončeno' : 'Rozpracované'],
  ]

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="clay-card bounce-in"
        style={{
          position: 'relative',
          margin: 'auto',
          width: '100%',
          maxWidth: '720px',
          maxHeight: 'calc(100vh - 32px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Sticky header — outside scroll area */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '2px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', margin: 0, color: 'var(--color-text)' }}>
            Detail sezení
          </h2>
          <button
            onClick={onClose}
            className="btn-clay btn-clay-secondary"
            style={{ padding: '8px 14px', borderRadius: '12px' }}
          >
            Zavřít
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px 24px', flex: 1 }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {summaryItems.map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: '14px 16px',
                border: '2px solid var(--color-border-light)',
                borderRadius: '14px',
                background: 'var(--color-bg)',
              }}
            >
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{label}</p>
              <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--color-text)' }}>{value}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.05rem', margin: '0 0 12px', color: 'var(--color-text)' }}>
            Chyby v sezení
          </h3>

          {loading ? (
            <div style={{
              border: '2px solid var(--color-border-light)',
              borderRadius: '14px',
              background: 'var(--color-bg)',
              padding: '14px 16px',
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-muted)',
            }}>
              Načítám detail odpovědí...
            </div>
          ) : mistakes.length > 0 ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {mistakes.map((mistake, index) => (
                <div
                  key={mistake.id}
                  style={{
                    border: '2px solid #FECACA',
                    borderRadius: '14px',
                    background: '#FEF2F2',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: '#FEE2E2',
                      border: '2px solid #FCA5A5',
                      color: '#B91C1C',
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                    }}>
                      Chyba {index + 1}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                      Čas odpovědi: {formatResponseTime(mistake.response_time_ms)}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 12px', fontFamily: 'var(--font-body)', color: 'var(--color-text)', fontSize: '1rem' }}>
                    {mistake.template || 'Bez detailu zadání'}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#FFF1F2', border: '2px solid #FDA4AF' }}>
                      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.74rem', fontWeight: 700, color: '#9F1239' }}>
                        Odpověď dítěte
                      </p>
                      <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-heading)', fontSize: '1rem', color: '#881337' }}>
                        {mistake.given_answer || '—'}
                      </p>
                    </div>
                    <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#F0FDF4', border: '2px solid #86EFAC' }}>
                      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.74rem', fontWeight: 700, color: '#166534' }}>
                        Správné řešení
                      </p>
                      <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-heading)', fontSize: '1rem', color: '#166534' }}>
                        {mistake.correct_answer || '—'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#FFF7ED', border: '1px solid #FED7AA', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9A3412' }}>
                      Slovo: {mistake.display_word || '—'}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#EFF6FF', border: '1px solid #BFDBFE', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#1D4ED8' }}>
                      Písmeno: {mistake.letter || '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              border: '2px solid #DCFCE7',
              borderRadius: '14px',
              background: '#F0FDF4',
              padding: '14px 16px',
              fontFamily: 'var(--font-body)',
              color: '#166534',
            }}>
              V tomhle sezení nejsou zaznamenané žádné chyby.
            </div>
          )}
        </div>

        </div> {/* end scrollable body */}
      </div>
    </div>
  )
}

function ChangePinModal({ token, onClose }) {
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setStatus({ type: 'error', message: 'PIN musí mít přesně 4 číslice.' })
      return
    }
    if (newPin !== confirmPin) {
      setStatus({ type: 'error', message: 'PINy se neshodují.' })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      await api.changePin(newPin, token)
      setStatus({ type: 'success', message: 'PIN byl úspěšně změněn.' })
      setNewPin('')
      setConfirmPin('')
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Nepodařilo se změnit PIN.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="clay-card" style={{ width: '100%', maxWidth: '380px', padding: '28px 24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', margin: '0 0 20px', color: 'var(--color-text)' }}>
          Změnit PIN
        </h2>

        {status && (
          <div style={{
            padding: '10px 14px', borderRadius: '12px', marginBottom: '16px',
            background: status.type === 'error' ? '#FEE2E2' : '#ECFDF5',
            border: `2px solid ${status.type === 'error' ? 'var(--color-error)' : '#16A34A'}`,
            color: status.type === 'error' ? 'var(--color-error)' : '#166534',
            fontFamily: 'var(--font-body)', fontSize: '0.9rem',
          }}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
              Nový PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              style={{
                width: '100%', textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.3em',
                border: '3px solid #CBD5E1', borderRadius: '16px', background: 'var(--color-surface)',
                boxShadow: '0 3px 0 #CBD5E1', color: 'var(--color-text)', outline: 'none',
                padding: '12px', fontFamily: 'var(--font-heading)', fontWeight: 700,
                boxSizing: 'border-box',
              }}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
              Potvrdit PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              style={{
                width: '100%', textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.3em',
                border: '3px solid #CBD5E1', borderRadius: '16px', background: 'var(--color-surface)',
                boxShadow: '0 3px 0 #CBD5E1', color: 'var(--color-text)', outline: 'none',
                padding: '12px', fontFamily: 'var(--font-heading)', fontWeight: 700,
                boxSizing: 'border-box',
              }}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn-clay btn-clay-primary"
              style={{ flex: 1, padding: '10px', borderRadius: '14px' }}
            >
              {loading ? 'Ukládám…' : 'Uložit PIN'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-clay btn-clay-secondary"
              style={{ flex: 1, padding: '10px', borderRadius: '14px' }}
            >
              Zavřít
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ParentDashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('parent_token')
  const dashboardRef = useRef()

  const [profiles, setProfiles] = useState([])
  const [modules, setModules] = useState([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [activeView, setActiveView] = useState('global')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const [stats, setStats] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [moduleStats, setModuleStats] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false)

  const [vslovStats, setVslovStats] = useState(null)
  const [vslovTimeline, setVslovTimeline] = useState([])

  const [dailyGoal, setDailyGoal] = useState(15)
  const [savingGoal, setSavingGoal] = useState(false)

  const [profileFormOpen, setProfileFormOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [profileNotice, setProfileNotice] = useState(null)

  const [changePinOpen, setChangePinOpen] = useState(false)

  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState('')

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = profiles.findIndex((p) => p.id === active.id)
    const newIndex = profiles.findIndex((p) => p.id === over.id)
    const reordered = arrayMove(profiles, oldIndex, newIndex)
    setProfiles(reordered)

    try {
      await Promise.all(reordered.map((profile, index) =>
        api.updateProfile(profile.id, { sort_order: index }, token)
      ))
    } catch {
      // Reorder saved best-effort; reload on next visit.
    }
  }

  useEffect(() => {
    if (!token) {
      navigate('/')
      return
    }

    loadProfiles()
    loadModules()
  }, [])

  useEffect(() => {
    if (selectedProfileId) {
      loadStats()
      const profile = profiles.find((item) => String(item.id) === selectedProfileId)
      setDailyGoal(profile?.daily_goal || 15)
    }
  }, [selectedProfileId])

  const loadProfiles = async () => {
    try {
      const data = await api.getProfiles(token)
      const list = data.profiles || data || []
      setProfiles(list)
      if (list.length > 0) {
        setSelectedProfileId(String(list[0].id))
      }
    } catch {
      setError('Nepodařilo se načíst profily')
      setLoading(false)
    }
  }

  const loadModules = async () => {
    try {
      const data = await api.getModules()
      setModules(data || [])
    } catch {
      // Dashboard works even without module labels.
    }
  }

  const loadLeaderboard = async () => {
    setLeaderboardLoading(true)
    setLeaderboardError('')
    try {
      const data = await fetch(`${BASE_API_URL}/api/leaderboard`).then((r) => r.json())
      setLeaderboard(Array.isArray(data) ? data : [])
    } catch {
      setLeaderboardError('Nepodařilo se načíst žebříček.')
    } finally {
      setLeaderboardLoading(false)
    }
  }

  const loadStats = async () => {
    if (!selectedProfileId) return

    setLoading(true)
    setError('')

    try {
      const [
        statsData,
        timelineData,
        moduleData,
        vslovData,
        recentSessionsData,
        vslovSessionsData,
      ] = await Promise.allSettled([
        api.getStats(selectedProfileId),
        api.getStatsTimeline(selectedProfileId, 30),
        api.getStatsByModule(selectedProfileId),
        api.getModuleStats('vyjmenovana-slova', selectedProfileId),
        api.getRecentSessions(selectedProfileId, { limit: 12 }),
        api.getRecentSessions(selectedProfileId, { limit: 200, moduleId: 'vyjmenovana-slova' }),
      ])

      if (statsData.status === 'fulfilled') {
        setStats(statsData.value)
      }

      if (timelineData.status === 'fulfilled') {
        const rawTimeline = timelineData.value.timeline || timelineData.value || []
        setTimeline(normalizeTimeline(rawTimeline, 30))
      } else {
        setTimeline([])
      }

      if (moduleData.status === 'fulfilled') {
        const rawModules = moduleData.value.modules || moduleData.value || []
        setModuleStats(rawModules)
      } else {
        setModuleStats([])
      }

      if (vslovData.status === 'fulfilled') {
        setVslovStats(vslovData.value)
      } else {
        setVslovStats(null)
      }

      if (recentSessionsData.status === 'fulfilled') {
        setRecentSessions(recentSessionsData.value || [])
      } else {
        setRecentSessions([])
      }

      if (vslovSessionsData.status === 'fulfilled') {
        setVslovTimeline(buildSessionTimeline(vslovSessionsData.value || [], 14))
      } else {
        setVslovTimeline([])
      }
    } catch {
      setError('Nepodařilo se načíst statistiky')
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default

      const element = dashboardRef.current
      const canvas = await html2canvas(element, { scale: 1.5, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth - 20
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 10

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const profileName = profiles.find((item) => String(item.id) === selectedProfileId)?.name || 'profil'
      pdf.save(`skolnicka-${profileName}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const handleExportCSV = () => {
    const profileName = profiles.find((p) => String(p.id) === selectedProfileId)?.name || 'profil'
    const date = new Date().toISOString().slice(0, 10)
    const rows = []

    // Sekce: Přehled
    rows.push(['## Přehled'])
    rows.push(['Celkem XP', 'Streak (dny)', 'Dní procvičování', 'Celkem odpovědí', 'Správně', 'Úspěšnost (%)'])
    if (stats) {
      const acc = stats.total_answers > 0 ? ((stats.correct_answers / stats.total_answers) * 100).toFixed(1) : '0.0'
      rows.push([stats.total_xp, stats.current_streak, stats.days_practiced, stats.total_answers, stats.correct_answers, acc])
    }
    rows.push([])

    // Sekce: Časová osa (posledních 30 dní)
    rows.push(['## Časová osa (posledních 30 dní)'])
    rows.push(['Datum', 'XP', 'Odpovědí'])
    for (const day of timeline) {
      rows.push([day.date, day.xp_earned ?? 0, day.answer_count ?? 0])
    }
    rows.push([])

    // Sekce: Statistiky podle modulu
    rows.push(['## Statistiky podle modulu'])
    rows.push(['Modul', 'Sezení', 'Celkem odpovědí', 'Správně', 'XP', 'Úspěšnost (%)'])
    for (const m of moduleStats) {
      const acc = m.total_answers > 0 ? ((m.correct_answers / m.total_answers) * 100).toFixed(1) : '0.0'
      rows.push([m.module_id, m.session_count, m.total_answers, m.correct_answers, m.total_xp, acc])
    }
    rows.push([])

    // Sekce: Poslední sezení
    rows.push(['## Poslední sezení'])
    rows.push(['Datum', 'Čas', 'Modul', 'Délka (min)', 'Celkem odpovědí', 'Správně', 'Úspěšnost (%)'])
    for (const s of recentSessions) {
      const dt = new Date(s.started_at)
      const acc = s.total_answers > 0 ? ((s.correct_answers / s.total_answers) * 100).toFixed(1) : '0.0'
      rows.push([
        dt.toLocaleDateString('cs-CZ'),
        dt.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }),
        s.module_id,
        s.duration_minutes ?? 0,
        s.total_answers,
        s.correct_answers,
        acc,
      ])
    }

    const csv = rows.map((r) => r.map((v) => (String(v).includes(',') ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `skolnicka-${profileName}-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLogout = () => {
    localStorage.removeItem('parent_token')
    navigate('/')
  }

  const reloadProfiles = async () => {
    const data = await api.getProfiles(token)
    const list = data.profiles || data || []
    setProfiles(list)
    const currentExists = list.some((p) => String(p.id) === selectedProfileId)
    if (!currentExists && list.length > 0) {
      setSelectedProfileId(String(list[0].id))
    }
    return list
  }

  const handleProfileFormSave = async (message) => {
    setProfileFormOpen(false)
    setEditingProfile(null)
    await reloadProfiles()
    setProfileNotice({ type: 'success', message })
  }

  const handleDeleteProfile = async (profileId) => {
    const previous = profiles
    setDeleteConfirm(null)
    setProfiles((items) => items.filter((p) => String(p.id) !== String(profileId)))
    try {
      await api.deleteProfile(profileId, token)
      setProfileNotice({ type: 'success', message: 'Profil byl smazán.' })
    } catch (err) {
      setProfiles(previous)
      setProfileNotice({ type: 'error', message: err.message || 'Nepodařilo se smazat profil.' })
    }
  }

  const handleTogglePauseProfile = async (profile) => {
    const newPaused = !profile.is_paused
    setProfiles((items) => items.map((p) =>
      String(p.id) === String(profile.id) ? { ...p, is_paused: newPaused } : p
    ))
    try {
      await api.updateProfile(profile.id, { is_paused: newPaused }, token)
      setProfileNotice({
        type: 'success',
        message: newPaused ? 'Profil byl pozastaven.' : 'Profil byl znovu aktivován.',
      })
    } catch (err) {
      setProfiles((items) => items.map((p) =>
        String(p.id) === String(profile.id) ? { ...p, is_paused: profile.is_paused } : p
      ))
      setProfileNotice({ type: 'error', message: err.message || 'Nepodařilo se změnit stav profilu.' })
    }
  }

  const handleSaveDailyGoal = async (newGoal) => {
    setDailyGoal(newGoal)
    setSavingGoal(true)
    try {
      await api.updateProfile(selectedProfileId, { daily_goal: newGoal }, token)
      setProfiles((items) => items.map((item) => (
        String(item.id) === selectedProfileId ? { ...item, daily_goal: newGoal } : item
      )))
    } catch {
      setError('Nepodařilo se uložit denní cíl.')
    } finally {
      setSavingGoal(false)
    }
  }

  const openSessionDetail = async (session) => {
    setSelectedSession({ ...session, answers: null })
    setSessionDetailLoading(true)
    try {
      const detail = await api.getSessionDetail(selectedProfileId, session.id)
      setSelectedSession((current) => current && current.id === session.id
        ? {
            ...current,
            ...detail,
            totalAnswers: parseNumber(detail.total_answers),
            correctAnswers: parseNumber(detail.correct_answers),
            durationMinutes: parseNumber(detail.duration_minutes),
            accuracy: calculateAccuracy(parseNumber(detail.correct_answers), parseNumber(detail.total_answers)),
            answers: detail.answers || [],
          }
        : current)
    } catch {
      setSelectedSession((current) => current && current.id === session.id
        ? { ...current, answers: [] }
        : current)
    } finally {
      setSessionDetailLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '3px solid var(--color-border-light)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => navigate('/')}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '8px 12px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <ChevronLeft size={18} />
          Zpět
        </button>

        <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)', margin: 0, flex: 1 }}>
          Rodičovský přehled
        </h1>

        {profiles.length > 1 && (
          <select
            value={selectedProfileId}
            onChange={(event) => setSelectedProfileId(event.target.value)}
            style={{
              padding: '8px 12px',
              border: '2px solid #CBD5E1',
              borderRadius: '12px',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={String(profile.id)}>{profile.name}</option>
            ))}
          </select>
        )}

        <button
          onClick={handleExportPDF}
          disabled={exporting || loading}
          className="btn-clay btn-clay-primary"
          style={{ padding: '8px 16px', borderRadius: '14px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Download size={16} />
          {exporting ? 'Exportuji...' : 'Export PDF'}
        </button>

        <button
          onClick={handleExportCSV}
          disabled={loading || !stats}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '8px 16px', borderRadius: '14px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Stáhnout statistiky jako CSV"
        >
          <Download size={16} />
          Export CSV
        </button>

        <button
          onClick={() => setChangePinOpen(true)}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '8px 12px', borderRadius: '14px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}
          title="Změnit PIN"
        >
          <KeyRound size={15} />
          PIN
        </button>

        <button
          onClick={handleLogout}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '8px 16px', borderRadius: '14px', fontSize: '0.9rem' }}
        >
          Odhlásit
        </button>
      </header>

      <div style={{
        background: 'var(--color-surface)',
        borderBottom: '2px solid var(--color-border-light)',
        padding: '0 24px',
        display: 'flex',
        gap: '4px',
      }}>
        {[
          { id: 'global', label: 'Přehled', icon: TrendingUp },
          { id: 'vyjmenovana', label: 'Vyjmenovaná slova', icon: BookOpen },
          { id: 'sentences', label: 'Správa vět', icon: ListPlus },
          { id: 'profiles', label: 'Profily', icon: Users },
          { id: 'leaderboard', label: 'Žebříček', icon: Trophy },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setActiveView(id)
              if (id === 'leaderboard') loadLeaderboard()
            }}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: `3px solid ${activeView === id ? 'var(--color-primary)' : 'transparent'}`,
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)',
              fontWeight: activeView === id ? 700 : 500,
              fontSize: '0.9rem',
              color: activeView === id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 150ms ease',
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <main ref={dashboardRef} id="dashboard-content" style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '64px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--color-border-light)',
              borderTop: '3px solid var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }} />
            <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>Načítám statistiky...</p>
          </div>
        )}

        {error && (
          <div style={{
            background: '#FEE2E2',
            border: '2px solid var(--color-error)',
            borderRadius: '16px',
            padding: '12px 16px',
            color: 'var(--color-error)',
            fontFamily: 'var(--font-body)',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {!loading && activeView === 'global' && (
          <DashboardGlobal
            stats={stats}
            timeline={timeline}
            moduleStats={moduleStats}
            recentSessions={recentSessions}
            modules={modules}
            dailyGoal={dailyGoal}
            savingGoal={savingGoal}
            onSaveDailyGoal={handleSaveDailyGoal}
            onOpenSession={openSessionDetail}
          />
        )}

        {!loading && activeView === 'sentences' && (
          <SentenceManager token={token} />
        )}

        {!loading && activeView === 'vyjmenovana' && (
          <DashboardVyjmenovana
            vslovStats={vslovStats}
            vslovTimeline={vslovTimeline}
            selectedProfileId={selectedProfileId}
          />
        )}
        {activeView === 'leaderboard' && (
          <DashboardLeaderboard
            leaderboard={leaderboard}
            leaderboardLoading={leaderboardLoading}
            leaderboardError={leaderboardError}
          />
        )}

        {activeView === 'profiles' && (
          <DashboardProfiles
            profiles={profiles}
            token={token}
            dndSensors={dndSensors}
            onDragEnd={handleDragEnd}
            onEdit={(p) => { setEditingProfile(p); setProfileFormOpen(true) }}
            onTogglePause={handleTogglePauseProfile}
            onDeleteConfirm={setDeleteConfirm}
            onAddProfile={() => { setEditingProfile(null); setProfileFormOpen(true) }}
            profileNotice={profileNotice}
            onCloseNotice={() => setProfileNotice(null)}
            BASE_API_URL={BASE_API_URL}
          />
        )}
      </main>

      <SessionDetailModal session={selectedSession} loading={sessionDetailLoading} onClose={() => setSelectedSession(null)} />

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div
            className="clay-card bounce-in"
            style={{ maxWidth: '380px', width: '90%', padding: '28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-text)', margin: '0 0 10px' }}>
              Smazat profil?
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Opravdu chceš smazat profil <strong style={{ color: 'var(--color-text)' }}>{deleteConfirm.name}</strong>? Smažou se i všechna data a statistiky. Tuto akci nelze vrátit.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-clay btn-clay-secondary"
                style={{ flex: 1, padding: '10px', borderRadius: '14px' }}
                onClick={() => setDeleteConfirm(null)}
              >
                Zrušit
              </button>
              <button
                className="btn-clay btn-clay-danger"
                style={{ flex: 1, padding: '10px', borderRadius: '14px' }}
                onClick={() => handleDeleteProfile(deleteConfirm.id)}
              >
                Smazat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile form modal */}
      {profileFormOpen && (
        <ProfileForm
          initialData={editingProfile}
          token={token}
          onSave={handleProfileFormSave}
          onCancel={() => { setProfileFormOpen(false); setEditingProfile(null) }}
        />
      )}

      {/* Change PIN modal */}
      {changePinOpen && (
        <ChangePinModal token={token} onClose={() => setChangePinOpen(false)} />
      )}
    </div>
  )
}
