import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Flame, Volume2, VolumeX } from 'lucide-react'
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
      }, isCorrect ? 1000 : 2000)
    } catch {
      setAnswered(null)
    }
  }, [answered, finishing, items, currentIndex, sessionId, profileId, soundOn])

  if (tablePickerVisible) {
    return (
      <div className="exercise-container">
        <div className="exercise-card" style={{ maxWidth: 480 }}>
          <h2 className="text-xl font-bold text-center mb-1" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
            Vyber násobilky
          </h2>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-5">
            Které násobilky chceš procvičovat?
          </p>

          <div className="grid grid-cols-5 gap-2 mb-6">
            {[1,2,3,4,5,6,7,8,9,10].map(t => {
              const prog = tableProgress[t]
              const seen = prog?.seen || 0
              const accuracy = prog && prog.total_seen > 0
                ? Math.round((prog.total_correct / prog.total_seen) * 100)
                : null
              const active = selectedTables.includes(t)
              return (
                <button
                  key={t}
                  onClick={() => toggleTable(t)}
                  className={`btn-clay flex flex-col items-center py-3 rounded-xl transition-all ${
                    active ? 'ring-2 ring-offset-1' : 'opacity-60'
                  }`}
                  style={active ? { ringColor: '#8B5CF6' } : {}}
                >
                  <span className="text-lg font-bold" style={{ fontFamily: 'Baloo 2' }}>{t}×</span>
                  {seen > 0 && accuracy !== null && (
                    <span className="text-xs mt-0.5" style={{ color: accuracy >= 80 ? '#22c55e' : accuracy >= 50 ? '#f59e0b' : '#ef4444' }}>
                      {accuracy}%
                    </span>
                  )}
                  {seen === 0 && <span className="text-xs mt-0.5 text-gray-400">nové</span>}
                </button>
              )
            })}
          </div>

          {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

          <button
            onClick={startSession}
            disabled={loading || selectedTables.length === 0}
            className="btn-clay-cta w-full py-3 text-lg font-bold"
          >
            {loading ? 'Načítám…' : `Začít (${selectedTables.sort((a,b)=>a-b).join(', ')}×)`}
          </button>
        </div>
      </div>
    )
  }

  const currentItem = items[currentIndex]
  if (!currentItem) return null
  const progress = Math.round((currentIndex / Math.max(items.length, TOTAL_ITEMS)) * 100)

  return (
    <div className="exercise-container">
      {/* XP popups */}
      {xpPopups.map(p => (
        <div key={p.id} className="xp-popup">+{p.amount} XP</div>
      ))}

      <div className={`exercise-card ${shaking ? 'shake' : ''}`} style={{ maxWidth: 480 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setTablePickerVisible(true)}
            className="btn-clay px-3 py-1 text-sm"
          >
            ← Zpět
          </button>
          <div className={`xp-pill ${xpPillFlash ? 'xp-pill-flash' : ''}`}>
            <Flame size={14} />
            <span>{totalXP} XP</span>
          </div>
          <button
            onClick={() => { toggleSound(); setSoundOn(isSoundEnabled()) }}
            className="btn-clay p-2"
            aria-label="Zvuk"
          >
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>

        <ProgressBar value={progress} />
        <p className="text-xs text-center text-gray-400 mt-1 mb-5">
          {currentIndex + 1} / {items.length}
        </p>

        {/* Question */}
        <div key={questionKey} className="question-slide-in text-center mb-8">
          <div
            className="text-5xl font-bold mb-2 tracking-wide"
            style={{ fontFamily: 'Baloo 2, sans-serif' }}
          >
            {currentItem.a} × {currentItem.b} = ?
          </div>
          {answered && (
            <div className={`text-lg font-semibold mt-2 ${answered.isCorrect ? 'text-green-500' : 'text-red-500'}`}>
              {answered.isCorrect ? '✓ Správně!' : `✗ Správně: ${answered.correct_answer}`}
            </div>
          )}
        </div>

        {/* Answer buttons */}
        <div className="grid grid-cols-2 gap-3">
          {currentItem.options.map((opt, i) => {
            let btnClass = 'btn-clay py-4 text-2xl font-bold w-full'
            if (answered) {
              if (opt === answered.correct_answer) btnClass += ' btn-clay-success'
              else if (opt === answered.given_answer && !answered.isCorrect) btnClass += ' btn-clay-danger'
            }
            return (
              <button
                key={i}
                onClick={() => !answered && handleAnswer(opt)}
                disabled={!!answered}
                className={btnClass}
              >
                {opt}
              </button>
            )
          })}
        </div>
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
