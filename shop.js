// LOCKIN.AI – Shop-Routen
import { Router } from 'express';
import { all, get, q } from '../db.js';
import { addJewels, addXp, bumpQuest, notify, unlockAchievements, publicUser, getUserById } from '../store.js';

const router = Router();

router.get('/', (req, res) => {
  const items = all(
    `SELECT s.*,
       (SELECT COUNT(*) FROM inventory i WHERE i.user_id = ? AND i.item_id = s.id) AS owned,
       (SELECT COALESCE(quantity,0) FROM inventory i WHERE i.user_id = ? AND i.item_id = s.id) AS quantity,
       (SELECT equipped FROM inventory i WHERE i.user_id = ? AND i.item_id = s.id) AS equipped
     FROM shop_items s WHERE s.active = 1 ORDER BY s.type, s.price`, [req.userId, req.userId, req.userId]
  );
  res.json({ items });
});

// Bundle-Definitionen: welche Items das Bundle enthält (hier: alle Themes einer Seltenheit)
const BUNDLES = {
  theme_bundle_rare: { itemType: 'theme', rarity: 'rare' },
};

router.post('/buy', (req, res) => {
  const { itemId } = req.body || {};
  const item = get('SELECT * FROM shop_items WHERE id = ? AND active = 1', [Number(itemId)]);
  if (!item) return res.status(404).json({ error: 'Item nicht gefunden' });
  const user = getUserById(req.userId);
  if (user.jewels < item.price) return res.status(400).json({ error: 'Nicht genug Juwelen' });

  // Bundle-Inhalt vor dem Abbuchen prüfen: nur kaufen, wenn mindestens ein enthaltenes Item noch fehlt
  let bundleMissing = [];
  if (item.type === 'bundle') {
    const def = BUNDLES[item.code];
    if (!def) return res.status(400).json({ error: 'Bundle nicht verfügbar' });
    const contents = all("SELECT * FROM shop_items WHERE type = ? AND rarity = ? AND active = 1", [def.itemType, def.rarity]);
    bundleMissing = contents.filter((t) => !get('SELECT item_id FROM inventory WHERE user_id = ? AND item_id = ?', [req.userId, t.id]));
    if (bundleMissing.length === 0) return res.status(400).json({ error: 'Du besitzt bereits alle Themes aus diesem Bundle!' });
  }

  const stackable = item.type === 'consumable' || item.type === 'box';
  const owned = get('SELECT * FROM inventory WHERE user_id = ? AND item_id = ?', [req.userId, item.id]);
  if (owned && !stackable) return res.status(400).json({ error: 'Du besitzt dieses Item bereits' });

  addJewels(req.userId, -item.price);
  const equipped = item.type === 'theme' ? 1 : 0;
  if (owned) {
    q('UPDATE inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?', [req.userId, item.id]);
  } else {
    q('INSERT INTO inventory (user_id, item_id, equipped, quantity) VALUES (?, ?, ?, ?)', [req.userId, item.id, equipped, 1]);
  }
  if (item.code === 'streak_freeze') {
    q('UPDATE users SET streak_shields = streak_shields + 1 WHERE id = ?', [req.userId]);
    notify(req.userId, 'reward', '🛡️ Streak-Freeze gekauft! Er schützt deinen Streak automatisch, sobald du einen Tag auslässt.');
  }
  if (item.type === 'bundle') {
    // Alle fehlenden Bundle-Themes in den Bestand (nicht automatisch aktiviert – der Nutzer wählt selbst)
    for (const t of bundleMissing) {
      q('INSERT INTO inventory (user_id, item_id, equipped, quantity) VALUES (?, ?, 0, 1)', [req.userId, t.id]);
    }
    notify(req.userId, 'shop', `🎁 Bundle „${item.name}" geöffnet: ${bundleMissing.length} Themes sind jetzt in deinem Besitz!`);
  }
  if (item.type === 'theme') {
    q('UPDATE users SET selected_theme = ? WHERE id = ?', [item.code, req.userId]);
    notify(req.userId, 'shop', `🎨 Theme „${item.name}“ aktiviert!`);
  }
  bumpQuest(req.userId, 'first_buy');
  const newAchievements = unlockAchievements(req.userId);

  res.json({ item, granted: item.type === 'bundle' ? bundleMissing.length : undefined, newAchievements, user: publicUser(req.userId) });
});

// Consumable nutzen
router.post('/use', (req, res) => {
  const { itemId } = req.body || {};
  const inv = get('SELECT * FROM inventory WHERE user_id = ? AND item_id = ?', [req.userId, Number(itemId)]);
  if (!inv || inv.quantity <= 0) return res.status(404).json({ error: 'Item nicht im Inventar' });
  const item = get('SELECT * FROM shop_items WHERE id = ?', [Number(itemId)]);
  if (!item || item.type !== 'consumable') return res.status(400).json({ error: 'Kein nutzbares Item' });

  if (item.code === 'streak_freeze') return res.status(400).json({ error: 'Der Streak-Freeze wird automatisch eingesetzt, sobald du einen Tag auslässt – kein manueller Gebrauch nötig.' }); // Auto-Konsum
  const user = getUserById(req.userId);
  let rewardMsg = '';
  let extraJewels = 0;
  let extraXp = 0;

  if (['mood_spark', 'focus_stamp', 'celebration_pack'].includes(item.code)) {
    rewardMsg = item.code === 'mood_spark'
      ? '✨ Mood Spark aktiviert – dein Profil bekommt einen kurzen Glanzmoment.'
      : item.code === 'focus_stamp'
        ? '🎯 Focus Stamp gesammelt – sichtbar in deiner Sammlung.'
        : '🎉 Celebration Pack aktiviert – kosmetische Konfetti-Variante bereit.';
  }

  if (extraXp) addXp(req.userId, extraXp);
  if (extraJewels) addJewels(req.userId, extraJewels);
  q('UPDATE users SET total_consumables_used = total_consumables_used + 1 WHERE id = ?', [req.userId]);
  if (inv.quantity <= 1) q('DELETE FROM inventory WHERE user_id = ? AND item_id = ?', [req.userId, item.id]);
  else q('UPDATE inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?', [req.userId, item.id]);

  notify(req.userId, 'reward', rewardMsg);
  const newAchievements = unlockAchievements(req.userId);
  res.json({ item, rewardMsg, rewards: { xp: extraXp, jewels: extraJewels }, newAchievements, user: publicUser(req.userId) });
});

router.post('/equip', (req, res) => {
  const { itemId, equipped: wantsEquip } = req.body || {};
  const inv = get('SELECT * FROM inventory WHERE user_id = ? AND item_id = ?', [req.userId, Number(itemId)]);
  if (!inv) return res.status(404).json({ error: 'Item nicht im Inventar' });
  const item = get('SELECT * FROM shop_items WHERE id = ?', [Number(itemId)]);
  if (!item) return res.status(404).json({ error: 'Item nicht gefunden' });

  const equip = wantsEquip !== false;
  if (item.type === 'theme') {
    if (equip) {
      q('UPDATE inventory SET equipped = 0 WHERE user_id = ? AND item_id IN (SELECT id FROM shop_items WHERE type = ?)', [req.userId, 'theme']);
      q('UPDATE users SET selected_theme = ? WHERE id = ?', [item.code, req.userId]);
    } else {
      q('UPDATE users SET selected_theme = ? WHERE id = ? AND selected_theme = ?', ['neon', req.userId, item.code]);
    }
    q('UPDATE inventory SET equipped = ? WHERE user_id = ? AND item_id = ?', [equip ? 1 : 0, req.userId, item.id]);
  } else if (item.type === 'frame') {
    q('UPDATE inventory SET equipped = 0 WHERE user_id = ? AND item_id IN (SELECT id FROM shop_items WHERE type = ?)', [req.userId, 'frame']);
    q('UPDATE inventory SET equipped = ? WHERE user_id = ? AND item_id = ?', [equip ? 1 : 0, req.userId, item.id]);
    q('UPDATE users SET avatar_frame = ? WHERE id = ?', [equip ? item.code : null, req.userId]);
  } else if (item.type === 'badge') {
    q('UPDATE inventory SET equipped = 0 WHERE user_id = ? AND item_id IN (SELECT id FROM shop_items WHERE type = ?)', [req.userId, 'badge']);
    q('UPDATE inventory SET equipped = ? WHERE user_id = ? AND item_id = ?', [equip ? 1 : 0, req.userId, item.id]);
    q('UPDATE users SET badge = ? WHERE id = ?', [equip ? item.code : null, req.userId]);
  } else if (item.type === 'title') {
    q('UPDATE inventory SET equipped = 0 WHERE user_id = ? AND item_id IN (SELECT id FROM shop_items WHERE type = ?)', [req.userId, 'title']);
    q('UPDATE inventory SET equipped = ? WHERE user_id = ? AND item_id = ?', [equip ? 1 : 0, req.userId, item.id]);
    q('UPDATE users SET title = ? WHERE id = ?', [equip ? item.name : null, req.userId]);
  }
  res.json({ user: publicUser(req.userId) });
});

// Mystery-Box öffnen: Box verbrauchen, zufälliges kosmetisches Item gewinnen.
const RARITY_WEIGHTS = { common: 40, rare: 30, epic: 18, legendary: 9, mythic: 3 };

router.post('/open', (req, res) => {
  const { itemId } = req.body || {};
  const inv = get('SELECT * FROM inventory WHERE user_id = ? AND item_id = ?', [req.userId, Number(itemId)]);
  if (!inv || inv.quantity <= 0) return res.status(404).json({ error: 'Keine Box im Inventar' });
  const box = get('SELECT * FROM shop_items WHERE id = ?', [Number(itemId)]);
  if (!box || box.type !== 'box') return res.status(400).json({ error: 'Keine Mystery-Box' });

  // Pool: aktive kosmetische Items, die der Nutzer noch nicht besitzt (kein Start-Theme, keine Verbrauchs-Items)
  const pool = all(
    `SELECT s.* FROM shop_items s
     WHERE s.active = 1 AND s.type IN ('theme','frame','badge','title')
       AND s.code != 'theme_neon'
       AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.user_id = ? AND i.item_id = s.id)`,
    [req.userId]
  );

  // Box verbrauchen
  if (inv.quantity <= 1) q('DELETE FROM inventory WHERE user_id = ? AND item_id = ?', [req.userId, box.id]);
  else q('UPDATE inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?', [req.userId, box.id]);
  q('UPDATE users SET total_loot_boxes = total_loot_boxes + 1 WHERE id = ?', [req.userId]);

  let won = null;
  let fallback = null;
  if (pool.length === 0) {
    // Alles schon besessen: kleiner Juwelen-Trost
    addJewels(req.userId, 30);
    fallback = 30;
    notify(req.userId, 'reward', '🎁 Du besitzt bereits alle kosmetischen Items – +30 💎 Trost.');
  } else {
    const total = pool.reduce((s, i) => s + (RARITY_WEIGHTS[i.rarity] || 10), 0);
    let roll = Math.random() * total;
    for (const it of pool) {
      roll -= RARITY_WEIGHTS[it.rarity] || 10;
      if (roll <= 0) { won = it; break; }
    }
    won = won || pool[pool.length - 1];
    const exists = get('SELECT * FROM inventory WHERE user_id = ? AND item_id = ?', [req.userId, won.id]);
    if (exists) q('UPDATE inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?', [req.userId, won.id]);
    else q('INSERT INTO inventory (user_id, item_id, equipped, quantity) VALUES (?, ?, 0, 1)', [req.userId, won.id]);
    const typeLabel = { theme: 'Theme', frame: 'Avatar-Rahmen', badge: 'Abzeichen', title: 'Titel' }[won.type] || 'Item';
    notify(req.userId, 'shop', `🎁 Mystery-Box: ${won.icon} ${won.name} (${typeLabel}) erhalten!`);
  }

  const newAchievements = unlockAchievements(req.userId);
  res.json({
    won: won ? { id: won.id, code: won.code, name: won.name, icon: won.icon, type: won.type, rarity: won.rarity, description: won.description } : null,
    fallbackJewels: fallback,
    newAchievements,
    user: publicUser(req.userId),
  });
});

export default router;
