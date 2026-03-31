import express from 'express';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { openDb, createPool } from './db/db.js';
import { migrate } from './db/migrations/001_init.js';
import { migrate002 } from './db/migrations/002_vslov_sentences_unique.js';
import { migrate003 } from './db/migrations/003_daily_goal.js';
import { migrate004 } from './db/migrations/004_profile_details.js';
import { migrate005 } from './db/migrations/005_sentence_category.js';
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
  migrate002(db);
  migrate003(db);
  migrate004(db);
  migrate005(db);
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

  // GET /api/sessions/recent?profile_id=X&limit=10
  app.get('/api/sessions/recent', async (req, res) => {
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
  app.get('/api/sessions/:id', async (req, res) => {
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

  // 6. Run seed
  console.log('Spouštím seed...');
  await runSeed(pool, modules);
  console.log('Seed dokončen.');

  // 7. Serve frontend static files (single-container setup)
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));
  app.get('/{*path}', (req, res) => {
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
