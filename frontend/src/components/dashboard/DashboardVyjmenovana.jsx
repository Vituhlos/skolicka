import React from 'react'
import { Clock, Target, TrendingUp } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { parseNumber, formatDuration, calculateAccuracy, getBarColor } from '../../utils/dashboardUtils.js'
import { StatCard } from './DashboardGlobal.jsx'

const LETTER_LABELS = { B: 'B', L: 'L', M: 'M', P: 'P', S: 'S', V: 'V', Z: 'Z' }

export default function DashboardVyjmenovana({ vslovStats, vslovTimeline, selectedProfileId }) {
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

  return (
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
  )
}
