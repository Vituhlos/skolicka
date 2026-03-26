/**
 * Helper module for building SQL queries related to vyjmenovaná slova sentences.
 * Uses ? placeholders for SQLite compatibility.
 */

export function buildGetSentencesByIdsQuery(itemIds) {
  if (!itemIds || itemIds.length === 0) {
    return {
      text: `SELECT vs.id, vs.template, vs.correct_answer, vs.display_word, vs.difficulty,
                    vw.letter, vw.word
             FROM vslov_sentences vs
             JOIN vslov_words vw ON vw.id = vs.word_id
             WHERE 0`,
      values: []
    };
  }
  const placeholders = itemIds.map(() => '?').join(', ');
  return {
    text: `SELECT vs.id, vs.template, vs.correct_answer, vs.display_word, vs.difficulty,
                  vw.letter, vw.word
           FROM vslov_sentences vs
           JOIN vslov_words vw ON vw.id = vs.word_id
           WHERE vs.id IN (${placeholders})`,
    values: itemIds
  };
}

export function buildGetSentencesByLettersQuery(letters, limit) {
  const placeholders = letters.map(() => '?').join(', ');
  return {
    text: `SELECT vs.id, vs.template, vs.correct_answer, vs.display_word, vs.difficulty,
                  vw.letter, vw.word
           FROM vslov_sentences vs
           JOIN vslov_words vw ON vw.id = vs.word_id
           WHERE vw.letter IN (${placeholders})
           ORDER BY RANDOM()
           LIMIT ?`,
    values: [...letters, limit]
  };
}

export function buildLetterStatsQuery(profileId) {
  return {
    text: `SELECT vw.letter,
                  COUNT(DISTINCT vs.id) as total,
                  COUNT(DISTINCT CASE WHEN a.is_correct = 1 THEN a.id END) as correct
           FROM vslov_words vw
           JOIN vslov_sentences vs ON vs.word_id = vw.id
           LEFT JOIN answers a ON a.item_id = vs.id
           LEFT JOIN sessions s ON s.id = a.session_id AND s.profile_id = ?
           GROUP BY vw.letter
           ORDER BY vw.letter`,
    values: [profileId]
  };
}

export function buildProgressByLetterQuery(profileId) {
  return {
    text: `SELECT vw.letter,
                  COUNT(ip.item_id) as seen_count,
                  SUM(ip.times_correct) as total_correct,
                  SUM(ip.times_seen) as total_seen
           FROM item_progress ip
           JOIN vslov_sentences vs ON vs.id = ip.item_id
           JOIN vslov_words vw ON vw.id = vs.word_id
           WHERE ip.profile_id = ? AND ip.module_id = 'vyjmenovana-slova'
           GROUP BY vw.letter`,
    values: [profileId]
  };
}

export function buildProblematicWordsQuery(profileId, limit) {
  return {
    text: `SELECT vw.word, vw.letter, ip.times_seen, ip.times_correct,
                  CASE WHEN ip.times_seen > 0
                    THEN ROUND(CAST(ip.times_correct AS REAL) / ip.times_seen * 100, 1)
                    ELSE 0
                  END as accuracy
           FROM item_progress ip
           JOIN vslov_sentences vs ON vs.id = ip.item_id
           JOIN vslov_words vw ON vw.id = vs.word_id
           WHERE ip.profile_id = ?
             AND ip.module_id = 'vyjmenovana-slova'
             AND ip.times_seen >= 5
           ORDER BY accuracy ASC
           LIMIT ?`,
    values: [profileId, limit]
  };
}
