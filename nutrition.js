// LOCKIN.AI – Kalorien-Scanner & -Tagebuch
import { Router } from 'express';
import { all, get, q } from '../db.js';
import { bumpQuest, addXp, addJewels, touchStreak, unlockAchievements, publicUser } from '../store.js';

const router = Router();

// Lebensmittel suchen (lokale DB)
router.get('/foods', (req, res) => {
  const term = String(req.query.q || '').trim();
  if (term.length < 2) return res.json({ foods: [] });
  const rows = all('SELECT * FROM foods WHERE name LIKE ? OR brand LIKE ? ORDER BY kcal LIMIT 15', [`%${term}%`, `%${term}%`]);
  res.json({ foods: rows });
});

// Barcode auflösen: lokale DB → Open Food Facts (mit Cache)
router.get('/barcode/:code', async (req, res) => {
  const code = String(req.params.code || '').replace(/\D/g, '');
  if (code.length < 6) return res.status(400).json({ error: 'Ungültiger Barcode' });
  // Offensichtliche Platzhalter-/Test-Barcodes ablehnen
  if (/^(\d)\1+$/.test(code) || code === '1234567890128') return res.status(404).json({ error: 'Produkt nicht gefunden – bitte manuell eintragen' });
  const local = get('SELECT * FROM foods WHERE barcode = ?', [code]);
  if (local) return res.json({ food: local, source: local.source === 'off' ? 'off-cache' : 'local' });

  // Open Food Facts Fallback (kostenlose, offene Produktdatenbank)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_de,brands,nutriments,categories_tags,image_front_small_url,quantity,serving_size`, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await resp.json();
    if (data?.status === 1 && data.product) {
      const p = data.product;
      const n = p.nutriments || {};
      // Energie: kcal direkt – sonst kJ-Wert umrechnen (1 kcal = 4,184 kJ)
      const kcalRaw = Number(n['energy-kcal_100g']);
      const kjRaw = Number(n['energy_100g'] ?? n.energy);
      const kcal100 = Number.isFinite(kcalRaw) && kcalRaw > 0 ? kcalRaw : (Number.isFinite(kjRaw) && kjRaw > 0 ? kjRaw / 4.184 : 0);
      const food = {
        name: p.product_name_de || p.product_name || 'Unbekanntes Produkt',
        brand: (p.brands || '').split(',')[0] || '',
        kcal: Math.round(kcal100),
        protein: Math.round(Number(n.proteins_100g ?? 0) * 10) / 10,
        carbs: Math.round(Number(n.carbohydrates_100g ?? 0) * 10) / 10,
        fat: Math.round(Number(n.fat_100g ?? 0) * 10) / 10,
        sugars: Math.round(Number(n.sugars_100g ?? 0) * 10) / 10,
        salt: Math.round(Number(n.salt_100g ?? 0) * 100) / 100,
        fiber: Math.round(Number(n.fiber_100g ?? 0) * 10) / 10,
        barcode: code,
        category: p.categories_tags?.[0]?.replace(/^..:/, '').replace(/-/g, ' ') || '',
        image: p.image_front_small_url || '',
        quantity: p.quantity || '',
        servingSize: p.serving_size || '',
        source: 'off',
      };
      // Im lokalen Cache speichern
      q('INSERT OR IGNORE INTO foods (code, name, brand, kcal, protein, carbs, fat, barcode, category, source, sugars, salt, fiber, image) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        ['off_' + code, food.name, food.brand, food.kcal, food.protein, food.carbs, food.fat, code, food.category, 'off', food.sugars, food.salt, food.fiber, food.image]);
      return res.json({ food, source: 'off' });
    }
    res.status(404).json({ error: 'Produkt nicht gefunden – bitte manuell eintragen' });
  } catch {
    res.status(502).json({ error: 'Kein Treffer lokal und Open Food Facts nicht erreichbar – bitte manuell eintragen' });
  }
});

// Eintrag hinzufügen
// body: { name, brand?, amountG, per100: { kcal, protein, carbs, fat }, barcode?, logDate? }
router.post('/log', (req, res) => {
  const { name, brand, amountG, per100, barcode, logDate } = req.body || {};
  const n = String(name || '').trim();
  const g = Number(amountG) || 0;
  if (n.length < 2 || g <= 0 || g > 5000) return res.status(400).json({ error: 'Bitte Lebensmittel und Menge angeben' });
  const p = per100 || {};
  const factor = g / 100;
  const kcal = Math.round((Number(p.kcal) || 0) * factor);
  const protein = Math.round((Number(p.protein) || 0) * factor * 10) / 10;
  const carbs = Math.round((Number(p.carbs) || 0) * factor * 10) / 10;
  const fat = Math.round((Number(p.fat) || 0) * factor * 10) / 10;
  const sugars = Math.round((Number(p.sugars) || 0) * factor * 10) / 10;
  const salt = Math.round((Number(p.salt) || 0) * factor * 100) / 100;
  const date = String(logDate || new Date().toISOString().slice(0, 10));

  const entryId = q('INSERT INTO food_logs (user_id, name, brand, amount_g, kcal, protein, carbs, fat, sugars, salt, barcode, log_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [req.userId, n, String(brand || ''), g, kcal, protein, carbs, fat, sugars, salt, String(barcode || ''), date]);
  q('UPDATE users SET total_food_logs = total_food_logs + 1 WHERE id = ?', [req.userId]);
  touchStreak(req.userId);
  addXp(req.userId, 15);
  bumpQuest(req.userId, 'daily_food');
  bumpQuest(req.userId, 'first_food');
  const newAchievements = unlockAchievements(req.userId);

  res.status(201).json({
    entry: get('SELECT * FROM food_logs WHERE id = ?', [entryId]),
    rewards: { xp: 15 },
    newAchievements,
    user: publicUser(req.userId),
  });
});

// Tageseinträge
router.get('/logs', (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const entries = all('SELECT * FROM food_logs WHERE user_id = ? AND log_date = ? ORDER BY id DESC', [req.userId, date]);
  const totals = entries.reduce((acc, e) => {
    acc.kcal += e.kcal; acc.protein += e.protein; acc.carbs += e.carbs; acc.fat += e.fat;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const u = get('SELECT calorie_goal, protein_goal, carbs_goal, fat_goal FROM users WHERE id = ?', [req.userId]);
  res.json({ date, entries, totals: { ...totals, kcal: Math.round(totals.kcal), protein: Math.round(totals.protein * 10) / 10, carbs: Math.round(totals.carbs * 10) / 10, fat: Math.round(totals.fat * 10) / 10 }, goals: u });
});

router.delete('/log/:id', (req, res) => {
  q('DELETE FROM food_logs WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
  res.json({ ok: true });
});

// Ziele setzen
router.put('/goals', (req, res) => {
  const { calorie, protein, carbs, fat } = req.body || {};
  const u = get('SELECT * FROM users WHERE id = ?', [req.userId]);
  q('UPDATE users SET calorie_goal = ?, protein_goal = ?, carbs_goal = ?, fat_goal = ? WHERE id = ?',
    [Math.min(8000, Math.max(500, Math.round(Number(calorie) || u.calorie_goal))),
     Math.min(500, Math.max(0, Math.round(Number(protein) || u.protein_goal))),
     Math.min(1000, Math.max(0, Math.round(Number(carbs) || u.carbs_goal))),
     Math.min(500, Math.max(0, Math.round(Number(fat) || u.fat_goal))),
     req.userId]);
  res.json({ user: publicUser(req.userId) });
});

// Verlauf (letzte N Tage)
router.get('/history', (req, res) => {
  const days = Math.min(30, Math.max(3, Number(req.query.days) || 7));
  const rows = all(
    `SELECT log_date AS date, ROUND(SUM(kcal)) AS kcal, ROUND(SUM(protein),1) AS protein, ROUND(SUM(carbs),1) AS carbs, ROUND(SUM(fat),1) AS fat, COUNT(*) AS entries
     FROM food_logs WHERE user_id = ? AND log_date >= date('now', ?) GROUP BY log_date ORDER BY log_date`, [req.userId, `-${days - 1} days`]
  );
  // Alle Tage auffüllen
  const map = new Map(rows.map((r) => [r.date, r]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push(map.get(d) || { date: d, kcal: 0, protein: 0, carbs: 0, fat: 0, entries: 0 });
  }
  const loggedDays = out.filter((d) => d.entries > 0).length;
  res.json({ days: out, loggedDays, streak: currentLogStreak(req.userId) });
});

function currentLogStreak(userId) {
  let streak = 0;
  const d = new Date();
  // Wenn heute noch nichts eingetragen, zähle ab gestern
  const today = d.toISOString().slice(0, 10);
  const hasToday = get('SELECT COUNT(*) AS c FROM food_logs WHERE user_id = ? AND log_date = ?', [userId, today]).c > 0;
  if (!hasToday) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const date = new Date(d.getTime() - i * 86400000).toISOString().slice(0, 10);
    const has = get('SELECT COUNT(*) AS c FROM food_logs WHERE user_id = ? AND log_date = ?', [userId, date]).c > 0;
    if (!has) break;
    streak += 1;
  }
  return streak;
}

export default router;
