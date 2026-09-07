// LOCKIN.AI – Coach-Chatbot
import { Router } from 'express';
import { q } from '../db.js';
import { generateReply } from '../bot.js';
import { generateExternalCoachReply, isExternalCoachConfigured } from '../coach-ai.js';
import { bumpQuest, addXp, touchStreak, unlockAchievements, publicUser } from '../store.js';

const router = Router();

router.post('/', async (req, res) => {
  const { message, history } = req.body || {};
  const text = String(message || '').trim();
  if (!text) return res.status(400).json({ error: 'Bitte eine Nachricht eingeben' });
  if (text.length > 2000) return res.status(400).json({ error: 'Nachricht zu lang (max. 2000 Zeichen)' });

  let reply;
  let mode = 'local';
  let suggestions = [];
  try {
    const external = await generateExternalCoachReply(text, history);
    if (external) {
      reply = external.reply;
      mode = 'cloud';
    }
  } catch (error) {
    // Ein Provider-Fehler darf den Coach nicht unbenutzbar machen.
    console.warn('Externer Coach nicht erreichbar, nutze lokalen Fallback:', error.message);
  }

  if (!reply) {
    const local = generateReply(text, req.userId);
    reply = local.reply;
    suggestions = local.suggestions;
  }

  q('UPDATE users SET total_chats = total_chats + 1 WHERE id = ?', [req.userId]);
  touchStreak(req.userId);
  addXp(req.userId, 10);
  const newAchievements = unlockAchievements(req.userId);

  res.json({
    reply,
    mode,
    configured: isExternalCoachConfigured(),
    suggestions,
    rewards: { xp: 10 },
    newAchievements,
    user: publicUser(req.userId),
  });
});

export default router;
