// LOCKIN.AI – Rangliste
import { Router } from 'express';
import { all, get } from '../db.js';
import { levelForXp } from '../store.js';

const router = Router();

const WEEK_SINCE = "date('now','weekday 0','-6 days')";

// Aktivitätspunkte dieser Woche pro User (einheitliche Gewichtung: 1 Aktion = 1 Punkt)
function weeklyActivity() {
  const agg = new Map();
  const add = (rows) => { for (const r of rows) agg.set(r.user_id, (agg.get(r.user_id) || 0) + r.c); };
  add(all(`SELECT user_id, COUNT(*) AS c FROM food_logs WHERE log_date >= ${WEEK_SINCE} GROUP BY user_id`));
  add(all(`SELECT user_id, COUNT(*) AS c FROM user_workouts WHERE date >= ${WEEK_SINCE} GROUP BY user_id`));
  add(all(`SELECT user_id, COUNT(*) AS c FROM scans WHERE date(created_at) >= ${WEEK_SINCE} GROUP BY user_id`));
  add(all(`SELECT user_id, COUNT(*) AS c FROM quiz_attempts WHERE date(created_at) >= ${WEEK_SINCE} GROUP BY user_id`));
  add(all(`SELECT user_id, COUNT(*) AS c FROM focus_sessions WHERE date(completed_at) >= ${WEEK_SINCE} GROUP BY user_id`));
  add(all(`SELECT user_id, COUNT(*) AS c FROM homework WHERE done = 1 AND date(done_at) >= ${WEEK_SINCE} GROUP BY user_id`));
  return agg;
}

router.get('/', (req, res) => {
  const users = all('SELECT id, username, xp, streak_count, best_streak, selected_theme, title, avatar_image FROM users');

  // Level-Rangliste (XP)
  const byXp = users.slice().sort((a, b) => b.xp - a.xp || a.id - b.id);
  const globalRank = byXp.findIndex((u) => u.id === req.userId) + 1;
  const global = byXp.slice(0, 20).map((u, i) => ({
    rank: i + 1,
    id: u.id,
    username: u.username,
    level: levelForXp(u.xp),
    xp: u.xp,
    streak: u.streak_count,
    bestStreak: u.best_streak,
    theme: u.selected_theme,
    title: u.title,
    avatarImage: u.avatar_image || '',
    isMe: u.id === req.userId,
  }));

  // Wochen-Rangliste (Aktivität)
  const act = weeklyActivity();
  const weeklyArr = [...act.entries()]
    .map(([userId, points]) => {
      const u = users.find((x) => x.id === userId);
      return u ? { id: u.id, username: u.username, level: levelForXp(u.xp), xp: u.xp, streak: u.streak_count, bestStreak: u.best_streak, theme: u.selected_theme, title: u.title, avatarImage: u.avatar_image || '', points } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.points - a.points || a.id - b.id);
  const weeklyRank = weeklyArr.findIndex((u) => u.id === req.userId) + 1;
  const weekly = weeklyArr.slice(0, 20).map((u, i) => ({ ...u, rank: i + 1, isMe: u.id === req.userId }));

  res.json({
    global,
    weekly,
    userRank: { global: globalRank, weekly: weeklyRank || 0 },
    weeklyPoints: act.get(req.userId) || 0,
    totalUsers: users.length,
  });
});

export default router;
