let _ctx = null

function getCtx() {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new AudioContext()
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume()
  }
  return _ctx
}

function playTone(frequency, duration, type = 'sine', volume = 0.28, startTime = 0) {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + startTime)
  gain.gain.setValueAtTime(volume, ctx.currentTime + startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration)
  osc.start(ctx.currentTime + startTime)
  osc.stop(ctx.currentTime + startTime + duration)
}

export function playCorrect() {
  try {
    // Veselé dvoutónové ding: C5 → E5
    playTone(523, 0.12, 'sine', 0.28, 0)
    playTone(659, 0.22, 'sine', 0.24, 0.1)
  } catch (e) {}
}

export function playWrong() {
  try {
    // Jemný sestupný tón: G4 → E4 — čitelně "špatně", ale ne drsně
    playTone(392, 0.14, 'sine', 0.22, 0)
    playTone(330, 0.28, 'sine', 0.18, 0.12)
  } catch (e) {}
}

export function playBossDefeated() {
  try {
    // Fanfára: C5 → E5 → G5 → C6
    playTone(523, 0.14, 'sine', 0.3, 0)
    playTone(659, 0.14, 'sine', 0.3, 0.14)
    playTone(784, 0.14, 'sine', 0.3, 0.28)
    playTone(1047, 0.5, 'sine', 0.32, 0.42)
  } catch (e) {}
}

export function isSoundEnabled() {
  return localStorage.getItem('sound_enabled') !== 'false'
}

export function toggleSound() {
  const enabled = !isSoundEnabled()
  localStorage.setItem('sound_enabled', String(enabled))
  return enabled
}
