// LOCKIN.AI – Schulmodus-Routen (Materialien, Quiz, Hausaufgaben, Fokus)
import { Router } from 'express';
import { all, get, q } from '../db.js';
import { summarize, generateFlashcards, generateQuiz } from '../ai.js';
import { bumpQuest, addXp, addJewels, touchStreak, unlockAchievements, publicUser, notify } from '../store.js';

const router = Router();

// ---------- Lernmaterialien ----------
router.post('/material', (req, res) => {
  const { title, subject, sourceText } = req.body || {};
  const text = String(sourceText || '').trim();
  const t = String(title || '').trim() || 'Unbenanntes Material';
  if (text.length < 80) return res.status(400).json({ error: 'Bitte mindestens 80 Zeichen Text einfügen' });
  if (text.length > 60000) return res.status(400).json({ error: 'Text ist zu lang (max. 60.000 Zeichen)' });

  const { summary, keyPoints } = summarize(text);
  const flashcards = generateFlashcards(text, 8);
  const quiz = generateQuiz(text, 6);

  const id = q('INSERT INTO study_materials (user_id, title, subject, source_text, summary, key_points, flashcards, quiz) VALUES (?,?,?,?,?,?,?,?)',
    [req.userId, t, String(subject || ''), text, summary, JSON.stringify(keyPoints), JSON.stringify(flashcards), JSON.stringify(quiz)]);
  q('UPDATE users SET total_study_materials = total_study_materials + 1 WHERE id = ?', [req.userId]);
  touchStreak(req.userId);
  addXp(req.userId, 40);
  addJewels(req.userId, 15);
  bumpQuest(req.userId, 'daily_learn');
  bumpQuest(req.userId, 'first_material_quest');
  const newAchievements = unlockAchievements(req.userId);

  res.status(201).json({
    material: { id, title: t, subject, summary, keyPoints, flashcards, quiz, createdAt: new Date().toISOString() },
    rewards: { xp: 40, jewels: 15 },
    newAchievements,
    user: publicUser(req.userId),
  });
});

router.get('/materials', (req, res) => {
  const rows = all('SELECT id, title, subject, source_text, summary, created_at FROM study_materials WHERE user_id = ? ORDER BY id DESC', [req.userId]);
  res.json({ materials: rows });
});

router.get('/material/:id', (req, res) => {
  const m = get('SELECT * FROM study_materials WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
  if (!m) return res.status(404).json({ error: 'Material nicht gefunden' });
  res.json({ material: { ...m, keyPoints: JSON.parse(m.key_points), flashcards: JSON.parse(m.flashcards), quiz: JSON.parse(m.quiz) } });
});

router.delete('/material/:id', (req, res) => {
  q('DELETE FROM study_materials WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
  q('DELETE FROM quiz_attempts WHERE material_id = ?', [Number(req.params.id)]);
  res.json({ ok: true });
});

// ---------- Quiz ----------
router.post('/quiz/attempt', (req, res) => {
  const { materialId, answers } = req.body || {};
  const m = get('SELECT * FROM study_materials WHERE id = ? AND user_id = ?', [Number(materialId), req.userId]);
  if (!m) return res.status(404).json({ error: 'Material nicht gefunden' });
  const quiz = JSON.parse(m.quiz);
  const given = Array.isArray(answers) ? answers : [];
  let correct = 0;
  const results = quiz.map((question, i) => {
    const ok = String(given[i] || '') === question.answer;
    if (ok) correct += 1;
    return { questionIndex: i, correct: ok, correctAnswer: question.answer };
  });
  const total = quiz.length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  q('INSERT INTO quiz_attempts (user_id, material_id, score, total) VALUES (?,?,?,?)', [req.userId, m.id, correct, total]);
  q('UPDATE users SET total_quiz_answered = total_quiz_answered + ?, total_quiz_correct = total_quiz_correct + ? WHERE id = ?', [total, correct, req.userId]);
  touchStreak(req.userId);
  addXp(req.userId, Math.round(total * 4 + (pct >= 80 ? 20 : 0)));
  bumpQuest(req.userId, 'daily_quiz', total);
  if (pct >= 80) bumpQuest(req.userId, 'quiz_80');
  const newAchievements = unlockAchievements(req.userId);
  res.json({ result: { score: correct, total, pct, results }, rewards: { xp: Math.round(total * 4 + (pct >= 80 ? 20 : 0)) }, newAchievements, user: publicUser(req.userId) });
});

// ---------- Hausaufgaben ----------
router.get('/homework', (req, res) => {
  const rows = all('SELECT * FROM homework WHERE user_id = ? ORDER BY done ASC, due_date ASC', [req.userId]);
  res.json({ homework: rows });
});

router.post('/homework', (req, res) => {
  const { title, subject, dueDate, notes } = req.body || {};
  const t = String(title || '').trim();
  if (t.length < 2) return res.status(400).json({ error: 'Titel zu kurz' });
  const id = q('INSERT INTO homework (user_id, title, subject, due_date, notes) VALUES (?,?,?,?,?)',
    [req.userId, t, String(subject || ''), dueDate ? String(dueDate) : null, String(notes || '')]);
  addXp(req.userId, 15);
  bumpQuest(req.userId, 'hw_first');
  const newAchievements = unlockAchievements(req.userId);
  res.status(201).json({ homework: get('SELECT * FROM homework WHERE id = ?', [id]), rewards: { xp: 15 }, newAchievements, user: publicUser(req.userId) });
});

router.patch('/homework/:id', (req, res) => {
  const { done, title, subject, dueDate, notes } = req.body || {};
  const hw = get('SELECT * FROM homework WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
  if (!hw) return res.status(404).json({ error: 'Hausaufgabe nicht gefunden' });
  if (typeof done === 'boolean') {
    q('UPDATE homework SET done = ?, done_at = CASE WHEN ? = 1 THEN datetime(\'now\') ELSE done_at END WHERE id = ?', [done ? 1 : 0, done ? 1 : 0, hw.id]);
    if (done && !hw.done) {
      q('UPDATE users SET total_homework_done = total_homework_done + 1 WHERE id = ?', [req.userId]);
      addXp(req.userId, 20);
      notify(req.userId, 'reward', `✅ „${hw.title}“ erledigt! +20 XP`);
    }
  } else {
    q('UPDATE homework SET title = ?, subject = ?, due_date = ?, notes = ? WHERE id = ?',
      [String(title || hw.title), subject !== undefined ? String(subject) : hw.subject, dueDate !== undefined ? String(dueDate) : hw.due_date, notes !== undefined ? String(notes) : hw.notes, hw.id]);
  }
  const newAchievements = unlockAchievements(req.userId);
  res.json({ homework: get('SELECT * FROM homework WHERE id = ?', [hw.id]), newAchievements, user: publicUser(req.userId) });
});

router.delete('/homework/:id', (req, res) => {
  q('DELETE FROM homework WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
  res.json({ ok: true });
});

// ---------- Fokusmodus ----------
router.post('/focus', (req, res) => {
  const { minutes } = req.body || {};
  const mins = Math.min(240, Math.max(1, Math.round(Number(minutes) || 0)));
  q('INSERT INTO focus_sessions (user_id, minutes) VALUES (?, ?)', [req.userId, mins]);
  q('UPDATE users SET total_focus_minutes = total_focus_minutes + ? WHERE id = ?', [mins, req.userId]);
  touchStreak(req.userId);
  addXp(req.userId, mins * 2);
  bumpQuest(req.userId, 'daily_focus', mins);
  bumpQuest(req.userId, 'focus_25');
  const newAchievements = unlockAchievements(req.userId);
  notify(req.userId, 'reward', `🧘 Fokussession abgeschlossen: ${mins} Minuten. Stark!`);
  res.json({ rewards: { xp: mins * 2 }, minutes: mins, newAchievements, user: publicUser(req.userId) });
});

export default router;
