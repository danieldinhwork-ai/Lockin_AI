// LOCKIN.AI – Wöchentliche Reflexion (Sonntag)
import { Router } from 'express';
import { all, get, q } from '../db.js';
import { addJewels, addXp, bumpQuest, touchStreak, unlockAchievements, publicUser, notify } from '../store.js';

const router = Router();

// Montag der aktuellen Woche (ISO-Woche)
function weekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function isSunday() {
  return new Date().getDay() === 0;
}

router.get('/', (req, res) => {
  const start = weekStart();
  const current = get('SELECT * FROM weekly_reflections WHERE user_id = ? AND week_start = ?', [req.userId, start]);
  const history = all('SELECT * FROM weekly_reflections WHERE user_id = ? ORDER BY week_start DESC LIMIT 16', [req.userId]);
  res.json({
    weekStart: start,
    isSunday: isSunday(),
    current: current || null,
    history,
  });
});

// Reflexion speichern (einmal pro Woche belohnt, Überschreiben möglich)
router.post('/', (req, res) => {
  const { sentence1 = '', sentence2 = '', sentence3 = '', mood = '😊' } = req.body || {};
  const s1 = String(sentence1).trim().slice(0, 400);
  const s2 = String(sentence2).trim().slice(0, 400);
  const s3 = String(sentence3).trim().slice(0, 400);
  if (!s1 && !s2 && !s3) {
    return res.status(400).json({ error: 'Bitte fasse deine Woche in mindestens einem Satz zusammen.' });
  }
  const m = ['😊', '🙂', '😐', '😕', '😢'].includes(mood) ? mood : '😊';
  const start = weekStart();

  const existing = get('SELECT * FROM weekly_reflections WHERE user_id = ? AND week_start = ?', [req.userId, start]);
  const wasNew = !existing;
  if (existing) {
    q('UPDATE weekly_reflections SET sentence1 = ?, sentence2 = ?, sentence3 = ?, mood = ? WHERE id = ?',
      [s1, s2, s3, m, existing.id]);
  } else {
    q('INSERT INTO weekly_reflections (user_id, week_start, sentence1, sentence2, sentence3, mood) VALUES (?,?,?,?,?,?)',
      [req.userId, start, s1, s2, s3, m]);
  }

  let rewards = { jewels: 0, xp: 0 };
  if (wasNew) {
    rewards = { jewels: 25, xp: 40 };
    addJewels(req.userId, 25);
    addXp(req.userId, 40);
    bumpQuest(req.userId, 'weekly_reflection');
    touchStreak(req.userId);
    notify(req.userId, 'reward', '📝 Wochen-Reflexion gespeichert: +25 💎 +40 ⚡');
  }

  const current = get('SELECT * FROM weekly_reflections WHERE user_id = ? AND week_start = ?', [req.userId, start]);
  const history = all('SELECT * FROM weekly_reflections WHERE user_id = ? ORDER BY week_start DESC LIMIT 16', [req.userId]);
  const newAchievements = unlockAchievements(req.userId);
  res.json({ rewards, current, history, newAchievements, user: publicUser(req.userId) });
});

export default router;
