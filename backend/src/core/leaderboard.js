import express from 'express';
import { getStreakCount } from './streaks.js';

const router = express.Router();

// GET /api/leaderboard
router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const profilesResult = await pool.query(
      `SELECT p.id, p.name, p.avatar_preset,
              COALESCE(SUM(x.amount), 0) as total_xp
       FROM child_profiles p
       LEFT JOIN xp_log x ON x.profile_id = p.id
       WHERE p.is_active = 1 AND p.is_paused = 0
       GROUP BY p.id
       ORDER BY total_xp DESC`
    );

    const leaderboard = await Promise.all(profilesResult.rows.map(async (p) => {
      const current_streak = await getStreakCount(pool, p.id);
      const daysResult = await pool.query(
        'SELECT COUNT(DISTINCT date) as days_practiced FROM streaks WHERE profile_id = ?',
        [p.id]
      );
      return {
        id: p.id,
        name: p.name,
        avatar_preset: p.avatar_preset,
        total_xp: parseInt(p.total_xp, 10),
        current_streak,
        days_practiced: parseInt(daysResult.rows[0].days_practiced, 10),
      };
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('leaderboard error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

export default router;
