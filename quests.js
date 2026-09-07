// LOCKIN.AI – Quest-Routen
import { Router } from 'express';
import { all, get, q } from '../db.js';
import { ensureQuestRows, claimQuest, resetDailyQuestsIfNeeded, unlockAchievements, publicUser } from '../store.js';

const router = Router();

// Manuelles Abhaken von Quests, die die App nicht automatisch verifizieren kann
const MANUAL_QUEST_CODES = ['daily_water', 'daily_bed', 'daily_skincare', 'daily_sleep'];

router.post('/manual-complete', (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code || !MANUAL_QUEST_CODES.includes(code))
      return res.status(400).json({ error: 'Diese Aufgabe kann nicht manuell abgehakt werden.' });

    ensureQuestRows(req.userId);
    resetDailyQuestsIfNeeded(req.userId);

    const quest = get('SELECT * FROM quests WHERE code = ?', [code]);
    if (!quest) return res.status(404).json({ error: 'Aufgabe nicht gefunden.' });

    const row = get('SELECT * FROM user_quests WHERE user_id = ? AND quest_id = ?', [req.userId, quest.id]);
    if (!row) return res.status(404).json({ error: 'Aufgabe nicht gefunden.' });

    // Anti-Farming: Bereits eingelöste Aufgaben (XP/Juwelen erhalten) sind eingefroren –
    // sie können erst nach dem täglichen Reset (neuer Tag) wieder zurückgesetzt werden.
    if (row.claimed) {
      return res.status(400).json({ error: 'Diese Aufgabe wurde bereits eingelöst und kann heute nicht mehr geändert werden.' });
    }

    if (row.completed) {
      // Haken entfernen (nur wenn noch NICHT eingelöst) – claimed bleibt unberührt
      q('UPDATE user_quests SET progress = 0, completed = 0 WHERE user_id = ? AND quest_id = ?', [req.userId, quest.id]);
    } else {
      // Als erledigt markieren
      q('UPDATE user_quests SET progress = ?, completed = 1, claimed = 0 WHERE user_id = ? AND quest_id = ?', [quest.goal, req.userId, quest.id]);
    }

    // Quests neu laden für Antwort
    const quests = all(
      `SELECT q.*, uq.progress, uq.completed, uq.claimed
       FROM quests q
       LEFT JOIN user_quests uq ON uq.quest_id = q.id AND uq.user_id = ?
       WHERE q.active = 1
       ORDER BY q.category DESC, CASE WHEN q.sort_order > 0 THEN q.sort_order ELSE 1000 + q.id END ASC`, [req.userId]
    );
    const daily = quests.filter((q2) => q2.category === 'daily');
    const dailyDone = daily.filter((q2) => q2.claimed).length;
    const claimable = quests.filter((q2) => q2.completed && !q2.claimed);
    const stats = {
      dailyTotal: daily.length,
      dailyDone,
      dailyCompletion: daily.length > 0 ? Math.round((dailyDone / daily.length) * 100) : 0,
      claimableCount: claimable.length,
      totalClaimed: quests.filter((q2) => q2.claimed).length,
    };

    res.json({ quests, stats, toggledCode: code, isCompleted: !row.completed });
  } catch (e) {
    res.status(500).json({ error: 'Fehler beim Abhaken: ' + e.message });
  }
});

router.get('/', (req, res) => {
  ensureQuestRows(req.userId);
  resetDailyQuestsIfNeeded(req.userId);
  const quests = all(
    `SELECT q.*, uq.progress, uq.completed, uq.claimed
     FROM quests q
     LEFT JOIN user_quests uq ON uq.quest_id = q.id AND uq.user_id = ?
     WHERE q.active = 1
     ORDER BY q.category DESC, CASE WHEN q.sort_order > 0 THEN q.sort_order ELSE 1000 + q.id END ASC`, [req.userId]
  );

  // Stats
  const daily = quests.filter((q) => q.category === 'daily');
  const dailyDone = daily.filter((q) => q.claimed).length;
  const claimable = quests.filter((q) => q.completed && !q.claimed);
  const stats = {
    dailyTotal: daily.length,
    dailyDone,
    dailyCompletion: daily.length > 0 ? Math.round((dailyDone / daily.length) * 100) : 0,
    claimableCount: claimable.length,
    totalClaimed: quests.filter((q) => q.claimed).length,
  };

  res.json({ quests, stats });
});

router.post('/claim', (req, res) => {
  const { questId } = req.body || {};
  const quest = claimQuest(req.userId, Number(questId));
  if (!quest) return res.status(400).json({ error: 'Aufgabe kann nicht eingelöst werden' });
  const newAchievements = unlockAchievements(req.userId);
  res.json({
    quest,
    rewards: { jewels: quest.reward_jewels, xp: quest.reward_xp },
    newAchievements,
    user: publicUser(req.userId),
  });
});

// Alle einlösbaren Aufgaben auf einmal einlösen
router.post('/claim-all', (req, res) => {
  const claimable = all(
    `SELECT q.* FROM quests q
     JOIN user_quests uq ON uq.quest_id = q.id AND uq.user_id = ?
     WHERE q.active = 1 AND uq.completed = 1 AND uq.claimed = 0`, [req.userId]
  );
  if (claimable.length === 0) return res.status(400).json({ error: 'Keine Aufgaben zum Einlösen' });
  let totalJewels = 0;
  let totalXp = 0;
  for (const q of claimable) {
    const claimed = claimQuest(req.userId, q.id);
    if (claimed) { totalJewels += q.reward_jewels; totalXp += q.reward_xp; }
  }
  const newAchievements = unlockAchievements(req.userId);
  res.json({
    count: claimable.length,
    rewards: { jewels: totalJewels, xp: totalXp },
    newAchievements,
    user: publicUser(req.userId),
  });
});

export default router;
