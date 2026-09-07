// LOCKIN.AI – Server-Einstiegspunkt
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import { seed } from './seed.js';
import { requireAuth } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;

await initDb({ reset: process.argv.includes('--reset') });
seed();
console.log('💾 Datenbank bereit: data/lockin.db');

const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());

// API-Routen
import authRoutes from './routes/auth.js';
import scanRoutes from './routes/scan.js';
import questRoutes from './routes/quests.js';
import shopRoutes from './routes/shop.js';
import adsRoutes from './routes/ads.js';
import schoolRoutes from './routes/school.js';
import userRoutes from './routes/user.js';
import nutritionRoutes from './routes/nutrition.js';
import workoutRoutes from './routes/workouts.js';
import dailyRoutes from './routes/daily.js';
import chatRoutes from './routes/chat.js';
import leaderboardRoutes from './routes/leaderboard.js';
import lifeRoutes from './routes/life.js';
import habitsRoutes from './routes/habits.js';
import remindersRoutes from './routes/reminders.js';
import reflectionsRoutes from './routes/reflections.js';
import statsRoutes from './routes/stats.js';

app.use('/api/auth', authRoutes);
app.use('/api/scan', requireAuth, scanRoutes);
app.use('/api/quests', requireAuth, questRoutes);
app.use('/api/shop', requireAuth, shopRoutes);
app.use('/api/ads', requireAuth, adsRoutes);
app.use('/api/school', requireAuth, schoolRoutes);
app.use('/api/user', requireAuth, userRoutes);
app.use('/api/nutrition', requireAuth, nutritionRoutes);
app.use('/api/workouts', requireAuth, workoutRoutes);
app.use('/api/daily', requireAuth, dailyRoutes);
app.use('/api/chat', requireAuth, chatRoutes);
app.use('/api/leaderboard', requireAuth, leaderboardRoutes);
app.use('/api/life', requireAuth, lifeRoutes);
app.use('/api/habits', requireAuth, habitsRoutes);
app.use('/api/reminders', requireAuth, remindersRoutes);
app.use('/api/reflections', requireAuth, reflectionsRoutes);
app.use('/api/stats', requireAuth, statsRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'LOCKIN.AI', time: new Date().toISOString() }));

const distDir = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.type('text').send('LOCKIN.AI API läuft. Starte das Frontend mit: npm run dev'));
}

// Fehlerbehandlung
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Interner Serverfehler' });
});

app.listen(PORT, () => {
  console.log(`🚀 LOCKIN.AI Server läuft auf http://localhost:${PORT}`);
});
