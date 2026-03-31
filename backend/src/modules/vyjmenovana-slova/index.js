import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadRoutes() {
  const { default: router } = await import('./routes.js');
  return router;
}

async function seed(pool) {
  const seedPath = path.join(__dirname, 'seed.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  const wordMap = {};
  for (const item of seedData) {
    const key = `${item.letter}:${item.word}`;
    if (!wordMap[key]) {
      wordMap[key] = { letter: item.letter, word: item.word, sentences: [] };
    }
    wordMap[key].sentences.push({
      template: item.template,
      correct_answer: item.correct_answer,
      display_word: item.display_word,
      difficulty: item.difficulty,
      category: item.category || null,
    });
  }

  let added = 0;
  for (const { letter, word, sentences } of Object.values(wordMap)) {
    await pool.query(
      `INSERT OR IGNORE INTO vslov_words (letter, word) VALUES (?, ?)`,
      [letter, word]
    );

    const wordResult = await pool.query(
      'SELECT id FROM vslov_words WHERE letter = ? AND word = ?',
      [letter, word]
    );
    const wordId = wordResult.rows[0].id;

    for (const s of sentences) {
      const result = await pool.query(
        `INSERT OR IGNORE INTO vslov_sentences (word_id, template, correct_answer, display_word, difficulty, category)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [wordId, s.template, s.correct_answer, s.display_word, s.difficulty, s.category]
      );
      if (result.rowCount > 0) added++;
    }
  }

  if (added > 0) {
    console.log(`Seed vyjmenovana-slova: přidáno ${added} nových vět.`);
  } else {
    console.log('Seed vyjmenovana-slova: žádné nové věty.');
  }
}

export default {
  id: 'vyjmenovana-slova',
  name: 'Vyjmenovaná slova',
  description: 'Procvičuj i a y ve větách',
  icon: 'BookOpen',
  color: '#F97316',
  exerciseTypes: ['fill-in'],
  registerRoutes: async (app) => {
    const router = await loadRoutes();
    app.use('/api/modules/vyjmenovana-slova', router);
  },
  seed
};
