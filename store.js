// LOCKIN.AI – Datenzugriff & Geschäftslogik (Level, Streak, Quests, Erfolge)
import { q, get, all } from './db.js';

// ---------- Level-System ----------
// Level n benötigt 100 * (n-1) * n / 2 Gesamt-XP (Dreieckszahlen)
export const xpForLevel = (level) => (100 * (level - 1) * level) / 2;
export const levelForXp = (xp) => Math.floor((Math.sqrt(1 + (8 * xp) / 100) + 1) / 2);

export function levelInfo(xp) {
  const level = levelForXp(xp);
  const prev = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const into = xp - prev;
  const span = next - prev;
  return { level, xp, prev, next, into, span, progress: span ? Math.min(100, Math.round((into / span) * 100)) : 100 };
}

// ---------- Streak ----------
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
export function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function touchStreak(userId) {
  const u = get('SELECT streak_count, last_active_date, best_streak, streak_shields FROM users WHERE id = ?', [userId]);
  if (!u) return;
  const today = todayStr();
  if (u.last_active_date === today) return;
  let streak = u.streak_count || 0;
  if (u.last_active_date === yesterdayStr()) {
    streak += 1;
  } else if (u.last_active_date === null || u.last_active_date === '') {
    streak = 1;
  } else {
    // Tag ausgelassen: Streak-Schild schützt vor Reset
    const shields = u.streak_shields || 0;
    if (shields > 0) {
      q('UPDATE users SET streak_shields = streak_shields - 1, total_shields_used = total_shields_used + 1 WHERE id = ?', [userId]);
      // Inventar synchron halten: Streak-Freeze-Item aus dem Shop mit abbuchen
      q('UPDATE inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = (SELECT id FROM shop_items WHERE code = ?)', [userId, 'streak_freeze']);
      q('DELETE FROM inventory WHERE user_id = ? AND item_id = (SELECT id FROM shop_items WHERE code = ?) AND quantity <= 0', [userId, 'streak_freeze']);
      notify(userId, 'reward', '🛡️ Streak-Schild eingesetzt! Dein Streak bleibt erhalten.');
      // Streak bleibt, nur letzter aktiver Tag wird angehoben
      q('UPDATE users SET last_active_date = ? WHERE id = ?', [yesterdayStr(), userId]);
    } else {
      streak = 1;
    }
  }
  const best = Math.max(u.best_streak || 0, streak);
  q('UPDATE users SET streak_count = ?, last_active_date = ?, best_streak = ? WHERE id = ?', [streak, today, best, userId]);
  if (streak === 3) notify(userId, 'achievement', '🔥 3er-Streak! Drei Tage in Folge aktiv – stark!');
  if (streak === 7) notify(userId, 'achievement', '⚡ 7-Tage-Streak erreicht! Konstanz ist der Superpower.');
  if (streak === 30) notify(userId, 'achievement', '🏆 30-Tage-Streak! Du bist offiziell unaufhaltbar.');
}

// ---------- Tägliches & wöchentliches Zurücksetzen der Quests ----------
function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export function resetDailyQuestsIfNeeded(userId) {
  const u = get('SELECT last_daily_reset FROM users WHERE id = ?', [userId]);
  const today = todayStr();
  if (!u || u.last_daily_reset === today) return;
  q('UPDATE users SET last_daily_reset = ? WHERE id = ?', [today, userId]);
  // Daily-Quests zurücksetzen
  const dailies = all('SELECT id FROM quests WHERE category = ?', ['daily']);
  for (const dq of dailies) {
    q('UPDATE user_quests SET progress = 0, completed = 0, claimed = 0, claimed_at = NULL WHERE user_id = ? AND quest_id = ?', [userId, dq.id]);
  }
  // Weekly-Quests zurücksetzen (falls neue Woche)
  const weekStart = startOfWeek();
  const weeklies = all('SELECT id FROM quests WHERE category = ?', ['weekly']);
  const lastWeeklyReset = get('SELECT last_weekly_reset FROM users WHERE id = ?', [userId]);
  if (!lastWeeklyReset || lastWeeklyReset.last_weekly_reset !== weekStart) {
    q('UPDATE users SET last_weekly_reset = ? WHERE id = ?', [weekStart, userId]);
    for (const wq of weeklies) {
      q('UPDATE user_quests SET progress = 0, completed = 0, claimed = 0, claimed_at = NULL WHERE user_id = ? AND quest_id = ?', [userId, wq.id]);
    }
  }
}

// ---------- Quests ----------
export function ensureQuestRows(userId) {
  const quests = all('SELECT id FROM quests WHERE active = 1');
  for (const quest of quests) {
    q('INSERT OR IGNORE INTO user_quests (user_id, quest_id) VALUES (?, ?)', [userId, quest.id]);
  }
}

export function bumpQuest(userId, code, amount = 1) {
  resetDailyQuestsIfNeeded(userId);
  const quest = get('SELECT * FROM quests WHERE code = ?', [code]);
  if (!quest) return null;
  ensureQuestRows(userId);
  const row = get('SELECT * FROM user_quests WHERE user_id = ? AND quest_id = ?', [userId, quest.id]);
  if (!row || (row.completed && !row.claimed)) return row ? { ...row, quest } : null;
  const newProgress = Math.min(quest.goal, (row.progress || 0) + amount);
  const completed = newProgress >= quest.goal ? 1 : 0;
  q('UPDATE user_quests SET progress = ?, completed = ? WHERE user_id = ? AND quest_id = ?', [newProgress, completed, userId, quest.id]);
  return get('SELECT * FROM user_quests WHERE user_id = ? AND quest_id = ?', [userId, quest.id]);
}

export function claimQuest(userId, questId) {
  const row = get('SELECT * FROM user_quests WHERE user_id = ? AND quest_id = ?', [userId, questId]);
  if (!row || !row.completed || row.claimed) return null;
  const quest = get('SELECT * FROM quests WHERE id = ?', [questId]);
  if (!quest) return null;
  q('UPDATE user_quests SET claimed = 1, claimed_at = datetime(\'now\') WHERE user_id = ? AND quest_id = ?', [userId, questId]);
  addXp(userId, quest.reward_xp);
  addJewels(userId, quest.reward_jewels);
  q('UPDATE users SET total_quests = total_quests + 1 WHERE id = ?', [userId]);
  return quest;
}

// ---------- Belohnungen ----------
export function addXp(userId, amount) {
  q('UPDATE users SET xp = xp + ? WHERE id = ?', [amount, userId]);
}

export function addJewels(userId, amount) {
  q('UPDATE users SET jewels = jewels + ? WHERE id = ?', [amount, userId]);
}

// ---------- Benachrichtigungen ----------
export function notify(userId, type, message) {
  q('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', [userId, type, message]);
}

// ---------- Life Score (spielerischer Fortschrittswert) ----------
export function lifeScore(userId) {
  const u = get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!u) return null;
  const WEEK = "date('now','weekday 0','-6 days')";

  // Appearance: letzter Scan-Score
  const lastScan = get('SELECT score FROM scans WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  const appearance = lastScan ? Math.max(0, Math.min(100, lastScan.score)) : 0;

  // Fitness: ECHTE Workouts diese Woche (Ziel: 3) – Spaziergänge zählen nur anteilig
  // (1 Spaziergang = 1/3 Workout-Punkt), damit ein 10-Min-Walk nicht die volle Fitness-Wertung gibt.
  const wWeek = get(
    `SELECT
       SUM(CASE WHEN kind = 'stroll' THEN 0.34 ELSE 1 END) AS score,
       COUNT(*) AS total
     FROM user_workouts WHERE user_id = ? AND date >= ${WEEK}`, [userId]
  );
  const fitnessRaw = wWeek.score || 0;
  const fitness = Math.min(100, Math.round((fitnessRaw / 3) * 100));

  // Nutrition: durchschnittliche Kalorien-Adhärenz der letzten 7 Tage
  let nutritionSum = 0, nutritionDays = 0;
  for (let i = 6; i >= 0; i--) {
    const d = get('SELECT date(?, ?) AS d', ['now', `-${i} days`]).d;
    const k = get('SELECT COALESCE(SUM(kcal),0) AS k FROM food_logs WHERE user_id = ? AND log_date = ?', [userId, d]).k;
    if (k > 0) { nutritionDays++; nutritionSum += Math.min(100, Math.round((k / u.calorie_goal) * 100)); }
  }
  const nutrition = nutritionDays > 0 ? Math.round(nutritionSum / nutritionDays) : 0;

  // Focus: Fokus-Minuten diese Woche (Ziel: 60)
  const focusWeek = get(`SELECT COALESCE(SUM(minutes),0) AS m FROM focus_sessions WHERE user_id = ? AND date(completed_at) >= ${WEEK}`, [userId]).m;
  const focus = Math.min(100, Math.round((focusWeek / 60) * 100));

  // Study: Lern-Aktionen diese Woche (Material + Quiz + Hausaufgaben, Ziel: 3)
  const studyWeek = get(`SELECT (SELECT COUNT(*) FROM study_materials WHERE user_id = ? AND date(created_at) >= ${WEEK})
    + (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = ? AND date(created_at) >= ${WEEK})
    + (SELECT COUNT(*) FROM homework WHERE user_id = ? AND done = 1 AND date(done_at) >= ${WEEK}) AS c`, [userId, userId, userId]).c;
  const study = Math.min(100, Math.round((studyWeek / 3) * 100));

  // Discipline: Streak (max. 7 Tage = 60 %) + eingelöste Aufgaben (40 %)
  const questTotal = Math.max(1, get('SELECT COUNT(*) AS c FROM quests WHERE active = 1').c);
  const questDone = get('SELECT COUNT(*) AS c FROM user_quests uq JOIN quests q ON q.id = uq.quest_id WHERE uq.user_id = ? AND uq.claimed = 1 AND q.active = 1', [userId]).c;
  const discipline = Math.min(100, Math.round(Math.min(1, u.streak_count / 7) * 60 + Math.min(1, questDone / questTotal) * 40));

  // Habits: Schlaf-Nächte + manuelle Gewohnheits-Checks diese Woche (Ziel: 7)
  const habitsWeek = get(`SELECT COUNT(DISTINCT d) AS c FROM (
      SELECT sleep_date AS d FROM sleep_logs WHERE user_id = ? AND sleep_date >= ${WEEK}
      UNION SELECT goal_date AS d FROM daily_goal_manual WHERE user_id = ? AND goal_date >= ${WEEK}
    )`, [userId, userId]).c;
  const habits = Math.min(100, Math.round((habitsWeek / 7) * 100));

  const parts = [
    { key: 'appearance', label: 'Appearance', icon: '✨', value: appearance },
    { key: 'fitness', label: 'Fitness', icon: '💪', value: fitness },
    { key: 'nutrition', label: 'Nutrition', icon: '🍎', value: nutrition },
    { key: 'focus', label: 'Focus', icon: '🧘', value: focus },
    { key: 'study', label: 'Study', icon: '📚', value: study },
    { key: 'discipline', label: 'Discipline', icon: '🎯', value: discipline },
    { key: 'habits', label: 'Habits', icon: '😴', value: habits },
  ];
  const total = Math.round(parts.reduce((s, p) => s + p.value, 0) / parts.length);
  return {
    total,
    parts,
    note: 'Spielerischer Fortschrittswert aus deinen Aktivitäten – keine medizinische oder wissenschaftliche Bewertung.',
  };
}

// ---------- Erfolge ----------
export const ACHIEVEMENTS = [
  { code: 'first_scan', title: 'Erster Scan', description: 'Führe deinen ersten AI Face Scan durch', icon: '📸', rarity: 'common', xp: 30 },
  { code: 'scan_10', title: 'Scan-Profi', description: 'Führe 10 Scans durch', icon: '🔁', rarity: 'rare', xp: 100 },
  { code: 'scan_25', title: 'Style-Scout', description: 'Führe 25 Scans durch', icon: '📸', rarity: 'rare', xp: 150 },
  { code: 'scan_50', title: 'Scan-Meister', description: 'Führe 50 Scans durch', icon: '✨', rarity: 'epic', xp: 300 },
  { code: 'first_quest', title: 'Quest-Geschafft', description: 'Schließe deine erste Quest ab', icon: '🎯', rarity: 'common', xp: 30 },
  { code: 'quest_5', title: 'Quest-Jäger', description: 'Schließe 5 Quests ab', icon: '🏹', rarity: 'rare', xp: 80 },
  { code: 'quest_10', title: 'Quest-Flitzer', description: 'Löse 10 Aufgaben ein', icon: '⚑', rarity: 'rare', xp: 120 },
  { code: 'quest_25', title: 'Quest-Krieger', description: 'Schließe 25 Quests ab', icon: '⚔️', rarity: 'epic', xp: 200 },
  { code: 'quest_50', title: 'Quest-Titan', description: 'Löse 50 Aufgaben ein', icon: '🏰', rarity: 'epic', xp: 300 },
  { code: 'quest_150', title: 'Quest-Gottheit', description: 'Löse 150 Aufgaben ein', icon: '🔱', rarity: 'legendary', xp: 600 },
  { code: 'streak_3', title: 'Funke', description: 'Erreiche einen 3-Tage-Streak', icon: '🔥', rarity: 'common', xp: 40 },
  { code: 'streak_7', title: 'Brennend', description: 'Erreiche einen 7-Tage-Streak', icon: '🌋', rarity: 'rare', xp: 100 },
  { code: 'streak_30', title: 'Unaufhaltbar', description: 'Erreiche einen 30-Tage-Streak', icon: '🏆', rarity: 'legendary', xp: 400 },
  { code: 'level_5', title: 'Aufsteiger', description: 'Erreiche Level 5', icon: '📈', rarity: 'common', xp: 60 },
  { code: 'level_10', title: 'Elite', description: 'Erreiche Level 10', icon: '💎', rarity: 'rare', xp: 150 },
  { code: 'level_15', title: 'Veteran', description: 'Erreiche Level 15', icon: '🎖️', rarity: 'rare', xp: 150 },
  { code: 'level_25', title: 'Legende', description: 'Erreiche Level 25', icon: '👑', rarity: 'legendary', xp: 500 },
  { code: 'level_40', title: 'Halbgott', description: 'Erreiche Level 40', icon: '🌩️', rarity: 'legendary', xp: 600 },
  { code: 'level_50', title: 'Gott', description: 'Erreiche Level 50', icon: '⚡', rarity: 'mythic', xp: 1000 },
  { code: 'jewels_500', title: 'Juwelen-Sammler', description: 'Besitze 500 Juwelen', icon: '🟦', rarity: 'common', xp: 50 },
  { code: 'jewels_1000', title: 'Juwelen-Tycoon', description: 'Besitze 1000 Juwelen', icon: '💠', rarity: 'rare', xp: 150 },
  { code: 'jewels_5000', title: 'Juwelen-Magnat', description: 'Besitze 5000 Juwelen', icon: '💎', rarity: 'legendary', xp: 500 },
  { code: 'first_shop', title: 'Shopping Queen/King', description: 'Kaufe dein erstes Item im Shop', icon: '🛍️', rarity: 'common', xp: 30 },
  { code: 'shop_5', title: 'Shopping-Profi', description: 'Kaufe 5 Items im Shop', icon: '🛒', rarity: 'rare', xp: 100 },
  { code: 'shop_15', title: 'Shopping-Meister', description: 'Kaufe 15 Items im Shop', icon: '💳', rarity: 'epic', xp: 250 },
  { code: 'shop_30', title: 'Shopping-Legende', description: 'Kaufe 30 Items im Shop', icon: '👑', rarity: 'legendary', xp: 500 },
  { code: 'theme_owner', title: 'Stylist', description: 'Besitze ein eigenes Theme', icon: '🎨', rarity: 'rare', xp: 80 },
  { code: 'first_material', title: 'Wissensschmied', description: 'Erstelle dein erstes Lernmaterial', icon: '📚', rarity: 'common', xp: 40 },
  { code: 'material_5', title: 'Bibliothekar', description: 'Erstelle 5 Lernmaterialien', icon: '📖', rarity: 'rare', xp: 120 },
  { code: 'material_10', title: 'Bibliothek', description: 'Erstelle 10 Lernmaterialien', icon: '🗂️', rarity: 'rare', xp: 150 },
  { code: 'material_25', title: 'Wissens-Bauer', description: 'Erstelle 25 Lernmaterialien', icon: '🏛️', rarity: 'epic', xp: 350 },
  { code: 'quiz_20', title: 'Quiz-Master', description: 'Beantworte 20 Quizfragen', icon: '🧠', rarity: 'rare', xp: 120 },
  { code: 'focus_60', title: 'Fokus-Ninja', description: 'Sammle 60 Minuten Fokuszeit', icon: '🧘', rarity: 'rare', xp: 120 },
  { code: 'focus_300', title: 'Deep-Work-Meister', description: 'Sammle 300 Minuten Fokuszeit', icon: '⏳', rarity: 'rare', xp: 150 },
  { code: 'focus_1000', title: 'Fokus-Orakel', description: 'Sammle 1000 Minuten Fokuszeit', icon: '🔮', rarity: 'epic', xp: 300 },
  { code: 'focus_2500', title: 'Fokus-Zen', description: 'Sammle 2500 Minuten Fokuszeit', icon: '🕉️', rarity: 'legendary', xp: 700 },
  { code: 'first_ad', title: 'Werbe-Profi', description: 'Schau dir deine erste belohnte Anzeige an', icon: '📺', rarity: 'common', xp: 20 },
  { code: 'first_homework', title: 'Organisator', description: 'Erstelle deine erste Hausaufgabe', icon: '🗂️', rarity: 'common', xp: 30 },
  { code: 'hw_done_5', title: 'Erledigt-König:in', description: 'Erledige 5 Hausaufgaben', icon: '✅', rarity: 'rare', xp: 90 },
  { code: 'hw_done_25', title: 'Erledigungs-Maschine', description: 'Erledige 25 Hausaufgaben', icon: '⚡', rarity: 'rare', xp: 200 },
  { code: 'hw_done_50', title: 'Erledigungs-Titan', description: 'Erledige 50 Hausaufgaben', icon: '📋', rarity: 'epic', xp: 400 },
  { code: 'first_food_log', title: 'Ernährungs-Starter', description: 'Trage dein erstes Lebensmittel ein', icon: '🍎', rarity: 'common', xp: 30 },
  { code: 'food_logs_20', title: 'Kalorien-Profi', description: 'Trage 20 Lebensmittel ein', icon: '📊', rarity: 'rare', xp: 120 },
  { code: 'food_logs_50', title: 'Kalorien-Experte', description: 'Trage 50 Lebensmittel ein', icon: '🥗', rarity: 'rare', xp: 150 },
  { code: 'food_logs_150', title: 'Makro-Magier', description: 'Trage 150 Lebensmittel ein', icon: '🧮', rarity: 'epic', xp: 350 },
  { code: 'food_logs_300', title: 'Makro-Guru', description: 'Trage 300 Lebensmittel ein', icon: '🔬', rarity: 'legendary', xp: 600 },
  { code: 'first_workout', title: 'Workout-Starter', description: 'Schließe dein erstes Workout ab', icon: '🏋️', rarity: 'common', xp: 30 },
  { code: 'workout_5', title: 'Trainingsheld', description: 'Schließe 5 Workouts ab', icon: '💪', rarity: 'rare', xp: 100 },
  { code: 'workout_15', title: 'Trainings-Routinier', description: 'Schließe 15 Workouts ab', icon: '🏋️', rarity: 'rare', xp: 150 },
  { code: 'workout_30', title: 'Workout-Profi', description: 'Schließe 30 Workouts ab', icon: '🦾', rarity: 'epic', xp: 300 },
  { code: 'workout_50', title: 'Workout-Meister', description: 'Schließe 50 Workouts ab', icon: '🔥', rarity: 'epic', xp: 450 },
  { code: 'workout_100', title: 'Eisen-Legende', description: 'Schließe 100 Workouts ab', icon: '🏆', rarity: 'legendary', xp: 700 },
  { code: 'workout_week', title: 'Wochen-Routine', description: '3 Workouts in einer Woche', icon: '🗓️', rarity: 'rare', xp: 120 },
  { code: 'first_chat', title: 'Coach-Kontakt', description: 'Stelle deine erste Frage an den Coach', icon: '🤖', rarity: 'common', xp: 20 },
  { code: 'chat_10', title: 'Coach-Fan', description: 'Stelle 10 Fragen an den Coach', icon: '💬', rarity: 'rare', xp: 80 },
  { code: 'chat_50', title: 'Coach-Schüler', description: 'Stelle 50 Fragen an den Coach', icon: '🧠', rarity: 'epic', xp: 200 },
  { code: 'chat_100', title: 'Coach-Meister', description: 'Stelle 100 Fragen an den Coach', icon: '🦉', rarity: 'legendary', xp: 500 },
  { code: 'first_consumable', title: 'Power-Up', description: 'Nutze dein erstes Item im Shop', icon: '⚡', rarity: 'common', xp: 30 },
  { code: 'loot_box', title: 'Glücksritter', description: 'Öffne deine erste Mystery-Box', icon: '🎁', rarity: 'rare', xp: 80 },
  { code: 'shield_saver', title: 'Unbesiegbar', description: 'Ein Streak-Schild hat deinen Streak gerettet', icon: '🛡️', rarity: 'rare', xp: 100 },
  { code: 'daily_goals_first', title: 'Ziele-Komplettierer', description: 'Schließe zum ersten Mal alle Tagesziele ab', icon: '🎯', rarity: 'epic', xp: 150 },
  { code: 'daily_goals_7', title: 'Wochen-Absolvent', description: 'Schließe 7× alle Tagesziele ab', icon: '📅', rarity: 'epic', xp: 300 },
  { code: 'daily_goals_30', title: 'Tagesziel-Meister', description: 'Schließe 30× alle Tagesziele ab', icon: '🏅', rarity: 'legendary', xp: 600 },
  { code: 'sleep_1', title: 'Erholter Start', description: 'Logge deine erste Schlaf-Nacht', icon: '😴', rarity: 'common', xp: 30 },
  { code: 'sleep_10', title: 'Traum-Sammler', description: 'Logge 10 Schlaf-Nächte', icon: '🌙', rarity: 'rare', xp: 120 },
  { code: 'sleep_30', title: 'Schlaf-König:in', description: 'Logge 30 Schlaf-Nächte', icon: '🛌', rarity: 'epic', xp: 300 },
  { code: 'sleep_60', title: 'Schlaf-Gott', description: 'Logge 60 Schlaf-Nächte', icon: '💤', rarity: 'legendary', xp: 600 },
  { code: 'habits_5', title: 'Routinen-Festiger', description: 'Pflege an 5 Tagen deine Gewohnheiten', icon: '🌱', rarity: 'rare', xp: 120 },
  { code: 'habits_30', title: 'Gewohnheits-Bauer', description: 'Pflege an 30 Tagen deine Gewohnheiten', icon: '🌳', rarity: 'epic', xp: 300 },
  { code: 'habits_100', title: 'Gewohnheits-Legende', description: 'Pflege an 100 Tagen deine Gewohnheiten', icon: '🏔️', rarity: 'legendary', xp: 700 },
  { code: 'life_40', title: 'Balance-Starter', description: 'Erreiche einen Life Score von 40', icon: '⚖️', rarity: 'common', xp: 60 },
  { code: 'life_70', title: 'Balance-Meister', description: 'Erreiche einen Life Score von 70', icon: '🌟', rarity: 'epic', xp: 200 },
  { code: 'life_90', title: 'Balance-Legende', description: 'Erreiche einen Life Score von 90', icon: '🌌', rarity: 'legendary', xp: 500 },

  // ─── Seltenere Streaks & Spezielle Meilensteine (nicht woanders schon definiert) ───
  { code: 'streak_14', title: 'Eiserne Kette', description: 'Erreiche einen 14-Tage-Streak', icon: '⛓️', rarity: 'rare', xp: 100 },
  { code: 'streak_21', title: 'Gewohnheits-Bauer', description: 'Erreiche einen 21-Tage-Streak', icon: '🧱', rarity: 'epic', xp: 200 },
  { code: 'streak_60', title: 'Unbeugsam', description: 'Erreiche einen 60-Tage-Streak', icon: '⚓', rarity: 'legendary', xp: 500 },
  { code: 'streak_100', title: 'Unsterblich', description: 'Erreiche einen 100-Tage-Streak', icon: '💯', rarity: 'legendary', xp: 800 },
  { code: 'perfect_week', title: 'Perfekte Woche', description: 'Schließe an 7 Tagen einer Woche alle Ziele ab', icon: '🌟', rarity: 'epic', xp: 400 },
];

export function unlockAchievements(userId) {
  const u = get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!u) return [];
  const unlocked = new Set(all('SELECT achievement_id FROM user_achievements WHERE user_id = ?', [userId]).map((r) => r.achievement_id));
  const newly = [];
  const conditions = {
    first_scan: u.total_scans >= 1,
    scan_10: u.total_scans >= 10,
    first_quest: u.total_quests >= 1,
    quest_5: u.total_quests >= 5,
    quest_25: u.total_quests >= 25,
    streak_3: u.best_streak >= 3,
    streak_7: u.best_streak >= 7,
    streak_30: u.best_streak >= 30,
    level_5: levelForXp(u.xp) >= 5,
    level_10: levelForXp(u.xp) >= 10,
    level_25: levelForXp(u.xp) >= 25,
    jewels_500: u.jewels >= 500,
    first_shop: get('SELECT COUNT(*) AS c FROM inventory WHERE user_id = ?', [userId]).c >= 1,
    shop_5: get('SELECT COUNT(*) AS c FROM inventory WHERE user_id = ?', [userId]).c >= 5,
    shop_15: get('SELECT COUNT(*) AS c FROM inventory WHERE user_id = ?', [userId]).c >= 15,
    shop_30: get('SELECT COUNT(*) AS c FROM inventory WHERE user_id = ?', [userId]).c >= 30,
    theme_owner: get('SELECT COUNT(*) AS c FROM inventory i JOIN shop_items s ON s.id = i.item_id WHERE i.user_id = ? AND s.type = ?', [userId, 'theme']).c >= 1,
    first_material: u.total_study_materials >= 1,
    quiz_20: u.total_quiz_answered >= 20,
    focus_60: u.total_focus_minutes >= 60,
    first_ad: u.total_ads >= 1,
    first_homework: get('SELECT COUNT(*) AS c FROM homework WHERE user_id = ?', [userId]).c >= 1,
    hw_done_5: u.total_homework_done >= 5,
    first_food_log: u.total_food_logs >= 1,
    food_logs_20: u.total_food_logs >= 20,
    first_workout: u.total_workouts >= 1,
    workout_5: u.total_workouts >= 5,
    workout_week: get('SELECT COUNT(*) AS c FROM user_workouts WHERE user_id = ? AND date >= date(\'now\',\'weekday 0\',\'-6 days\')', [userId]).c >= 3,
    first_chat: u.total_chats >= 1,
    chat_10: u.total_chats >= 10,
    chat_50: u.total_chats >= 50,
    chat_100: u.total_chats >= 100,
    first_consumable: u.total_consumables_used >= 1,
    loot_box: u.total_loot_boxes >= 1,
    shield_saver: u.total_shields_used >= 1,
    daily_goals_first: get('SELECT COUNT(*) AS c FROM daily_rewards WHERE user_id = ? AND type = ?', [userId, 'all_goals']).c >= 1,
    daily_goals_7: get('SELECT COUNT(*) AS c FROM daily_rewards WHERE user_id = ? AND type = ?', [userId, 'all_goals']).c >= 7,
    daily_goals_30: get('SELECT COUNT(*) AS c FROM daily_rewards WHERE user_id = ? AND type = ?', [userId, 'all_goals']).c >= 30,
    sleep_1: get('SELECT COUNT(*) AS c FROM sleep_logs WHERE user_id = ?', [userId]).c >= 1,
    habits_5: get('SELECT COUNT(DISTINCT goal_date) AS c FROM daily_goal_manual WHERE user_id = ?', [userId]).c >= 5,
    habits_30: get('SELECT COUNT(DISTINCT goal_date) AS c FROM daily_goal_manual WHERE user_id = ?', [userId]).c >= 30,
    habits_100: get('SELECT COUNT(DISTINCT goal_date) AS c FROM daily_goal_manual WHERE user_id = ?', [userId]).c >= 100,
    life_40: (lifeScore(userId) || { total: 0 }).total >= 40,
    life_70: (lifeScore(userId) || { total: 0 }).total >= 70,
    life_90: (lifeScore(userId) || { total: 0 }).total >= 90,

    // Seltene & legendäre Erfolge
    streak_14: u.best_streak >= 14,
    streak_21: u.best_streak >= 21,
    streak_60: u.best_streak >= 60,
    streak_100: u.best_streak >= 100,
    workout_15: u.total_workouts >= 15,
    workout_30: u.total_workouts >= 30,
    workout_50: u.total_workouts >= 50,
    workout_100: u.total_workouts >= 100,
    focus_300: u.total_focus_minutes >= 300,
    focus_1000: u.total_focus_minutes >= 1000,
    focus_2500: u.total_focus_minutes >= 2500,
    food_logs_50: u.total_food_logs >= 50,
    food_logs_150: u.total_food_logs >= 150,
    food_logs_300: u.total_food_logs >= 300,
    quiz_50: u.total_quiz_answered >= 50,
    quiz_100: u.total_quiz_answered >= 100,
    quiz_200: u.total_quiz_answered >= 200,
    quiz_500: u.total_quiz_answered >= 500,
    material_5: u.total_study_materials >= 5,
    material_10: u.total_study_materials >= 10,
    material_25: u.total_study_materials >= 25,
    hw_done_25: u.total_homework_done >= 25,
    hw_done_50: u.total_homework_done >= 50,
    sleep_10: get('SELECT COUNT(*) AS c FROM sleep_logs WHERE user_id = ?', [userId]).c >= 10,
    sleep_30: get('SELECT COUNT(*) AS c FROM sleep_logs WHERE user_id = ?', [userId]).c >= 30,
    sleep_60: get('SELECT COUNT(*) AS c FROM sleep_logs WHERE user_id = ?', [userId]).c >= 60,
    water_50: get('SELECT COALESCE(SUM(amount_ml),0) AS m FROM water_logs WHERE user_id = ?', [userId]).m >= 50000,
    water_150: get('SELECT COALESCE(SUM(amount_ml),0) AS m FROM water_logs WHERE user_id = ?', [userId]).m >= 150000,
    water_365: get('SELECT COALESCE(SUM(amount_ml),0) AS m FROM water_logs WHERE user_id = ?', [userId]).m >= 365000,
    skincare_20: get('SELECT COUNT(*) AS c FROM skincare_logs WHERE user_id = ?', [userId]).c >= 20,
    skincare_60: get('SELECT COUNT(*) AS c FROM skincare_logs WHERE user_id = ?', [userId]).c >= 60,
    skincare_150: get('SELECT COUNT(*) AS c FROM skincare_logs WHERE user_id = ?', [userId]).c >= 150,
    quest_10: u.total_quests >= 10,
    quest_50: u.total_quests >= 50,
    quest_150: u.total_quests >= 150,
    jewels_1000: u.jewels >= 1000,
    jewels_5000: u.jewels >= 5000,
    level_15: levelForXp(u.xp) >= 15,
    level_40: levelForXp(u.xp) >= 40,
    level_50: levelForXp(u.xp) >= 50,
    perfect_week: get(`SELECT COUNT(DISTINCT date) AS c FROM daily_rewards WHERE user_id = ? AND type = 'all_goals' AND date >= date('now','-6 days')`, [userId]).c >= 7,
    scan_25: u.total_scans >= 25,
    scan_50: u.total_scans >= 50,
  };
  for (const a of ACHIEVEMENTS) {
    const row = get('SELECT id FROM achievements WHERE code = ?', [a.code]);
    if (!row) continue;
    if (unlocked.has(row.id)) continue;
    if (conditions[a.code]) {
      q('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)', [userId, row.id]);
      addXp(userId, a.xp);
      notify(userId, 'achievement', `${a.icon} Erfolg freigeschaltet: ${a.title} (+${a.xp} XP)`);
      newly.push({ ...a, xp_reward: a.xp });
    }
  }
  return newly;
}

// ---------- Benutzer-Payload ----------
export function publicUser(userId) {
  const u = get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!u) return null;
  const level = levelInfo(u.xp);
  const unread = get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0', [userId]).c;
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    createdAt: u.created_at,
    xp: u.xp,
    jewels: u.jewels,
    streak: u.streak_count,
    bestStreak: u.best_streak,
    level: level.level,
    levelProgress: level.progress,
    xpIntoLevel: level.into,
    xpForNext: level.span,
    totalScans: u.total_scans,
    totalQuests: u.total_quests,
    totalFocusMinutes: u.total_focus_minutes,
    totalStudyMaterials: u.total_study_materials,
    totalQuizAnswered: u.total_quiz_answered,
    totalQuizCorrect: u.total_quiz_correct,
    totalAds: u.total_ads,
    totalHomeworkDone: u.total_homework_done,
    totalFoodLogs: u.total_food_logs,
    totalWorkouts: u.total_workouts,
    totalChats: u.total_chats,
    streakShields: u.streak_shields,
    totalConsumablesUsed: u.total_consumables_used,
    calorieGoal: u.calorie_goal,
    proteinGoal: u.protein_goal,
    carbsGoal: u.carbs_goal,
    fatGoal: u.fat_goal,
    avatarFrame: u.avatar_frame,
    badge: u.badge,
    title: u.title,
    theme: u.selected_theme,
    language: u.language || 'de',
    bio: u.bio,
    avatarImage: u.avatar_image || '',
    focusAreas: u.focus_areas ? JSON.parse(u.focus_areas) : [],
    onboarded: !!u.onboarded,
    unreadNotifications: unread,
  };
}

export function getUserById(userId) {
  return get('SELECT * FROM users WHERE id = ?', [userId]);
}
