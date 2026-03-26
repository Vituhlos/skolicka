import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Star, Trophy, Zap, RotateCcw, Home, Check } from 'lucide-react'

function AnimatedCounter({ target, duration = 1500 }) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target === 0) return
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])

  return <span>{value}</span>
}

function getMotivationalMessage(accuracy) {
  if (accuracy === 100) return { text: 'Perfektní! Žádná chyba!', color: 'var(--color-success)' }
  if (accuracy >= 80) return { text: 'Výborně! Jen tak dál!', color: '#2563EB' }
  if (accuracy >= 60) return { text: 'Dobrá práce! Cvič dál!', color: '#D97706' }
  if (accuracy >= 40) return { text: 'Nevzdávej se, zlepšíš se!', color: '#D97706' }
  return { text: 'Příště to půjde lépe!', color: 'var(--color-text-muted)' }
}

function Confetti() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width = W
    canvas.height = H

    const colors = ['#F97316', '#2563EB', '#7C3AED', '#16A34A', '#EF4444', '#F59E0B', '#0891B2', '#EC4899']
    const pieces = Array.from({ length: 160 }, () => ({
      x: Math.random() * W,
      y: Math.random() * -H * 0.5,
      w: Math.random() * 10 + 6,
      h: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * 3 + 2,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.15,
      drift: (Math.random() - 0.5) * 1.2,
    }))

    const startTime = Date.now()
    let animId

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const elapsed = (Date.now() - startTime) / 1000
      const alpha = elapsed < 2.5 ? 1 : Math.max(0, 1 - (elapsed - 2.5) / 1.2)

      pieces.forEach((p) => {
        p.y += p.speed
        p.x += p.drift
        p.angle += p.spin
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      })

      if (alpha > 0) animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 100 }}
    />
  )
}

function BadgeAward({ badge }) {
  const badgeColors = {
    first_correct: '#F59E0B',
    streak_3: '#F97316',
    streak_7: '#EF4444',
    streak_30: '#DC2626',
    perfect_session: '#7C3AED',
    answers_100: '#2563EB',
    answers_500: '#0891B2',
    speed_demon: '#F59E0B',
  }

  return (
    <div
      className="bounce-in clay-card"
      style={{
        padding: '16px',
        textAlign: 'center',
        borderColor: badgeColors[badge.key] || '#2563EB',
        boxShadow: `0 4px 0 ${badgeColors[badge.key] || '#1D4ED8'}99`,
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '6px' }}>
        {badge.key?.includes('streak') ? '🔥' : badge.key?.includes('perfect') ? '👑' : '⭐'}
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)' }}>
        {badge.name || badge.key}
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const { moduleId, profileId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const results = location.state?.results || {}
  const {
    correct = 0,
    total = 15,
    xp_earned = 0,
    new_badges = [],
    wrong_answers = [],
    session_id,
  } = results

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
  const msg = getMotivationalMessage(accuracy)

  const handleRetry = () => {
    navigate(`/cviceni/${moduleId}/${profileId}`)
  }

  const handleDone = () => {
    navigate(`/profil/${profileId}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '24px' }}>
      {accuracy === 100 && <Confetti />}
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Motivational message */}
        <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '16px' }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '2rem',
            color: msg.color,
            margin: '0 0 8px',
          }}>
            {msg.text}
          </h1>
        </div>

        {/* Score card */}
        <div className="clay-card" style={{
          padding: '28px',
          marginBottom: '20px',
          textAlign: 'center',
          borderColor: accuracy >= 80 ? 'var(--color-success)' : accuracy >= 60 ? '#D97706' : '#CBD5E1',
          boxShadow: `0 4px 0 ${accuracy >= 80 ? 'var(--color-success-dark)' : accuracy >= 60 ? '#B45309' : '#CBD5E1'}, 0 8px 24px rgba(0,0,0,0.08)`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '8px' }}>
            <Trophy size={32} color={accuracy >= 80 ? 'var(--color-success)' : '#D97706'} />
          </div>
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            marginBottom: '4px',
          }}>
            <span style={{ fontSize: '4rem', color: 'var(--color-text)' }}>
              <AnimatedCounter target={correct} />
            </span>
            <span style={{ fontSize: '2rem', color: 'var(--color-text-muted)' }}>/{total}</span>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', margin: 0, fontSize: '1rem' }}>
            správných odpovědí
          </p>

          {/* Accuracy bar */}
          <div style={{ marginTop: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: 'var(--color-text-muted)',
              marginBottom: '6px',
            }}>
              <span>Přesnost</span>
              <span style={{ color: msg.color }}><AnimatedCounter target={accuracy} />%</span>
            </div>
            <div style={{
              height: '12px',
              background: '#E2E8F0',
              border: '2px solid #CBD5E1',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${accuracy}%`,
                background: accuracy >= 80
                  ? 'linear-gradient(90deg, var(--color-success), #4ADE80)'
                  : accuracy >= 60
                  ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                  : 'linear-gradient(90deg, var(--color-error), #F87171)',
                borderRadius: '6px',
                transition: 'width 1s ease-out',
              }} />
            </div>
          </div>
        </div>

        {/* XP earned */}
        {xp_earned > 0 && (
          <div className="clay-card" style={{
            padding: '20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            borderColor: 'var(--color-cta)',
            boxShadow: '0 4px 0 var(--color-cta-dark), 0 8px 24px rgba(0,0,0,0.08)',
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              background: '#FFF7ED',
              border: '3px solid var(--color-cta)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 0 var(--color-cta-dark)',
              flexShrink: 0,
            }}>
              <Zap size={26} color="var(--color-cta)" fill="var(--color-cta)" />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', margin: '0 0 2px', fontSize: '0.85rem' }}>
                Získáno XP
              </p>
              <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.8rem', color: 'var(--color-cta)', margin: 0 }}>
                +<AnimatedCounter target={xp_earned} />
              </p>
            </div>
          </div>
        )}

        {/* New badges */}
        {new_badges && new_badges.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '1.1rem',
              color: 'var(--color-text)',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <Star size={20} color="#F59E0B" fill="#F59E0B" />
              Nový odznak!
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
              {new_badges.map((badge, idx) => (
                <BadgeAward key={idx} badge={badge} />
              ))}
            </div>
          </div>
        )}

        {/* Wrong answers review */}
        {wrong_answers.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '1rem',
              color: 'var(--color-text)',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px',
                background: 'var(--color-error)', borderRadius: '50%',
                fontSize: '0.75rem', color: 'white', fontWeight: 700, flexShrink: 0,
              }}>{wrong_answers.length}</span>
              Chyby k procvičení
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {wrong_answers.map((w, idx) => {
                const parts = (w.template || '').split('___')
                return (
                  <div key={idx} style={{
                    background: '#FEF2F2',
                    border: '2px solid #FECACA',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <div style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                      {parts.length === 2
                        ? <>{parts[0]}<strong style={{ color: 'var(--color-success)' }}>{w.correct_answer}</strong>{parts[1]}</>
                        : w.template}
                    </div>
                    {w.display_word && (
                      <span style={{
                        fontFamily: 'var(--font-heading)', fontWeight: 700,
                        fontSize: '0.85rem', color: 'var(--color-success)',
                        background: '#DCFCE7', border: '2px solid var(--color-success)',
                        borderRadius: '8px', padding: '2px 8px', flexShrink: 0,
                      }}>
                        {w.display_word}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleRetry}
            className="btn-clay btn-clay-secondary"
            style={{ flex: 1, padding: '14px', borderRadius: '18px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={18} />
            Znovu
          </button>
          <button
            onClick={handleDone}
            className="btn-clay btn-clay-primary"
            style={{ flex: 1, padding: '14px', borderRadius: '18px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Check size={18} />
            Hotovo
          </button>
        </div>
      </div>
    </div>
  )
}
