import express from 'express';

const router = express.Router();

export async function updateStreak(pool, profileId, xpEarned, moduleId) {
  const today = new Date().toISOString().split('T')[0];

  const existing = await pool.query(
    'SELECT * FROM streaks WHERE profile_id = ? AND date = ?',
    [profileId, today]
  );

  if (existing.rows.length === 0) {
    const modulesArr = moduleId ? [moduleId] : [];
    await pool.query(
      `INSERT INTO streaks (profile_id, date, xp_earned, modules_practiced)
       VALUES (?, ?, ?, ?)`,
      [profileId, today, xpEarned, JSON.stringify(modulesArr)]
    );
  } else {
    const current = existing.rows[0];
    const modulesPracticed = JSON.parse(current.modules_practiced || '[]');
    if (moduleId && !modulesPracticed.includes(moduleId)) {
      modulesPracticed.push(moduleId);
    }
    await pool.query(
      `UPDATE streaks
       SET xp_earned = xp_earned + ?, modules_practiced = ?
       WHERE profile_id = ? AND date = ?`,
      [xpEarned, JSON.stringify(modulesPracticed), profileId, today]
    );
  }
}

export async function getStreakCount(pool, profileId) {
  const result = await pool.query(
    `SELECT date FROM streaks WHERE profile_id = ? ORDER BY date DESC`,
    [profileId]
  );

  if (result.rows.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let expectedDate = new Date(today);

  for (const row of result.rows) {
    const rowDate = new Date(row.date);
    rowDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((expectedDate - rowDate) / 86400000);

    if (diffDays === 0) {
      streak++;
      expectedDate = new Date(rowDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else if (diffDays === 1 && streak === 0) {
      streak++;
      expectedDate = new Date(rowDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// GET /api/streak?profile_id=X
router.get('/', async (req, res) => {
  const { profile_id } = req.query;
  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }

  try {
    const pool = req.app.locals.pool;
    const today = new Date().toISOString().split('T')[0];
    const current_streak = await getStreakCount(pool, profile_id);

    const lastActive = await pool.query(
      `SELECT date FROM streaks WHERE profile_id = ? ORDER BY date DESC LIMIT 1`,
      [profile_id]
    );
    const last_active_date = lastActive.rows.length > 0 ? lastActive.rows[0].date : null;

    const todayAnswers = await pool.query(
      `SELECT COUNT(*) as count FROM answers a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.profile_id = ? AND date(a.answered_at) = ?`,
      [profile_id, today]
    );
    const today_answers = parseInt(todayAnswers.rows[0].count, 10);

    const profileResult = await pool.query(
      `SELECT daily_goal FROM child_profiles WHERE id = ?`, [profile_id]
    );
    const daily_goal = profileResult.rows[0]?.daily_goal ?? 15;

    res.json({ current_streak, last_active_date, today_answers, daily_goal });
  } catch (err) {
    console.error('streak error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

export default router;
