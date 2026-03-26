export function migrate003(db) {
  const cols = db.prepare(`PRAGMA table_info(child_profiles)`).all();
  if (cols.some(c => c.name === 'daily_goal')) return;
  db.prepare(`ALTER TABLE child_profiles ADD COLUMN daily_goal INTEGER DEFAULT 15`).run();
  console.log('Migrace 003: sloupec daily_goal přidán do child_profiles.');
}
