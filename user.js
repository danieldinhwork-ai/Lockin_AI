// LOCKIN.AI – Benutzer-Routen (Dashboard, Benachrichtigungen, Profil)
import { Router } from 'express';
import { all, get, q } from '../db.js';
import { publicUser, levelInfo, unlockAchievements, resetDailyQuestsIfNeeded, ensureQuestRows, notify } from '../store.js';

const router = Router();

router.get('/stats', (req, res) => {
  resetDailyQuestsIfNeeded(req.userId);
  ensureQuestRows(req.userId);
  const u = get('SELECT * FROM users WHERE id = ?', [req.userId]);
  const level = levelInfo(u.xp);

  const achievements = all(
    `SELECT a.*, ua.unlocked_at FROM achievements a
     LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = ?
     ORDER BY a.id`, [req.userId]
  );
  const unlockedCount = achievements.filter((a) => a.unlocked_at).length;

  const quests = all(
    `SELECT q.*, uq.progress, uq.completed, uq.claimed FROM quests q
     LEFT JOIN user_quests uq ON uq.quest_id = q.id AND uq.user_id = ?
     WHERE q.active = 1 ORDER BY q.category DESC, CASE WHEN q.sort_order > 0 THEN q.sort_order ELSE 1000 + q.id END ASC`, [req.userId]
  );

  const homework = all('SELECT * FROM homework WHERE user_id = ? ORDER BY done ASC, due_date ASC', [req.userId]);
  const notifications = all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30', [req.userId]);
  const focusHistory = all('SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 10', [req.userId]);
  const quizAvg = u.total_quiz_answered > 0 ? Math.round((u.total_quiz_correct / u.total_quiz_answered) * 100) : null;

  // 📊 Wochen-Summary (Montag–Sonntag): Workouts, km, Fokusminuten
  const nowD = new Date();
  const monday = new Date(nowD);
  monday.setDate(nowD.getDate() - (nowD.getDay() === 0 ? 6 : nowD.getDay() - 1));
  const ws = monday.toISOString().slice(0, 10);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const we = sunday.toISOString().slice(0, 10);
  const weekSummary = {
    weekStart: ws,
    workouts: get('SELECT COUNT(*) AS c FROM user_workouts WHERE user_id = ? AND date BETWEEN ? AND ?', [req.userId, ws, we]).c,
    km: get('SELECT COALESCE(SUM(distance_km),0) AS k FROM user_workouts WHERE user_id = ? AND date BETWEEN ? AND ?', [req.userId, ws, we]).k,
    focusMin: get('SELECT COALESCE(SUM(minutes),0) AS m FROM focus_sessions WHERE user_id = ? AND date(completed_at) BETWEEN ? AND ?', [req.userId, ws, we]).m,
  };

  res.json({
    user: publicUser(req.userId),
    level,
    achievements,
    unlockedCount,
    quests,
    homework,
    notifications,
    focusHistory,
    quizAvg,
    weekSummary,
  });
});

router.get('/notifications', (req, res) => {
  const rows = all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50', [req.userId]);
  res.json({ notifications: rows });
});

router.post('/notifications/read', (req, res) => {
  const { id } = req.body || {};
  if (id) q('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [Number(id), req.userId]);
  else q('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.userId]);
  res.json({ ok: true, user: publicUser(req.userId) });
});

// ─── Badges für den mobilen „Mehr"-Tab ───
// Zählt pro Bereich, wie viel dort noch offen/entdeckbar ist.
router.get('/more-badges', (req, res) => {
  resetDailyQuestsIfNeeded(req.userId);
  ensureQuestRows(req.userId);

  // Shop: wie viele Items man sich JETZT leisten könnte, aber noch nicht besitzt
  // (dynamisch – verschwindet beim Ausgeben, taucht wieder auf, wenn genug Juwelen da sind)
  const u = get('SELECT jewels FROM users WHERE id = ?', [req.userId]);
  const shopNew = get(
    `SELECT COUNT(*) AS c FROM shop_items s
     WHERE s.active = 1 AND s.price <= ?
       AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.user_id = ? AND i.item_id = s.id)`,
    [u?.jewels || 0, req.userId]
  ).c;

  // Einlösbare Quests (fertig, aber Belohnung noch nicht kassiert) → gehören zum Quest-Hub, nicht zu „Mehr".
  // Coach: nichts Zählbares (Chat) → Badge 0.
  // Rangliste: 1, wenn man diese Woche noch keine Aktivitätspunkte hat (= es gibt etwas zu holen).
  const weeklyPoints = (
    get(
      `SELECT
        (SELECT COUNT(*) FROM food_logs WHERE user_id = ? AND log_date >= date('now','weekday 0','-6 days')) +
        (SELECT COUNT(*) FROM user_workouts WHERE user_id = ? AND date >= date('now','weekday 0','-6 days')) +
        (SELECT COUNT(*) FROM focus_sessions WHERE user_id = ? AND date(completed_at) >= date('now','weekday 0','-6 days')) AS p`,
      [req.userId, req.userId, req.userId]
    ).p || 0
  );
  const leaderboardOpen = weeklyPoints === 0 ? 1 : 0;

  // Statistik: 1, wenn die Wochen-Reflexion dieser Woche noch nicht geschrieben wurde (heute Sonntag oder nicht)
  const ws = (() => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); return d.toISOString().slice(0, 10); })();
  const reflection = get('SELECT id FROM weekly_reflections WHERE user_id = ? AND week_start = ?', [req.userId, ws]);
  const statsOpen = reflection ? 0 : 1;

  const badges = { stats: statsOpen, shop: shopNew, leaderboard: leaderboardOpen, coach: 0 };
  const total = Object.values(badges).reduce((a, b) => a + b, 0);
  res.json({ badges, total });
});

// ─── Onboarding: Fokusgebiete wählen & Daily-Quests personalisieren ───
// Gebiet → zugehörige Daily-Quests (nicht gewählte Bereiche werden deaktiviert,
//_CORE-Basics wie Wasser bleiben immer aktiv)
const AREA_QUESTS = {
  fitness: ['daily_workout', 'daily_walk'],
  appearance: ['daily_skincare'],
  nutrition: ['daily_food'],
  focus: ['daily_focus'],
  learning: ['daily_learn', 'daily_quiz'],
  habits: ['daily_sleep', 'daily_bed'],
};
// Basis-Gewohnheiten, die immer aktiv bleiben, egal was gewählt wird
const CORE_QUESTS = ['daily_water'];

router.post('/onboarding', (req, res) => {
  const { focusAreas } = req.body || {};
  if (!Array.isArray(focusAreas) || focusAreas.length !== 3 || !focusAreas.every((a) => Object.keys(AREA_QUESTS).includes(a))) {
    return res.status(400).json({ error: 'Bitte genau 3 gültige Fokusgebiete wählen' });
  }
  const unique = [...new Set(focusAreas)];
  if (unique.length !== 3) return res.status(400).json({ error: 'Bitte 3 unterschiedliche Bereiche wählen' });

  q('UPDATE users SET focus_areas = ?, onboarded = 1 WHERE id = ?', [JSON.stringify(unique), req.userId]);

  // Daily-Quests personalisieren: gewählte Bereiche + Core aktiv, Rest aus
  ensureQuestRows(req.userId);
  const activeCodes = [...new Set([...CORE_QUESTS, ...unique.flatMap((a) => AREA_QUESTS[a])])];
  for (const [area, codes] of Object.entries(AREA_QUESTS)) {
    const on = unique.includes(area) ? 1 : 0;
    for (const code of codes) q('UPDATE quests SET active = ? WHERE code = ?', [on, code]);
  }
  for (const code of CORE_QUESTS) q('UPDATE quests SET active = 1 WHERE code = ?', [code]);

  // Inaktive Quests aus der persönlichen Quest-Liste entfernen (Fortschritt wird beim Reaktivieren zurückgesetzt)
  const inactive = all(`SELECT q.id FROM quests q WHERE q.active = 0`);
  for (const iq of inactive) {
    q('DELETE FROM user_quests WHERE user_id = ? AND quest_id = ?', [req.userId, iq.id]);
  }
  ensureQuestRows(req.userId);

  notify(req.userId, 'info', `🎯 Deine Daily Quests wurden personalisiert: ${unique.length} Fokusgebiete aktiviert.`);
  res.json({ user: publicUser(req.userId), activeQuests: activeCodes });
});

router.patch('/profile', (req, res) => {
  const { bio, language, avatarImage } = req.body || {};
  if (bio !== undefined) {
    if (String(bio).length > 300) return res.status(400).json({ error: 'Bio zu lang (max. 300 Zeichen)' });
    q('UPDATE users SET bio = ? WHERE id = ?', [String(bio), req.userId]);
  }
  if (language !== undefined) {
    if (!['de', 'en'].includes(language)) return res.status(400).json({ error: 'Sprache nicht unterstützt' });
    q('UPDATE users SET language = ? WHERE id = ?', [String(language), req.userId]);
  }
  if (avatarImage !== undefined) {
    const image = String(avatarImage || '');
    if (image && !/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(image)) {
      return res.status(400).json({ error: 'Bitte ein gültiges Bild auswählen' });
    }
    if (image.length > 700000) return res.status(400).json({ error: 'Bild ist zu groß. Maximal 500 KB.' });
    q('UPDATE users SET avatar_image = ? WHERE id = ?', [image, req.userId]);
  }
  res.json({ user: publicUser(req.userId) });
});

export default router;
