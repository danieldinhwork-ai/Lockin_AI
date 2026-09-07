// LOCKIN.AI – AI Face Scan (rein illustrativ / Unterhaltung)
import { Router } from 'express';
import { q, all, get } from '../db.js';
import { computeIllustrativeScan, imageFingerprint, FACE_SHAPES, HAIRCUT_RECOMMENDATIONS, detectFaceShape } from '../ai.js';
import { bumpQuest, addXp, addJewels, touchStreak, unlockAchievements, publicUser } from '../store.js';

const router = Router();// POST /api/scan  { image: dataURL, filename?, phash? }
// Ein Foto wird nur EINMAL bewertet: identischer Bild-Fingerprint ODER nahezu identischer
// Perceptual-Hash (Hamming-Distanz ≤ 6) → bestehende Bewertung zurückgeben, ohne Belohnung.
// Der pHash wird clientseitig aus den Pixeln berechnet (8×8 Average-Hash) und überlebt
// Screenshots/Re-Export/Komprimierung, die den bytegenauen image_hash ändern würden.
// (6/64 Bit: Re-Encode liegt typisch bei 0–5, verschiedene Fotos bei 12+)
const hamming = (a, b) => {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++;
  return d + Math.abs(a.length - b.length);
};

router.post('/', (req, res) => {
  const { image, filename, phash } = req.body || {};
  if (!image || typeof image !== 'string' || image.length > 6_000_000) {
    return res.status(400).json({ error: 'Bitte ein gültiges Bild hochladen' });
  }
  const hash = String(imageFingerprint(image));
  let dup = get('SELECT * FROM scans WHERE user_id = ? AND image_hash = ?', [req.userId, hash]);
  if (!dup && phash && /^[01]{64}$/.test(String(phash))) {
    const recent = all('SELECT * FROM scans WHERE user_id = ? AND phash IS NOT NULL ORDER BY id DESC LIMIT 60', [req.userId]);
    dup = recent.find((r) => hamming(String(r.phash), String(phash)) <= 6) || null;
  }
  if (dup) {
    const faceShape = detectFaceShape(image, req.userId);
    const haircuts = HAIRCUT_RECOMMENDATIONS[faceShape.shape];
    return res.json({
      duplicate: true,
      scan: { id: dup.id, score: dup.score, potential: dup.potential || dup.score, breakdown: JSON.parse(dup.breakdown), tips: JSON.parse(dup.tips), faceShape, haircuts },
      message: 'Dieses Foto wurde bereits bewertet – der Score bleibt gleich.',
      rewards: null,
      newAchievements: [],
      user: publicUser(req.userId),
      disclaimer: true,
    });
  }

  const result = computeIllustrativeScan(image, req.userId);
  // Thumbnail begrenzen (kleine Vorschau speichern)
  const thumb = image.length > 200_000 ? image.slice(0, 60) + '…' : image;
  const scanId = q('INSERT INTO scans (user_id, score, potential, breakdown, tips, thumbnail, image_hash, phash, created_at) VALUES (?,?,?,?,?,?,?,?, datetime(\'now\'))',
    [req.userId, result.score, result.potential, JSON.stringify(result.breakdown), JSON.stringify(result.tips), thumb, hash, typeof phash === 'string' && /^[01]{64}$/.test(phash) ? phash : null]);
  q('UPDATE users SET total_scans = total_scans + 1 WHERE id = ?', [req.userId]);
  touchStreak(req.userId);
  addXp(req.userId, 25);
  addJewels(req.userId, 10);
  bumpQuest(req.userId, 'first_scan_quest');
  const newAchievements = unlockAchievements(req.userId);

  res.json({
    scan: { id: scanId, score: result.score, potential: result.potential, breakdown: result.breakdown, tips: result.tips },
    rewards: { xp: 25, jewels: 10 },
    newAchievements,
    user: publicUser(req.userId),
    disclaimer: true,
  });
});

router.get('/history', (req, res) => {
  const rows = all('SELECT id, score, potential, breakdown, tips, created_at FROM scans WHERE user_id = ? ORDER BY id DESC LIMIT 10', [req.userId]);
  res.json({ scans: rows.map((r) => ({ ...r, breakdown: JSON.parse(r.breakdown), tips: JSON.parse(r.tips) })) });
});

export default router;
