# 🔒 LOCKIN.AI

Dein persönliches **Self-Improvement-Betriebssystem** – nicht eine Face-Rating-App, nicht eine Schul-App. Full-Stack: **Express + SQLite (via sql.js) + React (Vite + Tailwind CSS v4)**.

Alle Lebensbereiche sind **gleichwertig**: Appearance, Fitness, Nutrition, Focus, Study und Habits. Der **Daily Lock-In** fasst sie in einen modularen Tagesplan, der **Life Score** macht den Fortschritt spielerisch sichtbar.

> ⚠️ Alle Beauty-/Style-Scores und der Life Score sind **rein illustrativ** (Unterhaltung) – keine echte Gesichtsanalyse, keine objektive Bewertung, kein medizinisches Tool. Juwelen sind reine Demo-Währung ohne Echtgeldwert.

## ✨ Funktionen

| Modul | Beschreibung |
|---|---|
| **Home (Dashboard)** | Aufgeräumte Übersicht: **Life Score** (7 Teilwerte, spielerisch markiert), **Daily Lock-In** (6 gleichwertige Bereiche), Streak, 💎/Level und „Weiter geht’s“-Widgets |
| **Daily Lock-In** | Modularer Tagesplan mit **Appearance, Fitness, Nutrition, Focus, Study, Habits** – automatisch erkannt, manuell abhakbar (trust-based), Tagesbonus +60 💎/+120 ⚡, tägliche Reflexionszeile |
| **Life Score** | Spielerischer Fortschrittswert aus **7 Teilwerten** (Appearance, Fitness, Nutrition, Focus, Study, Discipline, Habits), berechnet aus echten Aktivitäten – ausdrücklich keine wissenschaftliche Bewertung |
| **Improve-Hub** | Vier gleichwertige Bereiche: **Appearance** (Face Scan + Style-Tipps), **Nutrition** (Foto-/Barcode-Scanner, Tagesziel, Verlauf), **Focus** (Lock-In Focus Mode), **Habits & Schlaf** (Schlaf-Log, Wochen-Snapshot) |
| **Appearance** | Face Scan als Unterhaltung: illustrativer Score **(55–99)** mit Bewertungsstufen (55–60 viel Verbesserungsbedarf · 60–70 noch nicht optimal · 70–80 gut · 80–90 exzellent · 90–99 griechischer Gott) + Potenzial-Wert, Tipps für Grooming, Frisur, Stil, Skincare, Fitness. **Jedes Foto nur einmal bewertet** (Fingerprint), Disclaimer klein ganz unten |
| **Nutrition** | Lebensmittel per **Foto-OCR** oder **Barcode** erfassen (lokale DB + Open-Food-Facts-Fallback), Kalorienzähler mit Tagesziel, Makros und 7-Tage-Verlauf – keine medizinischen Aussagen |
| **Focus** | Lock-In Focus Mode: Ziel aus 5 Bereichen wählen, Timer (10/25/50 Min), Fortschritts-Ring, Abschlussbelohnung, Anti-Ablenkungs-Checkliste (Web kann Apps nicht sperren – ehrlicher Hinweis, native App vorbereitet) |
| **Habits & Schlaf** | Schlafdauer loggen (+10 ⚡), Wochen-Snapshot, Life-Score-Habits-Anteil |
| **Train** | 5 Trainingspläne mit Übungen, Sets/Reps, Monats-Kalender, Fortschritts-Charts, Erinnerungen; erledigte Workouts geben XP/Juwelen. Dazu **„Kurzer Spaziergang“** (10 Min., +10 💎) als Quick-Action für die Bewegungs-Quest |
| **Learn** | Hausaufgaben/Skripte per **OCR** hochladen, lokale KI erstellt Zusammenfassung, Lernkarten & Quiz. Hausaufgaben-Manager – modular integriert, kein Hauptfokus |
| **Gamification** | Tägliche Routinen & Meilensteine („Aufgaben“) → Juwelen + XP, **65 Erfolge in 4 Seltenheitsstufen** (Gewöhnlich/Selten/Episch/Legendär) – darunter seltene Erfolge für besondere Streaks (14/21/60/100 Tage) und Meilensteine (100 Workouts, 1000 Fokus-Min., 150 Mahlzeiten, 150 Liter Wasser, perfekte Woche u.v.m.). Seltene/epische/legendäre Erfolge feiern sich mit **Konfetti-Popup** 🎉, Streaks (mit **Streak-Schild**-Schutz), Lock-In-Bonus, Level bis ∞ |
| **Aufgaben nach Priorität** | Tagesaufgaben sind nach echtem Selbstverbesserungswert sortiert: **Wasser (2L), Skincare, Schlaf (7+ Std.), bewusst essen, Workout, Spaziergang, Fokus, Lernen, Quiz, Hausaufgaben** – reine App-Nutzung (Style-Check, Coach fragen, Login, Shop-/Ranglisten-Besuch) wurde aus dem Tagesplan entfernt; Belohnte Werbung ist eine optionale **Wochen**-Aufgabe |
| **Shop** | Juwelen für kosmetische digitale Items: **8 Themes** (komplettes Farbschema), Profilrahmen, Abzeichen, Power-Ups (XP-Tränke, Streak-Schild, Mystery-Box) – **reine Demo-Währung** |
| **Coach-Chatbot** | Allgemeiner KI-Coach mit Gesprächskontext: nutzt optional einen OpenAI-kompatiblen Anbieter für freie Fragen zu praktisch jedem Thema und fällt bei fehlendem Anbieter automatisch auf die lokale Wissensbasis zurück. |
| **Rangliste** | Community-Ranking: **Level (XP)** und **Aktivität dieser Woche**, Podium mit Top 3, „DU“-Hervorhebung, +5 💎 pro Tag |
| **Profil & Fortschritt** | Life-Score-Detail (alle Teilwerte), **Wochenrückblick** (7-Tage-Matrix des Daily Lock-In), Erfolge, Verlauf |
| **Wochen-Reflexion** | Erscheint **jeden Sonntag** auf dem Dashboard: Woche in 3 Sätzen zusammenfassen + Stimmungs-Emoji → +25 💎/+40 ⚡. Im Profil jederzeit schreibbar mit Verlauf aller Reflexionen |
| **Statistik** | Fortschrittsgrafiken für **alle Lebensbereiche**: Life-Score-Balken, 14-Tage-Aktivität (Kalorien, Fokus, Workouts, Schlaf), 8-Wochen-Trend und Gesamt-Totals (Scans, Workouts, kcal, Fokus, Lernen, Schlaf, Wasser, Streak) |
| **Belohnte Werbung** | Demo-Platzhalter, klar als Werbung gekennzeichnet: 5-Sekunden-Anzeige → +25 💎 (Tageslimit) |
| **Auth** | Registrierung/Login mit bcrypt-gehashten Passwörtern, Session-Cookies in SQLite – **man bleibt angemeldet**: 1 Jahr gültige Sessions, Datenbank überlebt Server-Neustarts |

## 🚀 Starten

### Voraussetzungen
- Node.js 18+ (wird lokal im Projektordner mitgeliefert: `.tools/node-v22.23.2-darwin-arm64/`)

### Schnellstart

```bash
# In den Projektordner wechseln und Node in den PATH aufnehmen:
export PATH="$PWD/.tools/node-v22.23.2-darwin-arm64/bin:$PATH"

npm install        # Abhängigkeiten (einmalig)
npm run dev        # Entwicklungsmodus: API (Port 4000) + Vite (Port 5173)
```

Produktionsmodus:

```bash
npm run build      # Frontend bauen (client/dist)
npm start          # Server liefert API + gebautes Frontend auf http://localhost:4000
```

Datenbank: `data/lockin.db` (SQLite, wird automatisch erstellt und geseedet).
- `npm run db:reset` → Datenbank löschen und frisch seeden (achtung: löscht auch alle Nutzer/Sessions!)

**Sessions bleiben erhalten:** Die Datenbank wird bei Server-Neustarts **nicht** gelöscht – wer sich einmal registriert/angemeldet hat, bleibt angemeldet (Session-Cookie, 1 Jahr gültig).

### Demo-Konto
Einfach über **Registrieren** ein Konto anlegen (Start: 250 💎 Juwelen). Die Datenbank startet leer.

## 🧠 Architektur

```
lockin-ai/
├── server/            # Express-Backend
│   ├── index.js       # Server + Routen-Mount + SPA-Serving
│   ├── db.js          # SQLite via sql.js (WASM), Schema, Migrationen
│   ├── store.js       # Level, Streak, Quests, Erfolge, Life Score, Benutzer-Payload
│   ├── ai.js          # Lokale KI: Zusammenfassung, Lernkarten, Quiz, illustrativer Scan
│   ├── seed.js        # Quests, Shop-Items, Erfolge, 54 Lebensmittel, 5 Trainingspläne
│   └── routes/        # auth, scan, quests, shop, ads, school, user, nutrition, workouts, daily, chat, leaderboard, life, habits, reminders, reflections, stats
├── client/            # React-Frontend (Vite + Tailwind v4)
│   └── src/
│       ├── components/  # Layout (Sidebar/Bottom-Nav), UI-Bausteine
│       └── pages/       # Landing, Dashboard, Improve, Appearance, Nutrition, Focus, Habits, Workouts, School, Quests, Shop, Profile, Coach, Leaderboard, Auth
└── scripts/daemonize.rb  # Hilfsskript: Server als Daemon starten (macOS)
```

**Coach-KI aktivieren (optional):** Für freie Antworten zu allgemeinen Fragen setzt du auf dem Server `OPENAI_API_KEY` und optional `OPENAI_MODEL` (Standard: `gpt-4o-mini`). Der Schlüssel bleibt serverseitig und wird nie an den Browser übertragen. Ohne Schlüssel bleibt der lokale Coach verfügbar. Bei Render ist `OPENAI_API_KEY` bereits als geheime Blueprint-Variable vorgesehen; den Wert trägst du im Render-Dashboard ein. API-Nutzung kann Kosten verursachen – setze beim Anbieter ein Ausgabenlimit.


- **Barcode**: lokale Lebensmittel-DB mit Beispiel-EANs → Fallback **Open Food Facts API** (live, wird gecacht).
- **KI-Zusammenfassung & Coach**: deterministische, lokale Extraktion / Wissensbasis (keine API-Keys, offline).
- **Themes**: CSS-Variablen (`--accent`, `--accent-2`) werden pro User gespeichert und beim Laden angewendet.

## 📱 Responsive & Navigation

- **Desktop:** feste Sidebar mit Bereichen (Übersicht · Verbessern · Trainieren · Lernen · Profil · Mehr) + User-Karte
- **Mobil:** Top-Bar (💎-Pill → Shop, 🔔) + untere Navigationsleiste **Home · Improve · Train · Learn · Profil** – Shop prominent über die Juwelen-Pill, alle weiteren Module über Quick-Links auf Home/Profil/Improve
- Jede Seite mobil getestet: große Karten, viel Abstand, klare Icons

## 🛡️ Hinweise

- Die App ist ein Demo-/Unterhaltungsprodukt: Face-Scan-Scores, Kalorienwerte (Seed) und Werbung sind illustrativ bzw. Platzhalter.
- Erinnerungen (Workout/Hausaufgaben) erscheinen in der App bzw. als Browser-Benachrichtigung, solange LOCKIN.AI geöffnet ist – echte Push-Benachrichtigungen erfordern eine App-Version.
- Alle Passwörter werden mit bcrypt gehasht; Sessions liegen in der SQLite-Datenbank.
