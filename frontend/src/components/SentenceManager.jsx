import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Upload, Download, AlertTriangle } from 'lucide-react'
import { api, BASE_API_URL } from '../utils/api.js'

const LETTERS = ['B', 'L', 'M', 'P', 'S', 'V', 'Z']

// Find all words in the sentence that contain y/ý/i/í after the given letter
function findCandidates(sentence, letter) {
  if (!sentence || !letter) return []
  const words = sentence.match(/[a-záčďéěíňóřšťúůýžbilmpsv]+/gi) || []
  const letterLower = letter.toLowerCase()
  const seen = new Set()
  const candidates = []

  for (const word of words) {
    if (seen.has(word.toLowerCase())) continue
    const lower = word.toLowerCase()
    for (let i = 0; i < lower.length; i++) {
      if (lower[i] === letterLower) {
        for (let j = i + 1; j < lower.length; j++) {
          const ch = lower[j]
          if ('yý'.includes(ch) || 'ií'.includes(ch)) {
            const correct_answer = 'yý'.includes(ch) ? 'y' : 'i'
            const modified = word.slice(0, j) + '___' + word.slice(j + 1)
            const template = sentence.replace(word, modified)
            candidates.push({ display_word: word, correct_answer, template })
            seen.add(lower)
            break
          }
        }
        break
      }
    }
  }
  return candidates
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
  const [letter, setLetter] = useState('B')
  const [word, setWord] = useState('')
  const [sentence, setSentence] = useState('')
  const [selected, setSelected] = useState(null) // chosen candidate
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [exportFormat, setExportFormat] = useState('json')
  const [deletingAll, setDeletingAll] = useState(false)

  const candidates = useMemo(() => findCandidates(sentence, letter), [sentence, letter])

  // Auto-select if only one candidate
  useEffect(() => {
    if (candidates.length === 1) {
      setSelected(candidates[0])
    } else {
      setSelected(null)
    }
  }, [candidates])

  useEffect(() => { loadSentences() }, [])

  async function loadSentences() {
    setLoading(true)
    try {
      const data = await api.adminGetSentences(token)
      setSentences(data)
    } catch {
      setError('Nepodařilo se načíst věty.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!word.trim() || !sentence.trim() || !selected) {
      setError('Vyplň všechna pole a vyber slovo.')
      return
    }
    setSubmitting(true)
    try {
      await api.adminAddSentence({ letter, word: word.trim(), sentence, display_word: selected.display_word, difficulty: 1 }, token)
      setSuccess(`Přidáno: ${selected.template}`)
      setSentence('')
      setWord('')
      setSelected(null)
      await loadSentences()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleImport() {
    setImportResult(null)
    let parsed
    try {
      parsed = JSON.parse(importText)
      if (!Array.isArray(parsed)) throw new Error()
    } catch {
      setImportResult({ error: 'Neplatný JSON. Musí to být pole [ ... ].' })
      return
    }
    setImporting(true)
    try {
      const result = await api.adminBulkImport(parsed, token)
      setImportResult(result)
      setImportText('')
      await loadSentences()
    } catch (e) {
      setImportResult({ error: e.message })
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Opravdu smazat tuto větu?')) return
    try {
      await api.adminDeleteSentence(id, token)
      setSentences(s => s.filter(x => x.id !== id))
    } catch {
      setError('Nepodařilo se smazat.')
    }
  }

  function handleExport(format) {
    const url = `${BASE_API_URL}/api/modules/vyjmenovana-slova/admin/sentences/export?format=${format}`
    const a = document.createElement('a')
    a.href = url
    a.setAttribute('download', `skolicky-vety.${format}`)
    // Pass token via URL is not ideal; use hidden iframe trick with Authorization header workaround:
    // Instead fetch as blob and trigger download
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        a.href = blobUrl
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
      })
      .catch(() => setError('Export se nezdařil.'))
  }

  async function handleDeleteAll() {
    if (!confirm(`Opravdu smazat všech ${sentences.length} vět? Tato akce je nevratná.`)) return
    setDeletingAll(true)
    try {
      await api.adminDeleteAllSentences(token)
      setSentences([])
    } catch {
      setError('Nepodařilo se smazat věty.')
    } finally {
      setDeletingAll(false)
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
          {/* Letter + base word */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Písmeno</label>
              <select value={letter} onChange={e => setLetter(e.target.value)} style={inputStyle}>
                {LETTERS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Základní tvar slova</label>
              <input
                type="text"
                placeholder="např. být, lyže, syn…"
                value={word}
                onChange={e => setWord(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Sentence */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Celá věta (napiš normálně s y nebo i)</label>
            <input
              type="text"
              placeholder="např. Dnes ráno jsem byl nemocný."
              value={sentence}
              onChange={e => setSentence(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Candidate picker or auto preview */}
          {sentence && candidates.length === 0 && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#FEF2F2', border: '2px solid #DC2626', fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#DC2626', marginBottom: '16px' }}>
              Ve větě nebylo nalezeno y/i po písmenu <strong>{letter}</strong>. Zkontroluj větu nebo vybrané písmeno.
            </div>
          )}

          {candidates.length > 1 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Vyber slovo s y/i</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {candidates.map(c => (
                  <button
                    key={c.display_word}
                    type="button"
                    onClick={() => setSelected(c)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '10px',
                      border: `2px solid ${selected?.display_word === c.display_word ? 'var(--color-primary)' : '#CBD5E1'}`,
                      background: selected?.display_word === c.display_word ? '#EFF6FF' : 'white',
                      color: selected?.display_word === c.display_word ? 'var(--color-primary)' : 'var(--color-text)',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    {c.display_word}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {selected && (
            <div style={{ padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', background: '#F0FDF4', border: '2px solid #16A34A', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#166534', flex: 1 }}>
                <strong>Šablona:</strong> {selected.template}
              </span>
              <span style={{
                fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.85rem',
                padding: '2px 10px', borderRadius: '8px',
                background: selected.correct_answer === 'y' ? '#2563EB20' : '#7C3AED20',
                color: selected.correct_answer === 'y' ? '#2563EB' : '#7C3AED',
              }}>
                odpověď: {selected.correct_answer}
              </span>
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
            disabled={submitting || !selected}
            className="btn-clay btn-clay-primary"
            style={{ padding: '12px 24px', borderRadius: '14px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', opacity: !selected ? 0.5 : 1 }}
          >
            <Plus size={18} />
            {submitting ? 'Přidávám...' : 'Přidat větu'}
          </button>
        </form>
      </div>

      {/* Bulk import */}
      <div className="clay-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginTop: 0, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Upload size={18} color="var(--color-primary)" />
          Hromadný import z ChatGPT
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 0, marginBottom: '12px' }}>
          Požádej ChatGPT o JSON v tomto formátu a vlož ho sem:
        </p>
        <pre style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--color-text)', overflowX: 'auto', marginTop: 0, marginBottom: '12px' }}>{`[
  { "letter": "B", "word": "být", "sentence": "Dnes jsem byl nemocný." },
  { "letter": "B", "word": "bílý", "sentence": "Sníh je bílý." }
]`}</pre>
        <textarea
          value={importText}
          onChange={e => { setImportText(e.target.value); setImportResult(null) }}
          placeholder="Vlož JSON sem..."
          rows={6}
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical', marginBottom: '12px' }}
        />
        {importResult && (
          <div style={{
            padding: '10px 14px', borderRadius: '10px', marginBottom: '12px',
            fontFamily: 'var(--font-body)', fontSize: '0.9rem',
            background: importResult.error ? '#FEE2E2' : '#F0FDF4',
            color: importResult.error ? '#DC2626' : '#166534',
            border: `2px solid ${importResult.error ? '#DC2626' : '#16A34A'}`,
          }}>
            {importResult.error ? importResult.error : (
              <>
                Přidáno: <strong>{importResult.added}</strong> vět
                {importResult.skipped > 0 && `, přeskočeno (duplicity): ${importResult.skipped}`}
                {importResult.errors?.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: '16px' }}>
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
        <button
          onClick={handleImport}
          disabled={importing || !importText.trim()}
          className="btn-clay btn-clay-primary"
          style={{ padding: '10px 20px', borderRadius: '14px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', opacity: !importText.trim() ? 0.5 : 1 }}
        >
          <Upload size={16} />
          {importing ? 'Importuji...' : 'Importovat'}
        </button>
      </div>

      {/* List */}
      <div className="clay-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
            Všechny věty ({filtered.length})
          </h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => handleExport('json')}
              className="btn-clay btn-clay-secondary"
              style={{ padding: '5px 12px', borderRadius: '10px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Exportovat jako JSON pro AI kontrolu"
            >
              <Download size={13} /> JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="btn-clay btn-clay-secondary"
              style={{ padding: '5px 12px', borderRadius: '10px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Exportovat jako CSV"
            >
              <Download size={13} /> CSV
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll || sentences.length === 0}
              style={{
                padding: '5px 12px', borderRadius: '10px', fontSize: '0.82rem',
                display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                border: '2px solid #DC2626', background: 'transparent', color: '#DC2626',
                fontFamily: 'var(--font-heading)', fontWeight: 700,
                boxShadow: '0 2px 0 #B91C1C', opacity: sentences.length === 0 ? 0.4 : 1,
              }}
              title="Smazat všechny věty"
            >
              <AlertTriangle size={13} /> Smazat vše
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['vše', ...LETTERS].map(l => (
              <button
                key={l}
                onClick={() => setFilterLetter(l)}
                style={{
                  padding: '5px 12px', borderRadius: '10px', cursor: 'pointer',
                  border: `2px solid ${filterLetter === l ? 'var(--color-primary)' : '#CBD5E1'}`,
                  background: filterLetter === l ? 'var(--color-primary)' : 'transparent',
                  color: filterLetter === l ? 'white' : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.85rem',
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
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 14px', borderRadius: '12px',
                background: '#F8FAFC', border: '1px solid #E2E8F0',
              }}>
                <span style={{
                  fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.75rem',
                  padding: '2px 8px', borderRadius: '6px', flexShrink: 0,
                  background: s.correct_answer === 'y' ? '#EFF6FF' : '#F5F3FF',
                  color: s.correct_answer === 'y' ? '#2563EB' : '#7C3AED',
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
