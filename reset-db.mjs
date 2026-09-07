// LOCKIN.AI – Datenbank zurücksetzen & neu seeden
// Aufruf: node scripts/reset-db.mjs
// Löscht data/lockin.db und legt eine frische, geseedete Datenbank an.
import fs from 'node:fs';
import { initDb, DB_FILE } from '../server/db.js';
import { seed } from '../server/seed.js';

if (fs.existsSync(DB_FILE)) {
  fs.rmSync(DB_FILE);
  for (const f of fs.readdirSync(DB_FILE + '.dir')) fs.rmSync(DB_FILE + '.dir/' + f);
  fs.rmSync(DB_FILE + '.dir', { recursive: true, force: true });
}
await initDb();
seed();
console.log('✅ Datenbank zurückgesetzt & neu geseedet:', DB_FILE);
