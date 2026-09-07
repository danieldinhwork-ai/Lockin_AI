// LOCKIN.AI – Habits, Schlaf, Wasser & Skincare
import { Router } from 'express';
import { all, get, q } from '../db.js';
import { addXp, touchStreak, bumpQuest, unlockAchievements, publicUser, todayStr, notify } from '../store.js';

const router = Router();

router.get('/', (req, res) => {
  const sleepLogs = all('SELECT * FROM sleep_logs WHERE user_id = ? ORDER BY sleep_date DESC, id DESC LIMIT 14', [req.userId]);
  const date = todayStr();
  const waterLogs = all('SELECT * FROM water_logs WHERE user_id = ? AND log_date = ? ORDER BY created_at DESC', [req.userId, date]);
  const skincareLogs = all('SELECT * FROM skincare_logs WHERE user_id = ? AND log_date = ? ORDER BY created_at DESC', [req.userId, date]);
  const waterTotal = waterLogs.reduce((s, l) => s + (l.amount_ml || 0), 0);
  res.json({ sleepLogs, waterLogs, skincareLogs, waterTotal, waterGoal: 2000 });
});

// Schlafdauer loggen (ein Eintrag pro Tag, wird überschrieben)
router.post('/sleep', (req, res) => {
  const { hours, note } = req.body || {};
  const h = Math.max(1, Math.min(16, Math.round(Number(hours) * 10) / 10));
  if (!h || Number.isNaN(h)) return res.status(400).json({ error: 'Bitte eine gültige Schlafdauer angeben' });
  const date = todayStr();
  const exists = get('SELECT id FROM sleep_logs WHERE user_id = ? AND sleep_date = ?', [req.userId, date]);
  if (exists) q('UPDATE sleep_logs SET hours = ?, note = ? WHERE id = ?', [h, String(note || '').slice(0, 200), exists.id]);
  else q('INSERT INTO sleep_logs (user_id, sleep_date, hours, note) VALUES (?,?,?,?)', [req.userId, date, h, String(note || '').slice(0, 200)]);
  touchStreak(req.userId);
  addXp(req.userId, 10);
  if (h >= 7) bumpQuest(req.userId, 'daily_sleep');
  const newAchievements = unlockAchievements(req.userId);
  notify(req.userId, 'reward', `😴 Schlaf geloggt: ${h} Std. Erholung zählt!`);
  const log = get('SELECT * FROM sleep_logs WHERE user_id = ? AND sleep_date = ?', [req.userId, date]);
  res.json({ rewards: { xp: 10 }, log, newAchievements, user: publicUser(req.userId) });
});

// Wasser trinken loggen
router.post('/water', (req, res) => {
  const { amount_ml } = req.body || {};
  const ml = Math.max(50, Math.min(3000, Math.round(Number(amount_ml) || 250)));
  const date = todayStr();
  q('INSERT INTO water_logs (user_id, log_date, amount_ml) VALUES (?,?,?)', [req.userId, date, ml]);
  const total = get('SELECT COALESCE(SUM(amount_ml),0) AS total FROM water_logs WHERE user_id = ? AND log_date = ?', [req.userId, date]).total;
  const glasses = Math.round(total / 250);
  addXp(req.userId, 5);
  touchStreak(req.userId);
  if (total >= 2000) bumpQuest(req.userId, 'daily_water');
  notify(req.userId, 'reward', `💧 ${ml}ml Wasser getrunken! (${glasses}/8 Gläser)`);
  res.json({ rewards: { xp: 5 }, waterTotal: total, glasses, user: publicUser(req.userId) });
});

// Skincare Routine loggen
router.post('/skincare', (req, res) => {
  const { step } = req.body || {};
  const validSteps = ['reinigung', 'toner', 'serum', 'moisturizer', 'sunscreen', 'nachtcreme'];
  const s = validSteps.includes(step) ? step : 'reinigung';
  const date = todayStr();
  const exists = get('SELECT id FROM skincare_logs WHERE user_id = ? AND log_date = ? AND step = ?', [req.userId, date, s]);
  if (exists) return res.status(200).json({ message: 'Bereits geloggt', step: s });
  q('INSERT INTO skincare_logs (user_id, log_date, step) VALUES (?,?,?)', [req.userId, date, s]);
  const count = get('SELECT COUNT(*) AS c FROM skincare_logs WHERE user_id = ? AND log_date = ?', [req.userId, date]).c;
  addXp(req.userId, 8);
  touchStreak(req.userId);
  bumpQuest(req.userId, 'daily_skincare');
  notify(req.userId, 'reward', `🧴 Skincare: ${s.charAt(0).toUpperCase() + s.slice(1)} erledigt! (${count} Schritte heute)`);
  res.json({ rewards: { xp: 8 }, skincareCount: count, user: publicUser(req.userId) });
});

export default router;
