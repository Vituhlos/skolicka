import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, Volume2, VolumeX, ChevronLeft } from 'lucide-react'
import { api } from '../../utils/api.js'
import { playCorrect, playWrong, isSoundEnabled, toggleSound } from '../../utils/sounds.js'
import ProgressBar from '../../components/ProgressBar.jsx'

const TOTAL_ITEMS = 15

export default function MultiplyExercise({ profileId, onFinish }) {
  const [items, setItems] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionId, setSessionId] = useState(null)
  const [answered, setAnswered] = useState(null)
  const [totalXP, setTotalXP] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [soundOn, setSoundOn] = useState(isSoundEnabled())
  const [shaking, setShaking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [allNewBadges, setAllNewBadges] = useState([])
  const [xpPopups, setXpPopups] = useState([])
  const [xpPillFlash, setXpPillFlash] = useState(false)
  const [questionKey, setQuestionKey] = useState(0)
  const [tablePickerVisible, setTablePickerVisible] = useState(true)
  const [tableProgress, setTableProgress] = useState({})
  const [selectedTables, setSelectedTables] = useState(() => {
    const saved = localStorage.getItem(`nasobilka_tables_${profileId}`)
    return saved ? JSON.parse(saved) : [1, 2, 3, 4, 5]
  })
  const navigate = useNavigate()

  const currentIndexRef = useRef(0)
  const correctCountRef = useRef(0)
  const totalXPRef = useRef(0)
  const allNewBadgesRef = useRef([])
  const itemsRef = useRef([])
  const retriedIdsRef = useRef(new Set())
  const questionStartTimeRef = useRef(Date.now())

  useEffect(() => { currentIndexRef.current = currentIndex }, [currentIndex])
  useEffect(() => { correctCountRef.current = correctCount }, [correctCount])
  useEffect(() => { totalXPRef.current = totalXP }, [totalXP])
  useEffect(() => { allNewBadgesRef.current = allNewBadges }, [allNewBadges])
  useEffect(() => { itemsRef.current = items }, [items])

  useEffect(() => {
    api.getNasobilkaTableProgress(profileId)
      .then(data => {
        const map = {}
        for (const row of data) map[row.table] = row
        setTableProgress(map)
      })
      .catch(() => {})
  }, [profileId])

  const handleBack = () => navigate(`/profil/${profileId}`)
  const handleSoundToggle = () => { const enabled = toggleSound(); setSoundOn(enabled) }

  const toggleTable = (t) => {
    setSelectedTables(prev => {
      const next = prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
      if (next.length === 0) return prev
      localStorage.setItem(`nasobilka_tables_${profileId}`, JSON.stringify(next))
      return next
    })
  }

  const startSession = async () => {
    if (selectedTables.length === 0) return
    try {
      setLoading(true)
      setError('')
      setTablePickerVisible(false)
      const data = await api.startNasobilkaSession(profileId, selectedTables)
      setSessionId(data.session_id)
      const newItems = data.items || []
      setItems(newItems)
      setCurrentIndex(0)
      setAnswered(null)
      setTotalXP(0)
      setCorrectCount(0)
      setAllNewBadges([])
      retriedIdsRef.current = new Set()
      questionStartTimeRef.current = Date.now()
    } catch {
      setError('Nepodařilo se načíst cvičení. Zkus to znovu.')
      setTablePickerVisible(true)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = useCallback(async (answer) => {
    if (answered !== null || finishing) return
    const currentItem = items[currentIndex]
    if (!currentItem) return

    try {
      const response_time_ms = Date.now() - questionStartTimeRef.current
      const result = await api.submitAnswer('nasobilka', sessionId, {
        item_id: currentItem.id,
        given_answer: answer,
        profile_id: profileId,
        response_time_ms,
      })

      const isCorrect = result.is_correct
      const xpEarned = result.xp_earned || 0
      const newBadges = result.new_badges || []

      setAnswered({ isCorrect, correct_answer: result.correct_answer, xp_earned: xpEarned, given_answer: answer })

      if (isCorrect) {
        if (soundOn) playCorrect()
        setCorrectCount(c => c + 1)
      } else {
        if (soundOn) playWrong()
        setShaking(true)
        setTimeout(() => setShaking(false), 600)
        if (!retriedIdsRef.current.has(currentItem.id)) {
          retriedIdsRef.current.add(currentItem.id)
          setItems(prev => [...prev, { ...currentItem, options: generateOptionsClient(currentItem.correct_answer, currentItem.a, currentItem.b) }])
        }
      }

      setTotalXP(xp => xp + xpEarned)
      if (xpEarned > 0) {
        const popupId = Date.now()
        setXpPopups(prev => [...prev, { id: popupId, amount: xpEarned }])
        setTimeout(() => setXpPopups(prev => prev.filter(p => p.id !== popupId)), 1100)
        setXpPillFlash(true)
        setTimeout(() => setXpPillFlash(false), 600)
      }
      if (newBadges.length > 0) setAllNewBadges(prev => [...prev, ...newBadges])

      setTimeout(() => {
        const nextIndex = currentIndexRef.current + 1
        if (nextIndex >= itemsRef.current.length) {
          setFinishing(true)
          api.endSession('nasobilka', sessionId, profileId)
            .catch(() => {})
            .finally(() => {
              onFinish({
                correct: correctCountRef.current,
                total: itemsRef.current.length,
                xp_earned: totalXPRef.current,
                new_badges: allNewBadgesRef.current,
                wrong_answers: [],
              })
            })
        } else {
          setCurrentIndex(nextIndex)
          setAnswered(null)
          setQuestionKey(k => k + 1)
          questionStartTimeRef.current = Date.now()
        }
      }, isCorrect ? 1200 : 2500)
    } catch {
      setAnswered(null)
    }
  }, [answered, finishing, items, currentIndex, sessionId, profileId, soundOn])

  const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  if (tablePickerVisible) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ position: 'absolute', top: '16px', left: '16px' }}>
          <button onClick={handleBack} className="btn-clay btn-clay-secondary" style={{ padding: '8px 16px', borderRadius: '14px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ChevronLeft size={16} /> Zpět
          </button>
        </div>

        <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.7rem', color: 'var(--color-text)', marginBottom: '8px', marginTop: 0 }}>
            Které násobilky procvičíme?
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: '0.95rem' }}>
            Výběr se zapamatuje pro příště.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '28px' }}>
            {ALL_TABLES.map(t => {
              const active = selectedTables.includes(t)
              const prog = tableProgress[t]
              const accuracy = prog && prog.total_seen > 0
                ? Math.round((prog.total_correct / prog.total_seen) * 100)
                : null
              return (
                <button
                  key={t}
                  onClick={() => toggleTable(t)}
                  className={active ? 'btn-clay btn-clay-cta' : 'btn-clay btn-clay-secondary'}
                  style={{ height: '80px', fontSize: '1.4rem', borderRadius: '20px', flexDirection: 'column', gap: '4px', padding: '8px' }}
                >
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>{t}×</span>
                  {accuracy !== null && (
                    <span style={{
                      fontSize: '0.7rem',
                      color: active ? 'rgba(255,255,255,0.9)' : (accuracy >= 80 ? 'var(--color-success)' : accuracy >= 50 ? '#F59E0B' : 'var(--color-error)'),
                      fontFamily: 'var(--font-body)',
                    }}>
                      {accuracy}%
                    </span>
                  )}
                  {accuracy === null && (
                    <span style={{ fontSize: '0.7rem', color: active ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                      nové
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Vybráno: <strong>{[...selectedTables].sort((a, b) => a - b).join('×, ')}×</strong>
          </p>

          {error && (
            <div style={{ background: '#FEE2E2', border: '2px solid var(--color-error)', borderRadius: '14px', padding: '10px 16px', marginBottom: '16px', fontFamily: 'var(--font-body)', color: 'var(--color-error)', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <button
            onClick={startSession}
            disabled={loading || selectedTables.length === 0}
            className="btn-clay btn-clay-primary"
            style={{ width: '100%', padding: '16px', fontSize: '1.1rem', borderRadius: '20px' }}
          >
            {loading ? 'Načítám…' : 'Začít cvičení →'}
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px',
            border: '4px solid #E2E8F0',
            borderTop: '4px solid var(--color-cta)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>Načítám cvičení...</p>
        </div>
      </div>
    )
  }

  const currentItem = items[currentIndex]
  if (!currentItem) return null

  const progress = currentIndex + (answered ? 1 : 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '3px solid #E2E8F0',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <button
          onClick={() => setTablePickerVisible(true)}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '6px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
        >
          <ChevronLeft size={16} />
        </button>

        <div style={{ flex: 1 }}>
          <ProgressBar
            current={progress}
            total={items.length}
            color="var(--color-cta)"
            height={10}
          />
        </div>

        <span style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '0.82rem',
          color: 'var(--color-text-muted)',
          whiteSpace: 'nowrap',
        }}>
          {progress}/{items.length}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="pulse-flame">
            <Flame size={18} color="#F97316" fill="#F97316" />
          </span>
        </div>

        <div className={`xp-pill${xpPillFlash ? ' xp-pill-flash' : ''}`} style={{ fontSize: '0.78rem', padding: '2px 8px' }}>
          +{totalXP} XP
        </div>

        <button
          onClick={handleSoundToggle}
          className="btn-clay btn-clay-secondary"
          style={{ padding: '6px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={soundOn ? 'Vypnout zvuk' : 'Zapnout zvuk'}
        >
          {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </header>

      {/* Exercise area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        maxWidth: '600px',
        margin: '0 auto',
        width: '100%',
      }}>
        {/* Module label */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#F3F0FF',
          border: '2px solid #8B5CF6',
          borderRadius: '12px',
          padding: '4px 12px',
          marginBottom: '28px',
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '0.85rem',
          color: '#8B5CF6',
          boxShadow: '0 2px 0 #6D28D9',
        }}>
          Násobilka
        </div>

        {/* Question card */}
        <div
          key={questionKey}
          className={`clay-card question-enter ${answered ? (answered.isCorrect ? 'answer-correct' : 'answer-wrong') : ''} ${shaking ? 'shake' : ''}`}
          style={{
            width: '100%',
            padding: 'clamp(24px, 5vw, 40px) clamp(16px, 5vw, 28px)',
            marginBottom: '24px',
            textAlign: 'center',
            minHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 200ms ease, border-color 200ms ease',
            borderColor: answered
              ? answered.isCorrect ? 'var(--color-success)' : 'var(--color-error)'
              : '#E2E8F0',
            boxShadow: answered
              ? answered.isCorrect
                ? '0 4px 0 var(--color-success-dark), 0 8px 24px rgba(22,163,74,0.15)'
                : '0 4px 0 var(--color-error-dark), 0 8px 24px rgba(220,38,38,0.15)'
              : '0 4px 0 #E2E8F0, 0 8px 24px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 'clamp(2.5rem, 8vw, 4rem)',
            color: 'var(--color-text)',
            letterSpacing: '0.05em',
          }}>
            {currentItem.a} × {currentItem.b} = ?
          </div>
        </div>

        {/* XP float popups */}
        <div style={{ position: 'relative', height: 0, width: '100%' }}>
          {xpPopups.map(popup => (
            <div key={popup.id} className="xp-float-popup">
              +{popup.amount} XP
            </div>
          ))}
        </div>

        {/* Feedback */}
        {answered && (
          <div
            className="fade-in"
            style={{
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {answered.isCorrect ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)' }}>
                <div
                  className="checkmark-appear"
                  style={{
                    width: '36px', height: '36px',
                    background: 'var(--color-success)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10l4.5 4.5L16 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem' }}>
                  Správně! +{answered.xp_earned} XP
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-error)' }}>
                  <div style={{
                    width: '36px', height: '36px',
                    background: 'var(--color-error)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M6 6l8 8M14 6l-8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem' }}>
                    Špatně
                  </span>
                </div>
                <div style={{
                  background: '#DCFCE7',
                  border: '2px solid var(--color-success)',
                  borderRadius: '14px',
                  padding: '10px 24px',
                  boxShadow: '0 3px 0 var(--color-success-dark)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-success-dark)', marginBottom: '2px' }}>Správně je:</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.8rem', color: 'var(--color-success)' }}>
                    {currentItem.a} × {currentItem.b} = {answered.correct_answer}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Answer buttons */}
        {!answered && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', maxWidth: '400px' }}>
            {currentItem.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(opt)}
                disabled={finishing}
                className={i % 2 === 0 ? 'btn-answer-i' : 'btn-answer-y'}
                style={{ fontSize: '1.6rem', minHeight: '80px', borderRadius: '20px', fontFamily: 'var(--font-heading)', fontWeight: 800 }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Answered state — show all options with highlights */}
        {answered && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', maxWidth: '400px' }}>
            {currentItem.options.map((opt, i) => {
              const isCorrectOpt = opt === answered.correct_answer
              const isWrongPicked = opt === answered.given_answer && !answered.isCorrect
              let style = {
                fontSize: '1.6rem', minHeight: '80px', borderRadius: '20px',
                fontFamily: 'var(--font-heading)', fontWeight: 800,
                opacity: (!isCorrectOpt && !isWrongPicked) ? 0.4 : 1,
              }
              if (isCorrectOpt) {
                return (
                  <button key={i} disabled className="btn-clay" style={{ ...style, background: '#DCFCE7', border: '3px solid var(--color-success)', color: 'var(--color-success)', boxShadow: '0 4px 0 var(--color-success-dark)' }}>
                    {opt}
                  </button>
                )
              }
              if (isWrongPicked) {
                return (
                  <button key={i} disabled className="btn-clay" style={{ ...style, background: '#FEE2E2', border: '3px solid var(--color-error)', color: 'var(--color-error)', boxShadow: '0 4px 0 var(--color-error-dark)' }}>
                    {opt}
                  </button>
                )
              }
              return (
                <button key={i} disabled className="btn-clay btn-clay-secondary" style={style}>
                  {opt}
                </button>
              )
            })}
          </div>
        )}

        {/* New badge notification */}
        {answered && answered.new_badges && answered.new_badges.length > 0 && (
          <div className="bounce-in" style={{
            marginTop: '16px',
            background: '#FFF7ED',
            border: '2px solid var(--color-cta)',
            borderRadius: '16px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 3px 0 var(--color-cta-dark)',
          }}>
            <span style={{ fontSize: '1.2rem' }}>🏅</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-cta)' }}>
              Nový odznak!
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function generateOptionsClient(correct, a, b) {
  const wrong = new Set()
  const candidates = []
  for (let d = 1; d <= 10; d++) {
    if (correct - d > 0) candidates.push(correct - d)
    candidates.push(correct + d)
  }
  for (let x = 1; x <= 10; x++) {
    if (a * x !== correct) candidates.push(a * x)
    if (b * x !== correct) candidates.push(b * x)
  }
  candidates.sort(() => Math.random() - 0.5)
  for (const c of candidates) {
    if (c !== correct && c > 0 && !wrong.has(c)) {
      wrong.add(c)
      if (wrong.size === 3) break
    }
  }
  return [correct, ...wrong].sort(() => Math.random() - 0.5)
}
