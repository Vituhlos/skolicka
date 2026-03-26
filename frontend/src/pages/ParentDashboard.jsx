import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Download, Users, BookOpen, TrendingUp, Calendar, Target, Zap, Flame,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { api } from '../utils/api.js'

function StatCard({ label, value, icon: Icon, color = '#2563EB', colorBg = '#EFF6FF' }) {
  return (
    <div
      className="clay-card"
      style={{
        padding: '20px',
        borderColor: color,
        boxShadow: `0 4px 0 ${color}88, 0 8px 20px rgba(0,0,0,0.06)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '44px', height: '44px',
          background: colorBg,
          border: `2px solid ${color}`,
          borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={22} color={color} />
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0 0 2px' }}>
            {label}
          </p>
          <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--color-text)', margin: 0 }}>
            {value ?? '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

function getBarColor(accuracy) {
  if (accuracy >= 80) return '#16A34A'
  if (accuracy >= 60) return '#D97706'
  return '#DC2626'
}

const LETTER_LABELS = { b: 'B', l: 'L', m: 'M', p: 'P', s: 'S', v: 'V', z: 'Z' }

export default function ParentDashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('parent_token')
  const dashboardRef = useRef()

  const [profiles, setProfiles] = useState([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [activeView, setActiveView] = useState('global') // 'global' | 'vyjmenovana'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  // Global stats
  const [stats, setStats] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [moduleStats, setModuleStats] = useState([])

  // Vyjmenovana slova stats
  const [vslovStats, setVslovStats] = useState(null)
  const [vslovTimeline, setVslovTimeline] = useState([])

  useEffect(() => {
    if (!token) {
      navigate('/')
      return
    }
    loadProfiles()
  }, [])

  useEffect(() => {
    if (selectedProfileId) {
      loadStats()
    }
  }, [selectedProfileId])

  const loadProfiles = async () => {
    try {
      const data = await api.getProfiles()
      const list = data.profiles || data || []
      setProfiles(list)
      if (list.length > 0) {
        setSelectedProfileId(String(list[0].id))
      }
    } catch (err) {
      setError('Nepodařilo se načíst profily')
      setLoading(false)
    }
  }

  const loadStats = async () => {
    if (!selectedProfileId) return
    setLoading(true)
    setError('')
    try {
      const [statsData, timelineData, moduleData, vslovData, vslovTL] = await Promise.allSettled([
        api.getStats(selectedProfileId),
        api.getStatsTimeline(selectedProfileId, 30),
        api.getStatsByModule(selectedProfileId),
        api.getModuleStats('vyjmenovana-slova', selectedProfileId),
        api.getStatsTimeline(selectedProfileId, 14),
      ])

      if (statsData.status === 'fulfilled') setStats(statsData.value)
      if (timelineData.status === 'fulfilled') {
        const raw = timelineData.value.timeline || timelineData.value || []
        setTimeline(raw.map((d) => ({
          date: new Date(d.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }),
          xp: d.xp_earned || d.xp || 0,
          answers: d.total_answers || d.answers || 0,
        })))
      }
      if (moduleData.status === 'fulfilled') {
        const raw = moduleData.value.modules || moduleData.value || []
        setModuleStats(raw)
      }
      if (vslovData.status === 'fulfilled') setVslovStats(vslovData.value)
      if (vslovTL.status === 'fulfilled') {
        const raw = vslovTL.value.timeline || vslovTL.value || []
        setVslovTimeline(raw.map((d) => ({
          date: new Date(d.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }),
          answers: d.total_answers || d.answers || 0,
        })))
      }
    } catch (err) {
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

      const profileName = profiles.find(p => String(p.id) === selectedProfileId)?.name || 'profil'
      pdf.save(`skolnicka-${profileName}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('parent_token')
    navigate('/')
  }

  // Letter accuracy data for vyjmenovana slova
  const letterData = vslovStats?.by_letter
    ? Object.entries(vslovStats.by_letter).map(([letter, data]) => ({
        letter: LETTER_LABELS[letter] || letter.toUpperCase(),
        accuracy: Math.round((data.correct / (data.total || 1)) * 100),
        total: data.total || 0,
        correct: data.correct || 0,
      }))
    : []

  const problematicWords = vslovStats?.problematic_words
    ? [...vslovStats.problematic_words]
        .sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0))
        .slice(0, 20)
    : []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '3px solid #E2E8F0',
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

        {/* Profile selector */}
        {profiles.length > 1 && (
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
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
            {profiles.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
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
          onClick={handleLogout}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '8px 16px', borderRadius: '14px', fontSize: '0.9rem' }}
        >
          Odhlásit
        </button>
      </header>

      {/* View tabs */}
      <div style={{
        background: 'var(--color-surface)',
        borderBottom: '2px solid #E2E8F0',
        padding: '0 24px',
        display: 'flex',
        gap: '4px',
      }}>
        {[
          { id: 'global', label: 'Přehled', icon: TrendingUp },
          { id: 'vyjmenovana', label: 'Vyjmenovaná slova', icon: BookOpen },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
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

      {/* Main content */}
      <main ref={dashboardRef} id="dashboard-content" style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '64px' }}>
            <div style={{
              width: '40px', height: '40px',
              border: '3px solid #E2E8F0',
              borderTop: '3px solid var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>Načítám statistiky...</p>
          </div>
        )}

        {error && (
          <div style={{
            background: '#FEE2E2', border: '2px solid var(--color-error)',
            borderRadius: '16px', padding: '12px 16px', color: 'var(--color-error)',
            fontFamily: 'var(--font-body)', marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {!loading && activeView === 'global' && (
          <>
            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              <StatCard label="Celkem XP" value={stats?.total_xp || 0} icon={Zap} color="#F97316" colorBg="#FFF7ED" />
              <StatCard label="Aktuální streak" value={`${stats?.current_streak || 0} dní`} icon={Flame} color="#EF4444" colorBg="#FEF2F2" />
              <StatCard label="Dny cvičení" value={stats?.practice_days || stats?.total_days || 0} icon={Calendar} color="#7C3AED" colorBg="#F5F3FF" />
              <StatCard label="Celkem odpovědí" value={stats?.total_answers || 0} icon={Target} color="#2563EB" colorBg="#EFF6FF" />
            </div>

            {/* XP timeline chart */}
            {timeline.length > 0 && (
              <div className="clay-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '16px', marginTop: 0 }}>
                  XP za posledních 30 dní
                </h2>
                <div className="chart-container" style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={{ fontFamily: 'var(--font-body)', fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontFamily: 'var(--font-body)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ fontFamily: 'var(--font-body)', borderRadius: '10px', border: '2px solid #CBD5E1' }}
                        labelStyle={{ fontWeight: 700 }}
                        formatter={(v) => [`${v} XP`, 'XP']}
                      />
                      <Line
                        type="monotone"
                        dataKey="xp"
                        stroke="var(--color-cta)"
                        strokeWidth={3}
                        dot={{ fill: 'var(--color-cta)', r: 4, strokeWidth: 2, stroke: 'white' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Module activity bar chart */}
            {moduleStats.length > 0 && (
              <div className="clay-card" style={{ padding: '24px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '16px', marginTop: 0 }}>
                  Aktivita podle modulů
                </h2>
                <div className="chart-container" style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={moduleStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="module_name" tick={{ fontFamily: 'var(--font-body)', fontSize: 11 }} />
                      <YAxis tick={{ fontFamily: 'var(--font-body)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ fontFamily: 'var(--font-body)', borderRadius: '10px', border: '2px solid #CBD5E1' }}
                        formatter={(v) => [`${v} odpovědí`, 'Odpovědi']}
                      />
                      <Bar dataKey="total_answers" radius={[6, 6, 0, 0]} fill="var(--color-primary)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {timeline.length === 0 && moduleStats.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                Zatím žádná data k zobrazení.
              </div>
            )}
          </>
        )}

        {!loading && activeView === 'vyjmenovana' && (
          <>
            {/* Letter accuracy chart */}
            {letterData.length > 0 ? (
              <div className="clay-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '16px', marginTop: 0 }}>
                  Přesnost podle písmen
                </h2>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', fontFamily: 'var(--font-body)', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, background: '#DC2626', borderRadius: 2 }} />
                    Méně než 60%
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, background: '#D97706', borderRadius: 2 }} />
                    60–79%
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, background: '#16A34A', borderRadius: 2 }} />
                    80% a více
                  </span>
                </div>
                <div className="chart-container" style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={letterData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="letter" tick={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700 }} />
                      <YAxis domain={[0, 100]} tick={{ fontFamily: 'var(--font-body)', fontSize: 11 }} unit="%" />
                      <Tooltip
                        contentStyle={{ fontFamily: 'var(--font-body)', borderRadius: '10px', border: '2px solid #CBD5E1' }}
                        formatter={(v, name, props) => [
                          `${v}% (${props.payload.correct}/${props.payload.total})`,
                          'Přesnost',
                        ]}
                      />
                      <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                        {letterData.map((entry, index) => (
                          <Cell key={index} fill={getBarColor(entry.accuracy)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
                Žádná data pro vyjmenovaná slova.
              </div>
            )}

            {/* 14-day activity chart */}
            {vslovTimeline.length > 0 && (
              <div className="clay-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '16px', marginTop: 0 }}>
                  Aktivita za posledních 14 dní
                </h2>
                <div className="chart-container" style={{ height: '180px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vslovTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={{ fontFamily: 'var(--font-body)', fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontFamily: 'var(--font-body)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ fontFamily: 'var(--font-body)', borderRadius: '10px', border: '2px solid #CBD5E1' }}
                        formatter={(v) => [`${v} odpovědí`, 'Odpovědi']}
                      />
                      <Line
                        type="monotone"
                        dataKey="answers"
                        stroke="var(--color-cta)"
                        strokeWidth={3}
                        dot={{ fill: 'var(--color-cta)', r: 4, strokeWidth: 2, stroke: 'white' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Stats overview */}
            {vslovStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <StatCard
                  label="Celkem odpovědí"
                  value={vslovStats.total_answers || 0}
                  icon={Target}
                  color="#F97316"
                  colorBg="#FFF7ED"
                />
                <StatCard
                  label="Celková přesnost"
                  value={vslovStats.total_answers > 0
                    ? `${Math.round(((vslovStats.correct_answers || 0) / vslovStats.total_answers) * 100)}%`
                    : '—'}
                  icon={TrendingUp}
                  color="#16A34A"
                  colorBg="#F0FDF4"
                />
                <StatCard
                  label="Čas cvičení"
                  value={vslovStats.total_time_minutes
                    ? `${vslovStats.total_time_minutes} min`
                    : '—'}
                  icon={Calendar}
                  color="#7C3AED"
                  colorBg="#F5F3FF"
                />
              </div>
            )}

            {/* Problematic words table */}
            {problematicWords.length > 0 && (
              <div className="clay-card" style={{ padding: '24px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '16px', marginTop: 0 }}>
                  Nejproblematičtější slova (top 20)
                </h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                    <thead>
                      <tr>
                        {['Slovo', 'Zobrazeno', 'Správně', 'Přesnost'].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: 'left',
                              padding: '8px 12px',
                              fontFamily: 'var(--font-heading)',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              color: 'var(--color-text-muted)',
                              borderBottom: '2px solid #E2E8F0',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {problematicWords.map((word, idx) => {
                        const accuracy = word.total > 0 ? Math.round((word.correct / word.total) * 100) : 0
                        return (
                          <tr
                            key={idx}
                            style={{ background: idx % 2 === 0 ? '#F8FAFC' : 'white' }}
                          >
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', borderRadius: idx % 2 === 0 ? '8px 0 0 8px' : '' }}>
                              {word.word}
                            </td>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                              {word.total}
                            </td>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                              {word.correct}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <span style={{
                                fontFamily: 'var(--font-heading)',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                color: getBarColor(accuracy),
                                background: `${getBarColor(accuracy)}20`,
                                padding: '2px 10px',
                                borderRadius: '8px',
                              }}>
                                {accuracy}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
