import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requirePin, optionalPin } from './auth.js';
import { getStreakCount } from './streaks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.params.id}.jpg`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Povoleny jsou pouze JPG a PNG soubory.'));
    }
  }
});

// GET /api/profiles
// Bez tokenu: vrátí jen data potřebná pro výběr profilu dítětem (bez school_class, parent_note)
// S platným rodičovským tokenem: vrátí vše
router.get('/', optionalPin, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const isParent = !!req.user;

    const result = await pool.query(
      `SELECT p.id, p.name, p.avatar_url, p.avatar_preset, p.color, p.created_at, p.daily_goal,
              p.school_class, p.parent_note, p.is_paused,
              COALESCE(SUM(x.amount), 0) as total_xp
       FROM child_profiles p
       LEFT JOIN xp_log x ON x.profile_id = p.id
       WHERE p.is_active = 1
       GROUP BY p.id
       ORDER BY p.sort_order ASC, p.id ASC`
    );

    const profiles = await Promise.all(result.rows.map(async (p) => {
      const current_streak = await getStreakCount(pool, p.id);
      const lastActiveResult = await pool.query(
        `SELECT date FROM streaks WHERE profile_id = ? ORDER BY date DESC LIMIT 1`,
        [p.id]
      );
      const last_active_date = lastActiveResult.rows[0]?.date || null;

      const base = {
        id: p.id,
        name: p.name,
        avatar_url: p.avatar_url,
        avatar_preset: p.avatar_preset,
        color: p.color,
        is_paused: p.is_paused,
        daily_goal: p.daily_goal,
        current_streak,
        last_active_date,
        total_xp: parseInt(p.total_xp, 10),
      };

      if (isParent) {
        base.created_at = p.created_at;
        base.school_class = p.school_class;
        base.parent_note = p.parent_note;
      }

      return base;
    }));

    res.json(profiles);
  } catch (err) {
    console.error('GET /api/profiles error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// POST /api/profiles
router.post('/', requirePin, async (req, res) => {
  try {
    const { name, color, daily_goal, school_class, parent_note, avatar_preset, is_paused } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Jméno je povinné.' });
    }
    if (name.trim().length > 50) {
      return res.status(400).json({ error: 'Jméno je příliš dlouhé (max 50 znaků).' });
    }

    const goal = daily_goal === undefined ? 15 : parseInt(daily_goal, 10);
    if (Number.isNaN(goal) || goal < 5 || goal > 200) {
      return res.status(400).json({ error: 'Denní cíl musí být 5–200.' });
    }

    const normalizedClass = school_class ? String(school_class).trim().slice(0, 30) : null;
    const normalizedNote = parent_note ? String(parent_note).trim().slice(0, 300) : '';
    const normalizedPreset = avatar_preset ? String(avatar_preset).trim().slice(0, 20) : null;
    const pausedFlag = is_paused ? 1 : 0;

    const pool = req.app.locals.pool;
    const result = await pool.query(
      `INSERT INTO child_profiles (name, color, daily_goal, school_class, parent_note, avatar_preset, is_paused)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id, name, avatar_url, avatar_preset, color, created_at, daily_goal, school_class, parent_note, is_paused`,
      [name.trim(), color || '#2563EB', goal, normalizedClass, normalizedNote, normalizedPreset, pausedFlag]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/profiles error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// PUT /api/profiles/:id
router.put('/:id', requirePin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, daily_goal, school_class, parent_note, avatar_preset, is_paused } = req.body;
    const pool = req.app.locals.pool;

    const existing = await pool.query(
      'SELECT id FROM child_profiles WHERE id = ? AND is_active = 1',
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Profil nenalezen.' });
    }

    const setClauses = [];
    const values = [];

    if (name !== undefined) {
      if (name.trim().length === 0) return res.status(400).json({ error: 'Jméno je povinné.' });
      if (name.trim().length > 50) return res.status(400).json({ error: 'Jméno je příliš dlouhé.' });
      setClauses.push('name = ?');
      values.push(name.trim());
    }
    if (color !== undefined) {
      setClauses.push('color = ?');
      values.push(color);
    }
    if (daily_goal !== undefined) {
      const goal = parseInt(daily_goal, 10);
      if (isNaN(goal) || goal < 5 || goal > 200) return res.status(400).json({ error: 'Denní cíl musí být 5–200.' });
      setClauses.push('daily_goal = ?');
      values.push(goal);
    }
    if (school_class !== undefined) {
      setClauses.push('school_class = ?');
      values.push(school_class ? String(school_class).trim().slice(0, 30) : null);
    }
    if (parent_note !== undefined) {
      setClauses.push('parent_note = ?');
      values.push(parent_note ? String(parent_note).trim().slice(0, 300) : '');
    }
    if (avatar_preset !== undefined) {
      setClauses.push('avatar_preset = ?');
      values.push(avatar_preset ? String(avatar_preset).trim().slice(0, 20) : null);
      if (avatar_preset) {
        setClauses.push('avatar_url = NULL');
      }
    }
    if (is_paused !== undefined) {
      setClauses.push('is_paused = ?');
      values.push(is_paused ? 1 : 0);
    }

    const { sort_order } = req.body;
    if (sort_order !== undefined) {
      const order = parseInt(sort_order, 10);
      if (!isNaN(order)) {
        setClauses.push('sort_order = ?');
        values.push(order);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Žádná data k aktualizaci.' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE child_profiles SET ${setClauses.join(', ')} WHERE id = ?
       RETURNING id, name, avatar_url, avatar_preset, color, created_at, daily_goal, school_class, parent_note, is_paused`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/profiles/:id error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// DELETE /api/profiles/:id
router.delete('/:id', requirePin, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `UPDATE child_profiles SET is_active = 0 WHERE id = ? AND is_active = 1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profil nenalezen.' });
    }

    res.json({ message: 'Profil byl deaktivován.' });
  } catch (err) {
    console.error('DELETE /api/profiles/:id error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// POST /api/profiles/:id/avatar
router.post('/:id/avatar', requirePin, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Žádný soubor nebyl nahrán.' });
    }

    try {
      const { id } = req.params;
      const pool = req.app.locals.pool;
      const avatarUrl = `/uploads/avatars/${id}.jpg`;

      await pool.query(
        'UPDATE child_profiles SET avatar_url = ?, avatar_preset = NULL WHERE id = ?',
        [avatarUrl, id]
      );

      res.json({ avatar_url: avatarUrl });
    } catch (dbErr) {
      console.error('Avatar upload DB error:', dbErr);
      res.status(500).json({ error: 'Interní chyba serveru.' });
    }
  });
});

// GET /api/profiles/:id/avatar
router.get('/:id/avatar', (req, res) => {
  const { id } = req.params;
  const avatarPath = path.join(__dirname, '../../uploads/avatars', `${id}.jpg`);

  if (!fs.existsSync(avatarPath)) {
    return res.status(404).json({ error: 'Avatar nenalezen.' });
  }

  res.sendFile(avatarPath);
});

export default router;
