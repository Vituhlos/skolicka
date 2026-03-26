import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requirePin } from './auth.js';
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
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT p.id, p.name, p.avatar_url, p.color, p.created_at,
              COALESCE(SUM(x.amount), 0) as total_xp
       FROM child_profiles p
       LEFT JOIN xp_log x ON x.profile_id = p.id
       WHERE p.is_active = 1
       GROUP BY p.id
       ORDER BY p.created_at ASC`
    );

    const profiles = await Promise.all(result.rows.map(async (p) => {
      const current_streak = await getStreakCount(pool, p.id);
      return { ...p, current_streak, total_xp: parseInt(p.total_xp, 10) };
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
    const { name, color } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Jméno je povinné.' });
    }
    if (name.trim().length > 50) {
      return res.status(400).json({ error: 'Jméno je příliš dlouhé (max 50 znaků).' });
    }

    const pool = req.app.locals.pool;
    const result = await pool.query(
      `INSERT INTO child_profiles (name, color)
       VALUES (?, ?)
       RETURNING id, name, avatar_url, color, created_at`,
      [name.trim(), color || '#2563EB']
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
    const { name, color } = req.body;
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

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Žádná data k aktualizaci.' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE child_profiles SET ${setClauses.join(', ')} WHERE id = ?
       RETURNING id, name, avatar_url, color, created_at`,
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
        'UPDATE child_profiles SET avatar_url = ? WHERE id = ?',
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
