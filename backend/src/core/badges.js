import express from 'express';

const router = express.Router();

const BADGE_DEFINITIONS = [
  {
    key: 'first_correct',
    name: 'První správná',
    description: 'Odpověděl jsi správně poprvé!',
    icon: '⭐',
    check: async (pool, profileId, context) => {
      const r = await pool.query(
        `SELECT COUNT(*) as count FROM answers a
         JOIN sessions s ON a.session_id = s.id
         WHERE s.profile_id = ? AND a.is_correct = 1`,
        [profileId]
      );
      return parseInt(r.rows[0].count, 10) >= 1;
    }
  },
  {
    key: 'streak_3',
    name: 'Tři dny v řadě',
    description: 'Procvičoval jsi 3 dny po sobě!',
    icon: '🔥',
    check: async (pool, profileId, context) => context.streak >= 3
  },
  {
    key: 'streak_7',
    name: 'Týden v řadě',
    description: 'Procvičoval jsi 7 dní po sobě!',
    icon: '🔥',
    check: async (pool, profileId, context) => context.streak >= 7
  },
  {
    key: 'streak_30',
    name: 'Měsíc v řadě',
    description: 'Procvičoval jsi 30 dní po sobě!',
    icon: '🏆',
    check: async (pool, profileId, context) => context.streak >= 30
  },
  {
    key: 'answers_100',
    name: '100 odpovědí',
    description: 'Odpověděl jsi celkem 100krát správně!',
    icon: '💯',
    check: async (pool, profileId, context) => {
      const r = await pool.query(
        `SELECT COUNT(*) as count FROM answers a
         JOIN sessions s ON a.session_id = s.id
         WHERE s.profile_id = ? AND a.is_correct = 1`,
        [profileId]
      );
      return parseInt(r.rows[0].count, 10) >= 100;
    }
  },
  {
    key: 'answers_500',
    name: '500 odpovědí',
    description: 'Odpověděl jsi celkem 500krát správně!',
    icon: '🌟',
    check: async (pool, profileId, context) => {
      const r = await pool.query(
        `SELECT COUNT(*) as count FROM answers a
         JOIN sessions s ON a.session_id = s.id
         WHERE s.profile_id = ? AND a.is_correct = 1`,
        [profileId]
      );
      return parseInt(r.rows[0].count, 10) >= 500;
    }
  },
  {
    key: 'perfect_session',
    name: 'Dokonalé sezení',
    description: 'Dokončil jsi sezení bez jediné chyby!',
    icon: '✨',
    check: async (pool, profileId, context) => context.perfect_session === true
  },
  {
    key: 'speed_demon',
    name: 'Rychlík',
    description: '10 správných odpovědí pod 3 sekundy za sebou!',
    icon: '⚡',
    check: async (pool, profileId, context) => context.speed_demon === true
  },
  {
    key: 'multi_module',
    name: 'Vícemodulový žák',
    description: 'Byl jsi aktivní ve 2 a více modulech!',
    icon: '📚',
    check: async (pool, profileId, context) => {
      const r = await pool.query(
        `SELECT COUNT(DISTINCT module_id) as count FROM sessions
         WHERE profile_id = ? AND ended_at IS NOT NULL`,
        [profileId]
      );
      return parseInt(r.rows[0].count, 10) >= 2;
    }
  }
];

export async function checkAndAwardBadges(pool, profileId, context = {}) {
  const newBadges = [];

  const earnedResult = await pool.query(
    `SELECT badge_key FROM badges WHERE profile_id = ?`,
    [profileId]
  );
  const earnedKeys = new Set(earnedResult.rows.map(r => r.badge_key));

  for (const badge of BADGE_DEFINITIONS) {
    if (earnedKeys.has(badge.key)) continue;
    try {
      const shouldAward = await badge.check(pool, profileId, context);
      if (shouldAward) {
        await pool.query(
          `INSERT OR IGNORE INTO badges (profile_id, badge_key, module_id, name, description, icon)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [profileId, badge.key, context.module_id || null, badge.name, badge.description, badge.icon]
        );
        newBadges.push({ key: badge.key, name: badge.name, description: badge.description, icon: badge.icon });
      }
    } catch (err) {
      console.error(`Chyba při kontrole odznaku ${badge.key}:`, err.message);
    }
  }

  return newBadges;
}

// GET /api/badges?profile_id=X
router.get('/', async (req, res) => {
  const { profile_id } = req.query;
  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }

  try {
    const pool = req.app.locals.pool;

    const earnedResult = await pool.query(
      `SELECT badge_key, name, description, icon, earned_at, module_id
       FROM badges WHERE profile_id = ? ORDER BY earned_at DESC`,
      [profile_id]
    );
    const earnedKeys = new Set(earnedResult.rows.map(r => r.badge_key));

    const earned = earnedResult.rows.map(r => ({
      key: r.badge_key,
      name: r.name,
      description: r.description,
      icon: r.icon,
      earned_at: r.earned_at,
      module_id: r.module_id,
      locked: false
    }));

    const locked = BADGE_DEFINITIONS
      .filter(b => !earnedKeys.has(b.key))
      .map(b => ({ key: b.key, name: b.name, description: b.description, icon: b.icon, locked: true }));

    res.json({ earned, locked });
  } catch (err) {
    console.error('badges error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

export default router;
