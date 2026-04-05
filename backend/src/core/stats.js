import express from 'express';
import { getStreakCount } from './streaks.js';

const router = express.Router();
const xpRouter = express.Router();

// GET /api/stats/overview?profile_id=X
router.get('/overview', async (req, res) => {
  const pool = req.app.locals.pool;
  const { profile_id } = req.query;
  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }
  try {
    const xpResult = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total_xp FROM xp_log WHERE profile_id = ?',
      [profile_id]
    );

    const daysResult = await pool.query(
      'SELECT COUNT(DISTINCT date) as days_practiced FROM streaks WHERE profile_id = ?',
      [profile_id]
    );

    const answersResult = await pool.query(
      `SELECT COUNT(*) as total_answers,
              SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers
       FROM answers a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.profile_id = ?`,
      [profile_id]
    );

    const current_streak = await getStreakCount(pool, profile_id);

    res.json({
      total_xp: parseInt(xpResult.rows[0].total_xp, 10),
      current_streak,
      days_practiced: parseInt(daysResult.rows[0].days_practiced, 10),
      total_answers: parseInt(answersResult.rows[0].total_answers, 10) || 0,
      correct_answers: parseInt(answersResult.rows[0].correct_answers, 10) || 0
    });
  } catch (err) {
    console.error('stats/overview error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// GET /api/stats/timeline?profile_id=X&days=30
router.get('/timeline', async (req, res) => {
  const pool = req.app.locals.pool;
  const { profile_id, days = 30 } = req.query;
  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }
  try {
    const daysBack = parseInt(days, 10) - 1;
    const result = await pool.query(
      `SELECT s.date,
              s.xp_earned,
              COALESCE(ans.answer_count, 0) as answer_count
       FROM streaks s
       LEFT JOIN (
         SELECT date(a.answered_at) as date, COUNT(*) as answer_count
         FROM answers a
         JOIN sessions sess ON a.session_id = sess.id
         WHERE sess.profile_id = ?
         GROUP BY date(a.answered_at)
       ) ans ON ans.date = s.date
       WHERE s.profile_id = ?
         AND s.date >= date('now', '-' || ? || ' days')
       ORDER BY s.date DESC`,
      [profile_id, profile_id, daysBack]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('stats/timeline error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// GET /api/stats/by-module?profile_id=X
router.get('/by-module', async (req, res) => {
  const pool = req.app.locals.pool;
  const { profile_id } = req.query;
  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }
  try {
    const result = await pool.query(
      `SELECT
         modules.module_id,
         COALESCE(session_stats.session_count, 0) as session_count,
         COALESCE(answer_stats.total_answers, 0) as total_answers,
         COALESCE(answer_stats.correct_answers, 0) as correct_answers,
         COALESCE(xp_stats.total_xp, 0) as total_xp
       FROM (
         SELECT DISTINCT module_id
         FROM sessions
         WHERE profile_id = ?
       ) modules
       LEFT JOIN (
         SELECT module_id, COUNT(*) as session_count
         FROM sessions
         WHERE profile_id = ?
         GROUP BY module_id
       ) session_stats ON session_stats.module_id = modules.module_id
       LEFT JOIN (
         SELECT s.module_id,
                COUNT(a.id) as total_answers,
                SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers
         FROM sessions s
         LEFT JOIN answers a ON a.session_id = s.id
         WHERE s.profile_id = ?
         GROUP BY s.module_id
       ) answer_stats ON answer_stats.module_id = modules.module_id
       LEFT JOIN (
         SELECT module_id, SUM(amount) as total_xp
         FROM xp_log
         WHERE profile_id = ?
         GROUP BY module_id
       ) xp_stats ON xp_stats.module_id = modules.module_id
       ORDER BY total_xp DESC`,
      [profile_id, profile_id, profile_id, profile_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('stats/by-module error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// GET /api/xp?profile_id=X
xpRouter.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const { profile_id } = req.query;
  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }
  try {
    const result = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total_xp FROM xp_log WHERE profile_id = ?',
      [profile_id]
    );
    const total_xp = parseInt(result.rows[0].total_xp, 10);
    const XP_PER_LEVEL = 500;
    const level = Math.floor(total_xp / XP_PER_LEVEL) + 1;
    const xp_to_next_level = XP_PER_LEVEL - (total_xp % XP_PER_LEVEL);
    res.json({ total_xp, level, xp_to_next_level });
  } catch (err) {
    console.error('xp error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

export { xpRouter };
export default router;
