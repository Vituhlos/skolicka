import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadRoutes() {
  const { default: router } = await import('./routes.js');
  return router;
}

async function seed(pool) {
  const check = await pool.query('SELECT COUNT(*) as count FROM vslov_sentences');
  if (parseInt(check.rows[0].count, 10) > 0) {
    console.log('Seed vyjmenovana-slova: data již existují, přeskakuji.');
    return;
  }

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
      difficulty: item.difficulty
    });
  }

  for (const { letter, word, sentences } of Object.values(wordMap)) {
    // Insert word (ignore if already exists)
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
      await pool.query(
        `INSERT INTO vslov_sentences (word_id, template, correct_answer, display_word, difficulty)
         VALUES (?, ?, ?, ?, ?)`,
        [wordId, s.template, s.correct_answer, s.display_word, s.difficulty]
      );
    }
  }

  console.log('Seed vyjmenovana-slova: data vložena.');
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
