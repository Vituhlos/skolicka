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
import { migrate006 } from './db/migrations/006_profile_sort_order.js';
import { runSeed } from './db/seed.js';
import profilesRouter from './core/profiles.js';
import authRouter from './core/auth.js';
import streakRouter from './core/streaks.js';
import badgesRouter from './core/badges.js';
import statsRouter, { xpRouter } from './core/stats.js';
import sessionsRouter from './core/sessions.js';
import leaderboardRouter from './core/leaderboard.js';

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
  migrate006(db);
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
  app.use('/api/stats', statsRouter);
  app.use('/api/xp', xpRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/leaderboard', leaderboardRouter);

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
