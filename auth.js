// LOCKIN.AI – Auth-Routen
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { get, q } from '../db.js';
import { requireAuth, createSession, destroySession } from '../auth.js';
import { publicUser, touchStreak, ensureQuestRows, notify, unlockAchievements, getUserById } from '../store.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    const name = String(username || '').trim();
    const mail = String(email || '').trim().toLowerCase();
    if (name.length < 3) return res.status(400).json({ error: 'Benutzername muss mindestens 3 Zeichen haben' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
    if (get('SELECT id FROM users WHERE username = ?', [name])) return res.status(409).json({ error: 'Dieser Benutzername ist bereits vergeben' });
    if (get('SELECT id FROM users WHERE email = ?', [mail])) return res.status(409).json({ error: 'Diese E-Mail ist bereits registriert' });

    const hash = bcrypt.hashSync(password, 10);
    const userId = q('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [name, mail, hash]);
    // Startthema + Standard-Setup
    const neon = get('SELECT id FROM shop_items WHERE code = ?', ['theme_neon']);
    if (neon) q('INSERT OR IGNORE INTO inventory (user_id, item_id, equipped) VALUES (?, ?, 1)', [userId, neon.id]);
    ensureQuestRows(userId);
    notify(userId, 'welcome', `👋 Willkommen bei LOCKIN.AI, ${name}! Deine Reise beginnt jetzt.`);
    notify(userId, 'info', '💎 Du startest mit 250 Juwelen. Pflege deine Gewohnheiten und erledige Aufgaben, um mehr zu verdienen!');
    createSession(userId, res);
    res.status(201).json({ user: publicUser(userId) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

router.post('/login', (req, res) => {
  const { identifier, password } = req.body || {};
  const id = String(identifier || '').trim().toLowerCase();
  const user = get('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?', [id, id]);
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Benutzername/E-Mail oder Passwort falsch' });
  }
  touchStreak(user.id);
  unlockAchievements(user.id);
  createSession(user.id, res);
  res.json({ user: publicUser(user.id) });
});

router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = publicUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  res.json({ user });
});

export default router;
