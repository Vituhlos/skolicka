export function migrate006(db) {
  const cols = db.prepare(`PRAGMA table_info(child_profiles)`).all();

  if (!cols.some((col) => col.name === 'sort_order')) {
    db.prepare(`ALTER TABLE child_profiles ADD COLUMN sort_order INTEGER DEFAULT 0`).run();
    console.log('Migrace 006: přidán sloupec sort_order do child_profiles.');
  } else {
    console.log('Migrace 006: sort_order již existuje, přeskakuji.');
  }
}
