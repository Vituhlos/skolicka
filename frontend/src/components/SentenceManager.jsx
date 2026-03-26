import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Eye } from 'lucide-react'
import { api } from '../utils/api.js'

const LETTERS = ['B', 'L', 'M', 'P', 'S', 'V', 'Z']

// Same detection logic as backend — for live preview
function detectPreview(sentence, displayWord, letter) {
  if (!sentence || !displayWord || !letter) return null
  const lower = displayWord.toLowerCase()
  const letterLower = letter.toLowerCase()
  for (let i = 0; i < lower.length; i++) {
    if (lower[i] === letterLower) {
      for (let j = i + 1; j < lower.length; j++) {
        const ch = lower[j]
        if ('yý'.includes(ch)) {
          const modified = displayWord.slice(0, j) + '___' + displayWord.slice(j + 1)
          return { correct_answer: 'y', template: sentence.replace(displayWord, modified) }
        }
        if ('ií'.includes(ch)) {
          const modified = displayWord.slice(0, j) + '___' + displayWord.slice(j + 1)
          return { correct_answer: 'i', template: sentence.replace(displayWord, modified) }
        }
      }
    }
  }
  return null
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '2px solid #CBD5E1',
  borderRadius: '12px',
  fontFamily: 'var(--font-body)',
  fontSize: '0.95rem',
  color: 'var(--color-text)',
  background: 'var(--color-surface)',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 700,
  fontSize: '0.85rem',
  color: 'var(--color-text-muted)',
  marginBottom: '6px',
  display: 'block',
}

export default function SentenceManager({ token }) {
  const [sentences, setSentences] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterLetter, setFilterLetter] = useState('vše')
  const [form, setForm] = useState({ letter: 'B', word: '', sentence: '', display_word: '', difficulty: 1 })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const preview = detectPreview(form.sentence, form.display_word, form.letter)

  useEffect(() => {
    loadSentences()
  }, [])

  async function loadSentences() {
    setLoading(true)
    try {
      const data = await api.adminGetSentences(token)
      setSentences(data)
    } catch (e) {
      setError('Nepodařilo se načíst věty.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.word.trim() || !form.sentence.trim() || !form.display_word.trim()) {
      setError('Vyplň všechna pole.')
      return
    }
    if (!preview) {
      setError(`Ve slově "${form.display_word}" nebylo nalezeno y/i po písmenu ${form.letter}. Zkontroluj slovo ve větě.`)
      return
    }
    setSubmitting(true)
    try {
      await api.adminAddSentence(form, token)
      setSuccess(`Přidáno: ${preview.template}`)
      setForm(f => ({ ...f, sentence: '', display_word: '', word: '' }))
      await loadSentences()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Opravdu smazat tuto větu?')) return
    try {
      await api.adminDeleteSentence(id, token)
      setSentences(s => s.filter(x => x.id !== id))
    } catch (e) {
      setError('Nepodařilo se smazat.')
    }
  }

  const filtered = filterLetter === 'vše' ? sentences : sentences.filter(s => s.letter === filterLetter)

  return (
    <div>
      {/* Form */}
      <div className="clay-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} color="var(--color-primary)" />
          Přidat novou větu
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Písmeno</label>
              <select
                value={form.letter}
                onChange={e => setForm(f => ({ ...f, letter: e.target.value }))}
                style={inputStyle}
              >
                {LETTERS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Základní tvar slova</label>
              <input
                type="text"
                placeholder="např. být, lyže, syn..."
                value={form.word}
                onChange={e => setForm(f => ({ ...f, word: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Celá věta (napiš normálně s y nebo i)</label>
            <input
              type="text"
              placeholder="např. Dnes ráno jsem byl nemocný."
              value={form.sentence}
              onChange={e => setForm(f => ({ ...f, sentence: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Slovo ve větě (přesně jak ho tam máš)</label>
              <input
                type="text"
                placeholder="např. byl, lyžích, syna..."
                value={form.display_word}
                onChange={e => setForm(f => ({ ...f, display_word: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Obtížnost</label>
              <select
                value={form.difficulty}
                onChange={e => setForm(f => ({ ...f, difficulty: parseInt(e.target.value) }))}
                style={inputStyle}
              >
                <option value={1}>1 – snadná</option>
                <option value={2}>2 – střední</option>
                <option value={3}>3 – těžká</option>
              </select>
            </div>
          </div>

          {/* Live preview */}
          {form.sentence && form.display_word && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '16px',
              background: preview ? '#F0FDF4' : '#FEF2F2',
              border: `2px solid ${preview ? '#16A34A' : '#DC2626'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <Eye size={16} color={preview ? '#16A34A' : '#DC2626'} />
              <div>
                {preview ? (
                  <>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#166534' }}>
                      <strong>Šablona:</strong> {preview.template}
                    </span>
                    <span style={{
                      marginLeft: '12px',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      padding: '2px 10px',
                      borderRadius: '8px',
                      background: preview.correct_answer === 'y' ? '#2563EB20' : '#7C3AED20',
                      color: preview.correct_answer === 'y' ? '#2563EB' : '#7C3AED',
                    }}>
                      odpověď: {preview.correct_answer}
                    </span>
                  </>
                ) : (
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#DC2626' }}>
                    Nelze detekovat y/i — zkontroluj slovo ve větě a vybrané písmeno.
                  </span>
                )}
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#FEE2E2', color: '#DC2626', fontFamily: 'var(--font-body)', fontSize: '0.9rem', marginBottom: '12px' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#F0FDF4', color: '#16A34A', fontFamily: 'var(--font-body)', fontSize: '0.9rem', marginBottom: '12px' }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !preview}
            className="btn-clay btn-clay-primary"
            style={{ padding: '12px 24px', borderRadius: '14px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', opacity: (!preview) ? 0.5 : 1 }}
          >
            <Plus size={18} />
            {submitting ? 'Přidávám...' : 'Přidat větu'}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="clay-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
            Všechny věty ({filtered.length})
          </h2>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['vše', ...LETTERS].map(l => (
              <button
                key={l}
                onClick={() => setFilterLetter(l)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '10px',
                  border: `2px solid ${filterLetter === l ? 'var(--color-primary)' : '#CBD5E1'}`,
                  background: filterLetter === l ? 'var(--color-primary)' : 'transparent',
                  color: filterLetter === l ? 'white' : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', textAlign: 'center' }}>Načítám...</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', textAlign: 'center' }}>Žádné věty.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(s => (
              <div key={s.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '12px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}>
                <span style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: s.correct_answer === 'y' ? '#EFF6FF' : '#F5F3FF',
                  color: s.correct_answer === 'y' ? '#2563EB' : '#7C3AED',
                  flexShrink: 0,
                }}>
                  {s.letter} · {s.correct_answer}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--color-text)', flex: 1 }}>
                  {s.template}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {s.word}
                </span>
                <button
                  onClick={() => handleDelete(s.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#CBD5E1', flexShrink: 0 }}
                  title="Smazat"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
