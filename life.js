// LOCKIN.AI – Life Score & Wochenrückblick
import { Router } from 'express';
import { lifeScore } from '../store.js';
import { dailyGoalsForDate } from './daily.js';

const router = Router();

router.get('/', (req, res) => {
  const ls = lifeScore(req.userId);
  // Letzte 7 Tage für den Wochenrückblick (Daily Lock-In pro Tag)
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const day = dailyGoalsForDate(req.userId, date);
    week.push({
      date,
      weekday: d.toLocaleDateString('de-DE', { weekday: 'short' }),
      doneCount: day.doneCount,
      total: day.total,
      allDone: day.allDone,
      claimed: day.claimed,
      done: day.goals.filter((g) => g.done).map((g) => g.key),
    });
  }
  res.json({ lifeScore: ls, week });
});

export default router;
