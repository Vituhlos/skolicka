import express from 'express'
import { updateItemProgress } from '../../core/spaced-repetition.js'
import { updateStreak, getStreakCount } from '../../core/streaks.js'
import { checkAndAwardBadges } from '../../core/badges.js'

const router = express.Router()
const MODULE_ID = 'nasobilka'

// item_id encoding: (a-1)*10 + b, values 1–100 for a,b ∈ 1..10
function encodeItemId(a, b) { return (a - 1) * 10 + b }
function decodeItemId(id) {
  return { a: Math.floor((id - 1) / 10) + 1, b: ((id - 1) % 10) + 1 }
}

function itemDifficulty(a, b) {
  const t = Math.max(a, b)
  if (t <= 2 || t === 5 || t === 10) return 1
  if (t <= 6) return 2
  return 3
}

function generateOptions(correct, a, b) {
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

async function selectItems(pool, profileId, tables, count = 15) {
  const allIds = []
  for (const a of tables) {
    for (let b = 1; b <= 10; b++) allIds.push(encodeItemId(a, b))
  }
  if (allIds.length === 0) return []

  const placeholders = allIds.map(() => '?').join(',')
  const result = await pool.query(
    `SELECT item_id, next_due_at FROM item_progress
     WHERE profile_id = ? AND module_id = ? AND item_id IN (${placeholders})`,
    [profileId, MODULE_ID, ...allIds]
  )

  const seenMap = {}
  for (const row of result.rows) seenMap[row.item_id] = row.next_due_at

  const now = new Date().toISOString()
  const overdue = [], newItems = [], future = []
  for (const id of allIds) {
    if (!seenMap[id]) newItems.push(id)
    else if (seenMap[id] <= now) overdue.push(id)
    else future.push(id)
  }

  const shuffle = arr => arr.sort(() => Math.random() - 0.5)
  return [...shuffle(overdue), ...shuffle(newItems), ...shuffle(future)].slice(0, count)
}

// POST /session/start
router.post('/session/start', async (req, res) => {
  const { profile_id, tables } = req.body
  if (!profile_id) return res.status(400).json({ error: 'Chybí profile_id.' })

  const selectedTables = Array.isArray(tables) && tables.length > 0
    ? tables.filter(t => t >= 1 && t <= 10)
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  try {
    const pool = req.app.locals.pool
    const sessionResult = await pool.query(
      `INSERT INTO sessions (profile_id, module_id, exercise_type, metadata)
       VALUES (?, ?, 'multiply', ?) RETURNING id`,
      [profile_id, MODULE_ID, JSON.stringify({ tables: selectedTables })]
    )
    const session_id = sessionResult.rows[0].id

    const itemIds = await selectItems(pool, profile_id, selectedTables)
    const items = itemIds.map(id => {
      const { a, b } = decodeItemId(id)
      const correct = a * b
      return { id, a, b, correct_answer: correct, options: generateOptions(correct, a, b), difficulty: itemDifficulty(a, b) }
    })

    res.status(201).json({ session_id, items })
  } catch (err) {
    console.error('POST nasobilka/session/start error:', err)
    res.status(500).json({ error: 'Interní chyba serveru.' })
  }
})

// POST /session/:id/answer
router.post('/session/:id/answer', async (req, res) => {
  const { id: session_id } = req.params
  const { profile_id, item_id, given_answer, response_time_ms } = req.body

  if (!profile_id || item_id === undefined || given_answer === undefined || response_time_ms === undefined) {
    return res.status(400).json({ error: 'Chybí povinné parametry.' })
  }

  try {
    const pool = req.app.locals.pool

    const sessionCheck = await pool.query(
      'SELECT id FROM sessions WHERE id = ? AND profile_id = ?',
      [session_id, profile_id]
    )
    if (sessionCheck.rows.length === 0) return res.status(404).json({ error: 'Sezení nenalezeno.' })

    const { a, b } = decodeItemId(item_id)
    const correct_answer = a * b
    const is_correct = parseInt(given_answer) === correct_answer

    await pool.query(
      `INSERT INTO answers (session_id, item_id, given_answer, is_correct, response_time_ms)
       VALUES (?, ?, ?, ?, ?)`,
      [session_id, item_id, String(given_answer), is_correct ? 1 : 0, response_time_ms]
    )

    const progressResult = await pool.query(
      `SELECT * FROM item_progress WHERE profile_id = ? AND module_id = ? AND item_id = ?`,
      [profile_id, MODULE_ID, item_id]
    )

    let progress = progressResult.rows.length === 0
      ? { profile_id: parseInt(profile_id), module_id: MODULE_ID, item_id: parseInt(item_id), times_seen: 0, times_correct: 0, interval_days: 1, ease_factor: 2.5, next_due_at: new Date().toISOString(), last_seen_at: null }
      : progressResult.rows[0]

    const updated = updateItemProgress(progress, is_correct, response_time_ms)

    await pool.query(
      `INSERT INTO item_progress (profile_id, module_id, item_id, times_seen, times_correct, interval_days, ease_factor, last_seen_at, next_due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
       ON CONFLICT (profile_id, module_id, item_id) DO UPDATE SET
         times_seen = excluded.times_seen, times_correct = excluded.times_correct,
         interval_days = excluded.interval_days, ease_factor = excluded.ease_factor,
         last_seen_at = datetime('now'), next_due_at = excluded.next_due_at`,
      [profile_id, MODULE_ID, item_id, updated.times_seen, updated.times_correct, updated.interval_days, updated.ease_factor, updated.next_due_at]
    )

    let xp_earned = 0
    if (is_correct) {
      xp_earned = response_time_ms < 4000 ? 15 : 10
      await pool.query(
        `INSERT INTO xp_log (profile_id, amount, reason, module_id) VALUES (?, ?, ?, ?)`,
        [profile_id, xp_earned, response_time_ms < 4000 ? 'fast_correct' : 'correct_answer', MODULE_ID]
      )
    }

    await updateStreak(pool, profile_id, xp_earned, MODULE_ID)

    const recentAnswers = await pool.query(
      `SELECT a.is_correct, a.response_time_ms FROM answers a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.profile_id = ? ORDER BY a.answered_at DESC LIMIT 10`,
      [profile_id]
    )
    const speed_demon = recentAnswers.rows.length >= 10 &&
      recentAnswers.rows.every(a => a.is_correct && a.response_time_ms < 4000)

    const current_streak = await getStreakCount(pool, profile_id)
    const new_badges = await checkAndAwardBadges(pool, profile_id, { module_id: MODULE_ID, streak: current_streak, speed_demon })

    res.json({ is_correct, correct_answer, xp_earned, new_badges })
  } catch (err) {
    console.error('POST nasobilka/session/:id/answer error:', err)
    res.status(500).json({ error: 'Interní chyba serveru.' })
  }
})

// POST /session/:id/end
router.post('/session/:id/end', async (req, res) => {
  const { id: session_id } = req.params
  const { profile_id } = req.body
  if (!profile_id) return res.status(400).json({ error: 'Chybí profile_id.' })

  try {
    const pool = req.app.locals.pool

    const sessionCheck = await pool.query(
      'SELECT id, started_at FROM sessions WHERE id = ? AND profile_id = ?',
      [session_id, profile_id]
    )
    if (sessionCheck.rows.length === 0) return res.status(404).json({ error: 'Sezení nenalezeno.' })
    const session = sessionCheck.rows[0]

    const answersResult = await pool.query(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct
       FROM answers WHERE session_id = ?`,
      [session_id]
    )
    const total_answers = parseInt(answersResult.rows[0].total, 10)
    const correct_answers = parseInt(answersResult.rows[0].correct, 10) || 0
    const is_perfect = total_answers > 0 && correct_answers === total_answers

    let bonus_xp = 0
    if (is_perfect) {
      bonus_xp = 50
      await pool.query(
        `INSERT INTO xp_log (profile_id, amount, reason, module_id) VALUES (?, ?, 'perfect_session', ?)`,
        [profile_id, bonus_xp, MODULE_ID]
      )
      await updateStreak(pool, profile_id, bonus_xp, MODULE_ID)
    }

    const duration_seconds = Math.round((new Date() - new Date(session.started_at)) / 1000)

    await pool.query(
      `UPDATE sessions SET ended_at = datetime('now'), total_answers = ?, correct_answers = ? WHERE id = ?`,
      [total_answers, correct_answers, session_id]
    )

    const xpResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as xp_total FROM xp_log
       WHERE profile_id = ? AND module_id = ? AND created_at >= ?`,
      [profile_id, MODULE_ID, session.started_at]
    )
    const xp_total = parseInt(xpResult.rows[0].xp_total, 10)

    const current_streak = await getStreakCount(pool, profile_id)
    const new_badges = await checkAndAwardBadges(pool, profile_id, { module_id: MODULE_ID, streak: current_streak, perfect_session: is_perfect })

    res.json({ total_answers, correct_answers, xp_total, new_badges, duration_seconds })
  } catch (err) {
    console.error('POST nasobilka/session/:id/end error:', err)
    res.status(500).json({ error: 'Interní chyba serveru.' })
  }
})

// GET /table-progress?profile_id=X
router.get('/table-progress', async (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'Chybí profile_id.' })

  try {
    const pool = req.app.locals.pool
    const result = await pool.query(
      `SELECT item_id, times_seen, times_correct FROM item_progress
       WHERE profile_id = ? AND module_id = ?`,
      [profile_id, MODULE_ID]
    )

    const tables = {}
    for (let a = 1; a <= 10; a++) tables[a] = { table: a, seen: 0, total: 10, total_correct: 0, total_seen: 0 }

    for (const row of result.rows) {
      const { a } = decodeItemId(row.item_id)
      if (tables[a]) {
        tables[a].seen++
        tables[a].total_correct += parseInt(row.times_correct, 10) || 0
        tables[a].total_seen += parseInt(row.times_seen, 10) || 0
      }
    }

    res.json(Object.values(tables))
  } catch (err) {
    console.error('GET nasobilka/table-progress error:', err)
    res.status(500).json({ error: 'Interní chyba serveru.' })
  }
})

export default router
