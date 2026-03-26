export function migrate004(db) {
  const cols = db.prepare(`PRAGMA table_info(child_profiles)`).all();

  if (!cols.some((col) => col.name === 'school_class')) {
    db.prepare(`ALTER TABLE child_profiles ADD COLUMN school_class TEXT`).run();
  }

  if (!cols.some((col) => col.name === 'parent_note')) {
    db.prepare(`ALTER TABLE child_profiles ADD COLUMN parent_note TEXT DEFAULT ''`).run();
  }

  if (!cols.some((col) => col.name === 'avatar_preset')) {
    db.prepare(`ALTER TABLE child_profiles ADD COLUMN avatar_preset TEXT`).run();
  }

  if (!cols.some((col) => col.name === 'is_paused')) {
    db.prepare(`ALTER TABLE child_profiles ADD COLUMN is_paused INTEGER DEFAULT 0`).run();
  }

  console.log('Migrace 004: doplněny detaily profilů.');
}
