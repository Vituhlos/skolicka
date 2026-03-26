import React, { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { api } from '../utils/api.js'

export default function PinModal({ isOpen, onSuccess, onClose }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRefs = [useRef(), useRef(), useRef(), useRef()]

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', ''])
      setError('')
      setTimeout(() => inputRefs[0].current?.focus(), 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return
    const newDigits = [...digits]
    newDigits[index] = value
    setDigits(newDigits)
    setError('')

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus()
    }

    if (value && index === 3) {
      const pin = [...newDigits.slice(0, 3), value].join('')
      if (pin.length === 4) {
        submitPin(pin)
      }
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus()
    }
    if (e.key === 'Enter') {
      const pin = digits.join('')
      if (pin.length === 4) submitPin(pin)
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pasted.length === 4) {
      const newDigits = pasted.split('')
      setDigits(newDigits)
      inputRefs[3].current?.focus()
      submitPin(pasted)
    }
  }

  const submitPin = async (pin) => {
    setLoading(true)
    setError('')
    try {
      const data = await api.verifyPin(pin)
      if (data.token) {
        localStorage.setItem('parent_token', data.token)
        onSuccess(data.token)
      } else {
        setError('Nesprávný PIN')
        setDigits(['', '', '', ''])
        inputRefs[0].current?.focus()
      }
    } catch (err) {
      setError('Nesprávný PIN')
      setDigits(['', '', '', ''])
      inputRefs[0].current?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = () => {
    const pin = digits.join('')
    if (pin.length === 4) submitPin(pin)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="clay-card p-8 w-full max-w-sm mx-4 bounce-in">
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--color-text)' }}>
            Rodičovský PIN
          </h2>
          <button
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: '2px solid #CBD5E1',
              borderRadius: '12px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', textAlign: 'center', fontFamily: 'var(--font-body)' }}>
          Zadej 4místný PIN pro přístup
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '1.5rem' }}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              style={{
                width: '56px',
                height: '64px',
                textAlign: 'center',
                fontSize: '1.8rem',
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                border: `3px solid ${error ? 'var(--color-error)' : digit ? 'var(--color-primary)' : '#CBD5E1'}`,
                borderRadius: '16px',
                background: 'var(--color-surface)',
                boxShadow: `0 3px 0 ${error ? 'var(--color-error-dark)' : digit ? 'var(--color-primary-dark)' : '#CBD5E1'}`,
                color: 'var(--color-text)',
                outline: 'none',
                transition: 'all 150ms ease',
              }}
            />
          ))}
        </div>

        {error && (
          <p style={{
            color: 'var(--color-error)',
            textAlign: 'center',
            marginBottom: '1rem',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
          }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={digits.join('').length !== 4 || loading}
          className="btn-clay btn-clay-primary"
          style={{ width: '100%', fontSize: '1rem', padding: '12px', borderRadius: '16px' }}
        >
          {loading ? 'Ověřuji...' : 'Potvrdit'}
        </button>
      </div>
    </div>
  )
}
