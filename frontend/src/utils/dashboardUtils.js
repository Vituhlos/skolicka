export function parseNumber(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function toLocalDateKey(value) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`)
}

export function shiftDays(date, offset) {
  const next = new Date(date)
  next.setDate(next.getDate() + offset)
  return next
}

export function formatShortDate(value) {
  return new Date(value).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
}

export function formatLongDate(value) {
  return new Date(value).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDuration(minutes) {
  if (!minutes) return '0 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
}

export function formatResponseTime(ms) {
  const value = parseNumber(ms)
  if (!value) return '—'
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(1)} s`
}

export function calculateAccuracy(correct, total) {
  if (!total) return 0
  return Math.round((correct / total) * 100)
}

export function getBarColor(accuracy) {
  if (accuracy >= 80) return '#16A34A'
  if (accuracy >= 60) return '#D97706'
  return '#DC2626'
}

export function getHeatColor(value, maxValue) {
  if (!value) return '#E2E8F0'
  const ratio = maxValue > 0 ? value / maxValue : 0
  if (ratio >= 0.75) return '#2563EB'
  if (ratio >= 0.45) return '#60A5FA'
  if (ratio >= 0.2) return '#BFDBFE'
  return '#DBEAFE'
}

export function normalizeTimeline(raw, days) {
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

export function buildSessionTimeline(sessions, days) {
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
