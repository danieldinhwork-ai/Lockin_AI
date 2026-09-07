// LOCKIN.AI – SQLite-Datenbank (via sql.js, WASM, keine nativen Abhängigkeiten)
// Die Datenbank wird als echte SQLite-Datei unter data/lockin.db persistiert
// und kann mit jedem SQLite-Tool geöffnet werden.
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Produktion: Datenverzeichnis per Umgebungsvariable überschreibbar (Hosting-Volume),
// lokal standardmäßig data/ im Projektordner.
const DATA_DIR = process.env.LOCKIN_DATA_DIR
  ? path.resolve(process.env.LOCKIN_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'lockin.db');

let db = null;

export async function initDb({ reset = false } = {}) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (reset && fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE);

  const SQL = await initSqlJs();
  const bytes = fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE) : undefined;
  db = bytes && bytes.length > 0 ? new SQL.Database(bytes) : new SQL.Database();
  createSchema();
  persist();
  return db;
}

export function persist() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

// Statement ausführen (INSERT/UPDATE/DELETE/DDL).
// Gibt bei INSERT die neue Zeilen-ID zurück (WICHTIG: vor persist() lesen,
// da db.export() last_insert_rowid() in sql.js zurücksetzt).
export function q(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  const res = db.exec('SELECT last_insert_rowid() AS id');
  persist();
  return res[0]?.values[0]?.[0] ?? null;
}

// Einzelne Zeile
export function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

// Mehrere Zeilen
export function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function createSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    xp INTEGER NOT NULL DEFAULT 0,
    jewels INTEGER NOT NULL DEFAULT 250,
    streak_count INTEGER NOT NULL DEFAULT 0,
    last_active_date TEXT,
    best_streak INTEGER NOT NULL DEFAULT 0,
    last_daily_reset TEXT,
    total_scans INTEGER NOT NULL DEFAULT 0,
    total_quests INTEGER NOT NULL DEFAULT 0,
    total_focus_minutes INTEGER NOT NULL DEFAULT 0,
    total_study_materials INTEGER NOT NULL DEFAULT 0,
    total_quiz_answered INTEGER NOT NULL DEFAULT 0,
    total_quiz_correct INTEGER NOT NULL DEFAULT 0,
    total_ads INTEGER NOT NULL DEFAULT 0,
    total_homework_done INTEGER NOT NULL DEFAULT 0,
    total_food_logs INTEGER NOT NULL DEFAULT 0,
    total_workouts INTEGER NOT NULL DEFAULT 0,
    total_chats INTEGER NOT NULL DEFAULT 0,
    streak_shields INTEGER NOT NULL DEFAULT 0,
    total_consumables_used INTEGER NOT NULL DEFAULT 0,
    total_loot_boxes INTEGER NOT NULL DEFAULT 0,
    total_shields_used INTEGER NOT NULL DEFAULT 0,
    avatar_frame TEXT,
    badge TEXT,
    title TEXT,
    selected_theme TEXT NOT NULL DEFAULT 'neon',
    language TEXT NOT NULL DEFAULT 'de',
    bio TEXT DEFAULT '',
    avatar_image TEXT DEFAULT '',
    focus_areas TEXT DEFAULT '',
    onboarded INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    breakdown TEXT NOT NULL,
    tips TEXT NOT NULL,
    thumbnail TEXT DEFAULT '',
    image_hash TEXT,
    potential INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    reward_jewels INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    goal INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_quests (
    user_id INTEGER NOT NULL,
    quest_id INTEGER NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0,
    claimed_at TEXT,
    PRIMARY KEY (user_id, quest_id)
  );

  CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    price INTEGER NOT NULL,
    icon TEXT NOT NULL,
    accent TEXT DEFAULT '',
    rarity TEXT NOT NULL DEFAULT 'common',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS inventory (
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    owned_at TEXT NOT NULL DEFAULT (datetime('now')),
    equipped INTEGER NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS ad_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reward INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS homework (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    subject TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    due_date TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    done_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS study_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    subject TEXT DEFAULT '',
    source_text TEXT NOT NULL,
    summary TEXT NOT NULL,
    key_points TEXT NOT NULL,
    flashcards TEXT NOT NULL,
    quiz TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS focus_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    minutes INTEGER NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'common',
    xp_reward INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_achievements (
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, achievement_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT DEFAULT 'info',
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT,
    name TEXT NOT NULL,
    brand TEXT DEFAULT '',
    kcal REAL NOT NULL DEFAULT 0,
    protein REAL NOT NULL DEFAULT 0,
    carbs REAL NOT NULL DEFAULT 0,
    fat REAL NOT NULL DEFAULT 0,
    barcode TEXT,
    category TEXT DEFAULT '',
    source TEXT DEFAULT 'seed',
    sugars REAL NOT NULL DEFAULT 0,
    salt REAL NOT NULL DEFAULT 0,
    fiber REAL NOT NULL DEFAULT 0,
    image TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode);
  CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);

  CREATE TABLE IF NOT EXISTS food_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    brand TEXT DEFAULT '',
    amount_g REAL NOT NULL DEFAULT 0,
    kcal REAL NOT NULL DEFAULT 0,
    protein REAL NOT NULL DEFAULT 0,
    carbs REAL NOT NULL DEFAULT 0,
    fat REAL NOT NULL DEFAULT 0,
    sugars REAL NOT NULL DEFAULT 0,
    salt REAL NOT NULL DEFAULT 0,
    barcode TEXT,
    log_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON food_logs(user_id, log_date);

  CREATE TABLE IF NOT EXISTS workout_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'Anfänger',
    days_per_week INTEGER NOT NULL DEFAULT 3,
    duration_min INTEGER NOT NULL DEFAULT 30,
    focus TEXT DEFAULT '',
    icon TEXT DEFAULT '💪',
    exercises TEXT NOT NULL,
    amrap INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS user_workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id INTEGER,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 30,
    exercises TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_user_workouts_user_date ON user_workouts(user_id, date);

  CREATE TABLE IF NOT EXISTS workout_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day_of_week INTEGER,
    time TEXT NOT NULL DEFAULT '18:00',
    message TEXT DEFAULT 'Zeit für dein Workout! 💪',
    enabled INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_weekly_plans (
    user_id INTEGER PRIMARY KEY,
    plan_id INTEGER NOT NULL,
    week_days TEXT NOT NULL DEFAULT '[0,2,4]',
    reminder_time TEXT NOT NULL DEFAULT '18:00',
    set_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_rewards (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'all_goals',
    claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, date, type)
  );

  CREATE TABLE IF NOT EXISTS daily_goal_manual (
    user_id INTEGER NOT NULL,
    goal_date TEXT NOT NULL,
    goal_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, goal_date, goal_key)
  );

  CREATE TABLE IF NOT EXISTS sleep_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sleep_date TEXT NOT NULL,
    hours REAL NOT NULL,
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sleep_user_date ON sleep_logs(user_id, sleep_date);

  CREATE TABLE IF NOT EXISTS water_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    log_date TEXT NOT NULL,
    amount_ml INTEGER NOT NULL DEFAULT 250,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_logs(user_id, log_date);

  CREATE TABLE IF NOT EXISTS skincare_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    log_date TEXT NOT NULL,
    step TEXT NOT NULL DEFAULT 'reinigung',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_skincare_user_date ON skincare_logs(user_id, log_date);

  CREATE TABLE IF NOT EXISTS reminder_settings (
    user_id INTEGER NOT NULL,
    reminder_type TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    interval_min INTEGER NOT NULL DEFAULT 120,
    time_of_day TEXT DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (user_id, reminder_type)
  );

  CREATE TABLE IF NOT EXISTS weekly_reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    sentence1 TEXT DEFAULT '',
    sentence2 TEXT DEFAULT '',
    sentence3 TEXT DEFAULT '',
    mood TEXT DEFAULT '😊',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, week_start)
  );
  `);
  migrate();
}

// Migrationen für bestehende Datenbanken
function migrate() {
  const cols = all('PRAGMA table_info(users)').map((c) => c.name);
  if (!cols.includes('calorie_goal')) q('ALTER TABLE users ADD COLUMN calorie_goal INTEGER NOT NULL DEFAULT 2000');
  if (!cols.includes('protein_goal')) q('ALTER TABLE users ADD COLUMN protein_goal INTEGER NOT NULL DEFAULT 120');
  if (!cols.includes('carbs_goal')) q('ALTER TABLE users ADD COLUMN carbs_goal INTEGER NOT NULL DEFAULT 250');
  if (!cols.includes('fat_goal')) q('ALTER TABLE users ADD COLUMN fat_goal INTEGER NOT NULL DEFAULT 70');
  if (!cols.includes('total_food_logs')) q('ALTER TABLE users ADD COLUMN total_food_logs INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('total_workouts')) q('ALTER TABLE users ADD COLUMN total_workouts INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('streak_shields')) q('ALTER TABLE users ADD COLUMN streak_shields INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('total_chats')) q('ALTER TABLE users ADD COLUMN total_chats INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('total_consumables_used')) q('ALTER TABLE users ADD COLUMN total_consumables_used INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('total_loot_boxes')) q('ALTER TABLE users ADD COLUMN total_loot_boxes INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('total_shields_used')) q('ALTER TABLE users ADD COLUMN total_shields_used INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('language')) q('ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT \'de\'');
  if (!cols.includes('last_weekly_reset')) q('ALTER TABLE users ADD COLUMN last_weekly_reset TEXT');
  if (!cols.includes('title')) q('ALTER TABLE users ADD COLUMN title TEXT');
  if (!cols.includes('avatar_image')) q("ALTER TABLE users ADD COLUMN avatar_image TEXT DEFAULT ''");

  const scanCols = all('PRAGMA table_info(scans)').map((c) => c.name);
  if (!scanCols.includes('image_hash')) q('ALTER TABLE scans ADD COLUMN image_hash TEXT');
  if (!scanCols.includes('potential')) q('ALTER TABLE scans ADD COLUMN potential INTEGER');
  // Perceptual Hash (8×8 Average-Hash) gegen Re-Uploads desselben Fotos mit leicht anderen Bytes
  if (!scanCols.includes('phash')) q('ALTER TABLE scans ADD COLUMN phash TEXT');

  const invCols = all('PRAGMA table_info(inventory)').map((c) => c.name);
  if (!invCols.includes('quantity')) q('ALTER TABLE inventory ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1');

  const foodCols = all('PRAGMA table_info(foods)').map((c) => c.name);
  if (!foodCols.includes('sugars')) q('ALTER TABLE foods ADD COLUMN sugars REAL NOT NULL DEFAULT 0');
  if (!foodCols.includes('salt')) q('ALTER TABLE foods ADD COLUMN salt REAL NOT NULL DEFAULT 0');
  if (!foodCols.includes('fiber')) q('ALTER TABLE foods ADD COLUMN fiber REAL NOT NULL DEFAULT 0');
  if (!foodCols.includes('image')) q("ALTER TABLE foods ADD COLUMN image TEXT DEFAULT ''");

  const logCols = all('PRAGMA table_info(food_logs)').map((c) => c.name);
  if (!logCols.includes('sugars')) q('ALTER TABLE food_logs ADD COLUMN sugars REAL NOT NULL DEFAULT 0');
  if (!logCols.includes('salt')) q('ALTER TABLE food_logs ADD COLUMN salt REAL NOT NULL DEFAULT 0');

  const userCols = all('PRAGMA table_info(users)').map((c) => c.name);
  if (!userCols.includes('focus_areas')) q("ALTER TABLE users ADD COLUMN focus_areas TEXT DEFAULT ''");
  if (!userCols.includes('onboarded')) q('ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0');

  const wpCols = all('PRAGMA table_info(workout_plans)').map((c) => c.name);
  if (!wpCols.includes('amrap')) q('ALTER TABLE workout_plans ADD COLUMN amrap INTEGER NOT NULL DEFAULT 0');

  const hwCols = all('PRAGMA table_info(homework)').map((c) => c.name);
  if (!hwCols.includes('done_at')) q('ALTER TABLE homework ADD COLUMN done_at TEXT');

  const remCols = all('PRAGMA table_info(workout_reminders)').map((c) => c.name);
  if (!remCols.includes('source')) q("ALTER TABLE workout_reminders ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");

  const uwCols = all('PRAGMA table_info(user_workouts)').map((c) => c.name);
  if (!uwCols.includes('distance_km')) q('ALTER TABLE user_workouts ADD COLUMN distance_km REAL');
  if (!uwCols.includes('kind')) q("ALTER TABLE user_workouts ADD COLUMN kind TEXT NOT NULL DEFAULT 'workout'");

  const questCols = all('PRAGMA table_info(quests)').map((c) => c.name);
  if (!questCols.includes('sort_order')) q('ALTER TABLE quests ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');

  // Wöchentliches Lauf-Ziel (km) + ausgezahlte Wochen-Boni
  if (!cols.includes('weekly_run_goal_km')) q('ALTER TABLE users ADD COLUMN weekly_run_goal_km INTEGER NOT NULL DEFAULT 10');
  q(`CREATE TABLE IF NOT EXISTS weekly_run_rewards (
    user_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    km_at_reward REAL NOT NULL,
    xp_bonus INTEGER NOT NULL,
    jewels_bonus INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, week_start)
  );`);
}

export { DB_FILE };
