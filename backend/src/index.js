import express from 'express';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { openDb, createPool } from './db/db.js';
import { migrate } from './db/migrations/001_init.js';
import { runSeed } from './db/seed.js';
import profilesRouter from './core/profiles.js';
import authRouter from './core/auth.js';
import streakRouter from './core/streaks.js';
import badgesRouter from './core/badges.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadModules() {
  const pattern = path.join(__dirname, 'modules/*/index.js').replace(/\\/g, '/');
  const files = await glob(pattern);
  const modules = [];

  for (const file of files) {
    try {
      const fileUrl = pathToFileURL(file).href;
      const mod = await import(fileUrl);
      modules.push(mod);
      console.log(`Modul načten: ${mod.default.name}`);
    } catch (err) {
      console.error(`Chyba při načítání modulu ${file}:`, err.message);
    }
  }

  return modules;
}

async function main() {
  // 1. Open SQLite database
  const db = openDb();
  const pool = createPool(db);
  console.log('SQLite databáze otevřena.');

  // 2. Run migrations
  console.log('Spouštím migrace...');
  migrate(db);
  console.log('Migrace dokončeny.');

  // 3. Create Express app
  const app = express();

  app.use(express.json());

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Static files — uploads (avatars)
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

  // Share pool with routes
  app.locals.pool = pool;

  // 4. Auto-discovery of modules
  const modules = await loadModules();

  // 5. Register module routes
  for (const mod of modules) {
    if (typeof mod.default.registerRoutes === 'function') {
      await mod.default.registerRoutes(app);
    }
  }

  // Core routes
  app.use('/api/auth', authRouter);
  app.use('/api/profiles', profilesRouter);
  app.use('/api/streak', streakRouter);
  app.use('/api/badges', badgesRouter);

  // GET /api/health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // GET /api/modules
  app.get('/api/modules', (req, res) => {
    const moduleList = modules.map(mod => ({
      id: mod.default.id,
      name: mod.default.name,
      description: mod.default.description,
      icon: mod.default.icon,
      color: mod.default.color,
      exerciseTypes: mod.default.exerciseTypes
    }));
    res.json(moduleList);
  });

  // GET /api/stats/overview?profile_id=X
  app.get('/api/stats/overview', async (req, res) => {
    const { profile_id } = req.query;
    if (!profile_id) {
      return res.status(400).json({ error: 'Chybí profile_id.' });
    }
    try {
      const { getStreakCount } = await import('./core/streaks.js');

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
  app.get('/api/stats/timeline', async (req, res) => {
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
  app.get('/api/stats/by-module', async (req, res) => {
    const { profile_id } = req.query;
    if (!profile_id) {
      return res.status(400).json({ error: 'Chybí profile_id.' });
    }
    try {
      const result = await pool.query(
        `SELECT
           s.module_id,
           COUNT(DISTINCT s.id) as session_count,
           COUNT(a.id) as total_answers,
           SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
           COALESCE(SUM(x.amount), 0) as total_xp
         FROM sessions s
         LEFT JOIN answers a ON a.session_id = s.id
         LEFT JOIN xp_log x ON x.profile_id = s.profile_id AND x.module_id = s.module_id
         WHERE s.profile_id = ?
         GROUP BY s.module_id
         ORDER BY total_xp DESC`,
        [profile_id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('stats/by-module error:', err);
      res.status(500).json({ error: 'Interní chyba serveru.' });
    }
  });

  // GET /api/xp?profile_id=X
  app.get('/api/xp', async (req, res) => {
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

  // 6. Run seed
  console.log('Spouštím seed...');
  await runSeed(pool, modules);
  console.log('Seed dokončen.');

  // 7. Serve frontend static files (single-container setup)
  const publicDir = path.join(__dirname, '../../public');
  app.use(express.static(publicDir));
  app.get('(.*)', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Interní chyba serveru.' });
  });

  // 8. Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server běží na portu ${PORT}`);
  });
}

main().catch(err => {
  console.error('Fatální chyba při spuštění:', err);
  process.exit(1);
});
