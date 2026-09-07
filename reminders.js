// LOCKIN.AI – Reminder-Einstellungen (Wasser, Skincare, Schlaf, Fokus)
import { Router } from 'express';
import { all, q } from '../db.js';

const router = Router();

// Standard-Reminder-Konfiguration
const DEFAULT_REMINDERS = [
  { type: 'water', label: '💧 Wasser trinken', interval_min: 120, time_of_day: '' },
  { type: 'skincare_morning', label: '🧴 Morgen-Routine', interval_min: 0, time_of_day: '07:00' },
  { type: 'skincare_evening', label: '🌙 Abend-Routine', interval_min: 0, time_of_day: '21:00' },
  { type: 'sleep', label: '😴 Schlaf-Erinnerung', interval_min: 0, time_of_day: '22:30' },
  { type: 'focus', label: '🧘 Fokus-Zeit', interval_min: 0, time_of_day: '10:00' },
  { type: 'workout', label: '💪 Workout-Zeit', interval_min: 0, time_of_day: '17:00' },
];

// Alle Reminder-Einstellungen laden
router.get('/', (req, res) => {
  const rows = all('SELECT * FROM reminder_settings WHERE user_id = ?', [req.userId]);
  const settings = {};
  for (const r of rows) settings[r.reminder_type] = r;

  // Defaults mit gespeicherten Werten fusionieren
  const reminders = DEFAULT_REMINDERS.map((def) => {
    const saved = settings[def.type];
    return {
      type: def.type,
      label: def.label,
      enabled: saved ? !!saved.enabled : false,
      interval_min: saved ? saved.interval_min : def.interval_min,
      time_of_day: saved ? (saved.time_of_day || '') : def.time_of_day,
    };
  });

  res.json({ reminders });
});

// Reminder aktualisieren (enabled, interval, time_of_day)
router.put('/:type', (req, res) => {
  const { type } = req.params;
  const { enabled, interval_min, time_of_day } = req.body || {};

  const def = DEFAULT_REMINDERS.find((d) => d.type === type);
  if (!def) return res.status(400).json({ error: 'Unbekannter Reminder-Typ' });

  // WICHTIG: sql.js kann kein undefined binden – nicht gesetzte Felder müssen null sein
  // (COALESCE im UPSERT behält dann den gespeicherten Wert bei)
  const en = enabled !== undefined ? (enabled ? 1 : 0) : null;
  const iv = interval_min !== undefined ? Math.max(0, Math.min(480, Number(interval_min))) : null;
  const tod = time_of_day !== undefined ? String(time_of_day).slice(0, 5) : null;

  q(`INSERT INTO reminder_settings (user_id, reminder_type, enabled, interval_min, time_of_day, label)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, reminder_type) DO UPDATE SET
       enabled = COALESCE(?, enabled),
       interval_min = COALESCE(?, interval_min),
       time_of_day = COALESCE(?, time_of_day)`,
    [req.userId, type, en ?? 0, iv ?? def.interval_min, tod ?? def.time_of_day, def.label, en, iv, tod]);

  res.json({ ok: true });
});

// Alle auf einmal setzen
router.put('/', (req, res) => {
  const { reminders } = req.body || {};
  if (!Array.isArray(reminders)) return res.status(400).json({ error: 'reminders Array erwartet' });

  for (const r of reminders) {
    const def = DEFAULT_REMINDERS.find((d) => d.type === r.type);
    if (!def) continue;
    const en = r.enabled ? 1 : 0;
    const iv = Math.max(0, Math.min(480, Number(r.interval_min) || def.interval_min));
    const tod = String(r.time_of_day || def.time_of_day).slice(0, 5);
    q(`INSERT INTO reminder_settings (user_id, reminder_type, enabled, interval_min, time_of_day, label)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, reminder_type) DO UPDATE SET
         enabled = ?, interval_min = ?, time_of_day = ?`,
      [req.userId, r.type, en, iv, tod, def.label, en, iv, tod]);
  }

  res.json({ ok: true });
});

export default router;
