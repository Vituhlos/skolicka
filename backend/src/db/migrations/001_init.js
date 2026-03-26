export function migrate(db) {
  db.transaction(() => {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS child_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        avatar_url TEXT,
        color TEXT DEFAULT '#2563EB',
        created_at TEXT DEFAULT (datetime('now')),
        is_active INTEGER DEFAULT 1
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER REFERENCES child_profiles(id),
        module_id TEXT,
        exercise_type TEXT,
        started_at TEXT DEFAULT (datetime('now')),
        ended_at TEXT,
        total_answers INTEGER DEFAULT 0,
        correct_answers INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}'
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER REFERENCES sessions(id),
        item_id INTEGER,
        given_answer TEXT,
        is_correct INTEGER,
        response_time_ms INTEGER,
        answered_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS item_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER REFERENCES child_profiles(id),
        module_id TEXT,
        item_id INTEGER,
        times_seen INTEGER DEFAULT 0,
        times_correct INTEGER DEFAULT 0,
        interval_days INTEGER DEFAULT 1,
        ease_factor REAL DEFAULT 2.5,
        last_seen_at TEXT,
        next_due_at TEXT DEFAULT (datetime('now')),
        UNIQUE(profile_id, module_id, item_id)
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS streaks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER REFERENCES child_profiles(id),
        date TEXT,
        xp_earned INTEGER DEFAULT 0,
        modules_practiced TEXT DEFAULT '[]',
        UNIQUE(profile_id, date)
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER REFERENCES child_profiles(id),
        badge_key TEXT NOT NULL,
        module_id TEXT,
        name TEXT,
        description TEXT,
        icon TEXT,
        earned_at TEXT DEFAULT (datetime('now')),
        UNIQUE(profile_id, badge_key)
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS xp_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER REFERENCES child_profiles(id),
        amount INTEGER,
        reason TEXT,
        module_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS vslov_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        letter TEXT,
        word TEXT,
        UNIQUE(letter, word)
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS vslov_sentences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER REFERENCES vslov_words(id),
        template TEXT,
        correct_answer TEXT,
        display_word TEXT,
        difficulty INTEGER DEFAULT 1
      )
    `).run();
  })();

  console.log('Migrace 001_init dokončena.');
}
