import React from 'react'
import {
  ArrowDownRight, ArrowUpRight, Calendar, Clock, Flame, Minus, Target, TrendingUp, Zap,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  parseNumber, formatLongDate, formatDuration, calculateAccuracy, getBarColor, getHeatColor,
  fromDateKey, shiftDays, toLocalDateKey,
} from '../../utils/dashboardUtils.js'

const WEEKDAY_LABELS = ['Po', 'Ut', 'St', 'Ct', 'Pa', 'So', 'Ne']

export function StatCard({ label, value, icon: Icon, color = '#2563EB', colorBg = '#EFF6FF', hint = '' }) {
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

export default function DashboardGlobal({ stats, timeline, moduleStats, recentSessions, modules, dailyGoal, savingGoal, onSaveDailyGoal, onOpenSession }) {
  const moduleNameMap = modules.reduce((acc, module) => {
    acc[module.id] = module.name
    return acc
  }, {})

  const totalAccuracy = stats?.total_answers
    ? `${calculateAccuracy(parseNumber(stats.correct_answers), parseNumber(stats.total_answers))}%`
    : '—'

  const hasTimelineData = hasActivity(timeline, 'xp') || hasActivity(timeline, 'answers')
  const heatmapCells = buildHeatmapCells(timeline.slice(-28))
  const trend = getTrendData(timeline)

  const chartModuleStats = moduleStats.map((module) => ({
    ...module,
    module_label: moduleNameMap[module.module_id] || module.module_id,
  }))

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

  return (
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
              onSaveDailyGoal(nextValue)
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
              onSaveDailyGoal(nextValue)
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
                    onClick={() => onOpenSession(session)}
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
  )
}
