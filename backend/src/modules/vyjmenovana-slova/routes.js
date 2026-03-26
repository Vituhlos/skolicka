import express from 'express';
import { selectSessionItems, updateItemProgress } from '../../core/spaced-repetition.js';
import { updateStreak, getStreakCount } from '../../core/streaks.js';
import { checkAndAwardBadges } from '../../core/badges.js';
import { requirePin } from '../../core/auth.js';
import {
  buildGetSentencesByIdsQuery,
  buildGetSentencesByLettersQuery,
  buildProgressByLetterQuery,
  buildProblematicWordsQuery
} from './questions.js';

const router = express.Router();

// Detects y/i position after the given consonant letter.
// If displayWord is provided, uses it directly.
// If autoFind=true, scans all words in the sentence to find the first match.
// Returns { correct_answer, template, display_word } or null.
function detectAnswerAndTemplate(sentence, displayWord, letter, autoFind = false) {
  const letterLower = letter.toLowerCase();

  function tryWord(word) {
    const lower = word.toLowerCase();
    for (let i = 0; i < lower.length; i++) {
      if (lower[i] === letterLower) {
        for (let j = i + 1; j < lower.length; j++) {
          const ch = lower[j];
          if ('yý'.includes(ch) || 'ií'.includes(ch)) {
            const correct_answer = 'yý'.includes(ch) ? 'y' : 'i';
            const modified = word.slice(0, j) + '___' + word.slice(j + 1);
            const template = sentence.replace(word, modified);
            return { correct_answer, template, display_word: word };
          }
        }
        break;
      }
    }
    return null;
  }

  if (displayWord) return tryWord(displayWord);

  if (autoFind) {
    const words = sentence.match(/[a-záčďéěíňóřšťúůýž]+/gi) || [];
    for (const word of words) {
      const result = tryWord(word);
      if (result) return result;
    }
  }

  return null;
}

// GET /api/modules/vyjmenovana-slova/admin/sentences
router.get('/admin/sentences', requirePin, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT vs.id, vs.template, vs.correct_answer, vs.display_word, vs.difficulty,
              vw.letter, vw.word
       FROM vslov_sentences vs
       JOIN vslov_words vw ON vw.id = vs.word_id
       ORDER BY vw.letter, vw.word, vs.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET admin/sentences error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// POST /api/modules/vyjmenovana-slova/admin/sentences
router.post('/admin/sentences', requirePin, async (req, res) => {
  const { letter, word, sentence, display_word, difficulty = 1 } = req.body;
  if (!letter || !word || !sentence || !display_word) {
    return res.status(400).json({ error: 'Chybí povinné parametry.' });
  }
  const detected = detectAnswerAndTemplate(sentence, display_word, letter);
  if (!detected) {
    return res.status(400).json({ error: `Ve slově "${display_word}" nebylo nalezeno y/í/i po písmenu ${letter}.` });
  }
  try {
    const pool = req.app.locals.pool;
    await pool.query(`INSERT OR IGNORE INTO vslov_words (letter, word) VALUES (?, ?)`, [letter.toUpperCase(), word]);
    const wordResult = await pool.query(`SELECT id FROM vslov_words WHERE letter = ? AND word = ?`, [letter.toUpperCase(), word]);
    const wordId = wordResult.rows[0].id;
    await pool.query(
      `INSERT INTO vslov_sentences (word_id, template, correct_answer, display_word, difficulty) VALUES (?, ?, ?, ?, ?)`,
      [wordId, detected.template, detected.correct_answer, display_word, difficulty]
    );
    res.status(201).json({ template: detected.template, correct_answer: detected.correct_answer, display_word });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Tato věta již existuje.' });
    }
    console.error('POST admin/sentences error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// POST /api/modules/vyjmenovana-slova/admin/sentences/bulk
router.post('/admin/sentences/bulk', requirePin, async (req, res) => {
  const { sentences } = req.body;
  if (!Array.isArray(sentences) || sentences.length === 0) {
    return res.status(400).json({ error: 'Chybí pole sentences.' });
  }
  const pool = req.app.locals.pool;
  const results = { added: 0, skipped: 0, errors: [] };

  for (const item of sentences) {
    const { letter, word, sentence } = item;
    if (!letter || !word || !sentence) {
      results.errors.push(`Chybí pole: ${JSON.stringify(item)}`);
      continue;
    }
    const detected = detectAnswerAndTemplate(sentence, null, letter, true);
    if (!detected) {
      results.errors.push(`Nelze detekovat y/i pro: "${sentence}" (${letter})`);
      continue;
    }
    try {
      await pool.query(`INSERT OR IGNORE INTO vslov_words (letter, word) VALUES (?, ?)`, [letter.toUpperCase(), word]);
      const wordResult = await pool.query(`SELECT id FROM vslov_words WHERE letter = ? AND word = ?`, [letter.toUpperCase(), word]);
      const wordId = wordResult.rows[0].id;
      const result = await pool.query(
        `INSERT OR IGNORE INTO vslov_sentences (word_id, template, correct_answer, display_word, difficulty) VALUES (?, ?, ?, ?, 1)`,
        [wordId, detected.template, detected.correct_answer, detected.display_word]
      );
      if (result.rowCount > 0) results.added++;
      else results.skipped++;
    } catch {
      results.errors.push(`Chyba při ukládání: "${sentence}"`);
    }
  }

  res.json(results);
});

// DELETE /api/modules/vyjmenovana-slova/admin/sentences/:id
router.delete('/admin/sentences/:id', requirePin, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await pool.query(`DELETE FROM vslov_sentences WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE admin/sentences error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});
const MODULE_ID = 'vyjmenovana-slova';

// GET /api/modules/vyjmenovana-slova/session?profile_id=X
router.get('/session', async (req, res) => {
  const { profile_id } = req.query;
  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }

  try {
    const pool = req.app.locals.pool;
    const selectedItems = await selectSessionItems(pool, profile_id, MODULE_ID, 15);

    if (selectedItems.length === 0) {
      return res.json([]);
    }

    const itemIds = selectedItems.map(i => i.item_id);
    const query = buildGetSentencesByIdsQuery(itemIds);
    const result = await pool.query(query.text, query.values);

    const itemMap = {};
    for (const row of result.rows) {
      itemMap[row.id] = row;
    }

    const items = selectedItems
      .filter(si => itemMap[si.item_id])
      .map(si => {
        const sentence = itemMap[si.item_id];
        return {
          id: sentence.id,
          template: sentence.template,
          correct_answer: sentence.correct_answer,
          display_word: sentence.display_word,
          letter: sentence.letter,
          difficulty: sentence.difficulty,
          word: sentence.word
        };
      });

    res.json(items);
  } catch (err) {
    console.error('GET session error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// POST /api/modules/vyjmenovana-slova/session/start
router.post('/session/start', async (req, res) => {
  const { profile_id, letters } = req.body;
  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }

  try {
    const pool = req.app.locals.pool;
    const letterFilter = Array.isArray(letters) && letters.length > 0 ? letters : null;

    const sessionResult = await pool.query(
      `INSERT INTO sessions (profile_id, module_id, exercise_type, metadata)
       VALUES (?, ?, 'fill-in', ?)
       RETURNING id`,
      [profile_id, MODULE_ID, JSON.stringify({ letters: letterFilter })]
    );
    const session_id = sessionResult.rows[0].id;

    const selectedItems = await selectSessionItems(pool, profile_id, MODULE_ID, 15, letterFilter);

    let items = [];
    if (selectedItems.length > 0) {
      const itemIds = selectedItems.map(i => i.item_id);
      const query = buildGetSentencesByIdsQuery(itemIds);
      const result = await pool.query(query.text, query.values);

      const itemMap = {};
      for (const row of result.rows) {
        itemMap[row.id] = row;
      }

      items = selectedItems
        .filter(si => itemMap[si.item_id])
        .map(si => {
          const sentence = itemMap[si.item_id];
          return {
            id: sentence.id,
            template: sentence.template,
            correct_answer: sentence.correct_answer,
            display_word: sentence.display_word,
            letter: sentence.letter,
            difficulty: sentence.difficulty,
            word: sentence.word
          };
        });
    }

    res.status(201).json({ session_id, items });
  } catch (err) {
    console.error('POST session/start error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// POST /api/modules/vyjmenovana-slova/session/:id/answer
router.post('/session/:id/answer', async (req, res) => {
  const { id: session_id } = req.params;
  const { profile_id, item_id, given_answer, response_time_ms } = req.body;

  if (!profile_id || item_id === undefined || given_answer === undefined || response_time_ms === undefined) {
    return res.status(400).json({ error: 'Chybí povinné parametry.' });
  }

  try {
    const pool = req.app.locals.pool;

    const sessionCheck = await pool.query(
      'SELECT id FROM sessions WHERE id = ? AND profile_id = ?',
      [session_id, profile_id]
    );
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sezení nenalezeno.' });
    }

    const sentenceResult = await pool.query(
      `SELECT vs.correct_answer, vs.display_word, vw.letter
       FROM vslov_sentences vs
       JOIN vslov_words vw ON vw.id = vs.word_id
       WHERE vs.id = ?`,
      [item_id]
    );
    if (sentenceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Věta nenalezena.' });
    }

    const sentence = sentenceResult.rows[0];
    const is_correct = given_answer.toLowerCase() === sentence.correct_answer.toLowerCase();

    await pool.query(
      `INSERT INTO answers (session_id, item_id, given_answer, is_correct, response_time_ms)
       VALUES (?, ?, ?, ?, ?)`,
      [session_id, item_id, given_answer, is_correct ? 1 : 0, response_time_ms]
    );

    const progressResult = await pool.query(
      `SELECT * FROM item_progress
       WHERE profile_id = ? AND module_id = ? AND item_id = ?`,
      [profile_id, MODULE_ID, item_id]
    );

    let progress;
    if (progressResult.rows.length === 0) {
      progress = {
        profile_id: parseInt(profile_id),
        module_id: MODULE_ID,
        item_id: parseInt(item_id),
        times_seen: 0,
        times_correct: 0,
        interval_days: 1,
        ease_factor: 2.5,
        next_due_at: new Date().toISOString(),
        last_seen_at: null
      };
    } else {
      progress = progressResult.rows[0];
    }

    const updatedProgress = updateItemProgress(progress, is_correct, response_time_ms);

    await pool.query(
      `INSERT INTO item_progress (profile_id, module_id, item_id, times_seen, times_correct,
                                  interval_days, ease_factor, last_seen_at, next_due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
       ON CONFLICT (profile_id, module_id, item_id)
       DO UPDATE SET
         times_seen = excluded.times_seen,
         times_correct = excluded.times_correct,
         interval_days = excluded.interval_days,
         ease_factor = excluded.ease_factor,
         last_seen_at = datetime('now'),
         next_due_at = excluded.next_due_at`,
      [
        profile_id, MODULE_ID, item_id,
        updatedProgress.times_seen,
        updatedProgress.times_correct,
        updatedProgress.interval_days,
        updatedProgress.ease_factor,
        updatedProgress.next_due_at
      ]
    );

    let xp_earned = 0;
    if (is_correct) {
      xp_earned = response_time_ms < 3000 ? 15 : 10;
    }

    if (xp_earned > 0) {
      await pool.query(
        `INSERT INTO xp_log (profile_id, amount, reason, module_id)
         VALUES (?, ?, ?, ?)`,
        [profile_id, xp_earned, is_correct && response_time_ms < 3000 ? 'fast_correct' : 'correct_answer', MODULE_ID]
      );
    }

    await updateStreak(pool, profile_id, xp_earned, MODULE_ID);

    let speed_demon = false;
    const recentAnswers = await pool.query(
      `SELECT a.is_correct, a.response_time_ms FROM answers a
       JOIN sessions s ON a.session_id = s.id
       WHERE s.profile_id = ?
       ORDER BY a.answered_at DESC
       LIMIT 10`,
      [profile_id]
    );
    if (recentAnswers.rows.length >= 10) {
      speed_demon = recentAnswers.rows.every(a => a.is_correct && a.response_time_ms < 3000);
    }

    const current_streak = await getStreakCount(pool, profile_id);
    const new_badges = await checkAndAwardBadges(pool, profile_id, {
      module_id: MODULE_ID,
      streak: current_streak,
      speed_demon
    });

    res.json({
      is_correct,
      correct_answer: sentence.correct_answer,
      display_word: sentence.display_word,
      xp_earned,
      new_badges
    });
  } catch (err) {
    console.error('POST session/:id/answer error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// POST /api/modules/vyjmenovana-slova/session/:id/end
router.post('/session/:id/end', async (req, res) => {
  const { id: session_id } = req.params;
  const { profile_id } = req.body;

  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }

  try {
    const pool = req.app.locals.pool;

    const sessionCheck = await pool.query(
      'SELECT id, started_at FROM sessions WHERE id = ? AND profile_id = ?',
      [session_id, profile_id]
    );
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sezení nenalezeno.' });
    }
    const session = sessionCheck.rows[0];

    const answersResult = await pool.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
       FROM answers WHERE session_id = ?`,
      [session_id]
    );
    const total_answers = parseInt(answersResult.rows[0].total, 10);
    const correct_answers = parseInt(answersResult.rows[0].correct, 10) || 0;
    const is_perfect = total_answers > 0 && correct_answers === total_answers;

    let bonus_xp = 0;
    if (is_perfect) {
      bonus_xp = 50;
      await pool.query(
        `INSERT INTO xp_log (profile_id, amount, reason, module_id)
         VALUES (?, ?, 'perfect_session', ?)`,
        [profile_id, bonus_xp, MODULE_ID]
      );
      await updateStreak(pool, profile_id, bonus_xp, MODULE_ID);
    }

    const now = new Date();
    const started = new Date(session.started_at);
    const duration_seconds = Math.round((now - started) / 1000);

    await pool.query(
      `UPDATE sessions
       SET ended_at = datetime('now'), total_answers = ?, correct_answers = ?
       WHERE id = ?`,
      [total_answers, correct_answers, session_id]
    );

    const sessionXpResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as xp_total FROM xp_log
       WHERE profile_id = ? AND module_id = ? AND created_at >= ?`,
      [profile_id, MODULE_ID, session.started_at]
    );
    const xp_total = parseInt(sessionXpResult.rows[0].xp_total, 10);

    const current_streak = await getStreakCount(pool, profile_id);
    const new_badges = await checkAndAwardBadges(pool, profile_id, {
      module_id: MODULE_ID,
      streak: current_streak,
      perfect_session: is_perfect
    });

    res.json({ total_answers, correct_answers, xp_total, new_badges, duration_seconds });
  } catch (err) {
    console.error('POST session/:id/end error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// GET /api/modules/vyjmenovana-slova/stats?profile_id=X
router.get('/stats', async (req, res) => {
  const { profile_id } = req.query;
  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }

  try {
    const pool = req.app.locals.pool;

    const progressQuery = buildProgressByLetterQuery(profile_id);
    const progressResult = await pool.query(progressQuery.text, progressQuery.values);

    const allLetters = await pool.query(`SELECT DISTINCT letter FROM vslov_words ORDER BY letter`);

    const progressMap = {};
    for (const row of progressResult.rows) {
      progressMap[row.letter] = row;
    }

    const letterStats = allLetters.rows.map(({ letter }) => {
      const prog = progressMap[letter] || { seen_count: 0, total_correct: 0, total_seen: 0 };
      const total = parseInt(prog.total_seen, 10) || 0;
      const correct = parseInt(prog.total_correct, 10) || 0;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      return { letter, total, correct, accuracy };
    });

    const problematicQuery = buildProblematicWordsQuery(profile_id, 20);
    const problematicResult = await pool.query(problematicQuery.text, problematicQuery.values);

    res.json({ by_letter: letterStats, problematic_words: problematicResult.rows });
  } catch (err) {
    console.error('GET stats error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// GET /api/modules/vyjmenovana-slova/boss/status?profile_id=X
router.get('/boss/status', async (req, res) => {
  const { profile_id } = req.query;
  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }

  try {
    const pool = req.app.locals.pool;

    const progressQuery = buildProgressByLetterQuery(profile_id);
    const progressResult = await pool.query(progressQuery.text, progressQuery.values);

    const letters_ready = [];
    for (const row of progressResult.rows) {
      const total = parseInt(row.total_seen, 10) || 0;
      const correct = parseInt(row.total_correct, 10) || 0;
      const accuracy = total > 0 ? (correct / total) * 100 : 0;
      if (accuracy > 70 && total >= 3) {
        letters_ready.push(row.letter);
      }
    }

    const unlocked = letters_ready.length >= 4;
    res.json({ unlocked, letters_ready });
  } catch (err) {
    console.error('GET boss/status error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

// GET /api/modules/vyjmenovana-slova/boss/session?profile_id=X
router.get('/boss/session', async (req, res) => {
  const { profile_id } = req.query;
  if (!profile_id) {
    return res.status(400).json({ error: 'Chybí profile_id.' });
  }

  try {
    const pool = req.app.locals.pool;
    const LETTERS = ['B', 'L', 'M', 'P', 'S', 'V', 'Z'];

    const query = buildGetSentencesByLettersQuery(LETTERS, 20);
    const result = await pool.query(query.text, query.values);

    const items = result.rows.map(row => ({
      id: row.id,
      template: row.template,
      correct_answer: row.correct_answer,
      display_word: row.display_word,
      letter: row.letter,
      difficulty: row.difficulty,
      word: row.word
    }));

    res.json(items);
  } catch (err) {
    console.error('GET boss/session error:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  }
});

export default router;
