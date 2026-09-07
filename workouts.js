// LOCKIN.AI – Workout-Planer
import { Router } from 'express';
import { all, get, q } from '../db.js';
import { bumpQuest, addXp, addJewels, touchStreak, unlockAchievements, publicUser, notify } from '../store.js';

const router = Router();

// Montag der aktuellen Woche (ISO) – gleiche Logik wie reflections.js
function weekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

// Wöchentliche gelaufene km + Ziel-Status (inkl. Bonus-Auszahlung)
function runGoalState(userId) {
  const ws = weekStart();
  const user = get('SELECT weekly_run_goal_km FROM users WHERE id = ?', [userId]);
  const agg = get(
    `SELECT COALESCE(SUM(distance_km),0) AS km, COUNT(*) AS runs FROM user_workouts
     WHERE user_id = ? AND kind = 'run' AND distance_km IS NOT NULL AND date >= ?`, [userId, ws]
  );
  const goalKm = Math.max(1, Number(user?.weekly_run_goal_km) || 10);
  const km = Math.round(Number(agg.km) * 10) / 10;
  const reward = get('SELECT * FROM weekly_run_rewards WHERE user_id = ? AND week_start = ?', [userId, ws]);
  const reached = km >= goalKm;
  return {
    weekStart: ws,
    goalKm,
    kmThisWeek: km,
    runsThisWeek: agg.runs,
    pct: Math.min(100, Math.round((km / goalKm) * 100)),
    reached,
    bonus: reward ? { xp: reward.xp_bonus, jewels: reward.jewels_bonus, kmAtReward: reward.km_at_reward } : null,
    // Bonus: 100 XP + 30 💎, skaliert leicht mit dem Ziel (ziehiger als Tages-Workouts,
    // damit echtes Training nicht unterläuft)
    bonusPending: reached && !reward,
    bonusXp: 100,
    bonusJewels: 30,
  };
}

// Wöchentliches Lauf-Ziel: Status abrufen
router.get('/run-goal', (req, res) => {
  res.json(runGoalState(req.userId));
});

// Wöchentliches Lauf-Ziel: Ziel in km setzen (5–100)
router.put('/run-goal', (req, res) => {
  const raw = Number(req.body?.goalKm);
  if (!Number.isFinite(raw) || raw < 5 || raw > 100) {
    return res.status(400).json({ error: 'Ziel muss zwischen 5 und 100 km liegen' });
  }
  q('UPDATE users SET weekly_run_goal_km = ? WHERE id = ?', [Math.round(raw), req.userId]);
  res.json(runGoalState(req.userId));
});

// Wochen-Bonus auszahlen (nur einmal pro Woche, wenn Ziel erreicht)
router.post('/run-goal/claim', (req, res) => {
  const state = runGoalState(req.userId);
  if (!state.reached) return res.status(400).json({ error: 'Ziel noch nicht erreicht' });
  if (state.bonus) return res.status(400).json({ error: 'Der Wochen-Bonus wurde schon abgeholt' });
  const ws = state.weekStart;
  q('INSERT OR IGNORE INTO weekly_run_rewards (user_id, week_start, km_at_reward, xp_bonus, jewels_bonus) VALUES (?,?,?,?,?)',
    [req.userId, ws, state.kmThisWeek, state.bonusXp, state.bonusJewels]);
  addXp(req.userId, state.bonusXp);
  addJewels(req.userId, state.bonusJewels);
  notify(req.userId, 'reward', `🏁 Wochen-Laufziel erreicht! +${state.bonusXp} XP +${state.bonusJewels} 💎`);
  const newAchievements = unlockAchievements(req.userId);
  res.json({ ...runGoalState(req.userId), rewards: { xp: state.bonusXp, jewels: state.bonusJewels }, newAchievements, user: publicUser(req.userId) });
});

// ---------- Pläne ----------
router.get('/plans', (req, res) => {
  const plans = all('SELECT * FROM workout_plans WHERE active = 1 ORDER BY id');
  res.json({ plans: plans.map((p) => ({ ...p, exercises: JSON.parse(p.exercises) })) });
});

router.get('/plans/:id', (req, res) => {
  const p = get('SELECT * FROM workout_plans WHERE id = ? AND active = 1', [Number(req.params.id)]);
  if (!p) return res.status(404).json({ error: 'Plan nicht gefunden' });
  res.json({ plan: { ...p, exercises: JSON.parse(p.exercises) } });
});

// ---------- Aktiver Wochenplan ----------
router.get('/active-plan', (req, res) => {
  const ap = get('SELECT * FROM user_weekly_plans WHERE user_id = ?', [req.userId]);
  if (!ap) return res.json({ activePlan: null });
  const plan = get('SELECT * FROM workout_plans WHERE id = ? AND active = 1', [ap.plan_id]);
  if (!plan) return res.json({ activePlan: null });
  res.json({
    activePlan: {
      planId: ap.plan_id,
      plan: { ...plan, exercises: JSON.parse(plan.exercises) },
      weekDays: JSON.parse(ap.week_days || '[]'),
      reminderTime: ap.reminder_time,
      setAt: ap.set_at,
    },
  });
});

// body: { planId, weekDays: [0..6] (Mo..So), reminderTime: 'HH:MM' }
router.post('/active-plan', (req, res) => {
  const { planId, weekDays, reminderTime } = req.body || {};
  const plan = get('SELECT * FROM workout_plans WHERE id = ? AND active = 1', [Number(planId)]);
  if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });
  const days = [...new Set((Array.isArray(weekDays) ? weekDays : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
  if (days.length === 0) return res.status(400).json({ error: 'Mindestens einen Trainingstag wählen' });
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(reminderTime)) ? String(reminderTime) : '18:00';

  const existing = get('SELECT 1 FROM user_weekly_plans WHERE user_id = ?', [req.userId]);
  if (existing) {
    q("UPDATE user_weekly_plans SET plan_id = ?, week_days = ?, reminder_time = ?, set_at = datetime('now') WHERE user_id = ?",
      [plan.id, JSON.stringify(days), time, req.userId]);
  } else {
    q("INSERT INTO user_weekly_plans (user_id, plan_id, week_days, reminder_time, set_at) VALUES (?,?,?,?,datetime('now'))",
      [req.userId, plan.id, JSON.stringify(days), time]);
  }

  // Alte automatische Plan-Erinnerungen entfernen, neue je Trainingstag anlegen
  q("DELETE FROM workout_reminders WHERE user_id = ? AND source = 'plan'", [req.userId]);
  let created = 0;
  for (const wd of days) {
    q("INSERT INTO workout_reminders (user_id, day_of_week, time, message, source) VALUES (?,?,?,?,'plan')",
      [req.userId, wd, time, `Zeit für ${plan.name}! 💪`]);
    created += 1;
  }

  res.json({
    activePlan: {
      planId: plan.id,
      plan: { ...plan, exercises: JSON.parse(plan.exercises) },
      weekDays: days,
      reminderTime: time,
    },
    remindersCreated: created,
  });
});

router.delete('/active-plan', (req, res) => {
  q('DELETE FROM user_weekly_plans WHERE user_id = ?', [req.userId]);
  q("DELETE FROM workout_reminders WHERE user_id = ? AND source = 'plan'", [req.userId]);
  res.json({ ok: true });
});

// ---------- Sessions ----------
// body: { planId?, name, date, durationMin, exercises: [{name,sets,reps}], notes? }
router.post('/sessions', (req, res) => {
  const { planId, name, date, durationMin, exercises, notes, distanceKm, kind } = req.body || {};
  const n = String(name || '').trim() || 'Workout';
  const d = String(date || new Date().toISOString().slice(0, 10));
  const mins = Math.min(300, Math.max(1, Math.round(Number(durationMin) || 30)));
  const ex = Array.isArray(exercises) ? exercises : [];
  // Lauf-Eintrag: Distanz in km (0.1–200), Typ 'run' für Lauf-Bewertung & Quests
  const kmRaw = Number(distanceKm);
  const km = Number.isFinite(kmRaw) && kmRaw > 0 ? Math.min(200, Math.round(kmRaw * 10) / 10) : null;
  const isRun = kind === 'run' || km != null;
  const kindVal = isRun ? 'run' : 'workout';
  // XP: Workout 30 · Lauf 40 + 10 pro km (max. +100) → Laufen lohnt sich besonders
  const xp = isRun && km ? Math.min(140, 40 + Math.round(km * 10)) : 30;
  const jewels = isRun && km ? Math.min(30, 5 + Math.round(km * 2)) : 10;
  // ── Anti-Farm-Regeln ──
  // 1) Spaziergang-Button: nur EIN „Spaziergang"-Bonus pro Tag (die Quest heißt „10 Min. Spaziergang")
  const todayStr = new Date().toISOString().slice(0, 10);
  const isStroll = /^spaziergang$/i.test(n);
  const strollsToday = get(
    `SELECT COUNT(*) AS c FROM user_workouts WHERE user_id = ? AND date = ? AND kind = 'stroll'`, [req.userId, d || todayStr]
  ).c;
  if (isStroll && strollsToday >= 1) {
    return res.status(400).json({
      error: 'Der Spaziergang-Bonus wurde heute schon abgeholt – die Tagesaufgabe ist einmal pro Tag. 💚 (Ein weiterer Spaziergang würde trotzdem zählen – trag ihn einfach über den Kalender mit Distanz ein.)',
      code: 'STROLL_DAILY_LIMIT',
    });
  }
  // 2) Maximale Boni pro Tag: 5 Workouts + max. 30 km Lauf-Distanz – alles darüber wird gespeichert, gibt aber nichts mehr
  const todayStats = get(
    `SELECT COUNT(*) AS workouts, COALESCE(SUM(CASE WHEN kind = 'run' THEN distance_km ELSE 0 END),0) AS km
     FROM user_workouts WHERE user_id = ? AND date = ?`, [req.userId, d]
  );
  const cappedWorkout = todayStats.workouts >= 5;
  const kmToday = todayStats.km || 0;
  const kmCounting = isRun && km ? Math.max(0, Math.min(km, Math.max(0, 30 - kmToday))) : 0;
  const xpFinal = cappedWorkout ? 0 : xp - Math.max(0, Math.round((km - kmCounting) * 10));
  const jewelsFinal = cappedWorkout ? 0 : jewels - Math.max(0, Math.round((km - kmCounting) * 2));
  const kindStored = isStroll ? 'stroll' : kindVal;
  const id = q('INSERT INTO user_workouts (user_id, plan_id, name, date, duration_min, exercises, notes, distance_km, kind) VALUES (?,?,?,?,?,?,?,?,?)',
    [req.userId, planId ? Number(planId) : null, n, d, mins, JSON.stringify(ex), String(notes || ''), km, kindStored]);
  q('UPDATE users SET total_workouts = total_workouts + 1 WHERE id = ?', [req.userId]);
  touchStreak(req.userId);
  addXp(req.userId, Math.max(0, xpFinal));
  addJewels(req.userId, Math.max(0, jewelsFinal));
  bumpQuest(req.userId, 'daily_workout');
  bumpQuest(req.userId, 'first_workout');
  // Leichte Bewegung (z. B. Spaziergang) zählt zusätzlich zur Bewegungs-Quest
  if (/spazier|walk|gehen/i.test(n)) bumpQuest(req.userId, 'daily_walk');
  const newAchievements = unlockAchievements(req.userId);

  res.status(201).json({
    session: { ...get('SELECT * FROM user_workouts WHERE id = ?', [id]), exercises: JSON.parse(get('SELECT exercises FROM user_workouts WHERE id = ?', [id]).exercises || '[]') },
    rewards: { xp: Math.max(0, xpFinal), jewels: Math.max(0, jewelsFinal) },
    capped: cappedWorkout || (isRun && km != null && kmCounting < km),
    newAchievements,
    user: publicUser(req.userId),
  });
});

router.get('/sessions', (req, res) => {
  const from = String(req.query.from || '1900-01-01');
  const to = String(req.query.to || '2100-01-01');
  const rows = all('SELECT * FROM user_workouts WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, id DESC', [req.userId, from, to]);
  res.json({ sessions: rows.map((r) => ({ ...r, exercises: JSON.parse(r.exercises) })) });
});

// Lauf-Statistik: Summen + Bestzeit über alle gespeicherten Läufe
router.get('/runs', (req, res) => {
  const s = get(
    `SELECT COUNT(*) AS runs, COALESCE(SUM(distance_km),0) AS totalKm, COALESCE(SUM(duration_min),0) AS totalMin
     FROM user_workouts WHERE user_id = ? AND kind = 'run' AND distance_km IS NOT NULL`, [req.userId]
  );
  const runs = all(
    `SELECT id, name, date, duration_min, distance_km, notes FROM user_workouts
     WHERE user_id = ? AND kind = 'run' AND distance_km IS NOT NULL ORDER BY date DESC, id DESC LIMIT 30`, [req.userId]
  );
  res.json({ stats: s, runs });
});

router.delete('/sessions/:id', (req, res) => {
  q('DELETE FROM user_workouts WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
  res.json({ ok: true });
});

// ---------- Kalender (Monat) ----------
router.get('/calendar', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-31`;
  const rows = all(
    `SELECT date, COUNT(*) AS count, SUM(duration_min) AS minutes FROM user_workouts
     WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date`, [req.userId, start, end]
  );
  const days = rows.map((r) => ({ ...r, planned: 0, plan_id: null, plan_name: null }));

  // Geplante Trainingstage des aktiven Wochenplans eintragen
  const ap = get('SELECT * FROM user_weekly_plans WHERE user_id = ?', [req.userId]);
  if (ap) {
    const plan = get('SELECT id, name, duration_min FROM workout_plans WHERE id = ? AND active = 1', [ap.plan_id]);
    if (plan) {
      const weekDays = JSON.parse(ap.week_days || '[]');
      const daysInMonth = new Date(year, month, 0).getDate();
      const byDate = new Map(days.map((d) => [d.date, d]));
      for (let d = 1; d <= daysInMonth; d++) {
        const jsDay = (new Date(year, month - 1, d).getDay() + 6) % 7; // Mo = 0
        if (!weekDays.includes(jsDay)) continue;
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const existing = byDate.get(iso);
        if (existing) {
          existing.planned = 1;
          existing.plan_id = plan.id;
          existing.plan_name = plan.name;
        } else {
          days.push({ date: iso, count: 0, minutes: 0, planned: 1, plan_id: plan.id, plan_name: plan.name });
        }
      }
    }
  }
  res.json({ year, month, days });
});

// ---------- Statistiken ----------
router.get('/stats', (req, res) => {
  const total = get('SELECT COUNT(*) AS c, COALESCE(SUM(duration_min),0) AS minutes FROM user_workouts WHERE user_id = ?', [req.userId]);
  const thisWeek = get(
    `SELECT COUNT(*) AS c, COALESCE(SUM(duration_min),0) AS minutes FROM user_workouts WHERE user_id = ? AND date >= date('now','weekday 0','-6 days')`, [req.userId]
  );
  const lastWeek = get(
    `SELECT COUNT(*) AS c FROM user_workouts WHERE user_id = ? AND date >= date('now','weekday 0','-13 days') AND date < date('now','weekday 0','-6 days')`, [req.userId]
  );
  // Letzte 8 Wochen
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    const start = new Date();
    start.setDate(start.getDate() - (start.getDay() + 7 + w * 7) + 1); // Montag
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const c = get('SELECT COUNT(*) AS c FROM user_workouts WHERE user_id = ? AND date BETWEEN ? AND ?', [req.userId, fmt(start), fmt(end)]).c;
    weeks.push({ start: fmt(start), workouts: c });
  }
  // Workout-Streak (aufeinanderfolgende Tage mit Workout)
  let streak = 0;
  const d = new Date();
  const hasToday = get('SELECT COUNT(*) AS c FROM user_workouts WHERE user_id = ? AND date = ?', [req.userId, d.toISOString().slice(0, 10)]).c > 0;
  if (!hasToday) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const date = new Date(d.getTime() - i * 86400000).toISOString().slice(0, 10);
    const c = get('SELECT COUNT(*) AS c FROM user_workouts WHERE user_id = ? AND date = ?', [req.userId, date]).c;
    if (c === 0) break;
    streak += 1;
  }
  res.json({
    total: total.c, totalMinutes: total.minutes,
    thisWeek: thisWeek.c, thisWeekMinutes: thisWeek.minutes,
    lastWeek: lastWeek.c,
    streak, weeks,
  });
});

// ---------- Erinnerungen ----------
router.get('/reminders', (req, res) => {
  const rows = all('SELECT * FROM workout_reminders WHERE user_id = ? ORDER BY id DESC', [req.userId]);
  res.json({ reminders: rows });
});

router.post('/reminders', (req, res) => {
  const { dayOfWeek, time, message } = req.body || {};
  const t = String(time || '18:00');
  const m = String(message || '').trim() || 'Zeit für dein Workout! 💪';
  const id = q('INSERT INTO workout_reminders (user_id, day_of_week, time, message) VALUES (?,?,?,?)',
    [req.userId, dayOfWeek !== undefined && dayOfWeek !== null && dayOfWeek !== '' ? Number(dayOfWeek) : null, t, m]);
  res.status(201).json({ reminder: get('SELECT * FROM workout_reminders WHERE id = ?', [id]) });
});

router.patch('/reminders/:id', (req, res) => {
  const { enabled } = req.body || {};
  q('UPDATE workout_reminders SET enabled = ? WHERE id = ? AND user_id = ?', [enabled ? 1 : 0, Number(req.params.id), req.userId]);
  res.json({ ok: true });
});

router.delete('/reminders/:id', (req, res) => {
  q('DELETE FROM workout_reminders WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
  res.json({ ok: true });
});

export default router;
