import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, Volume2, VolumeX, ChevronLeft } from 'lucide-react'
import { api } from '../../utils/api.js'
import { playCorrect, playWrong, isSoundEnabled, toggleSound } from '../../utils/sounds.js'
import ProgressBar from '../../components/ProgressBar.jsx'

const TOTAL_ITEMS = 15

function makeWrongVariant(displayWord, correctAnswer) {
  if (!displayWord) return displayWord
  if (correctAnswer === 'y') return displayWord.replace('ý', 'í').replace('y', 'i')
  return displayWord.replace('í', 'ý').replace('i', 'y')
}

const VYJMENOVANA_SLOVA = {
  B: ['být', 'bydlit', 'obyvatel', 'příbytek', 'nábytek', 'dobytek', 'bystrý', 'bylina', 'kobyla', 'zbýt', 'zbylý'],
  L: ['lysý', 'lýko', 'lyže', 'lyn', 'lýra', 'lyrika', 'lýtko', 'plynout', 'vzlykat', 'mlýn', 'blýskat'],
  M: ['my', 'mýt', 'mýlit', 'mýval', 'myslit', 'myš', 'mýto', 'hmyz', 'nezmýlit', 'umýt', 'zamýšlet'],
  P: ['pykat', 'pysk', 'pýcha', 'pyl', 'pýr', 'pytel', 'netopýr', 'slepýš', 'kopyto', 'krupýř', 'spytovat'],
  S: ['syn', 'sýr', 'syrový', 'sychravý', 'sýkora', 'sýček', 'sysel', 'sypat', 'sytý', 'nasytit', 'usychat'],
  V: ['vy', 'výt', 'výr', 'výše', 'vydat', 'zvyk', 'žvýkat', 'výskat', 'vývoj', 'výběr', 'výklad'],
  Z: ['jazyk', 'nazývat', 'brzy', 'různý', 'zvykat', 'zýval', 'zývat'],
}

function renderSentenceWithBlank(template) {
  if (!template) return null
  const parts = template.split('___')
  if (parts.length === 1) return <span>{template}</span>
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          <span>{part}</span>
          {i < parts.length - 1 && (
            <span className="blank-space" />
          )}
        </React.Fragment>
      ))}
    </>
  )
}

function renderSentenceWithAnswer(template, givenAnswer, isCorrect) {
  if (!template) return null
  const parts = template.split('___')
  if (parts.length === 1) return <span>{template}</span>

  const highlightedLetter = (
    <span className={isCorrect ? 'correct-letter' : 'wrong-letter'}>
      {givenAnswer}
    </span>
  )

  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          <span>{part}</span>
          {i < parts.length - 1 && highlightedLetter}
        </React.Fragment>
      ))}
    </>
  )
}

export default function FillInExercise({ profileId, onFinish, boss = false }) {
  const [items, setItems] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionId, setSessionId] = useState(null)
  const [answered, setAnswered] = useState(null) // null | { isCorrect, correct_answer, display_word, xp_earned, new_badges }
  const [totalXP, setTotalXP] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [soundOn, setSoundOn] = useState(isSoundEnabled())
  const [shaking, setShaking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [allNewBadges, setAllNewBadges] = useState([])
  const [wrongAnswers, setWrongAnswers] = useState([])
  const [wrongStreak, setWrongStreak] = useState(0) // počet chyb na aktuální otázce
  const [xpPopups, setXpPopups] = useState([])
  const [xpPillFlash, setXpPillFlash] = useState(false)
  const [questionKey, setQuestionKey] = useState(0)
  const [selectedLetters, setSelectedLetters] = useState(() => {
    const saved = localStorage.getItem(`vslov_letters_${profileId}`)
    return saved ? JSON.parse(saved) : ['B', 'L', 'M', 'P', 'S', 'V', 'Z']
  })
  const [letterPickerVisible, setLetterPickerVisible] = useState(!boss)
  const [letterProgress, setLetterProgress] = useState({})
  const [questionTypes, setQuestionTypes] = useState([])
  const [correctOnLeft, setCorrectOnLeft] = useState(true)
  const navigate = useNavigate()

  // Boss mode: auto-start with all letters on mount
  useEffect(() => {
    if (boss) startSession(['B', 'L', 'M', 'P', 'S', 'V', 'Z'])
  }, [])

  // Načíst progres per písmeno pro letter picker
  useEffect(() => {
    if (!boss) {
      api.getLetterProgress(profileId)
        .then((data) => {
          const map = {}
          for (const row of data) map[row.letter] = row
          setLetterProgress(map)
        })
        .catch(() => {})
    }
  }, [])

  const currentIndexRef = useRef(0)
  const correctCountRef = useRef(0)
  const totalXPRef = useRef(0)
  const allNewBadgesRef = useRef([])
  const wrongAnswersRef = useRef([])
  const retriedIdsRef = useRef(new Set())
  const itemsRef = useRef([])
  const questionStartTimeRef = useRef(Date.now())

  // Randomizovat pozici správné odpovědi při každé nové otázce
  useEffect(() => { setCorrectOnLeft(Math.random() < 0.5) }, [currentIndex])

  // Keep refs in sync with state
  useEffect(() => { currentIndexRef.current = currentIndex }, [currentIndex])
  useEffect(() => { correctCountRef.current = correctCount }, [correctCount])
  useEffect(() => { totalXPRef.current = totalXP }, [totalXP])
  useEffect(() => { allNewBadgesRef.current = allNewBadges }, [allNewBadges])
  useEffect(() => { wrongAnswersRef.current = wrongAnswers }, [wrongAnswers])
  useEffect(() => { itemsRef.current = items }, [items])

  const startSession = async (letters) => {
    try {
      setLoading(true)
      setError('')
      setLetterPickerVisible(false)
      const data = await api.startSession('vyjmenovana-slova', profileId, letters)
      setSessionId(data.session_id)
      const newItems = data.items || []
      setItems(newItems)
      setQuestionTypes(newItems.map(() => Math.random() < 0.5 ? 'word-choice' : 'fill-in'))
      setCurrentIndex(0)
      setAnswered(null)
      setTotalXP(0)
      setCorrectCount(0)
      setAllNewBadges([])
      setWrongAnswers([])
      setWrongStreak(0)
      retriedIdsRef.current = new Set()
      questionStartTimeRef.current = Date.now()
    } catch (err) {
      setError('Nepodařilo se načíst cvičení. Zkus to znovu.')
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
      const result = await api.submitAnswer('vyjmenovana-slova', sessionId, {
        item_id: currentItem.id,
        given_answer: answer,
        profile_id: profileId,
        response_time_ms,
      })

      const isCorrect = result.is_correct ?? result.correct ?? false
      const xpEarned = result.xp_earned || 0
      const newBadges = result.new_badges || []

      setAnswered({
        isCorrect,
        given_answer: answer,
        correct_answer: result.correct_answer,
        display_word: result.display_word,
        xp_earned: xpEarned,
        new_badges: newBadges,
      })

      if (isCorrect) {
        if (soundOn) playCorrect()
        setCorrectCount((c) => c + 1)
      } else {
        if (soundOn) playWrong()
        setShaking(true)
        setTimeout(() => setShaking(false), 600)
        setWrongStreak((n) => n + 1)
        if (!retriedIdsRef.current.has(currentItem.id)) {
          retriedIdsRef.current.add(currentItem.id)
          setItems((prev) => [...prev, currentItem])
        }
        setWrongAnswers((prev) => [...prev, {
          template: currentItem.template,
          correct_answer: result.correct_answer,
          display_word: result.display_word,
        }])
      }

      setTotalXP((xp) => xp + xpEarned)
      if (xpEarned > 0) {
        const popupId = Date.now()
        setXpPopups((prev) => [...prev, { id: popupId, amount: xpEarned }])
        setTimeout(() => setXpPopups((prev) => prev.filter((p) => p.id !== popupId)), 1100)
        setXpPillFlash(true)
        setTimeout(() => setXpPillFlash(false), 600)
      }
      if (newBadges.length > 0) {
        setAllNewBadges((prev) => [...prev, ...newBadges])
      }

      // Správná: 1.2s, chybná: 2.5s
      setTimeout(() => {
        const nextIndex = currentIndexRef.current + 1
        if (nextIndex >= itemsRef.current.length) {
          setFinishing(true)
          api.endSession('vyjmenovana-slova', sessionId, profileId)
            .catch(() => {})
            .finally(() => {
              onFinish({
                correct: correctCountRef.current,
                total: itemsRef.current.length,
                xp_earned: totalXPRef.current,
                new_badges: allNewBadgesRef.current,
                wrong_answers: wrongAnswersRef.current,
                session_id: sessionId,
              })
            })
        } else {
          setCurrentIndex(nextIndex)
          setAnswered(null)
          setWrongStreak(0)
          setQuestionKey((k) => k + 1)
          questionStartTimeRef.current = Date.now()
        }
      }, isCorrect ? 1200 : 2500)
    } catch (err) {
      setError('Chyba při odesílání odpovědi')
    }
  }, [answered, finishing, items, currentIndex, sessionId, profileId, soundOn, wrongAnswers, wrongStreak])

  // Keyboard support (y / i keys) — musí být AŽ PO handleAnswer
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'y' || e.key === 'Y') handleAnswer('y')
      if (e.key === 'i' || e.key === 'I') handleAnswer('i')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleAnswer])

  const handleSoundToggle = () => {
    const enabled = toggleSound()
    setSoundOn(enabled)
  }

  const handleBack = () => {
    navigate(`/profil/${profileId}`)
  }

  const ALL_LETTERS = ['B', 'L', 'M', 'P', 'S', 'V', 'Z']

  const toggleLetter = (letter) => {
    setSelectedLetters(prev => {
      const next = prev.includes(letter) ? prev.filter(l => l !== letter) : [...prev, letter]
      if (next.length === 0) return prev // aspoň jedno musí být vybráno
      localStorage.setItem(`vslov_letters_${profileId}`, JSON.stringify(next))
      return next
    })
  }

  const handleStartWithLetters = () => {
    startSession(selectedLetters)
  }

  if (letterPickerVisible) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ position: 'absolute', top: '16px', left: '16px' }}>
          <button onClick={handleBack} className="btn-clay btn-clay-secondary" style={{ padding: '8px 16px', borderRadius: '14px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ChevronLeft size={16} /> Zpět
          </button>
        </div>

        <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.7rem', color: 'var(--color-text)', marginBottom: '8px', marginTop: 0 }}>
            Která písmena procvičíme?
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: '0.95rem' }}>
            Výběr se zapamatuje pro příště.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
            {ALL_LETTERS.map(letter => {
              const active = selectedLetters.includes(letter)
              const prog = letterProgress[letter]
              const pct = prog?.total > 0 ? Math.round((prog.seen / prog.total) * 100) : 0
              return (
                <button
                  key={letter}
                  onClick={() => toggleLetter(letter)}
                  className={active ? 'btn-clay btn-clay-cta' : 'btn-clay btn-clay-secondary'}
                  style={{ height: '80px', fontSize: '1.8rem', borderRadius: '20px', flexDirection: 'column', gap: '2px', padding: '8px' }}
                >
                  {letter}
                  {prog && (
                    <div style={{ width: '100%', height: '4px', background: active ? 'rgba(255,255,255,0.3)' : 'var(--color-border-light)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: active ? 'white' : 'var(--color-primary)', borderRadius: '2px', transition: 'width 400ms ease' }} />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Vybráno: <strong>{[...selectedLetters].sort().join(', ')}</strong>
          </p>

          <button
            onClick={handleStartWithLetters}
            disabled={selectedLetters.length === 0}
            className="btn-clay btn-clay-primary"
            style={{ width: '100%', padding: '16px', fontSize: '1.1rem', borderRadius: '20px' }}
          >
            Začít cvičení →
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

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <div style={{
            background: '#FEE2E2', border: '2px solid var(--color-error)',
            borderRadius: '20px', padding: '24px', marginBottom: '16px',
            fontFamily: 'var(--font-body)', color: 'var(--color-error)',
          }}>
            {error}
          </div>
          <button onClick={startSession} className="btn-clay btn-clay-cta" style={{ padding: '12px 32px', borderRadius: '16px' }}>
            Zkusit znovu
          </button>
        </div>
      </div>
    )
  }

  const currentItem = items[currentIndex]
  if (!currentItem) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--color-text)', marginBottom: '8px' }}>
        Výborně! Zatím není co procvičovat.
      </h2>
      <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
        Všechna slova máš dobře zažitá. Vrať se za chvíli.
      </p>
      <button onClick={handleBack} className="btn-clay btn-clay-primary" style={{ padding: '12px 28px', borderRadius: '16px', fontSize: '1rem' }}>
        Zpět
      </button>
    </div>
  )

  const progress = currentIndex + (answered ? 1 : 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '3px solid #E2E8F0',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <button
          onClick={handleBack}
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
          fontSize: '0.9rem',
          color: 'var(--color-text-muted)',
          minWidth: '40px',
          textAlign: 'right',
        }}>
          {progress}/{items.length}
        </span>

        {/* Streak flame */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="pulse-flame">
            <Flame size={18} color="#F97316" fill="#F97316" />
          </span>
        </div>

        {/* XP display */}
        <div className={`xp-pill${xpPillFlash ? ' xp-pill-flash' : ''}`} style={{ fontSize: '0.85rem', padding: '2px 10px' }}>
          +{totalXP} XP
        </div>

        {/* Sound toggle */}
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
        padding: '24px 20px',
        maxWidth: '600px',
        margin: '0 auto',
        width: '100%',
      }}>
        {/* Module label */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#FFF7ED',
          border: '2px solid var(--color-cta)',
          borderRadius: '12px',
          padding: '4px 12px',
          marginBottom: '28px',
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '0.85rem',
          color: 'var(--color-cta)',
          boxShadow: '0 2px 0 var(--color-cta-dark)',
        }}>
          Vyjmenovaná slova
        </div>

        {/* Sentence card */}
        <div
          key={questionKey}
          className={`clay-card question-enter ${answered ? (answered.isCorrect ? 'answer-correct' : 'answer-wrong') : ''} ${shaking ? 'shake' : ''}`}
          style={{
            width: '100%',
            padding: '32px 28px',
            marginBottom: '32px',
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
          <div className="sentence-display">
            {answered
              ? renderSentenceWithAnswer(
                  currentItem.template,
                  answered.given_answer,
                  answered.isCorrect
                )
              : renderSentenceWithBlank(currentItem.template)
            }
          </div>
        </div>

        {/* XP float popups */}
        <div style={{ position: 'relative', height: 0, width: '100%' }}>
          {xpPopups.map((popup) => (
            <div key={popup.id} className="xp-float-popup">
              +{popup.amount} XP
            </div>
          ))}
        </div>

        {/* Feedback overlay */}
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'var(--color-error)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                {answered.display_word && (
                  <div style={{
                    marginTop: '10px',
                    background: '#DCFCE7',
                    border: '2px solid var(--color-success)',
                    borderRadius: '14px',
                    padding: '10px 20px',
                    boxShadow: '0 3px 0 var(--color-success-dark)',
                  }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-success-dark)', marginBottom: '2px' }}>Správně je:</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--color-success)' }}>
                      {answered.display_word}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Nápověda po druhé chybě */}
        {wrongStreak >= 2 && !answered && currentItem?.letter && (
          <div className="fade-in" style={{
            marginBottom: '16px',
            background: '#EFF6FF',
            border: '2px solid #93C5FD',
            borderRadius: '14px',
            padding: '12px 16px',
            boxShadow: '0 2px 0 #93C5FD',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>💡</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#1D4ED8' }}>
                Vyjmenovaná slova po <strong>{currentItem.letter.toUpperCase()}</strong>:
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(VYJMENOVANA_SLOVA[currentItem.letter.toUpperCase()] || []).map((slovo) => (
                <span key={slovo} style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  background: slovo === currentItem.word ? '#DBEAFE' : 'white',
                  border: `2px solid ${slovo === currentItem.word ? '#2563EB' : '#BFDBFE'}`,
                  borderRadius: '8px',
                  padding: '2px 8px',
                  color: slovo === currentItem.word ? '#1D4ED8' : '#3B82F6',
                }}>
                  {slovo}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Answer buttons */}
        {!answered && (() => {
          const qType = questionTypes[currentIndex] || 'fill-in'
          const hasMultipleBlanks = (currentItem.template || '').split('___').length > 2
          const effectiveQType = (qType === 'word-choice' && hasMultipleBlanks) ? 'fill-in' : qType
          if (effectiveQType === 'word-choice' && currentItem.display_word) {
            const wrongVariant = makeWrongVariant(currentItem.display_word, currentItem.correct_answer)
            const wrongAnswer = currentItem.correct_answer === 'y' ? 'i' : 'y'
            const left = correctOnLeft
              ? { word: currentItem.display_word, answer: currentItem.correct_answer }
              : { word: wrongVariant, answer: wrongAnswer }
            const right = correctOnLeft
              ? { word: wrongVariant, answer: wrongAnswer }
              : { word: currentItem.display_word, answer: currentItem.correct_answer }
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', maxWidth: '400px' }}>
                {[left, right].map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(opt.answer)}
                    disabled={!!answered || finishing}
                    className={idx === 0 ? 'btn-answer-i' : 'btn-answer-y'}
                    style={{ fontSize: '1.3rem', minHeight: '80px', borderRadius: '20px' }}
                  >
                    {opt.word}
                  </button>
                ))}
              </div>
            )
          }
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', maxWidth: '400px' }}>
              <button className="btn-answer-i" onClick={() => handleAnswer('i')} disabled={!!answered || finishing}>i</button>
              <button className="btn-answer-y" onClick={() => handleAnswer('y')} disabled={!!answered || finishing}>y</button>
            </div>
          )
        })()}

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
