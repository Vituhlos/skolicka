import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownRight, ArrowUpRight, BookOpen, Calendar, ChevronLeft, Clock, Download, Flame, GripVertical, KeyRound,
  ListPlus, Minus, Pencil, PauseCircle, Play, Plus, Target, Trash2, TrendingUp, Trophy, Users, Zap,
} from 'lucide-react'
import SentenceManager from '../components/SentenceManager.jsx'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProfileForm from '../components/ProfileForm.jsx'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api, BASE_API_URL } from '../utils/api.js'

const WEEKDAY_LABELS = ['Po', 'Ut', 'St', 'Ct', 'Pa', 'So', 'Ne']
const LETTER_LABELS = { B: 'B', L: 'L', M: 'M', P: 'P', S: 'S', V: 'V', Z: 'Z' }

function parseNumber(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

function toLocalDateKey(value) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`)
}

function shiftDays(date, offset) {
  const next = new Date(date)
  next.setDate(next.getDate() + offset)
  return next
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
}

function formatLongDate(value) {
  return new Date(value).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDuration(minutes) {
  if (!minutes) return '0 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
}

function formatResponseTime(ms) {
  const value = parseNumber(ms)
  if (!value) return '—'
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(1)} s`
}

function calculateAccuracy(correct, total) {
  if (!total) return 0
  return Math.round((correct / total) * 100)
}

function getBarColor(accuracy) {
  if (accuracy >= 80) return '#16A34A'
  if (accuracy >= 60) return '#D97706'
  return '#DC2626'
}

function getHeatColor(value, maxValue) {
  if (!value) return '#E2E8F0'
  const ratio = maxValue > 0 ? value / maxValue : 0
  if (ratio >= 0.75) return '#2563EB'
  if (ratio >= 0.45) return '#60A5FA'
  if (ratio >= 0.2) return '#BFDBFE'
  return '#DBEAFE'
}

function normalizeTimeline(raw, days) {
  const today = new Date()
  const start = shiftDays(today, -(days - 1))
  const byDate = new Map(
    (raw || []).map((entry) => [
      entry.date,
      {
        xp: parseNumber(entry.xp_earned ?? entry.xp),
        answers: parseNumber(entry.answer_count ?? entry.total_answers ?? entry.answers),
      },
    ]),
  )

  const series = []
  for (let i = 0; i < days; i += 1) {
    const current = shiftDays(start, i)
    const key = toLocalDateKey(current)
    const point = byDate.get(key) || { xp: 0, answers: 0 }
    series.push({
      dateKey: key,
      date: formatShortDate(current),
      xp: point.xp,
      answers: point.answers,
    })
  }
  return series
}

function buildSessionTimeline(sessions, days) {
  const today = new Date()
  const start = shiftDays(today, -(days - 1))
  const byDate = new Map()

  ;(sessions || []).forEach((session) => {
    const key = toLocalDateKey(session.started_at)
    const current = byDate.get(key) || 0
    byDate.set(key, current + parseNumber(session.total_answers))
  })

  const series = []
  for (let i = 0; i < days; i += 1) {
    const current = shiftDays(start, i)
    const key = toLocalDateKey(current)
    series.push({
      dateKey: key,
      date: formatShortDate(current),
      answers: byDate.get(key) || 0,
    })
  }
  return series
}

function buildHeatmapCells(series) {
  if (!series.length) return []

  const startDate = fromDateKey(series[0].dateKey)
  const endDate = fromDateKey(series[series.length - 1].dateKey)
  const startWeekday = (startDate.getDay() + 6) % 7
  const gridStart = shiftDays(startDate, -startWeekday)
  const endWeekday = (endDate.getDay() + 6) % 7
  const gridEnd = shiftDays(endDate, 6 - endWeekday)
  const valuesByDate = new Map(series.map((entry) => [entry.dateKey, entry.answers]))
  const maxValue = Math.max(...series.map((entry) => entry.answers), 0)
  const cells = []

  for (let date = new Date(gridStart); date <= gridEnd; date = shiftDays(date, 1)) {
    const key = toLocalDateKey(date)
    const answers = valuesByDate.get(key)
    const isInRange = answers !== undefined
    cells.push({
      dateKey: key,
      answers: answers || 0,
      isInRange,
      color: isInRange ? getHeatColor(answers || 0, maxValue) : 'transparent',
    })
  }

  return cells
}

function getTrendData(series) {
  if (series.length < 14) {
    return { direction: 'flat', currentWeek: 0, previousWeek: 0, delta: 0 }
  }

  const currentWeek = series.slice(-7).reduce((sum, entry) => sum + entry.answers, 0)
  const previousWeek = series.slice(-14, -7).reduce((sum, entry) => sum + entry.answers, 0)
  const delta = currentWeek - previousWeek

  if (delta > 0) return { direction: 'up', currentWeek, previousWeek, delta }
  if (delta < 0) return { direction: 'down', currentWeek, previousWeek, delta }
  return { direction: 'flat', currentWeek, previousWeek, delta }
}

function hasActivity(series, key = 'answers') {
  return Array.isArray(series) && series.some((entry) => parseNumber(entry[key]) > 0)
}

function StatCard({ label, value, icon: Icon, color = '#2563EB', colorBg = '#EFF6FF', hint = '' }) {
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
          width: '44px',
          height: '44px',
          background: colorBg,
          border: `2px solid ${color}`,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
          {hint ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              {hint}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function TrendCard({ trend }) {
  const directionMap = {
    up: { icon: ArrowUpRight, color: '#16A34A', label: 'Lepší než minulý týden' },
    down: { icon: ArrowDownRight, color: '#DC2626', label: 'Slabší než minulý týden' },
    flat: { icon: Minus, color: '#64748B', label: 'Stejné jako minulý týden' },
  }
  const current = directionMap[trend.direction]
  const Icon = current.icon

  return (
    <div className="clay-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          border: `2px solid ${current.color}`,
          background: `${current.color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={22} color={current.color} />
        </div>
        <div>
          <p style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-text)' }}>
            Trend posledních 7 dní
          </p>
          <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            {current.label}
          </p>
        </div>
      </div>
      <p style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: 700, color: current.color }}>
        {trend.delta > 0 ? '+' : ''}{trend.delta} odpovědí
      </p>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
        Tento týden: {trend.currentWeek} • minulý týden: {trend.previousWeek}
      </p>
    </div>
  )
}

function ActivityHeatmap({ cells }) {
  return (
    <div className="clay-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
            Tepelná mapa aktivity
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Posledních 28 dní, tmavší pole znamená víc odpovědí.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
          <span>Méně</span>
          {['#E2E8F0', '#DBEAFE', '#BFDBFE', '#60A5FA', '#2563EB'].map((color) => (
            <span key={color} style={{ width: 12, height: 12, borderRadius: 3, background: color, border: '1px solid rgba(148,163,184,0.3)' }} />
          ))}
          <span>Více</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '24px auto', gap: '10px', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 14px)', gap: '6px', fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div style={{ display: 'grid', gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 14px)', gap: '6px' }}>
          {cells.map((cell) => (
            <div
              key={cell.dateKey}
              title={cell.isInRange ? `${formatLongDate(cell.dateKey)}: ${cell.answers} odpovědí` : ''}
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: cell.color,
                border: cell.isInRange ? '1px solid rgba(148,163,184,0.2)' : '1px solid transparent',
                opacity: cell.isInRange ? 1 : 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

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

  const moduleNameMap = modules.reduce((acc, module) => {
    acc[module.id] = module.name
    return acc
  }, {})

  const totalAccuracy = stats?.total_answers
    ? `${calculateAccuracy(parseNumber(stats.correct_answers), parseNumber(stats.total_answers))}%`
    : '—'

  const hasTimelineData = hasActivity(timeline, 'xp') || hasActivity(timeline, 'answers')
  const hasVslovTimelineData = hasActivity(vslovTimeline, 'answers')
  const heatmapCells = buildHeatmapCells(timeline.slice(-28))
  const trend = getTrendData(timeline)

  const chartModuleStats = moduleStats.map((module) => ({
    ...module,
    module_label: moduleNameMap[module.module_id] || module.module_id,
  }))

  const letterData = Array.isArray(vslovStats?.by_letter)
    ? [...vslovStats.by_letter]
        .map((entry) => {
          const total = parseNumber(entry.total)
          const correct = parseNumber(entry.correct)
          return {
            letter: LETTER_LABELS[entry.letter] || entry.letter,
            accuracy: parseNumber(entry.accuracy) || calculateAccuracy(correct, total),
            total,
            correct,
          }
        })
        .sort((a, b) => a.letter.localeCompare(b.letter, 'cs'))
    : []

  const problematicWords = Array.isArray(vslovStats?.problematic_words)
    ? [...vslovStats.problematic_words]
        .map((word) => ({
          ...word,
          total: parseNumber(word.total),
          correct: parseNumber(word.correct),
        }))
        .sort((a, b) => calculateAccuracy(a.correct, a.total) - calculateAccuracy(b.correct, b.total))
        .slice(0, 20)
    : []

  const sessionRows = recentSessions.map((session) => {
    const totalAnswers = parseNumber(session.total_answers)
    const correctAnswers = parseNumber(session.correct_answers)
    return {
      ...session,
      totalAnswers,
      correctAnswers,
      durationMinutes: parseNumber(session.duration_minutes),
      accuracy: calculateAccuracy(correctAnswers, totalAnswers),
      moduleLabel: moduleNameMap[session.module_id] || session.module_id,
    }
  })

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
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              <StatCard label="Celkem XP" value={parseNumber(stats?.total_xp)} icon={Zap} color="#F97316" colorBg="#FFF7ED" />
              <StatCard label="Aktuální streak" value={`${parseNumber(stats?.current_streak)} dní`} icon={Flame} color="#EF4444" colorBg="#FEF2F2" />
              <StatCard label="Dny cvičení" value={parseNumber(stats?.days_practiced)} icon={Calendar} color="#7C3AED" colorBg="#F5F3FF" />
              <StatCard label="Celkem odpovědí" value={parseNumber(stats?.total_answers)} icon={Target} color="#2563EB" colorBg="#EFF6FF" />
              <StatCard
                label="Celková přesnost"
                value={totalAccuracy}
                icon={TrendingUp}
                color="#16A34A"
                colorBg="#F0FDF4"
                hint={stats?.total_answers ? `${parseNumber(stats.correct_answers)} z ${parseNumber(stats.total_answers)} správně` : ''}
              />
            </div>

            <div className="clay-card" style={{ padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', margin: '0 0 2px' }}>Denní cíl odpovědí</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Kolik odpovědí má dítě splnit každý den</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => {
                    const nextValue = Math.max(5, Math.round(dailyGoal / 5) * 5 - 5)
                    setDailyGoal(nextValue)
                    handleSaveDailyGoal(nextValue)
                  }}
                  disabled={savingGoal || dailyGoal <= 5}
                  className="btn-clay btn-clay-secondary"
                  style={{ width: '36px', height: '36px', borderRadius: '10px', padding: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >−</button>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.4rem', color: 'var(--color-primary)', minWidth: '40px', textAlign: 'center' }}>
                  {dailyGoal}
                </span>
                <button
                  onClick={() => {
                    const nextValue = Math.min(200, Math.round(dailyGoal / 5) * 5 + 5)
                    setDailyGoal(nextValue)
                    handleSaveDailyGoal(nextValue)
                  }}
                  disabled={savingGoal || dailyGoal >= 200}
                  className="btn-clay btn-clay-secondary"
                  style={{ width: '36px', height: '36px', borderRadius: '10px', padding: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >+</button>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--color-text-muted)', visibility: savingGoal ? 'visible' : 'hidden' }}>Ukládám…</span>
              </div>
            </div>

            {hasTimelineData && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '16px', marginBottom: '24px' }}>
                  <div className="clay-card" style={{ padding: '24px' }}>
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
                            formatter={(value) => [`${value} XP`, 'XP']}
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

                  <TrendCard trend={trend} />
                </div>

                <ActivityHeatmap cells={heatmapCells} />
              </>
            )}

            {moduleStats.length > 0 && (
              <div className="clay-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '16px', marginTop: 0 }}>
                  Aktivita podle modulů
                </h2>
                <div className="chart-container" style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartModuleStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="module_label" tick={{ fontFamily: 'var(--font-body)', fontSize: 11 }} />
                      <YAxis tick={{ fontFamily: 'var(--font-body)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ fontFamily: 'var(--font-body)', borderRadius: '10px', border: '2px solid #CBD5E1' }}
                        formatter={(value) => [`${value} odpovědí`, 'Odpovědi']}
                      />
                      <Bar dataKey="total_answers" radius={[6, 6, 0, 0]} fill="var(--color-primary)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {sessionRows.length > 0 && (
              <div className="clay-card" style={{ padding: '24px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '6px', marginTop: 0 }}>
                  Historie sezení
                </h2>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0 0 16px' }}>
                  Posledních {sessionRows.length} dokončených i rozpracovaných sezení.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                    <thead>
                      <tr>
                        {['Datum', 'Modul', 'Otázky', 'Přesnost', 'Délka'].map((heading) => (
                          <th
                            key={heading}
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
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sessionRows.map((session, index) => (
                        <tr
                          key={session.id}
                          onClick={() => openSessionDetail(session)}
                          style={{ background: index % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)', cursor: 'pointer', transition: 'background 150ms ease, transform 150ms ease' }}
                          onMouseEnter={(event) => {
                            event.currentTarget.style.background = '#EFF6FF'
                            event.currentTarget.style.transform = 'translateY(-1px)'
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.background = index % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)'
                            event.currentTarget.style.transform = 'translateY(0)'
                          }}
                        >
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                            {formatLongDate(session.started_at)}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                            {session.moduleLabel}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                            {session.totalAnswers}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: getBarColor(session.accuracy) }}>
                            {session.totalAnswers ? `${session.accuracy}%` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                            {formatDuration(session.durationMinutes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(!hasTimelineData) && moduleStats.length === 0 && sessionRows.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                Zatím žádná data k zobrazení.
              </div>
            )}
          </>
        )}

        {!loading && activeView === 'sentences' && (
          <SentenceManager token={token} />
        )}

        {!loading && activeView === 'vyjmenovana' && (
          <>
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
                        formatter={(value, name, props) => [
                          `${value}% (${props.payload.correct}/${props.payload.total})`,
                          'Přesnost',
                        ]}
                      />
                      <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                        {letterData.map((entry) => (
                          <Cell key={entry.letter} fill={getBarColor(entry.accuracy)} />
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

            {vslovStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <StatCard
                  label="Celkem odpovědí"
                  value={parseNumber(vslovStats.total_answers)}
                  icon={Target}
                  color="#F97316"
                  colorBg="#FFF7ED"
                />
                <StatCard
                  label="Celková přesnost"
                  value={vslovStats.total_answers
                    ? `${calculateAccuracy(parseNumber(vslovStats.correct_answers), parseNumber(vslovStats.total_answers))}%`
                    : '—'}
                  icon={TrendingUp}
                  color="#16A34A"
                  colorBg="#F0FDF4"
                />
                <StatCard
                  label="Čas cvičení"
                  value={vslovStats.total_time_minutes ? formatDuration(parseNumber(vslovStats.total_time_minutes)) : '—'}
                  icon={Clock}
                  color="#7C3AED"
                  colorBg="#F5F3FF"
                />
              </div>
            )}

            {problematicWords.length > 0 && (
              <div className="clay-card" style={{ padding: '24px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '16px', marginTop: 0 }}>
                  Nejproblematičtější slova (top 20)
                </h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                    <thead>
                      <tr>
                        {['Slovo', 'Zobrazeno', 'Správně', 'Přesnost'].map((heading) => (
                          <th
                            key={heading}
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
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {problematicWords.map((word, index) => {
                        const accuracy = calculateAccuracy(word.correct, word.total)
                        return (
                          <tr key={`${word.word}-${index}`} style={{ background: index % 2 === 0 ? '#F8FAFC' : 'white' }}>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
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
        {activeView === 'leaderboard' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-text)', margin: '0 0 4px' }}>
                Žebříček profilů
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
                Aktivní profily seřazené podle nasbíraných XP.
              </p>
            </div>

            {leaderboardLoading && (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{
                  width: '36px', height: '36px',
                  border: '3px solid var(--color-border-light)',
                  borderTop: '3px solid var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 12px',
                }} />
                <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>Načítám žebříček…</p>
              </div>
            )}

            {leaderboardError && (
              <div style={{
                background: '#FEE2E2', border: '2px solid var(--color-error)',
                borderRadius: '14px', padding: '12px 16px',
                color: 'var(--color-error)', fontFamily: 'var(--font-body)',
              }}>
                {leaderboardError}
              </div>
            )}

            {!leaderboardLoading && !leaderboardError && leaderboard.length === 0 && (
              <div className="clay-card" style={{ padding: '48px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>
                  Zatím žádné aktivní profily v žebříčku.
                </p>
              </div>
            )}

            {!leaderboardLoading && !leaderboardError && leaderboard.length > 0 && (
              <div style={{ display: 'grid', gap: '10px' }}>
                {leaderboard.map((entry, index) => {
                  const medals = ['🥇', '🥈', '🥉']
                  const rank = index < 3 ? medals[index] : `#${index + 1}`
                  const avatar = entry.avatar_preset || '👤'
                  return (
                    <div
                      key={entry.id}
                      className="clay-card"
                      style={{
                        padding: '14px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        background: index === 0 ? '#FFFBEB' : 'var(--color-surface)',
                        borderColor: index === 0 ? '#F59E0B' : undefined,
                        boxShadow: index === 0 ? '0 4px 0 #F59E0B88, 0 8px 20px rgba(0,0,0,0.06)' : undefined,
                      }}
                    >
                      <div style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 700,
                        fontSize: index < 3 ? '1.6rem' : '1.1rem',
                        minWidth: '40px',
                        textAlign: 'center',
                        color: index < 3 ? undefined : 'var(--color-text-muted)',
                      }}>
                        {rank}
                      </div>
                      <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>{avatar}</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: '0 0 2px' }}>
                          {entry.name}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                          Streak: {entry.current_streak} 🔥 · Dny: {entry.days_practiced}
                        </p>
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        color: '#F97316',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        <Zap size={16} color="#F97316" />
                        {entry.total_xp} XP
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeView === 'profiles' && (
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
                onClick={() => { setEditingProfile(null); setProfileFormOpen(true) }}
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
                  onClick={() => setProfileNotice(null)}
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
                  onClick={() => { setEditingProfile(null); setProfileFormOpen(true) }}
                >
                  Vytvořit první profil
                </button>
              </div>
            ) : (
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={profiles.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {profiles.map((profile) => {
                      const avatarUrl = profile.avatar_url ? `${BASE_API_URL}${profile.avatar_url}` : null
                      return (
                        <SortableProfileItem
                          key={profile.id}
                          profile={profile}
                          avatarUrl={avatarUrl}
                          onEdit={(p) => { setEditingProfile(p); setProfileFormOpen(true) }}
                          onTogglePause={handleTogglePauseProfile}
                          onDeleteConfirm={setDeleteConfirm}
                        />
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
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
