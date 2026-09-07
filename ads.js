// LOCKIN.AI – Belohnte Werbung (Demo/Platzhalter)
import { Router } from 'express';
import { all, q } from '../db.js';
import { addJewels, addXp, notify, unlockAchievements, publicUser } from '../store.js';

const router = Router();

const DAILY_CAP = 10;
const REWARD_JEWELS = 25;
const REWARD_XP = 15;

router.get('/status', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayViews = all('SELECT COUNT(*) AS c FROM ad_views WHERE user_id = ? AND date(created_at) = ?', [req.userId, today])[0].c;
  res.json({ watchedToday: todayViews, cap: DAILY_CAP, rewardJewels: REWARD_JEWELS, rewardXp: REWARD_XP, remaining: Math.max(0, DAILY_CAP - todayViews) });
});

router.post('/complete', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayViews = all('SELECT COUNT(*) AS c FROM ad_views WHERE user_id = ? AND date(created_at) = ?', [req.userId, today])[0].c;
  if (todayViews >= DAILY_CAP) {
    return res.status(400).json({ error: 'Tageslimit erreicht – komm morgen wieder!' });
  }
  q('INSERT INTO ad_views (user_id, reward) VALUES (?, ?)', [req.userId, REWARD_JEWELS]);
  q('UPDATE users SET total_ads = total_ads + 1 WHERE id = ?', [req.userId]);
  addJewels(req.userId, REWARD_JEWELS);
  addXp(req.userId, REWARD_XP);
  notify(req.userId, 'reward', `📺 Belohnte Anzeige abgeschlossen: +${REWARD_JEWELS} Juwelen!`);
  const newAchievements = unlockAchievements(req.userId);
  res.json({ rewards: { jewels: REWARD_JEWELS, xp: REWARD_XP }, newAchievements, user: publicUser(req.userId) });
});

export default router;
