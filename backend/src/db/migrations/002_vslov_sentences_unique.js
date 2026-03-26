export function migrate002(db) {
  // Check if unique constraint already exists
  const tableInfo = db.prepare(`PRAGMA index_list(vslov_sentences)`).all();
  const hasUnique = tableInfo.some(idx => idx.unique && idx.name.includes('word_id_template'));
  if (hasUnique) return;

  // SQLite doesn't support ADD CONSTRAINT — recreate the table
  db.transaction(() => {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS vslov_sentences_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER REFERENCES vslov_words(id),
        template TEXT,
        correct_answer TEXT,
        display_word TEXT,
        difficulty INTEGER DEFAULT 1,
        UNIQUE (word_id, template)
      )
    `).run();

    // Copy existing data; skip duplicates if any
    db.prepare(`
      INSERT OR IGNORE INTO vslov_sentences_new (id, word_id, template, correct_answer, display_word, difficulty)
      SELECT id, word_id, template, correct_answer, display_word, difficulty FROM vslov_sentences
    `).run();

    db.prepare(`DROP TABLE vslov_sentences`).run();
    db.prepare(`ALTER TABLE vslov_sentences_new RENAME TO vslov_sentences`).run();
  })();

  console.log('Migrace 002: UNIQUE constraint na vslov_sentences přidán.');
}
