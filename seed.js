// LOCKIN.AI – Seed-Daten (Quests, Shop, Erfolge, Lebensmittel, Trainingspläne)
import { q } from './db.js';
import { ACHIEVEMENTS } from './store.js';

export const QUESTS = [
  // ═══ WICHTIG: Gesundheit & Self-Improvement (täglich, nach Priorität sortiert) ═══
  { code: 'daily_water', title: '2L Wasser trinken', description: 'Trinke mindestens 2 Liter Wasser am Tag', icon: '💧', category: 'daily', reward_jewels: 15, reward_xp: 25, goal: 1 },
  { code: 'daily_bed', title: 'Bett machen', description: 'Mache dein Bett – der erste Sieg des Tages', icon: '🛏️', category: 'daily', reward_jewels: 12, reward_xp: 20, goal: 1 },
  { code: 'daily_skincare', title: 'Skincare Routine', description: 'Führe deine morgendliche oder abendliche Hautpflege durch', icon: '🧴', category: 'daily', reward_jewels: 15, reward_xp: 25, goal: 1 },
  { code: 'daily_sleep', title: '7+ Stunden Schlaf', description: 'Schlafe mindestens 7 Stunden und logge es', icon: '😴', category: 'daily', reward_jewels: 15, reward_xp: 25, goal: 1 },
  { code: 'daily_food', title: 'Bewusst essen', description: 'Trage mindestens eine Mahlzeit bewusst ein', icon: '🍎', category: 'daily', reward_jewels: 15, reward_xp: 25, goal: 1 },
  { code: 'daily_workout', title: 'Körper bewegen', description: 'Absolviere ein Workout oder 30 Min. Bewegung', icon: '💪', category: 'daily', reward_jewels: 20, reward_xp: 30, goal: 1 },
  { code: 'daily_walk', title: '10 Min. Spaziergang', description: 'Bewege dich draußen – ein kurzer Spaziergang zählt', icon: '🚶', category: 'daily', reward_jewels: 12, reward_xp: 20, goal: 1 },
  // ═══ WICHTIG: Fokus & Lernen (täglich) ═══
  { code: 'daily_focus', title: '10 Min. Fokus', description: 'Sammle 10 Minuten ungeteilte Konzentration', icon: '🧘', category: 'daily', reward_jewels: 15, reward_xp: 25, goal: 10 },
  { code: 'daily_learn', title: 'Wissen erweitern', description: 'Erstelle ein Lernmaterial oder lerne 15 Minuten', icon: '📚', category: 'daily', reward_jewels: 20, reward_xp: 30, goal: 1 },
  { code: 'daily_quiz', title: 'Quiz-Boost', description: 'Beantworte 5 Quizfragen zum Festigen', icon: '🧠', category: 'daily', reward_jewels: 20, reward_xp: 30, goal: 5 },

  // ═══ WOCHENZIELE (jede Woche 1×) ═══
  { code: 'weekly_reflection', title: 'Wochen-Reflexion', description: 'Fasse deine Woche in 3 Sätzen zusammen', icon: '📝', category: 'weekly', reward_jewels: 25, reward_xp: 40, goal: 1 },
  { code: 'weekly_review', title: 'Wochen-Review', description: 'Schau dir deinen Wochenfortschritt im Profil an', icon: '📊', category: 'weekly', reward_jewels: 20, reward_xp: 30, goal: 1 },
  // ═══ OPTIONAL: Belohnte Werbung (wöchentlich, klar als Werbung gekennzeichnet) ═══
  { code: 'weekly_ad', title: 'Belohnte Werbung', description: 'Schau dir eine belohnte Anzeige an – optionaler Juwelen-Boost', icon: '📺', category: 'weekly', reward_jewels: 25, reward_xp: 15, goal: 1 },

  { code: 'first_scan_quest', title: 'Erster Scan', description: 'Führe deinen allerersten Scan durch', icon: '🆕', category: 'special', reward_jewels: 30, reward_xp: 50, goal: 1 },
  { code: 'first_material_quest', title: 'Lernstarter', description: 'Erstelle dein erstes Lernmaterial', icon: '🚀', category: 'special', reward_jewels: 40, reward_xp: 60, goal: 1 },
  { code: 'quiz_80', title: 'Quiz-Sieger', description: 'Bestehe ein Quiz mit mindestens 80 %', icon: '💯', category: 'special', reward_jewels: 50, reward_xp: 80, goal: 1 },
  { code: 'first_buy', title: 'Erster Kauf', description: 'Kaufe ein Item im Shop', icon: '🛒', category: 'special', reward_jewels: 20, reward_xp: 30, goal: 1 },
  { code: 'focus_25', title: 'Deep Work', description: 'Schließe eine 25-Minuten-Fokussession ab', icon: '⏳', category: 'special', reward_jewels: 40, reward_xp: 60, goal: 1 },
  { code: 'hw_first', title: 'Hausaufgaben-Start', description: 'Lege deine erste Hausaufgabe an', icon: '📝', category: 'special', reward_jewels: 20, reward_xp: 30, goal: 1 },
  { code: 'first_food', title: 'Kalorien-Start', description: 'Trage dein erstes Lebensmittel ein', icon: '🍽️', category: 'special', reward_jewels: 20, reward_xp: 30, goal: 1 },
  { code: 'first_workout', title: 'Workout-Starter', description: 'Schließe dein erstes Workout ab', icon: '🏋️', category: 'special', reward_jewels: 30, reward_xp: 50, goal: 1 },
];

export const SHOP_ITEMS = [
  // Bundles (Spar-Angebote)
  { code: 'theme_bundle_rare', name: 'Rare-Themes Bundle', description: 'Alle 9 Rare-Themes in einem Paket – statt 3.050 💎 im Einzelkauf zahlst du nur 1.000 💎. Du sparst über 2.000 Juwelen!', type: 'bundle', price: 1000, icon: '🎁', accent: '#a78bfa', rarity: 'epic' },
  // Themes
  { code: 'theme_neon', name: 'Neon Blau', description: 'Das klassische LOCKIN.AI-Theme', type: 'theme', price: 0, icon: '🔵', accent: '{"accent":"#38bdf8","accent2":"#818cf8"}', rarity: 'common' },
  { code: 'theme_crimson', name: 'Crimson Pulse', description: 'Glühendes Rot – Energie für harte Tage', type: 'theme', price: 300, icon: '🔴', accent: '{"accent":"#fb7185","accent2":"#f43f5e"}', rarity: 'rare' },
  { code: 'theme_emerald', name: 'Emerald Grid', description: 'Kühles Grün für maximale Konzentration', type: 'theme', price: 300, icon: '🟢', accent: '{"accent":"#34d399","accent2":"#2dd4bf"}', rarity: 'rare' },
  { code: 'theme_violet', name: 'Violet Void', description: 'Tiefes Violett – geheimnisvoll und fokussiert', type: 'theme', price: 300, icon: '🟣', accent: '{"accent":"#a78bfa","accent2":"#c084fc"}', rarity: 'rare' },
  { code: 'theme_solar', name: 'Solar Flare', description: 'Warmes Gold – wie ein Energie-Boost', type: 'theme', price: 350, icon: '🟡', accent: '{"accent":"#fbbf24","accent2":"#fb923c"}', rarity: 'rare' },
  { code: 'theme_aurora', name: 'Aurora Shift', description: 'Schimmerndes Polarlicht – das seltenste Theme', type: 'theme', price: 500, icon: '🌌', accent: '{"accent":"#22d3ee","accent2":"#a3e635"}', rarity: 'legendary' },
  // Frames
  { code: 'frame_steel', name: 'Stahlrahmen', description: 'Minimalistischer Metallrahmen für deinen Avatar', type: 'frame', price: 150, icon: '🪙', accent: '', rarity: 'common' },
  { code: 'frame_neon', name: 'Neon-Rahmen', description: 'Leuchtender Rahmen im LOCKIN-Stil', type: 'frame', price: 250, icon: '✨', accent: '', rarity: 'rare' },
  { code: 'frame_cyber', name: 'Cyber-Rahmen', description: 'Glitchiger Rahmen aus der Zukunft', type: 'frame', price: 400, icon: '🕹️', accent: '', rarity: 'epic' },
  // Badges
  { code: 'badge_phoenix', name: 'Phönix-Abzeichen', description: 'Für alle, die immer wieder aufstehen', type: 'badge', price: 200, icon: '🐦‍🔥', accent: '', rarity: 'rare' },
  { code: 'badge_ghost', name: 'Geist-Abzeichen', description: 'Unsichtbar produktiv', type: 'badge', price: 250, icon: '👻', accent: '', rarity: 'rare' },
  { code: 'badge_god', name: 'G.O.D.-Abzeichen', description: 'Für die Legende unter den Legenden', type: 'badge', price: 600, icon: '🌩️', accent: '', rarity: 'legendary' },

  // Keine käuflichen XP-/Juwelen-Booster: Fortschritt entsteht durch echte Arbeit.
  // Verbrauchs-Items bleiben rein kosmetisch oder dienen als kleine Profil-Interaktion.
  { code: 'streak_freeze', name: 'Streak-Freeze', description: 'Schützt deinen Streak automatisch für einen verpassten Tag – wird eingesetzt, sobald du einen Tag auslässt', type: 'consumable', price: 200, icon: '🛡️', accent: '', rarity: 'rare' },
  { code: 'mood_spark', name: 'Mood Spark', description: 'Einmalige Profil-Animation beim Öffnen – keine XP- oder Juwelenwirkung', type: 'consumable', price: 80, icon: '✨', accent: '', rarity: 'common' },
  { code: 'focus_stamp', name: 'Focus Stamp', description: 'Sammelbarer Stempel für dein Profil – nur zur Darstellung', type: 'consumable', price: 120, icon: '🎯', accent: '', rarity: 'rare' },
  { code: 'celebration_pack', name: 'Celebration Pack', description: 'Kosmetische Konfetti-Variante für deine nächste Belohnung', type: 'consumable', price: 180, icon: '🎉', accent: '', rarity: 'epic' },

  // Weitere Kosmetik
  { code: 'frame_gold', name: 'Gold-Rahmen', description: 'Strahlender Goldrahmen für VIP-Avatare', type: 'frame', price: 500, icon: '🌟', accent: '', rarity: 'legendary' },
  { code: 'badge_cyber', name: 'Cyber-Abzeichen', description: 'Für Maschinen, die niemals stoppen', type: 'badge', price: 350, icon: '🤖', accent: '', rarity: 'epic' },
  { code: 'theme_gold', name: 'Gold Vault', description: 'Massives Gold – nur für die Besten', type: 'theme', price: 600, icon: '🟨', accent: '{"accent":"#fde047","accent2":"#f59e0b"}', rarity: 'legendary' },
  { code: 'theme_galaxy', name: 'Galaxy', description: 'Tiefes Weltraum-Blau mit Sternenglanz', type: 'theme', price: 450, icon: '🌌', accent: '{"accent":"#60a5fa","accent2":"#c084fc"}', rarity: 'epic' },
  // Neue interessante kosmetische Items
  { code: 'frame_diamond', name: 'Diamant-Rahmen', description: 'Kristallklarer Rahmen für echte Diamanten', type: 'frame', price: 700, icon: '💎', accent: '', rarity: 'mythic' },
  { code: 'badge_dragon', name: 'Drachen-Abzeichen', description: 'Für die, die Feuer im Bauch haben', type: 'badge', price: 500, icon: '🐉', accent: '', rarity: 'legendary' },
  { code: 'badge_owl', name: 'Eulen-Abzeichen', description: 'Weisheit und Lernbereitschaft', type: 'badge', price: 300, icon: '🦉', accent: '', rarity: 'rare' },
  { code: 'theme_matrix', name: 'Matrix Rain', description: 'Grüner Digitalregen – willst du die Wahrheit?', type: 'theme', price: 550, icon: '🟩', accent: '{"accent":"#22c55e","accent2":"#16a34a"}', rarity: 'epic' },
  { code: 'theme_sunset', name: 'Sunset Vibes', description: 'Warme Orange-Töne für entspannte Abende', type: 'theme', price: 350, icon: '🌅', accent: '{"accent":"#fb923c","accent2":"#f43f5e"}', rarity: 'rare' },
  { code: 'frame_neon_pink', name: 'Pink Neon-Rahmen', description: 'Pinker Leuchtrahmen für den Vibe', type: 'frame', price: 300, icon: '💜', accent: '', rarity: 'rare' },
  { code: 'badge_zen', name: 'Zen-Meister', description: 'Ruhe im Sturm – für Fokus-Legenden', type: 'badge', price: 400, icon: '🧘', accent: '', rarity: 'epic' },
  { code: 'badge_early', name: 'Early Bird', description: 'Früher Aufsteher – der Morgen gehört dir', type: 'badge', price: 200, icon: '🐦', accent: '', rarity: 'rare' },
  { code: 'mood_lightning', name: 'Lightning Strike', description: 'Blitz-Animation für dein Profil – reine Optik', type: 'consumable', price: 150, icon: '⚡', accent: '', rarity: 'rare' },
  { code: 'mood_aura', name: 'Aura Glow', description: 'Sanfte Aura um deinen Avatar – kosmetisch', type: 'consumable', price: 200, icon: '🔮', accent: '', rarity: 'epic' },

  // ═══ Mystery-Boxen: kosmetisches Glücksspiel, keine XP-/Juwelen-Vorteile ═══
  { code: 'mystery_box', name: 'Mystery-Box', description: 'Öffne sie für ein zufälliges kosmetisches Item – vom seltenen Theme bis zur Legende', type: 'box', price: 180, icon: '🎁', accent: '', rarity: 'epic' },

  // ═══ Titel: kleine kosmetische Titel, die unter deinem Namen erscheinen ═══
  { code: 'title_grinder', name: 'Der Grinder', description: 'Für alle, die jeden Tag liefern', type: 'title', price: 150, icon: '⚙️', accent: '', rarity: 'common' },
  { code: 'title_riser', name: 'Early Riser', description: 'Die Sonne aufgehen sehen – jeden Tag', type: 'title', price: 200, icon: '🌅', accent: '', rarity: 'rare' },
  { code: 'title_locked', name: 'Locked In', description: 'Der Kern dieser App – unerschütterlich fokussiert', type: 'title', price: 250, icon: '🔒', accent: '', rarity: 'rare' },
  { code: 'title_phoenix', name: 'Phönix', description: 'Aus der Asche zurückgekehrt – stärker als je zuvor', type: 'title', price: 350, icon: '🐦‍🔥', accent: '', rarity: 'epic' },
  { code: 'title_legend', name: 'Legendär', description: 'Dein Name wird in der LOCKIN-Geschichte bleiben', type: 'title', price: 600, icon: '👑', accent: '', rarity: 'legendary' },
  { code: 'title_myth', name: 'Der Unantastbare', description: 'Nur für die, die wirklich alles gegeben haben', type: 'title', price: 900, icon: '🌀', accent: '', rarity: 'mythic' },

  // ═══ Weitere Themes ═══
  { code: 'theme_ice', name: 'Frostbite', description: 'Eisige Blautöne – kühler Kopf, klarer Fokus', type: 'theme', price: 400, icon: '🧊', accent: '{"accent":"#7dd3fc","accent2":"#e0f2fe"}', rarity: 'epic' },
  { code: 'theme_synth', name: 'Synthwave', description: 'Neon-Pink der 80er – purer Retrovibe', type: 'theme', price: 450, icon: '🌆', accent: '{"accent":"#f472b6","accent2":"#22d3ee"}', rarity: 'epic' },
  { code: 'theme_obsidian', name: 'Obsidian', description: 'Dunkles, edles Grau – stilvoll reduziert', type: 'theme', price: 350, icon: '🖤', accent: '{"accent":"#94a3b8","accent2":"#cbd5e1"}', rarity: 'rare' },
  { code: 'theme_bloodmoon', name: 'Blood Moon', description: 'Düster-roter Mond – für die intensity-Fans', type: 'theme', price: 500, icon: '🌙', accent: '{"accent":"#ef4444","accent2":"#f97316"}', rarity: 'epic' },
  { code: 'theme_toxic', name: 'Toxic Lime', description: 'Giftgrün – maximaler Kontrast, maximale Energie', type: 'theme', price: 450, icon: '☢️', accent: '{"accent":"#a3e635","accent2":"#bef264"}', rarity: 'epic' },
  { code: 'theme_ocean', name: 'Deep Ocean', description: 'Tiefsee-Blau – beruhigend und klar', type: 'theme', price: 400, icon: '🌊', accent: '{"accent":"#0ea5e9","accent2":"#2dd4bf"}', rarity: 'rare' },
  { code: 'theme_royal', name: 'Royal Purple', description: 'Königliches Lila – nicht für die Kleinen', type: 'theme', price: 550, icon: '👑', accent: '{"accent":"#c084fc","accent2":"#e879f9"}', rarity: 'epic' },
  { code: 'theme_ember', name: 'Ember Glow', description: 'Glühende Glut – wärmt auch kalte Tage', type: 'theme', price: 450, icon: '🔥', accent: '{"accent":"#f97316","accent2":"#fbbf24"}', rarity: 'epic' },
  { code: 'theme_arctic', name: 'Arctic Mint', description: 'Frisches Polar-Mint – kühle Schönheit', type: 'theme', price: 450, icon: '❄️', accent: '{"accent":"#5eead4","accent2":"#99f6e4"}', rarity: 'epic' },
  { code: 'theme_cherry', name: 'Cherry Blossom', description: 'Sanfte Kirschblüte – ästhetisch & verspielt', type: 'theme', price: 500, icon: '🌸', accent: '{"accent":"#fda4af","accent2":"#f9a8d4"}', rarity: 'epic' },
  { code: 'theme_mint', name: 'Mint Fresh', description: 'Saftiges Minzgrün – sofort wach', type: 'theme', price: 350, icon: '🌿', accent: '{"accent":"#6ee7b7","accent2":"#a7f3d0"}', rarity: 'rare' },
  { code: 'theme_cyberpunk', name: 'Cyberpunk', description: 'Magenta-Cyan-Chaos der Metropole', type: 'theme', price: 650, icon: '🌃', accent: '{"accent":"#d946ef","accent2":"#22d3ee"}', rarity: 'legendary' },
  { code: 'theme_espresso', name: 'Espresso', description: 'Warme Kaffee-Töne – gemütlich & fokussiert', type: 'theme', price: 350, icon: '☕', accent: '{"accent":"#d6a97b","accent2":"#b08968"}', rarity: 'rare' },
  { code: 'theme_aurora2', name: 'Northern Lights', description: 'Eiskalt pulsierendes Polarlicht', type: 'theme', price: 700, icon: '🌫️', accent: '{"accent":"#34f5c5","accent2":"#818cf8"}', rarity: 'legendary' },
  { code: 'theme_cosmic', name: 'Cosmic Lavender', description: 'Sternenstaub-Lavendel – cosmic vibes only', type: 'theme', price: 600, icon: '✴️', accent: '{"accent":"#b4a7f5","accent2":"#7c3aed"}', rarity: 'legendary' },
  { code: 'theme_lava', name: 'Lava Flow', description: 'Magma-Orange aus dem Vulkan', type: 'theme', price: 550, icon: '🌋', accent: '{"accent":"#ff5e3a","accent2":"#ffb347"}', rarity: 'epic' },
];

// Lebensmittel (Nährwerte pro 100 g). Barcodes sind Beispiel-EANs;
// echte Barcodes werden zusätzlich über Open Food Facts aufgelöst.
export const FOODS = [
  ['food_apfel', 'Apfel', '', 52, 0.3, 14, 0.2, '4000000000001', 'Obst'],
  ['food_banane', 'Banane', '', 89, 1.1, 23, 0.3, '4000000000002', 'Obst'],
  ['food_orange', 'Orange', '', 47, 0.9, 12, 0.1, '4000000000003', 'Obst'],
  ['food_erdbeeren', 'Erdbeeren', '', 32, 0.7, 7.7, 0.3, '4000000000004', 'Obst'],
  ['food_avocado', 'Avocado', '', 160, 2, 9, 15, '4000000000005', 'Obst'],
  ['food_tomate', 'Tomate', '', 18, 0.9, 3.9, 0.2, '4000000000006', 'Gemüse'],
  ['food_gurke', 'Salatgurke', '', 15, 0.7, 3.6, 0.1, '4000000000007', 'Gemüse'],
  ['food_karotte', 'Karotte', '', 41, 0.9, 9.6, 0.2, '4000000000008', 'Gemüse'],
  ['food_paprika', 'Paprika', '', 31, 1, 6, 0.3, '4000000000009', 'Gemüse'],
  ['food_brokkoli', 'Brokkoli', '', 34, 2.8, 7, 0.4, '4000000000010', 'Gemüse'],
  ['food_spinat', 'Spinat', '', 23, 2.9, 3.6, 0.4, '4000000000011', 'Gemüse'],
  ['food_zucchini', 'Zucchini', '', 17, 1.2, 3.1, 0.3, '4000000000012', 'Gemüse'],
  ['food_kartoffeln', 'Kartoffeln (gekocht)', '', 87, 2, 20, 0.1, '4000000000013', 'Beilagen'],
  ['food_suesskartoffel', 'Süßkartoffel', '', 86, 1.6, 20, 0.1, '4000000000014', 'Beilagen'],
  ['food_reis', 'Reis (gekocht)', '', 130, 2.7, 28, 0.3, '4000000000015', 'Beilagen'],
  ['food_nudeln', 'Nudeln (gekocht)', '', 131, 5, 25, 1.1, '4000000000016', 'Beilagen'],
  ['food_quinoa', 'Quinoa (gekocht)', '', 120, 4.4, 21, 1.9, '4000000000017', 'Beilagen'],
  ['food_vollkornbrot', 'Vollkornbrot', '', 220, 9, 40, 3, '4000000000018', 'Brot & Backwaren'],
  ['food_baguette', 'Baguette', '', 270, 9, 55, 2, '4000000000019', 'Brot & Backwaren'],
  ['food_croissant', 'Croissant', '', 406, 8, 45, 21, '4000000000020', 'Brot & Backwaren'],
  ['food_haferflocken', 'Haferflocken', '', 366, 13, 59, 7, '4000000000021', 'Getreide'],
  ['food_muesli', 'Früchtemüsli', '', 370, 9, 70, 7, '4000000000022', 'Getreide'],
  ['food_ei', 'Ei (gekocht)', '', 155, 13, 1.1, 11, '4000000000023', 'Protein'],
  ['food_haehnchen', 'Hähnchenbrust', '', 165, 31, 0, 3.6, '4000000000024', 'Protein'],
  ['food_rinderhack', 'Rinderhackfleisch', '', 250, 26, 0, 15, '4000000000025', 'Protein'],
  ['food_lachs', 'Lachsfilet', '', 208, 20, 0, 13, '4000000000026', 'Protein'],
  ['food_thunfisch', 'Thunfisch (Dose, in Wasser)', '', 116, 26, 0, 1, '4000000000027', 'Protein'],
  ['food_tofu', 'Tofu', '', 144, 15, 3, 9, '4000000000028', 'Protein'],
  ['food_whey', 'Whey-Protein', 'MyProtein', 376, 75, 8, 5, '4000000000029', 'Protein'],
  ['food_proteinriegel', 'Proteinriegel', 'Fitnessbar', 400, 30, 35, 15, '4000000000030', 'Snacks'],
  ['food_milch', 'Milch 3,5 %', '', 64, 3.4, 4.7, 3.5, '4000000000031', 'Milchprodukte'],
  ['food_joghurt', 'Naturjoghurt 3,5 %', '', 68, 4, 4.8, 3.8, '4000000000032', 'Milchprodukte'],
  ['food_quark', 'Magerquark', '', 67, 12, 4, 0.3, '4000000000033', 'Milchprodukte'],
  ['food_gouda', 'Gouda', '', 356, 25, 2, 28, '4000000000034', 'Milchprodukte'],
  ['food_butter', 'Butter', '', 742, 0.7, 0.1, 82, '4000000000035', 'Milchprodukte'],
  ['food_nutella', 'Nutella', 'Ferrero', 544, 6, 57, 31, '4000000000036', 'Süßes'],
  ['food_schoko', 'Vollmilchschokolade', '', 535, 7.7, 59, 30, '4000000000037', 'Süßes'],
  ['food_honig', 'Honig', '', 304, 0.3, 82, 0, '4000000000038', 'Süßes'],
  ['food_zucker', 'Zucker', '', 400, 0, 100, 0, '4000000000039', 'Süßes'],
  ['food_chips', 'Kartoffelchips', '', 536, 7, 53, 35, '4000000000040', 'Snacks'],
  ['food_pizza', 'Pizza Margherita', '', 250, 11, 30, 9, '4000000000041', 'Fertiggerichte'],
  ['food_pommes', 'Pommes frites', '', 312, 3.4, 41, 15, '4000000000042', 'Fast Food'],
  ['food_doner', 'Döner Kebab', '', 210, 11, 24, 7, '4000000000043', 'Fast Food'],
  ['food_olivenoel', 'Olivenöl', '', 884, 0, 0, 100, '4000000000044', 'Fette'],
  ['food_erdnussbutter', 'Erdnussbutter', '', 588, 25, 20, 50, '4000000000045', 'Fette'],
  ['food_mandeln', 'Mandeln', '', 579, 21, 22, 50, '4000000000046', 'Nüsse'],
  ['food_cola', 'Cola', '', 42, 0, 10.6, 0, '4000000000047', 'Getränke'],
  ['food_energydrink', 'Energy-Drink', '', 22, 0, 5, 0, '4000000000048', 'Getränke'],
  ['food_orangensaft', 'Orangensaft', '', 45, 0.7, 10, 0.2, '4000000000049', 'Getränke'],
  ['food_apfelsaft', 'Apfelsaft', '', 46, 0.1, 11, 0.1, '4000000000050', 'Getränke'],
  ['food_bier', 'Bier', '', 43, 0.5, 3.6, 0, '4000000000051', 'Getränke'],
  ['food_rotwein', 'Rotwein', '', 85, 0.1, 2.6, 0, '4000000000052', 'Getränke'],
  ['food_salami', 'Salami', '', 336, 22, 1.5, 27, '4000000000053', 'Protein'],
  ['food_putenbrust', 'Putenbrust (Aufschnitt)', '', 105, 24, 0, 1, '4000000000054', 'Protein'],
];

// Trainingspläne (Übungen als JSON)
export const WORKOUT_PLANS = [
  {
    code: 'plan_beginner',
    name: 'Anfänger: Ganzkörper',
    description: '3× pro Woche der perfekte Einstieg. Alle großen Muskelgruppen, überall machbar – mit oder ohne Equipment.',
    difficulty: 'Anfänger', days_per_week: 3, duration_min: 35, focus: 'Ganzkörper', icon: '🌱',
    exercises: [
      { name: 'Kniebeugen', sets: 3, reps: '12–15', rest: '60s' },
      { name: 'Liegestütze (Knie oder voll)', sets: 3, reps: '8–12', rest: '60s' },
      { name: 'Ausfallschritte', sets: 3, reps: '10 pro Bein', rest: '60s' },
      { name: 'Plank', sets: 3, reps: '30–45s', rest: '45s' },
      { name: 'Glute Bridge', sets: 3, reps: '15', rest: '45s' },
      { name: 'Rudern mit Wasserflaschen', sets: 3, reps: '12', rest: '60s' },
    ],
  },
  {
    code: 'plan_home',
    name: 'Home Bodyweight',
    description: '4× pro Woche – nur Körpergewicht, kein Equipment nötig. Perfekt für Zuhause.',
    difficulty: 'Mittel', days_per_week: 4, duration_min: 30, focus: 'Ganzkörper', icon: '🏠',
    exercises: [
      { name: 'Burpees', sets: 4, reps: '10', rest: '45s' },
      { name: 'Bergsteiger', sets: 4, reps: '30s', rest: '30s' },
      { name: 'Diamond Push-Ups', sets: 3, reps: '8–12', rest: '60s' },
      { name: 'Bulg. Ausfallschritt', sets: 3, reps: '10 pro Bein', rest: '60s' },
      { name: 'Superman', sets: 3, reps: '12', rest: '45s' },
    ],
  },
  {
    code: 'plan_ppl',
    name: 'Push · Pull · Legs',
    description: 'Der Klassiker für Fortgeschrittene: 6 Trainingstage, jeder Muskel 2× pro Woche.',
    difficulty: 'Fortgeschritten', days_per_week: 6, duration_min: 60, focus: 'Split', icon: '🏋️',
    exercises: [
      { name: 'Bankdrücken', sets: 4, reps: '8–10', rest: '90s' },
      { name: 'Schulterdrücken', sets: 4, reps: '8–10', rest: '90s' },
      { name: 'Latzug', sets: 4, reps: '10–12', rest: '90s' },
      { name: 'Rudern am Kabel', sets: 4, reps: '10–12', rest: '90s' },
      { name: 'Kniebeugen', sets: 4, reps: '8–10', rest: '120s' },
      { name: 'Kreuzheben', sets: 3, reps: '6–8', rest: '120s' },
    ],
  },
  {
    code: 'plan_hiit',
    name: 'HIIT Burn 20′',
    description: 'Kurze, intensive Einheiten: maximaler Kalorienverbrauch in nur 20 Minuten.',
    difficulty: 'Mittel', days_per_week: 3, duration_min: 20, focus: 'Kondition', icon: '🔥',
    exercises: [
      { name: 'Jumping Jacks', sets: 4, reps: '40s', rest: '20s' },
      { name: 'Squat Jumps', sets: 4, reps: '30s', rest: '20s' },
      { name: 'Mountain Climbers', sets: 4, reps: '40s', rest: '20s' },
      { name: 'High Knees', sets: 4, reps: '40s', rest: '20s' },
      { name: 'Plank Jacks', sets: 4, reps: '30s', rest: '20s' },
    ],
  },
  {
    code: 'plan_morning',
    name: 'Morgens 7 Minuten',
    description: 'Jeden Morgen kurz aktiv werden: Beweglichkeit, Kreislauf und gute Laune.',
    difficulty: 'Anfänger', days_per_week: 7, duration_min: 7, focus: 'Mobilität', icon: '☀️',
    exercises: [
      { name: 'Katzen-Kuh', sets: 2, reps: '10', rest: '10s' },
      { name: 'Hüftöffner', sets: 2, reps: '30s pro Seite', rest: '10s' },
      { name: 'Kniebeugen', sets: 2, reps: '15', rest: '20s' },
      { name: 'Wand-Liegestütze', sets: 2, reps: '12', rest: '20s' },
      { name: 'Dehnung Rücken & Beine', sets: 1, reps: '60s', rest: '0s' },
    ],
  },
  {
    code: 'plan_cindy',
    name: 'CINDY – Tom-Holland-Test',
    description: 'Der berühmte 20-Minuten-Benchmark, den Tom Holland viral gemacht hat: 5 Klimmzüge, 10 Liegestütze, 15 Kniebeugen – so viele Runden wie möglich. Benötigt eine Klimmzugstange.',
    difficulty: 'Mittel', days_per_week: 3, duration_min: 20, focus: 'Ganzkörper-Circuit', icon: '⚡',
    exercises: [
      { name: 'Klimmzüge (Pull-ups)', sets: 1, reps: '5 pro Runde', rest: '0s' },
      { name: 'Liegestütze (Push-ups)', sets: 1, reps: '10 pro Runde', rest: '0s' },
      { name: 'Kniebeugen (Squats)', sets: 1, reps: '15 pro Runde', rest: '0s' },
    ],
    amrap: true,
  },
];

export function seed() {
  // Frühere Fortschritts-Booster deaktivieren: Shop bleibt kosmetisch und fair.
  for (const code of ['xp_potion_small', 'xp_potion_big', 'loot_box', 'gem_boost']) {
    q('UPDATE shop_items SET active = 0 WHERE code = ?', [code]);
  }
  // Entfernte App-Nutzungs-Quests deaktivieren (bestehende Datenbanken)
  const REMOVED = ['daily_scan', 'daily_chat', 'daily_login', 'daily_ad', 'weekly_shop', 'weekly_leaderboard', 'daily_homework'];
  for (const code of REMOVED) {
    q('UPDATE quests SET active = 0 WHERE code = ?', [code]);
  }
  // Angepasste Quest-Definitionen in bestehenden Datenbanken synchronisieren
  q("UPDATE quests SET title = '2L Wasser trinken', goal = 1, active = 1 WHERE code = 'daily_water'");
  for (const quest of QUESTS) {
    q('INSERT OR IGNORE INTO quests (code, title, description, icon, category, reward_jewels, reward_xp, goal) VALUES (?,?,?,?,?,?,?,?)',
      [quest.code, quest.title, quest.description, quest.icon, quest.category, quest.reward_jewels, quest.reward_xp, quest.goal]);
  }
  // Sortierung der Daily-Quests pflegen (Reihenfolge = Reihenfolge im QUESTS-Array)
  let dailyOrder = 0;
  for (const quest of QUESTS) {
    if (quest.category === 'daily') {
      dailyOrder += 1;
      q('UPDATE quests SET sort_order = ? WHERE code = ?', [dailyOrder, quest.code]);
    }
  }
  for (const item of SHOP_ITEMS) {
    q('INSERT OR IGNORE INTO shop_items (code, name, description, type, price, icon, accent, rarity) VALUES (?,?,?,?,?,?,?,?)',
      [item.code, item.name, item.description, item.type, item.price, item.icon, item.accent, item.rarity]);
  }
  for (const a of ACHIEVEMENTS) {
    q('INSERT OR IGNORE INTO achievements (code, title, description, icon, rarity, xp_reward) VALUES (?,?,?,?,?,?)',
      [a.code, a.title, a.description, a.icon, a.rarity, a.xp]);
  }
  for (const f of FOODS) {
    q('INSERT OR IGNORE INTO foods (code, name, brand, kcal, protein, carbs, fat, barcode, category, source) VALUES (?,?,?,?,?,?,?,?,?,?)',
      f);
  }
  for (const p of WORKOUT_PLANS) {
    q("INSERT INTO workout_plans (code, name, description, difficulty, days_per_week, duration_min, focus, icon, exercises, amrap) VALUES (?,?,?,?,?,?,?,?,?,?)" +
      " ON CONFLICT(code) DO UPDATE SET name = excluded.name, description = excluded.description, difficulty = excluded.difficulty, days_per_week = excluded.days_per_week, duration_min = excluded.duration_min, focus = excluded.focus, icon = excluded.icon, exercises = excluded.exercises, amrap = excluded.amrap",
      [p.code, p.name, p.description, p.difficulty, p.days_per_week, p.duration_min, p.focus, p.icon, JSON.stringify(p.exercises), p.amrap ? 1 : 0]);
  }
}
