export function updateItemProgress(progress, isCorrect, responseTimeMs) {
  const quality = isCorrect ? (responseTimeMs < 3000 ? 5 : 4) : 1;
  if (quality >= 3) {
    if (progress.times_seen === 0) progress.interval_days = 1;
    else if (progress.times_seen === 1) progress.interval_days = 6;
    else progress.interval_days = Math.round(progress.interval_days * progress.ease_factor);
  } else {
    progress.interval_days = 1;
  }
  progress.ease_factor = Math.max(1.3,
    progress.ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );
  progress.next_due_at = new Date(Date.now() + progress.interval_days * 86400000).toISOString();
  progress.times_seen += 1;
  if (isCorrect) progress.times_correct += 1;
  return progress;
}

// letters: optional array of uppercase letters to filter by, e.g. ['B', 'L', 'M']
export async function selectSessionItems(pool, profileId, moduleId, count = 15, letters = null) {
  const hasLetters = Array.isArray(letters) && letters.length > 0;

  // --- 1) Overdue items ---
  let overdueSql;
  let overdueParams;
  if (hasLetters) {
    const lp = letters.map(() => '?').join(',');
    overdueSql = `
      SELECT ip.item_id, ip.times_seen, ip.times_correct, ip.interval_days, ip.ease_factor,
             ip.next_due_at, ip.last_seen_at
      FROM item_progress ip
      JOIN vslov_sentences vs2 ON vs2.id = ip.item_id
      JOIN vslov_words vw ON vw.id = vs2.word_id
      WHERE ip.profile_id = ? AND ip.module_id = ? AND ip.next_due_at <= datetime('now')
        AND vw.letter IN (${lp})
      ORDER BY ip.next_due_at ASC
      LIMIT ?`;
    overdueParams = [profileId, moduleId, ...letters, count];
  } else {
    overdueSql = `
      SELECT ip.item_id, ip.times_seen, ip.times_correct, ip.interval_days, ip.ease_factor,
             ip.next_due_at, ip.last_seen_at
      FROM item_progress ip
      WHERE ip.profile_id = ? AND ip.module_id = ? AND ip.next_due_at <= datetime('now')
      ORDER BY ip.next_due_at ASC
      LIMIT ?`;
    overdueParams = [profileId, moduleId, count];
  }
  const overdueResult = await pool.query(overdueSql, overdueParams);
  const selectedIds = new Set(overdueResult.rows.map(r => r.item_id));
  const items = [...overdueResult.rows];

  if (items.length >= count) return items.slice(0, count);

  // --- 2) Never seen items ---
  const remaining1 = count - items.length;
  let neverSql;
  let neverParams;
  if (hasLetters) {
    const lp = letters.map(() => '?').join(',');
    neverSql = `
      SELECT vs.id as item_id, 0 as times_seen, 0 as times_correct,
             1 as interval_days, 2.5 as ease_factor,
             NULL as next_due_at, NULL as last_seen_at
      FROM vslov_sentences vs
      JOIN vslov_words vw2 ON vw2.id = vs.word_id
      WHERE vs.id NOT IN (
        SELECT item_id FROM item_progress WHERE profile_id = ? AND module_id = ?
      )
        AND vw2.letter IN (${lp})
      ORDER BY RANDOM()
      LIMIT ?`;
    neverParams = [profileId, moduleId, ...letters, remaining1];
  } else {
    neverSql = `
      SELECT vs.id as item_id, 0 as times_seen, 0 as times_correct,
             1 as interval_days, 2.5 as ease_factor,
             NULL as next_due_at, NULL as last_seen_at
      FROM vslov_sentences vs
      WHERE vs.id NOT IN (
        SELECT item_id FROM item_progress WHERE profile_id = ? AND module_id = ?
      )
      ORDER BY RANDOM()
      LIMIT ?`;
    neverParams = [profileId, moduleId, remaining1];
  }
  const neverResult = await pool.query(neverSql, neverParams);
  for (const row of neverResult.rows) {
    if (!selectedIds.has(row.item_id)) {
      selectedIds.add(row.item_id);
      items.push(row);
    }
  }

  if (items.length >= count) return items.slice(0, count);

  // --- 3) Highest error rate (min 2 seen, not already selected) ---
  const remaining2 = count - items.length;
  const excludedIds = Array.from(selectedIds);
  const ep = excludedIds.length > 0 ? excludedIds.map(() => '?').join(',') : 'NULL';
  let errorSql;
  let errorParams;
  if (hasLetters) {
    const lp = letters.map(() => '?').join(',');
    errorSql = `
      SELECT ip.item_id, ip.times_seen, ip.times_correct, ip.interval_days, ip.ease_factor,
             ip.next_due_at, ip.last_seen_at
      FROM item_progress ip
      JOIN vslov_sentences vs3 ON vs3.id = ip.item_id
      JOIN vslov_words vw3 ON vw3.id = vs3.word_id
      WHERE ip.profile_id = ? AND ip.module_id = ?
        AND ip.times_seen >= 2
        AND ip.item_id NOT IN (${ep})
        AND vw3.letter IN (${lp})
      ORDER BY (CAST(ip.times_correct AS REAL) / ip.times_seen) ASC
      LIMIT ?`;
    errorParams = [profileId, moduleId, ...excludedIds, ...letters, remaining2];
  } else {
    errorSql = `
      SELECT ip.item_id, ip.times_seen, ip.times_correct, ip.interval_days, ip.ease_factor,
             ip.next_due_at, ip.last_seen_at
      FROM item_progress ip
      WHERE ip.profile_id = ? AND ip.module_id = ?
        AND ip.times_seen >= 2
        AND ip.item_id NOT IN (${ep})
      ORDER BY (CAST(ip.times_correct AS REAL) / ip.times_seen) ASC
      LIMIT ?`;
    errorParams = [profileId, moduleId, ...excludedIds, remaining2];
  }
  const errorResult = await pool.query(errorSql, errorParams);
  for (const row of errorResult.rows) {
    if (!selectedIds.has(row.item_id)) {
      selectedIds.add(row.item_id);
      items.push(row);
    }
  }

  if (items.length >= count) return items.slice(0, count);

  // --- 4) Random fill ---
  const remaining3 = count - items.length;
  const excludedIds2 = Array.from(selectedIds);
  const ep2 = excludedIds2.length > 0 ? excludedIds2.map(() => '?').join(',') : 'NULL';
  let randomSql;
  let randomParams;
  if (hasLetters) {
    const lp = letters.map(() => '?').join(',');
    randomSql = `
      SELECT vs.id as item_id,
             COALESCE(ip.times_seen, 0) as times_seen,
             COALESCE(ip.times_correct, 0) as times_correct,
             COALESCE(ip.interval_days, 1) as interval_days,
             COALESCE(ip.ease_factor, 2.5) as ease_factor,
             ip.next_due_at, ip.last_seen_at
      FROM vslov_sentences vs
      JOIN vslov_words vw4 ON vw4.id = vs.word_id
      LEFT JOIN item_progress ip ON ip.item_id = vs.id AND ip.profile_id = ? AND ip.module_id = ?
      WHERE vs.id NOT IN (${ep2})
        AND vw4.letter IN (${lp})
      ORDER BY RANDOM()
      LIMIT ?`;
    randomParams = [profileId, moduleId, ...excludedIds2, ...letters, remaining3];
  } else {
    randomSql = `
      SELECT vs.id as item_id,
             COALESCE(ip.times_seen, 0) as times_seen,
             COALESCE(ip.times_correct, 0) as times_correct,
             COALESCE(ip.interval_days, 1) as interval_days,
             COALESCE(ip.ease_factor, 2.5) as ease_factor,
             ip.next_due_at, ip.last_seen_at
      FROM vslov_sentences vs
      LEFT JOIN item_progress ip ON ip.item_id = vs.id AND ip.profile_id = ? AND ip.module_id = ?
      WHERE vs.id NOT IN (${ep2})
      ORDER BY RANDOM()
      LIMIT ?`;
    randomParams = [profileId, moduleId, ...excludedIds2, remaining3];
  }
  const randomResult = await pool.query(randomSql, randomParams);
  for (const row of randomResult.rows) {
    if (!selectedIds.has(row.item_id)) {
      selectedIds.add(row.item_id);
      items.push(row);
    }
  }

  return items.slice(0, count);
}
