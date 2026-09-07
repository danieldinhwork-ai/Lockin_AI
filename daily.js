// LOCKIN.AI – Tagesziele & Tagesbonus (komplett neu geschrieben)
import { Router } from 'express';
import { all, get, q } from '../db.js';
import { addJewels, addXp, notify, unlockAchievements, publicUser, todayStr } from '../store.js';

const router = Router();

const BONUS_JEWELS = 60;
const BONUS_XP = 120;

// Ziele, die die App NICHT automatisch verifizieren kann → manuell abhakbar
const MANUAL_KEYS = ['water', 'skincare', 'habits'];

// Daily Lock-In – sechs gleichwertige Lebensbereiche
const GOAL_DEFS = [
  { key: 'water', icon: '💧', label: 'Wasser', desc: '2 Liter Wasser trinken', check: (userId, date) => get('SELECT COALESCE(SUM(amount_ml),0) AS m FROM water_logs WHERE user_id = ? AND log_date = ?', [userId, date]).m >= 2000 },
  { key: 'skincare', icon: '🧴', label: 'Skincare', desc: 'Hautpflege-Routine durchführen', check: (userId, date) => get('SELECT COUNT(*) AS c FROM skincare_logs WHERE user_id = ? AND log_date = ?', [userId, date]).c >= 1 },
  { key: 'fitness', icon: '💪', label: 'Fitness', desc: 'Ein Workout für Körper und Geist', check: (userId, date) => get('SELECT COUNT(*) AS c FROM user_workouts WHERE user_id = ? AND date = ?', [userId, date]).c >= 1 },
  { key: 'nutrition', icon: '🍎', label: 'Ernährung', desc: 'Eine Mahlzeit bewusst tracken', check: (userId, date) => get('SELECT COUNT(*) AS c FROM food_logs WHERE user_id = ? AND log_date = ?', [userId, date]).c >= 1 },
  { key: 'focus', icon: '🧘', label: 'Fokus', desc: '10 Minuten ungeteilte Konzentration', check: (userId, date) => get('SELECT COALESCE(SUM(minutes),0) AS m FROM focus_sessions WHERE user_id = ? AND date(completed_at) = ?', [userId, date]).m >= 10 },
  { key: 'habits', icon: '😴', label: 'Schlaf', desc: '7+ Stunden Schlaf', check: (userId, date) => get('SELECT COUNT(*) AS c FROM sleep_logs WHERE user_id = ? AND sleep_date = ? AND hours >= 7', [userId, date]).c >= 1 },
];

const MESSAGES = [
  'Jeder große Fortschritt beginnt mit einem kleinen Schritt. 🌱',
  'Du hast begonnen – der wichtigste Schritt ist getan. 🌱',
  'Zwei Bereiche gepflegt. Momentum entsteht. 🌿',
  'Halbzeit – dein Tag gehört dir. 🌤️',
  'Konsistenz schlägt Perfektion. Weiter so! 🌿',
  'Fast geschafft – noch ein bewusster Schritt. 🧭',
  'Ein voller Tag. Du hast dir bewiesen, woraus du gemacht bist. 🏔️',
];

export function dailyGoalsForDate(userId, date) {
  const manualRows = all('SELECT goal_key FROM daily_goal_manual WHERE user_id = ? AND goal_date = ?', [userId, date]);
  const manual = new Set(manualRows.map((r) => r.goal_key));
  const goals = GOAL_DEFS.map((def) => {
    const m = manual.has(def.key);
    let auto = false;
    try { auto = def.check(userId, date); } catch { auto = false; }
    const isManualKey = MANUAL_KEYS.includes(def.key);
    const done = auto || (isManualKey && m);
    return { key: def.key, icon: def.icon, label: def.label, desc: def.desc, auto, manual: m, done, isManual: isManualKey };
  });
  const doneCount = goals.filter((g) => g.done).length;
  const claimed = get('SELECT * FROM daily_rewards WHERE user_id = ? AND date = ? AND type = ?', [userId, date, 'all_goals']) !== undefined;
  return { date, goals, doneCount, total: goals.length, allDone: doneCount === goals.length, claimed, message: MESSAGES[doneCount] };
}

export function dailyGoals(userId) {
  return dailyGoalsForDate(userId, todayStr());
}

// Status der Tagesziele
router.get('/', (req, res) => {
  try {
    res.json({ daily: dailyGoals(req.userId) });
  } catch (e) {
    res.status(500).json({ error: 'Tagesziele konnten nicht geladen werden: ' + e.message });
  }
});

// Tagesziel manuell abhaken / Haken entfernen
router.post('/toggle', (req, res) => {
  try {
    const { key } = req.body || {};
    if (!key) return res.status(400).json({ error: 'Kein Ziel angegeben.' });
    if (!MANUAL_KEYS.includes(key)) return res.status(400).json({ error: 'Dieses Ziel wird automatisch erkannt.' });
    const today = todayStr();
    const exists = get('SELECT goal_key FROM daily_goal_manual WHERE user_id = ? AND goal_date = ? AND goal_key = ?', [req.userId, today, key]);
    if (exists) {
      q('DELETE FROM daily_goal_manual WHERE user_id = ? AND goal_date = ? AND goal_key = ?', [req.userId, today, key]);
    } else {
      q('INSERT OR IGNORE INTO daily_goal_manual (user_id, goal_date, goal_key) VALUES (?,?,?)', [req.userId, today, key]);
    }
    const result = dailyGoals(req.userId);
    res.json({ daily: result, toggledKey: key, isDone: result.goals.find((g) => g.key === key)?.done });
  } catch (e) {
    res.status(500).json({ error: 'Toggle fehlgeschlagen: ' + e.message });
  }
});

// Tagesbonus einlösen
router.post('/claim', (req, res) => {
  try {
    const d = dailyGoals(req.userId);
    if (!d.allDone) return res.status(400).json({ error: 'Noch nicht alle Tagesziele erfüllt.' });
    if (d.claimed) return res.status(400).json({ error: 'Tagesbonus heute schon eingelöst.' });
    q('INSERT OR IGNORE INTO daily_rewards (user_id, date, type) VALUES (?, ?, ?)', [req.userId, d.date, 'all_goals']);
    addJewels(req.userId, BONUS_JEWELS);
    addXp(req.userId, BONUS_XP);
    notify(req.userId, 'reward', `🏔️ Voller Tag: Alle ${d.total} Gewohnheiten gepflegt! Belohnung: +${BONUS_JEWELS} 💎 +${BONUS_XP} ⚡`);
    const newAchievements = unlockAchievements(req.userId);
    res.json({
      rewards: { jewels: BONUS_JEWELS, xp: BONUS_XP },
      newAchievements,
      daily: { ...dailyGoals(req.userId), claimed: true },
      user: publicUser(req.userId),
    });
  } catch (e) {
    res.status(500).json({ error: 'Claim fehlgeschlagen: ' + e.message });
  }
});

export default router;
export { BONUS_JEWELS, BONUS_XP };
