export function migrate005(db) {
  const cols = db.prepare(`PRAGMA table_info(vslov_sentences)`).all();

  if (!cols.some((col) => col.name === 'category')) {
    db.prepare(`ALTER TABLE vslov_sentences ADD COLUMN category TEXT`).run();
    console.log('Migrace 005: přidán sloupec category do vslov_sentences.');
  } else {
    console.log('Migrace 005: category již existuje, přeskakuji.');
  }
}
