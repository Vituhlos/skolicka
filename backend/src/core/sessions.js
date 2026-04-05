import express from 'express';

const router = express.Router();

// GET /api/sessions/recent?profile_id=X&limit=10
router.get('/recent', async (req, res) => {
  const pool = req.app.locals.pool;
  const { profile_id, module_id } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 200);
  if (!profile_id) return res.status(400).json({ error: 'Chybí profile_id.' });
  try {
    const filters = ['s.profile_id = ?'];
    const values = [profile_id];

    if (module_id) {
      filters.push('s.module_id = ?');
      values.push(module_id);
    }

    values.push(limit);

    const result = await pool.query(
      `SELECT s.id, s.module_id, s.started_at, s.ended_at,
              COUNT(a.id) as total_answers,
              SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
              COALESCE(
                ROUND((julianday(COALESCE(s.ended_at, datetime('now'))) - julianday(s.started_at)) * 24 * 60),
                0
              ) as duration_minutes
       FROM sessions s
       LEFT JOIN answers a ON a.session_id = s.id
       WHERE ${filters.join(' AND ')}
       GROUP BY s.id
       ORDER BY s.started_at DESC
       LIMIT ?`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error('sessions/recent error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// GET /api/sessions/:id?profile_id=X
router.get('/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { profile_id } = req.query;
  if (!profile_id) return res.status(400).json({ error: 'Chybí profile_id.' });

  try {
    const sessionResult = await pool.query(
      `SELECT s.id, s.module_id, s.started_at, s.ended_at,
              COUNT(a.id) as total_answers,
              SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
              COALESCE(
                ROUND((julianday(COALESCE(s.ended_at, datetime('now'))) - julianday(s.started_at)) * 24 * 60),
                0
              ) as duration_minutes
       FROM sessions s
       LEFT JOIN answers a ON a.session_id = s.id
       WHERE s.id = ? AND s.profile_id = ?
       GROUP BY s.id`,
      [id, profile_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sezení nenalezeno.' });
    }

    const session = sessionResult.rows[0];
    let answers = [];

    if (session.module_id === 'vyjmenovana-slova') {
      const answersResult = await pool.query(
        `SELECT a.id, a.item_id, a.given_answer, a.is_correct, a.response_time_ms, a.answered_at,
                vs.template, vs.correct_answer, vs.display_word, vw.letter
         FROM answers a
         LEFT JOIN vslov_sentences vs ON vs.id = a.item_id
         LEFT JOIN vslov_words vw ON vw.id = vs.word_id
         WHERE a.session_id = ?
         ORDER BY a.answered_at ASC, a.id ASC`,
        [id]
      );
      answers = answersResult.rows;
    } else {
      const answersResult = await pool.query(
        `SELECT id, item_id, given_answer, is_correct, response_time_ms, answered_at
         FROM answers
         WHERE session_id = ?
         ORDER BY answered_at ASC, id ASC`,
        [id]
      );
      answers = answersResult.rows;
    }

    res.json({ ...session, answers });
  } catch (err) {
    console.error('sessions/:id error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

export default router;
