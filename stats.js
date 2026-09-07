// LOCKIN.AI – Statistik & Fortschrittsgrafiken für alle Lebensbereiche
import { Router } from 'express';
import { all, get } from '../db.js';
import { lifeScore } from '../store.js';

const router = Router();

function iso(d) {
  return d.toISOString().slice(0, 10);
}

router.get('/', (req, res) => {
  const ls = lifeScore(req.userId);
  const u = get('SELECT * FROM users WHERE id = ?', [req.userId]);

  // ─── Tagesdaten der letzten 14 Tage ───
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = iso(d);

    const workouts = get('SELECT COUNT(*) AS c, COALESCE(SUM(duration_min),0) AS m FROM user_workouts WHERE user_id = ? AND date = ?', [req.userId, date]);
    const focus = get('SELECT COALESCE(SUM(minutes),0) AS m FROM focus_sessions WHERE user_id = ? AND date(completed_at) = ?', [req.userId, date]);
    const kcal = get('SELECT COALESCE(SUM(kcal),0) AS k FROM food_logs WHERE user_id = ? AND log_date = ?', [req.userId, date]);
    const sleep = get('SELECT hours FROM sleep_logs WHERE user_id = ? AND sleep_date = ?', [req.userId, date]);
    const water = get('SELECT COALESCE(SUM(amount_ml),0) AS m FROM water_logs WHERE user_id = ? AND log_date = ?', [req.userId, date]);
    const skincare = get('SELECT COUNT(*) AS c FROM skincare_logs WHERE user_id = ? AND log_date = ?', [req.userId, date]);
    const scans = get('SELECT COUNT(*) AS c FROM scans WHERE user_id = ? AND date(created_at) = ?', [req.userId, date]);
    const study = get('SELECT COUNT(*) AS c FROM study_materials WHERE user_id = ? AND date(created_at) = ?', [req.userId, date]);
    const quiz = get('SELECT COUNT(*) AS c FROM quiz_attempts WHERE user_id = ? AND date(created_at) = ?', [req.userId, date]);
    const homework = get('SELECT COUNT(*) AS c FROM homework WHERE user_id = ? AND done = 1 AND date(done_at) = ?', [req.userId, date]);
    const manual = get('SELECT COUNT(*) AS c FROM daily_goal_manual WHERE user_id = ? AND goal_date = ?', [req.userId, date]);

    daily.push({
      date,
      weekday: d.toLocaleDateString('de-DE', { weekday: 'short' }),
      workouts: workouts.c,
      workoutMin: workouts.m,
      focusMin: focus.m,
      kcal: Math.round(kcal.k),
      sleepHours: sleep ? sleep.hours : null,
      waterMl: water.m,
      skincare: skincare.c,
      scans: scans.c,
      study: study.c,
      quiz: quiz.c,
      homework: homework.c,
      manual: manual.c,
    });
  }

  // ─── Wochen-Trend der letzten 8 Wochen (Montag–Sonntag) ───
  const now = new Date();
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  const weekly = [];
  for (let weeksAgo = 7; weeksAgo >= 0; weeksAgo--) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - 7 * weeksAgo);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const s = iso(monday);
    const e = iso(sunday);

    const workouts = get('SELECT COUNT(*) AS c FROM user_workouts WHERE user_id = ? AND date BETWEEN ? AND ?', [req.userId, s, e]);
    const focus = get('SELECT COALESCE(SUM(minutes),0) AS m FROM focus_sessions WHERE user_id = ? AND date(completed_at) BETWEEN ? AND ?', [req.userId, s, e]);
    const kcal = get('SELECT COALESCE(SUM(kcal),0) AS k FROM food_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?', [req.userId, s, e]);
    const sleep = get('SELECT COUNT(*) AS c FROM sleep_logs WHERE user_id = ? AND sleep_date BETWEEN ? AND ?', [req.userId, s, e]);
    const water = get('SELECT COALESCE(SUM(amount_ml),0) AS m FROM water_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?', [req.userId, s, e]);
    const skincare = get('SELECT COUNT(*) AS c FROM skincare_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?', [req.userId, s, e]);
    const scans = get('SELECT COUNT(*) AS c FROM scans WHERE user_id = ? AND date(created_at) BETWEEN ? AND ?', [req.userId, s, e]);
    const study = get('SELECT COUNT(*) AS c FROM study_materials WHERE user_id = ? AND date(created_at) BETWEEN ? AND ?', [req.userId, s, e]);
    const quiz = get('SELECT COUNT(*) AS c FROM quiz_attempts WHERE user_id = ? AND date(created_at) BETWEEN ? AND ?', [req.userId, s, e]);
    const homework = get('SELECT COUNT(*) AS c FROM homework WHERE user_id = ? AND done = 1 AND date(done_at) BETWEEN ? AND ?', [req.userId, s, e]);
    const claimed = get('SELECT COUNT(*) AS c FROM user_quests uq JOIN quests q ON q.id = uq.quest_id WHERE uq.user_id = ? AND uq.claimed = 1 AND date(uq.claimed_at) BETWEEN ? AND ?', [req.userId, s, e]);

    weekly.push({
      weekStart: s,
      label: `${new Date(s + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`,
      workouts: workouts.c,
      focusMin: focus.m,
      kcal: Math.round(kcal.k),
      sleepNights: sleep.c,
      waterMl: water.m,
      skincare: skincare.c,
      scans: scans.c,
      study: study.c,
      quiz: quiz.c,
      homework: homework.c,
      questsClaimed: claimed.c,
    });
  }

  // ─── Gesamt-Totals pro Lebensbereich ───
  const totals = {
    appearance: {
      scans: get('SELECT COUNT(*) AS c FROM scans WHERE user_id = ?', [req.userId]).c,
      lastScore: get('SELECT score FROM scans WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.userId])?.score ?? null,
    },
    fitness: {
      workouts: get('SELECT COUNT(*) AS c FROM user_workouts WHERE user_id = ?', [req.userId]).c,
      workoutMin: get('SELECT COALESCE(SUM(duration_min),0) AS m FROM user_workouts WHERE user_id = ?', [req.userId]).m,
    },
    nutrition: {
      foodLogs: get('SELECT COUNT(*) AS c FROM food_logs WHERE user_id = ?', [req.userId]).c,
      kcalTotal: get('SELECT COALESCE(SUM(kcal),0) AS k FROM food_logs WHERE user_id = ?', [req.userId]).k,
      logStreak: currentLogStreak(req.userId),
    },
    focus: {
      sessions: get('SELECT COUNT(*) AS c FROM focus_sessions WHERE user_id = ?', [req.userId]).c,
      minutes: get('SELECT COALESCE(SUM(minutes),0) AS m FROM focus_sessions WHERE user_id = ?', [req.userId]).m,
    },
    study: {
      materials: get('SELECT COUNT(*) AS c FROM study_materials WHERE user_id = ?', [req.userId]).c,
      quizAttempts: get('SELECT COUNT(*) AS c FROM quiz_attempts WHERE user_id = ?', [req.userId]).c,
      quizCorrect: get('SELECT COALESCE(SUM(score),0) AS s FROM quiz_attempts WHERE user_id = ?', [req.userId]).s,
      quizTotal: get('SELECT COALESCE(SUM(total),0) AS t FROM quiz_attempts WHERE user_id = ?', [req.userId]).t,
      homeworkDone: get('SELECT COUNT(*) AS c FROM homework WHERE user_id = ? AND done = 1', [req.userId]).c,
    },
    habits: {
      sleepNights: get('SELECT COUNT(*) AS c FROM sleep_logs WHERE user_id = ?', [req.userId]).c,
      avgSleep: get('SELECT ROUND(AVG(hours),1) AS a FROM sleep_logs WHERE user_id = ?', [req.userId]).a ?? 0,
      waterMl: get('SELECT COALESCE(SUM(amount_ml),0) AS m FROM water_logs WHERE user_id = ?', [req.userId]).m,
      skincare: get('SELECT COUNT(*) AS c FROM skincare_logs WHERE user_id = ?', [req.userId]).c,
    },
    discipline: {
      streak: u.streak_count,
      bestStreak: u.best_streak,
      questsClaimed: u.total_quests,
      achievements: get('SELECT COUNT(*) AS c FROM user_achievements WHERE user_id = ?', [req.userId]).c,
    },
  };

  res.json({ lifeScore: ls, daily, weekly, totals });
});

function currentLogStreak(userId) {
  let streak = 0;
  const d = new Date();
  const today = iso(d);
  const hasToday = get('SELECT COUNT(*) AS c FROM food_logs WHERE user_id = ? AND log_date = ?', [userId, today]).c > 0;
  if (!hasToday) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const date = iso(new Date(d.getTime() - i * 86400000));
    const has = get('SELECT COUNT(*) AS c FROM food_logs WHERE user_id = ? AND log_date = ?', [userId, date]).c > 0;
    if (!has) break;
    streak += 1;
  }
  return streak;
}

export default router;

// ─── Habit-Heatmap: tägliche Ziel-Erfüllungen der letzten 365 Tage ───
// Nutzt dieselben Kriterien wie der Daily Lock-In (daily.js), aber effizient:
// pro Tabelle EIN aggregierter Query, Auswertung in JS statt 365×6 Queries.
router.get('/heatmap', (req, res) => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  const startDate = iso(start);
  const endDate = iso(today);

  // Datumsindex initialisieren: date -> Set der erfüllten Bereiche
  const days = new Map();
  for (let i = 0; i < 365; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    days.set(iso(d), new Set());
  }
  const mark = (dateCol, table, key, where = '') => {
    for (const row of all(`SELECT ${dateCol} AS d FROM ${table} WHERE user_id = ? AND ${dateCol} >= ? AND ${dateCol} <= ? ${where}`, [req.userId, startDate, endDate])) {
      const set = days.get(row.d);
      if (set) set.add(key);
    }
  };

  // Wasser: mind. 2000 ml am Tag
  for (const row of all('SELECT log_date AS d, SUM(amount_ml) AS m FROM water_logs WHERE user_id = ? AND log_date >= ? AND log_date <= ? GROUP BY log_date HAVING m >= 2000', [req.userId, startDate, endDate])) {
    days.get(row.d)?.add('water');
  }
  mark('log_date', 'skincare_logs', 'skincare');
  mark('date', 'user_workouts', 'fitness');
  mark('log_date', 'food_logs', 'nutrition');
  // Fokus: mind. 10 Minuten am Tag
  for (const row of all(`SELECT date(completed_at) AS d, SUM(minutes) AS m FROM focus_sessions WHERE user_id = ? AND date(completed_at) >= ? AND date(completed_at) <= ? GROUP BY date(completed_at) HAVING m >= 10`, [req.userId, startDate, endDate])) {
    days.get(row.d)?.add('focus');
  }
  // Schlaf: mind. 7 Stunden
  for (const row of all('SELECT sleep_date AS d, MAX(hours) AS h FROM sleep_logs WHERE user_id = ? AND sleep_date >= ? AND sleep_date <= ? GROUP BY sleep_date HAVING h >= 7', [req.userId, startDate, endDate])) {
    days.get(row.d)?.add('habits');
  }
  // Manuell abgehakte Ziele (Wasser/Skincare/Schlaf) zusätzlich werten
  for (const row of all('SELECT goal_date AS d, goal_key FROM daily_goal_manual WHERE user_id = ? AND goal_date >= ? AND goal_date <= ?', [req.userId, startDate, endDate])) {
    if (['water', 'skincare', 'habits'].includes(row.goal_key)) days.get(row.d)?.add(row.goal_key);
  }

  const heatmap = [...days.entries()].map(([date, set]) => ({ date, count: set.size, areas: [...set] }));
  const activeDays = heatmap.filter((d) => d.count > 0).length;
  const perfectDays = heatmap.filter((d) => d.count >= 6).length;
  // Längste Serie hintereinanderliegender aktiver Tage (mindestens 1 Bereich)
  let bestRun = 0, run = 0;
  for (const d of heatmap) {
    if (d.count > 0) { run += 1; bestRun = Math.max(bestRun, run); } else run = 0;
  }

  res.json({ days: heatmap, activeDays, perfectDays, bestRun });
});
