// LOCKIN.AI – Konversationeller Coach (lokale KI, offline)
// Topic-Klassifikation + kontextbewusste Antwort-Generierung.
// Der Coach baut Antworten modular zusammen, versteht Folgefragen
// ("und wie genau?", "erklär das näher") und variiert Formulierungen.

// ─── Context-Tracking pro Nutzer ──────────────────────────
const contexts = new Map();

function getContext(userId) {
  const k = userId || 0;
  if (!contexts.has(k)) {
    contexts.set(k, { topic: null, lastQuestionType: null, turn: 0, history: [] });
  }
  return contexts.get(k);
}

function setContext(userId, ctx) {
  contexts.set(userId || 0, { ...ctx, turn: (ctx.turn || 0) + 1, history: [...(ctx.history || []).slice(-4), ctx.topic] });
}

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Topic-Klassifikation ─────────────────────────────────
const TOPIC_KEYWORDS = {
  greeting: ['hallo', 'hey', 'hi ', 'moin', 'guten tag', 'guten morgen', 'guten abend', 'servus', 'nabend'],
  motivation: ['motiv', 'disziplin', 'antrieb', 'faul', 'aufgeben', 'keine lust', 'willpower', 'durchhalten', 'willenskraft', 'antriebslos'],
  nutrition: ['ernähr', 'essen', 'kalorien', 'abnehmen', 'nimm', 'zunehmen', 'protein', 'diät', 'nahrung', 'fett', 'muskelaufbau ernähr', 'gesund essen', 'heißhunger'],
  training: ['training', 'workout', 'sport', 'muskel', 'fitness', 'gym', 'kraft', 'cardio', 'hiit', 'trainieren', 'übungen', 'bauch', 'sixpack', 'bankdrück', 'kniebeuge', 'liegestütz'],
  sleep: ['schlaf', 'müde', 'energie', 'durchschlafen', 'insomnia', 'schlaflos', 'bett', 'aufwachen', 'erholt', 'einschlaf'],
  focus: ['fokus', 'konzentr', 'ablenk', 'aufmerksam', 'telefon', 'handy', 'deep work', 'multitasking', 'störung', 'abgelenkt', 'tiefenarbeit'],
  learning: ['lernen', 'lernmethoden', 'lernmethode', 'karteikarten', 'lernkarten', 'auswendig', 'merken', 'wiederholen', 'wiederholung', 'prüfung', 'klausur', 'hausauf', 'schule', 'studium', 'uni', 'mitschreiben', 'notizen', 'lernplan', 'lernstoff', 'vokabeln', 'pomodoro', 'lerntechnik'],
  procrastination: ['prokrastin', 'aufschieben', 'aufschieberitis', 'schiebe auf', 'verschieben', 'morgen mache ich', 'später machen', 'nicht anfangen', 'anfangen können', 'überfordert mit lernen'],
  streak: ['streak', 'gewohnheit', 'routine', 'täglich', 'daily', 'tag für tag', 'konstanz', 'verpassen', 'dranbleiben', 'routine aufbauen'],
  skincare: ['haut', 'skincare', 'pickel', 'akne', 'creme', 'sonnencreme', 'pflege', 'trockene haut', 'hautpflege'],
  grooming: ['bart', 'haarschnitt', 'styling', 'rasur', 'grooming', 'look', 'outfit', 'kleidung', 'style', 'augenbrauen', 'bartpflege', 'kleiderschrank'],
  faceshape: ['gesichtsform', 'gesicht form', 'kopfform', 'oval', 'quadratisch', 'herzform', 'herz gesicht', 'diamant', 'lang gesicht', 'welche form', 'haarform', 'welche gesichtsform', 'frisur für', 'frisur fuer', 'frisur passt', 'haarschnitt für', 'ovales gesicht', 'rundes gesicht', 'eckiges gesicht', 'welche gesichtsform habe ich', 'gesichtsform erkennen', 'welche frisur', 'frisur zu'],
  facescore: ['face score', 'face-score', 'facescore', 'style score', 'style-score', 'stylescore', 'griechischer gott', 'griechisch', 'exzellent', 'skala', 'stufen', 'bewertung', 'rating', 'mein score', 'meinen score', 'der score', 'den score', 'score bedeutung', 'score erklärt', 'score steigern', 'was bedeutet mein score', 'face scan', 'face-scan'],
  money: ['geld', 'finanzen', 'finanziell', 'sparen', 'spar', 'budget', 'investieren', 'aktien', 'ausgaben', 'einkommen', 'rechnung', 'schulden', 'kosten sparen'],
  career: ['karriere', 'beruf', 'job', 'arbeit', 'bewerbung', 'interview', 'vorstellungsgespräch', 'beförderung', 'aufstieg', 'gehaltsverhandlung', 'verhandl', 'kündigung', 'neuen job', 'kollegen', 'team'],
  social: ['social', 'sozial', 'smalltalk', 'kommunikation', 'konversation', 'gespräch', 'freunde', 'freundschaft', 'einsam', 'netzwerken', 'kennenlernen', 'gesellig'],
  digital_balance: ['bildschirm', 'screentime', 'screen time', 'social media', 'instagram', 'tiktok', 'netflix', 'youtube', 'handysucht', 'bildschirmzeit', 'dopamin', 'scrollen', 'offline', 'digital detox', 'digitaler'],
  stress: ['stress', 'überfordert', 'angst', 'panik', 'druck', 'burnout', 'erschöpft', 'ausgebrannt', 'overwhelmed', 'unsicher'],
  water: ['wasser', 'trinken', 'hydration', 'flüssigkeit', 'durst'],
  coffee: ['kaffee', 'koffein', 'energydrink', 'energie getränk', 'aufputsch'],
  shop_gems: ['juwelen', 'gems', 'shop', 'kaufen', 'belohnung', 'punkte', 'xp', 'level'],
  selfimprovement: ['selfimprovement', 'selbstverbesserung', 'besser werden', 'ziele', 'new year', 'vorsatz', 'verbessern', 'erfolg', 'glücklich', 'wo soll ich anfangen'],
};

function classifyTopic(text) {
  const t = text.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const [topic, kws] of Object.entries(TOPIC_KEYWORDS)) {
    let score = 0;
    for (const kw of kws) {
      if (t.includes(kw)) score += kw.includes(' ') ? 2.5 : 1;
    }
    if (score > bestScore) { bestScore = score; best = topic; }
  }
  return bestScore >= 1 ? best : null;
}

// ─── Question-Type Detection ─────────────────────────────
function detectQuestionType(text, topic) {
  const t = text.toLowerCase();
  if (/^(und|was|wie|erklär|näher|genauer|konkret|mehr|genau so|und dann|und wie)/.test(t)) return 'followup';
  if (/\b(wie|wo|womit|was genau|genau wie|konkret)\b/.test(t) && !/\bwarum\b/.test(t)) return 'howto';
  if (/warum|wieso|weshalb|grund|warum ist/.test(t)) return 'why';
  if (/beispiel|bsp|konkret|praktisch|in der praxis|im alltag|anwendung/.test(t)) return 'example';
  if (/anfäng|neu|noch nie|start|beginn|erster|anfangen/.test(t)) return 'beginner';
  if (/wann|zeitpunkt|uhrzeit|timing/.test(t)) return 'when';
  return 'default';
}

// ─── Modulare Wissensbasis ────────────────────────────────
// Jedes Topic hat: intro, steps (wie macht man es), tips, pitfalls,
// followup (Vertiefung), examples, beginner.
const KB = {
  motivation: {
    intro: ['Motivation kommt und geht – Disziplin bleibt. 💪 Hier sind die Hebel, die wirklich funktionieren:'],
    steps: [
      '**1. Starte winzig klein:** 2 Minuten reichen als Einstieg – danach willst du weitermachen.',
      '**2. Trigger nutzen:** Koppel die neue Gewohnheit an eine bestehende ("Nach dem Zähneputzen 5 Liegestütze").',
      '**3. Nicht 2 Tage in Folge brechen:** Ein Ausrutscher ist ok, zwei machen daraus eine Gewohnheitspause.',
      '**4. Erinnere dich ans WARUM:** Schreib dir auf, warum du anfängst – und häng es sichtbar auf.',
    ],
    tips: ['Tipp: Lege dir eine "Mindestversion" deiner Aufgabe fest – 2 Minuten zählen schon als erledigt!'],
    pitfalls: ['⚠️ Häufigster Fehler: Zu groß starten. Wer Tag 1 zwei Stunden trainiert, bricht Tag 3 ab.'],
    beginner: ['Du bist neu dabei? Perfekt – fang mit nur EINER Gewohnheit an, nicht mit fünf. 5 Minuten reichen.'],
    followup: ['Möchtest du das auf einen konkreten Bereich anwenden – Sport, Lernen oder Gewohnheiten?'],
  },
  nutrition: {
    intro: ['Ernährung ist 80% des Ergebnisses. 🍎 Die Grundregeln, die wirklich zählen:'],
    steps: [
      '**1. Kalorien im Blick:** Tracke 3–5 Tage, um dein realistisches Soll zu kennen (LOCKIN.AI hilft dir dabei!).',
      '**2. Protein priorisieren:** ~1,6–2 g pro kg Körpergewicht bei Muskelaufbau.',
      '**3. Volumen statt Verzicht:** Gemüse, Obst und Wasser füllen den Magen – so bleibst du satt bei weniger Kalorien.',
      '**4. 80/20-Regel:** 80% sauber essen, 20% Genuss – so bleibt es langfristig machbar.',
    ],
    tips: ['Tipp: Heißhunger kommt oft von zu wenig Protein und Wasser – probier erst ein Glas Wasser und einen Apfel.'],
    pitfalls: ['⚠️ Extreme Diäten (z.B. nur Kohlsuppe) funktionieren 2 Wochen, dann folgt der Jojo-Effekt.'],
    example: ['**Konkretes Beispiel für einen Tag:**\n• Frühstück: Haferflocken + Proteinpulver + Beeren\n• Mittag: Hähnchen, Reis, viel Gemüse\n• Abend: Lachs, Salat, Quinoa\n• Snack: griechischer Joghurt + Nüsse'],
    beginner: ['Erste Schritte: Tracke 3 Tage, was du isst – ohne etwas zu ändern. Das Bewusstsein allein wirkt.'],
    when: ['Bestes Timing: Protein innerhalb von 1–2h nach dem Training, größte Mahlzeit mittags, abends leichter.'],
    followup: ['Möchtest du abnehmen, Muskeln aufbauen oder einfach gesünder essen?'],
  },
  training: {
    intro: ['Fürs Training gilt: Progressive Überlastung – du musst Woche für Woche etwas mehr machen. 💪'],
    steps: [
      '**• Anfänger:** 3× pro Woche Ganzkörper reicht völlig.',
      '**• Ruhe nicht unterschätzen:** Muskeln wachsen in der Erholung, nicht im Training.',
      '**• Form vor Gewicht:** Lieber 10 saubere Wiederholungen als 12 wackelige.',
      '**• Dranbleiben:** 2–3 Monate Konstanz sind mehr wert als ein 4-Wochen-Boost.',
    ],
    tips: ['Tipp: Tracke deine Gewichte jede Session – wenn du nichts steigerst, stagnierst du.'],
    pitfalls: ['⚠️ Zu viel, zu früh: Wer mit 5× pro Woche startet, verletzt sich oder brennt aus.'],
    beginner: ['Neu im Gym? Starte mit 3×/Woche Ganzkörper, 6 Übungen à 3 Sätze. Der Plan "Ganzkörper Starter" im Train-Bereich ist perfekt dafür!'],
    example: ['**Beispiel-Session (Ganzkörper, 45 Min):**\n1. Kniebeugen 3×10\n2. Bankdrücken 3×10\n3. Rudern 3×10\n4. Schulterdrücken 3×12\n5. Plank 3×30s\n6. Bizeps/Curl 3×12'],
    when: ['Bestes Trainingstime: 16–19 Uhr (Körpertemperatur und Leistung am höchsten), aber die beste Zeit ist die, an der du dranbleibst.'],
    followup: ['Willst du einen Plan für Zuhause oder ins Gym?'],
  },
  sleep: {
    intro: ['Schlaf ist das unterschätzte Superfood. 😴 Diese Hebel machen den größten Unterschied:'],
    steps: [
      '**1. Feste Zeiten:** Auch am Wochenende ähnliche Schlafenszeit – der Körper liebt Rhythmus.',
      '**2. Blaulicht-Cut 60 Min.** vor dem Schlafen (Handy weg, Handy weg, Handy weg 😉).',
      '**3. Kühler, dunkler Raum:** ~18 °C und komplett dunkel machen den größten Unterschied.',
      '**4. Kein Koffein nach 14 Uhr:** Halbwertszeit ~6 h – der Nachmittags-Cappuccino raubt dir Tiefschlaf.',
    ],
    tips: ['Tipp: Magnesium (200–400 mg) am Abend verbessert die Schlafqualität für viele spürbar.'],
    pitfalls: ['⚠️ "Ich hole das am Wochenende nach" funktioniert nicht – Schlafschulden werden nicht linear zurückgezahlt.'],
    beginner: ['Erste Schritte: Lege heute Abend eine feste Schlafenszeit fest und stelle dein Handy 60 Min vorher weg.'],
    followup: ['Wie sieht dein aktueller Rhythmus aus? Morgens fit oder müde?'],
  },
  focus: {
    intro: ['Fokus ist trainierbar – wie ein Muskel. 🧠 Die wirksamsten Methoden:'],
    steps: [
      '**1. Handy aus dem Raum:** Nicht nur stumm, sondern außer Sichtweite – das reduziert Ablenkung um ~50%.',
      '**2. Ein Task, eine App:** Multitasking kostet dich bis zu 40% Produktivität.',
      '**3. Deep Work-Block:** 2 Stunden am Tag für die wichtigste Aufgabe, ohne Unterbrechungen.',
      '**4. Notfall-Regel:** Bei Ablenkungsdrang 5 Minuten warten – der Impuls klingt meist ab.',
    ],
    tips: ['Tipp: Die Pomodoro-Technik (25 Min Fokus + 5 Min Pause) ist der einfachste Einstieg. Probier die Focus-Mode-Funktion in LOCKIN.AI!'],
    pitfalls: ['⚠• "Ich kann nebenbei gut arbeiten" – Neurologisch widerlegt. Jeder Task-Wechsel kostet ~15 Min Effizienz.'],
    beginner: ['Starte mit einem einzigen 25-Min-Pomodoro pro Tag. Das ist dein Einstieg in Deep Work.'],
    example: ['**Konkreter Deep-Work-Block:**\n1. Handy in anderen Raum\n2. Eine Aufgabe aufschreiben\n3. 90 Min Timer starten\n4. Nur diese eine Sache bearbeiten\n5. Danach 20 Min Pause'],
    followup: ['Geht es dir um Arbeits-Fokus oder ums Lernen? Frag mich nach "Lernmethoden" für spezifische Lerntipps!'],
  },
  learning: {
    intro: ['Lernen ist keine Begabung, sondern eine Technik. 📚 Die vier wirksamsten Hebel:'],
    steps: [
      '**1. Aktives Abrufen statt Lesen:** Nach dem Lesen zudecken und aus dem Gedächtnis wiedergeben – der Abruf festigt 5× stärker als erneutes Lesen.',
      '**2. Karteikarten mit System:** Frage vorne, Antwort hinten. Wirklich lernen heißt: laut beantworten, nicht nur umdrehen und lesen.',
      '**3. Spaced Repetition:** Wiederhole nach 1 Tag, dann 3, 7, 21 Tagen – so wandert Stoff ins Langzeitgedächtnis.',
      '**4. Pomodoro:** 25 Min. voller Fokus, 5 Min. Pause. Lieber 4 kurze Blöcke als eine 4-Stunden-Folter.',
    ],
    tips: ['Pro-Tipp gegen Prokrastination: Mach die erste Lern-Aufgabe winzig klein ("1 Karteikarte lernen") – der Anfang ist der schwerste Teil.'],
    pitfalls: ['⚠️ Markieren und nochmal Lesen fühlt sich produktiv an, ist aber eine der ineffizientesten Lernmethoden.'],
    beginner: ['Erste Schritte: 1. Erstelle 10 Karteikarten. 2. Lerne sie mit der "Leitner-Box" (wiederhole falsche Karten öfter). 3. Mach 2 Pomodoro-Sessions pro Tag.'],
    example: ['**Beispiel-Lernplan für eine Prüfung:**\n• Tag 1–3: Stoff lesen + 20 Karteikarten erstellen\n• Tag 4–10: Karten wiederholen (Spaced Repetition)\n• Tag 7+: Altklausuren rechnen\n• Tag vor Prüfung: Nur noch Karten durchgehen, nichts Neues'],
    when: ['Bestes Timing: Morgens 8–11 Uhr ist das Gedächtnis am stärksten. Kurz vor dem Schlafen Gelerntes wird im Schlaf gefestigt!'],
    followup: ['Was lernst du gerade? Für eine Klausur, Vokabeln oder ein neues Thema?'],
  },
  procrastination: {
    intro: ['Prokrastination ist fast nie Faulheit – meist ist es Überforderung oder Angst vor dem Anfang. 🧠'],
    steps: [
      '**1. Die 2-Minuten-Regel:** Wenn etwas unter 2 Minuten dauert, mach es sofort.',
      '**2. Aufgaben zerkleinern:** "Mathe lernen" ist zu groß. Besser: "Seite 12–14 lesen" oder "3 Aufgaben rechnen".',
      '**3. 5-Minuten-Start:** Sag dir "Ich mache nur 5 Minuten" – das senkt die Einstiegshürde massiv. Danach willst du fast immer weitermachen.',
      '**4. Umgebung aufräumen:** Handy in einen anderen Raum, Schreibtisch frei – Entscheidungen sparen.',
      '**5. Selbst-Mitgefühl:** Wer sich nach einem Aufschieber schuldig fühlt, schiebt oft noch mehr auf. Verzeih dir und starte neu.',
    ],
    tips: ['Tipp: Der "5-Minuten-Trick" ist der stärkste: Sage dir "nur 5 Minuten". Nach 5 Minuten willst du weitermachen – derImpuls war nur die Hürde.'],
    pitfalls: ['⚠• Strenge dich nicht mit "hart diszipliniert sein" an – Strategien wie die 2-Minuten-Regel wirken besser als reine Willenskraft.'],
    example: ['**Konkretes Beispiel:**\nStatt: "Ich muss für die Klausur lernen" →\nStatt: "Ich lese Seite 12 und mache die erste Aufgabe."\nSogar: "Ich öffne nur das Buch."\nDas ist der Trick: die Hürde so klein machen, dass ein Nein unmöglich ist.'],
    beginner: ['Erste Schritte: Nimm EINE Aufgabe, die du aufschiebst. Brich sie in einen Schritt, der 2 Minuten dauert. Mach nur den.'],
    followup: ['Woran genau hängst du gerade fest? Lernen, Sport oder eine andere Gewohnheit?'],
  },
  streak: {
    intro: ['Ein Streak ist dein bester Freund – und dein strengster Lehrer. 🔥'],
    steps: [
      '**• Mache ihn schwer zu brechen:** Die Aufgabe muss an schlechten Tagen in 2 Minuten machbar sein.',
      '**• Immer einen Ersatzplan:** "Wenn ich keine Zeit habe, mache ich nur die Mini-Version."',
      '**• Verpasse nie zwei Tage:** Ein Tag Pause ist ok, zwei sind der Anfang vom Ende.',
      '**• Belohne Meilensteine:** Nach 7, 30, 100 Tagen gönn dir etwas – im LOCKIN.AI-Shop zum Beispiel 😉',
    ],
    tips: ['Tipp: Ein Streak-Schild im Shop schützt deinen Lauf, falls doch mal ein Tag verrutscht!'],
    pitfalls: ['⚠• Perfektionismus tötet Streaks: Ein Tag Pause ist kein Versagen – aufgeben erst.'],
    beginner: ['Erste Schritte: Wähle EINE Gewohnheit (z.B. 5 Min. Stretching). Mach sie 7 Tage lang jeden Tag – egal wie kurz.'],
    followup: ['Welche Gewohnheit willst du als Streak aufbauen?'],
  },
  skincare: {
    intro: ['Hautpflege muss nicht kompliziert sein – Konsistenz schlägt Produktflut. 🧴'],
    steps: [
      '**1. Die Basis:** Reinigen, Feuchtigkeit, Sonnencreme (täglich! auch im Winter).',
      '**2. Neu einführen:** Ein neues Produkt pro 2 Wochen testen, sonst weißt du nie, was wirkt.',
      '**3. Bei Akne:** Sanfte Reinigung + nicht puhlen – und bei anhaltender Akne einen Dermatologen fragen.',
      '**4. Schlaf & Wasser:** Deine Haut zeigt, was innen passiert – 7+ Stunden Schlaf und 2 Liter Wasser sind "inwendige Skincare".',
    ],
    tips: ['Tipp: Sonnencreme ist der beste Anti-Aging-Wirkstoff – täglich, auch im Winter, auch bei Bewölkung.'],
    pitfalls: ['⚠• Zu viele Produkte auf einmal: Wenn du 5 neue Cremes gleichzeitig einfährst, weißt du nie, was allergisch reagiert.'],
    example: ['**Beispiel-Routine (Anfänger, 3 Schritte):**\nMorgens: Reinigen → Feuchtigkeitscreme → Sonnencreme SPF 30+\nAbends: Reinigen → Feuchtigkeitscreme\nDas reicht für 90% aller Hauttypen.'],
    beginner: ['Erste Schritte: Besorge dir 3 Dinge: einen Reiniger, eine Feuchtigkeitscreme und Sonnencreme. Das ist deine Basis für die nächsten 4 Wochen.'],
    followup: ['Geht es dir um allgemeine Pflege, Akne oder Anti-Aging?'],
  },
  grooming: {
    intro: ['Grooming ist deine tägliche 5-Minuten-Investition in Selbstbewusstsein. ✨'],
    steps: [
      '**• Augenbrauen & Bart:** Saubere Kanten machen sofort den gepflegtesten Unterschied.',
      '**• Haarschnitt im Rhythmus:** Alle 4–6 Wochen – lieber häufiger nachschneiden lassen.',
      '**• Outfit-Formel:** 3 neutrale Basics + 1 Statement-Teil = mühelos gut aussehen.',
      '**• Schuhe:** Ein sauberes Paar Schuhe macht 50% des ersten Eindrucks aus.',
    ],
    tips: ['Tipp: Frag deinen Friseur nach deiner Gesichtsform – der richtige Schnitt für deine Form wirkt wie ein Upgrade. Frag mich "Welche Gesichtsform habe ich?" für Details!'],
    pitfalls: ['⚠• Zu viele Trends gleichzeitig: Ein klassischer, gut gepflegter Look schlägt jedes kurzlebige Trend-Outfit.'],
    example: ['**Beispiel-Outfit (clean & vielseitig):**\n• Weißes T-Shirt (gut sitzend)\n• Dunkelblaue Jeans (keine Risse)\n• Weiße Sneaker (sauber!)\n• 1 Statement-Teil: z.B. eine gute Uhr oder eine markante Jacke'],
    beginner: ['Erste Schritte: 1. Augenbrauen professionell formen lassen. 2. Einen klassischen Haarschnitt wählen. 3. 3 neutrale Basics kaufen.'],
    followup: ['Möchtest du Bartpflege-Tipps, Frisur-Empfehlungen oder Stil-Ratschläge?'],
  },
  faceshape: {
    intro: ['Deine Gesichtsform bestimmt, welche Frisuren und Styles dir besonders gut stehen! 🪞 Hier ist das Wichtigste:'],
    steps: [
      '**🥚 Oval:** Stirn, Wangenknochen und Kinn laufen harmonisch zusammen. Fast jede Frisur passt! Bestens: Short Back & Sides, Curtain Bangs, Mid-Length Textured.',
      '**🌕 Rund:** Weiche Konturen, ähnliche Breite und Länge. Bestens: Pompadour/Quiff, High Fade + Textured Top, Side Part. Vermeide gerade Ponys.',
      '**🔲 Quadratisch:** Starke Kieferkante, markante Wangenknochen. Bestens: Textured Crop, Medium Wavy, Side-Swept Fringe. Vermeide Buzz-Cuts ohne Struktur.',
      '**💜 Herz:** Breite Stirn, schmales Kinn. Bestens: Curtain Bangs, Chin-Length Bob, Layered Medium. Vermeide Volumen oben ohne Ausgleich.',
      '**📭 Lang:** Länger als breit, gerade Kieferlinie. Bestens: Full Fringe/Bangs, Layered Mid-Length, Side-Swept. Vermeide sehr lange glatte Schnitte.',
      '**💎 Diamant:** Schmal an Stirn und Kinn, breite Wangenknochen. Bestens: Textured Fringe, Medium Wavy, Chin-Length. Vermeide kurze Seiten ohne Volumen oben.',
    ],
    tips: ['Tipp: Mach den Face Scan in LOCKIN.AI – er erkennt deine Gesichtsform (illustrativ) und empfiehlt dir passgenaue Frisuren!'],
    pitfalls: ['⚠• Die falsche Frisur für deine Gesichtsform kann das Gesicht unharmonisch wirken lassen. Ein guter Friseur kennt die Formen.'],
    example: ['**Konkretes Beispiel:**\nRundes Gesicht + Pompadour: Das Volumen oben streckt das Gesicht optisch, die kurzen Seiten definieren die Wangenknochen. Sofort harmonischer Look.'],
    beginner: ['Erste Schritte: Schau in den Spiegel und vergleiche deine Form mit den 6 Typen oben. Oder mach den Face Scan – er erkennt sie für dich!'],
    followup: ['Möchtest du mehr zu einer bestimmten Gesichtsform wissen – oval, rund, quadratisch, herz, lang oder diamant?'],
  },
  facescore: {
    intro: ['Der Face-/Style-Score ist rein illustrativ – Unterhaltung für dich, keine objektive Messung. 😉'],
    steps: [
      '🔴 **55–60 · Viel Verbesserungsbedarf** – hier steckt am meisten Potenzial',
      '🟠 **60–70 · Noch nicht optimal** – die Basics wirken, jetzt wird es spannend',
      '🔵 **70–80 · Gut** – solide Basis, einfach dranbleiben!',
      '🟢 **80–90 · Exzellent** – sehr stark, die Tipps halten deinen Kurs',
      '🟡 **90–99 · Griechischer Gott** – extrem selten, absoluter Top-Wert',
    ],
    tips: ['Tipp: Du bekommst auch einen Potenzial-Wert (+5 bis +18 über deinem Score) und Tipps in 5 Kategorien: Grooming, Hautpflege, Frisur, Stil und Fitness.'],
    pitfalls: ['⚠• Der Score ist keine objektive Bewertung und kein medizinisches Tool – er ist rein für Unterhaltung und Motivation gedacht.'],
    beginner: ['Wichtig: Jedes Foto wird nur einmal bewertet – du kannst nicht so lange neu laden, bis die Zahl passt. Steigern kannst du nur mit täglichen Gewohnheiten!'],
    followup: ['Möchtest du wissen, wie du deinen Score steigern kannst, oder was die einzelnen Kategorien bedeuten?'],
  },
  money: {
    intro: ['Geld ist ein Werkzeug für Freiheit – und ein Gewohnheitsthema wie alles andere. 💰'],
    steps: [
      '**1. Automatisieren:** Einen Dauerauftrag fürs Sparen direkt am Gehaltstag – was weg ist, gibt kein Bauchgefühl.',
      '**2. 50/30/20-Regel:** 50% Fixkosten, 30% Leben, 20% Sparen/Abbau – ein einfacher Einstieg.',
      '**3. 30-Tage-Regel bei Impulskäufen:** Auf die Wunschliste, 30 Tage warten. Viele Wünsche verfliegen.',
      '**4. Fixkosten-Check:** Abos und Versicherungen 1× im Jahr durchgehen – oft schlummert hier echtes Potenzial.',
      '**5. Schulden zuerst:** Bevor du investierst, tilge teure Schulden (Kreditkarte/Dispo) – das ist die sicherste "Rendite".',
    ],
    tips: ['Tipp: Tracke einen Monat lang jede Ausgabe – das Bewusstsein allein reduziert oft 15–20% der Ausgaben.'],
    pitfalls: ['⚠• "Ich fange an zu investieren, wenn ich mehr Geld habe" – der beste Moment zum Sparen ist immer jetzt, auch wenn es nur 20€ sind.'],
    example: ['**Konkretes Beispiel (50/30/20):**\nBei 2000€ netto: 1000€ Fixkosten, 600€ Leben, 400€ Sparen/Schulden.\nNach 1 Jahr: 4800€ gespart. Nach 5 Jahren: 24.000€ + Zinsen.'],
    beginner: ['Erste Schritte: 1. Notiere heute jede Ausgabe. 2. Prüfe deine Abos (Netflix, Gym, etc.). 3. Stelle einen Dauerauftrag von 50€/Monat ein.'],
    followup: ['Möchtest du ein Budget erstellen, sparen automatisieren oder Schulden abbauen?'],
  },
  career: {
    intro: ['Karriere ist Marathon, nicht Sprint – sie läuft über Kompetenz + Sichtbarkeit. 📈'],
    steps: [
      '**1. Wert schaffen, dann fragen:** Bevor du nach mehr Gehalt fragst, dokumentiere 3 konkrete Erfolge mit Zahlen.',
      '**2. Netzwerken, bevor du es brauchst:** 1 Kaffee pro Monat mit jemandem außerhalb deines Teams.',
      '**3. Skills, die gefragt sind:** Frag dich: "Welches Problem löst mein Team, das ich noch lernen kann?" – dann lern genau das.',
      '**4. Bewerbung = Fit-Story:** Lebenslauf ist Chronik, Anschreiben ist Argument. Zeig, welches Problem du löst.',
      '**5. Work-Life-Grenzen:** Überstunden sind manchmal nötig, Dauer-Überstunden sind ein Systemfehler.',
    ],
    tips: ['Tipp: Für eine Gehaltsverhandlung: 3 konkrete Erfolge mit Zahlen notieren, Marktwert recherchieren (Glassdoor, StepStone), dann einen Bereich nennen, nicht eine Zahl.'],
    pitfalls: ['⚠• "Meine Arbeit spricht für sich" – in den meisten Firmen muss Sichtbarkeit aktiv gestaltet werden. Niemand sieht, was nicht gezeigt wird.'],
    example: ['**Beispiel-Gehaltsverhandlung:**\n"Ich habe im letzten Jahr 3 Projekte erfolgreich abgeschlossen, die das Team um 15% effizienter gemacht haben. Mein Marktwert liegt bei X–Y. Ich würde mich freuen, wenn wir darüber sprechen."'],
    beginner: ['Erste Schritte: 1. Schreibe deine 3 größten Erfolge der letzten 12 Monate auf. 2. Recherchiere deinen Marktwert. 3. Rede mit 1 Person außerhalb deines Teams.'],
    followup: ['Was ist dein nächster Karriereschritt – Gehalt, Beförderung oder ein neuer Job?'],
  },
  social: {
    intro: ['Soziale Fähigkeiten sind trainierbar – wie Muskeln. 🤝'],
    steps: [
      '**1. Smalltalk-Formel:** Frage + eigene Anekdote im Wechsel. "Woher kennst du die Gastgeber?" → kurz erzählen → zurückfragen.',
      '**2. Zuhören ist das Zaubermittel:** Die beste Konversation ist die, in der der andere sich gehört fühlt. Nachfragen > Nacherzählen.',
      '**3. Einsamkeit aktiv angehen:** Regelmäßige wiederkehrende Treffen (Sportkurs, Buchclub, Verein) ersetzen keinen Zufall.',
      '**4. Ablehnung entdramatisieren:** Die meisten Menschen freuen sich über ein ehrliches "Wollen wir mal einen Kaffee trinken?" – und wenn nicht, liegt es fast nie an dir.',
      '**5. Energie-Budget:** Introvertiert? Plane Erholungszeit nach sozialen Events ein – das ist kein Defizit, sondern System.',
    ],
    tips: ['Tipp: Aktives Zuhören bedeutet: nicht ans Antworten denken, sondern eine Frage stellen, die zeigt, dass du zugehört hast.'],
    pitfalls: ['⚠• Wer zu sehr darauf achtet, "interessant" zu wirken, wirkt oft weniger attraktiv als jemand, der aufrichtig interessiert ist.'],
    example: ['**Beispiel-Smalltalk:**\nDu: "Woher kennst du die Gastgeber?"\nEr/Sie: "Über den Sportverein."\nDu: "Cool, ich laufe gern – welcher Sport?" (eigene Anekdote + Frage)\nDas Wechselspiel macht die Konversation lebendig.'],
    beginner: ['Erste Schritte: 1. Lächle 3 Menschen heute bewusst zu. 2. Stelle eine Person eine echte Frage. 3. Treffe dich 1× pro Woche mit jemandem.'],
    followup: ['Arbeitest du an mehr Kontakten oder an besseren Gesprächen?'],
  },
  digital_balance: {
    intro: ['Dein Handy ist ein Werkzeug, kein Boss – das Gleichgewicht ist trainierbar. 📵'],
    steps: [
      '**1. Zeitbudget setzen:** Nicht "weniger scrollen", sondern konkret "max. 45 Min. Social Media/Tag".',
      '**2. Trigger wegräumen:** Benachrichtigungen aus, Apps vom Homescreen, Handy beim Arbeiten im anderen Raum.',
      '**3. Dopamin-Diät:** Ersetze eine halbe Stunde Scrollen bewusst durch echte Aktivität (Spaziergang, Sport, Lesen).',
      '**4. Digitale Sonnenuntergänge:** 60 Min. ohne Bildschirm vor dem Schlafen verbessern deinen Schlaf messbar.',
      '**5. Zweck fragen:** "Warum öffne ich diese App gerade?" – Langeweile, Emotion, Gewohnheit? Bewusstsein allein reduziert schon viel.',
    ],
    tips: ['Tipp: Probiere die Focus-Mode-Funktion in LOCKIN.AI – sie hilft dir, bewusst offline zu arbeiten und belohnt dich dafür!'],
    pitfalls: ['⚠• "Ich brauche mein Handy für die Arbeit" – ja, aber nicht für Instagram. Trenne Berufs- von Freizeit-Apps.'],
    example: ['**Konkreter Plan:**\n1. Bildschirmzeit-App aktivieren (kostenlos in iOS/Android)\n2. Social-Media-Limit: 30 Min/Tag\n3. Handy ab 21 Uhr im anderen Raum\n4. Ersatz: 20 Min. Lesen vor dem Schlafen'],
    beginner: ['Erste Schritte: 1. Deaktiviere alle Push-Benachrichtigungen außer Anrufen. 2. Lösche 1 Social-Media-App vom Homescreen. 3. Stelle das Handy abends in einen anderen Raum.'],
    followup: ['Geht es dir um Social-Media-Sucht, besseren Schlaf oder generell weniger Bildschirmzeit?'],
  },
  stress: {
    intro: ['Erstmal durchatmen. 🌬️ Du bist nicht allein – Überforderung ist ein Signal, nicht ein Versagen.'],
    steps: [
      '**1. Runterbrechen:** Schreibe alles auf, dann pick dir EINE Mini-Aufgabe für die nächsten 10 Minuten.',
      '**2. Box-Breathing:** 4 Sek. einatmen – 4 halten – 4 ausatmen – 4 halten. 3 Runden.',
      '**3. Bewegung:** 10 Minuten Spazieren senkt Cortisol messbar.',
      '**4. Reden hilft:** Mit Freunden, Familie – oder hier mit mir. Wenn es anhaltend belastet, suche dir professionelle Unterstützung.',
    ],
    tips: ['Tipp: Die 4-4-4-4 Atemtechnik (Box Breathing) aktiviert den Vagusnerv und senkt Stress in unter 2 Minuten – probier sie jetzt.'],
    pitfalls: ['⚠• "Ich muss einfach funktionieren" – chronischer Stress ohne Pausen führt zu Burnout. Pausen sind keine Schwäche, sondern Wartung.'],
    example: ['**Box Breathing konkret:**\n1. 4 Sekunden einatmen durch die Nase\n2. 4 Sekunden halten\n3. 4 Sekunden ausatmen durch den Mund\n4. 4 Sekunden halten\n→ 3 Runden = 48 Sekunden. Danach fühlst du dich messbar ruhiger.'],
    beginner: ['Erste Schritte: 1. Atme jetzt 3 Runden Box-Breathing (siehe oben). 2. Schreibe alles auf, was dich belastet. 3. Pick EINE Sache für die nächsten 10 Min.'],
    followup: ['Was belastet dich gerade am meisten?'],
  },
  water: {
    intro: ['Wasser ist der billigste Performance-Booster. 💧'],
    steps: [
      '**• Ziel:** ~30–40 ml pro kg Körpergewicht (bei 70 kg also ~2,1–2,8 Liter).',
      '**• Trick:** 1 Glas direkt nach dem Aufstehen, 1 Glas vor jeder Mahlzeit.',
      '**• Signal:** Dunkler Urin = trink mehr. Hell = perfekt.',
      '**• Hunger-Check:** Oft verwechselt das Gehirn Durst mit Hunger – erst Glas, dann entscheiden.',
    ],
    tips: ['Tipp: Stell dir eine 1-Liter-Flasche auf den Schreibtisch. Wenn sie leer ist, hast du dein Minimum geschafft.'],
    pitfalls: ['⚠• "Ich trinke nur Kaffee" – Kaffee zählt zur Hälfte, aber 3 Espresso ersetzen nicht 2 Liter Wasser.'],
    beginner: ['Erste Schritte: 1. Trink heute 1 Glas Wasser nach dem Aufstehen. 2. Stell eine Flasche sichtbar auf. 3. Tracke 3 Tage lang deine Trinkmenge.'],
    followup: ['Möchtest du eine Trinkroutine aufbauen oder weißt du nicht, wie viel du trinken sollst?'],
  },
  coffee: {
    intro: ['Koffein ist ein Werkzeug – benutzt es klug. ☕'],
    steps: [
      '**• Timing:** 60–90 Min. nach dem Aufstehen (der Cortisol-Peak sollte erst abklingen).',
      '**• Cutoff:** Nichts mehr nach 14 Uhr, sonst leidet dein Schlaf (Halbwertszeit ~6 h).',
      '**• Dosis:** 200–400 mg/Tag sind die übliche Wohlfühlzone (≈2–4 Tassen Filterkaffee).',
      '**• Kombi:** Koffein + 10 Min. Bewegung wirkt stärker als Koffein allein.',
    ],
    tips: ['Tipp: Wenn du müde wirst, trink zuerst Wasser – oft ist Dehydration, nicht Koffeinmangel.'],
    pitfalls: ['⚠• Koffein ab 16 Uhr: Auch wenn du einschläfst, verlierst du bis zu 20% Tiefschlaf – der Rhythmus leidet.'],
    beginner: ['Erste Schritte: 1. Verschiebe deinen ersten Kaffee um 60 Min. 2. Letzter Kaffee vor 14 Uhr. 3. Trink pro Tasse Kaffee ein Glas Wasser.'],
    followup: ['Geht es dir um mehr Energie, besseren Schlaf oder Koffein-Timing?'],
  },
  shop_gems: {
    intro: ['Dein Belohnungssystem läuft überall in LOCKIN.AI. 💎'],
    steps: [
      '**• Juwelen:** Aufgaben, Tagesziele, Werbung, Workouts & Food-Logs bringen Juwelen.',
      '**• XP:** Jede Aktion gibt XP → Level → neue Erfolge.',
      '**• Shop:** Gibt Juwelen für Themes, Rahmen, Abzeichen und kosmetische Items.',
      '**• Tagesbonus:** Pflegst du heute ALLE 6 Gewohnheiten, gibt es +60 💎 und +120 ⚡ obendrauf!',
    ],
    tips: ['Tipp: Die schnellsten Juwelen kommen von Tageszielen – Wasser trinken, Skincare, Schlaf abhaken kostet 2 Minuten und bringt +30 💎.'],
    pitfalls: ['⚠• Shop-Items sind rein kosmetisch – sie geben keinen Vorteil gegenüber echter Arbeit. Du musst Juwelen durch echte Aufgaben verdienen.'],
    beginner: ['Erste Schritte: 1. Hake heute 3 Tagesziele ab. 2. Mach einen Face Scan (+10 💎). 3. Schau im Shop nach, was dir gefällt.'],
    followup: ['Möchtest du wissen, wie du schnell Juwelen verdienst, oder was es im Shop gibt?'],
  },
  selfimprovement: {
    intro: ['Selbstverbesserung ist kein Sprint, sondern eine Systemfrage. 🌱'],
    steps: [
      '**1. Identität statt Ziel:** Statt "Ich will abnehmen" → "Ich bin jemand, der sich bewegt."',
      '**2. Systeme > Ziele:** Tägliche Routinen schlagen einmalige Anstrengungen.',
      '**3. 1% besser pro Tag:** Das klingt klein, verdoppelt deine Leistung aber in ~70 Tagen.',
      '**4. Reflektieren:** Wöchentlich 10 Minuten: Was lief gut? Was nicht? Warum?',
    ],
    tips: ['Tipp: LOCKIN.AI ist genau dafür gebaut: Face Scan, Kalorien, Workouts, Lernen – alles in einem Streak-System. Starte mit einem Bereich, nicht mit allen!'],
    pitfalls: ['⚠• Alles auf einmal ändern: Wer 5 Gewohnheiten gleichzeitig startet, hält keine einzige durch. Starte mit EINER.'],
    beginner: ['Erste Schritte: 1. Wähle EINEN Bereich (z.B. Fitness oder Lernen). 2. Lege eine tägliche Mini-Aufgabe fest. 3. Mach sie 7 Tage lang.'],
    example: ['**Beispiel-System:**\nIdentität: "Ich bin jemand, der sich jeden Tag bewegt."\nSystem: 5 Min. Stretching jeden Morgen\nZiel: In 3 Monaten flexibler sein\nDas System treibt das Ziel – nicht umgekehrt.'],
    followup: ['Wo möchtest du anfangen – Fitness, Lernen, Ernährung oder eine andere Gewohnheit?'],
  },
};

// ─── Reply-Builder ────────────────────────────────────────
function buildReply(topicKey, questionType, ctx) {
  const blocks = KB[topicKey];
  if (!blocks) {
    return 'Gute Frage! 🤔 Frag mich zu Motivation, Ernährung, Training, Schlaf, Fokus, Lernen, Prokrastination, Hautpflege, Style, Gesichtsformen, Geld, Karriere oder sozialen Fähigkeiten.';
  }

  let reply = '';

  // Intro (nur wenn nicht in Folgefrage oder wenn Kontext gewechselt)
  const showIntro = questionType !== 'followup' || ctx.topic !== topicKey;
  if (showIntro) reply += rand(blocks.intro) + '\n\n';

  // Question-type-spezifischer Inhalt
  if (questionType === 'howto' || questionType === 'default') {
    for (const s of blocks.steps) reply += s + '\n';
    reply += '\n';
  } else if (questionType === 'why') {
    if (blocks.pitfalls) reply += blocks.pitfalls + '\n\n';
    for (const s of blocks.steps.slice(0, 2)) reply += s + '\n';
    reply += '\n' + rand(blocks.tips || ['']) + '\n';
  } else if (questionType === 'example') {
    if (blocks.example) {
      reply += blocks.example + '\n\n';
    } else {
      for (const s of blocks.steps.slice(0, 2)) reply += s + '\n';
    }
  } else if (questionType === 'beginner') {
    if (blocks.beginner) reply += blocks.beginner + '\n\n';
    for (const s of blocks.steps.slice(0, 2)) reply += s + '\n';
  } else if (questionType === 'when') {
    if (blocks.when) {
      reply += blocks.when + '\n\n';
    } else if (blocks.steps[0]) {
      reply += blocks.steps[0] + '\n';
    }
  } else if (questionType === 'followup') {
    if (blocks.tips) reply += rand(blocks.tips) + '\n\n';
    for (const s of blocks.steps.slice(0, 2)) reply += s + '\n';
  }

  // Followup-Frage
  reply += '\n' + (blocks.followup ? rand(blocks.followup) : 'Was möchtest du noch wissen?');

  return reply;
}

// ─── Export: generateReply mit Kontext ────────────────────
export function generateReply(message, userId = 0) {
  const text = String(message || '').trim();
  if (!text) {
    return { reply: 'Hey! 👋 Frag mich etwas – ich bin hier, um dir zu helfen.', suggestions: ['Wie bleibe ich motiviert?', 'Tipps für besseren Schlaf', 'Wie starte ich mit Sport?'] };
  }

  const ctx = getContext(userId);

  // Begrüßung
  if (/^(hi|hey|hallo|moin|servus|guten\s+(tag|morgen|abend))\b/i.test(text) && text.length < 25) {
    setContext(userId, { ...ctx, topic: 'greeting', lastQuestionType: null });
    return {
      reply: 'Hey! 👋 Ich bin dein LOCKIN.AI-Coach. Frag mich alles rund um **Selbstverbesserung**: Motivation, Ernährung, Training, Schlaf, Fokus, Lernen & Prüfungen, Prokrastination, Hautpflege, Style, **Gesichtsformen & Frisuren**, Geld, Karriere, soziale Fähigkeiten und digitale Balance. Was beschäftigt dich heute?',
      suggestions: ['Wie überwinde ich Prokrastination?', 'Lernmethoden für Prüfungen', 'Tipps für besseren Schlaf', 'Welche Gesichtsform habe ich?'],
    };
  }

  // Dank
  if (/(danke|thx|dankeschön|vielen dank|dank dir|cool danke|nice danke)/i.test(text) && text.length < 30) {
    return {
      reply: 'Sehr gerne! 😊 Bleib dran – Konstanz schlägt Intensität. Hast du noch eine Frage?',
      suggestions: ['Wie halte ich einen Streak?', 'Ernährungstipps', 'Fokus steigern'],
    };
  }

  // Topic klassifizieren
  let topicKey = classifyTopic(text);

  // Follow-up-Erkennung: „und wie?", „erklär näher", „und dann?"
  if (!topicKey && ctx.topic && /^(und|was|wie|erklär|näher|genauer|konkret|mehr|genau so|und dann|und wie)/i.test(text)) {
    topicKey = ctx.topic;
  }

  // Wenn immer noch kein Topic: Fallback
  if (!topicKey) {
    return {
      reply: 'Gute Frage! 🤔 Ich kann dir helfen mit: **Motivation & Disziplin, Ernährung, Training, Schlaf, Fokus, Lernen & Prüfungen, Prokrastination, Hautpflege, Grooming/Style, Gesichtsformen & Frisuren, Face Score, Streaks & Belohnungen, Geld & Sparen, Karriere, soziale Fähigkeiten, digitale Balance, Stressbewältigung, Wasser & Koffein**.\n\nVersuche z. B.: „Wie lerne ich für Prüfungen?", „Welche Frisur passt zu meiner Gesichtsform?", „Wie starte ich mit Sparen?" oder „Wie überwinde ich Prokrastination?"',
      suggestions: ['Lernmethoden für Prüfungen', 'Prokrastination stoppen', 'Welche Gesichtsform habe ich?', 'Geld sparen anfangen'],
    };
  }

  // Frage-Typ erkennen
  let questionType = detectQuestionType(text, topicKey);

  // Followup: wenn Text "und wie genau?" o.ä. ist, vertiefe das letzte Topic
  if (questionType === 'followup' && ctx.topic === topicKey) {
    questionType = ctx.lastQuestionType || 'default';
  }

  const reply = buildReply(topicKey, questionType, ctx);

  // Kontext aktualisieren
  setContext(userId, { topic: topicKey, lastQuestionType: questionType, turn: ctx.turn, history: ctx.history });

  // Topic-spezifische Suggestions
  const topicSuggestions = SUGGESTIONS[topicKey] || ['Erzähl mir mehr', 'Und wie genau?', 'Anderes Thema'];

  return { reply, suggestions: topicSuggestions };
}

// ─── Topic-spezifische Vorschläge ─────────────────────────
const SUGGESTIONS = {
  motivation: ['Mehr Disziplin beim Lernen', 'Sport-Motivation', 'Schlechte Angewohnheit stoppen'],
  nutrition: ['Abnehmen – wo starte ich?', 'Mehr Protein essen', 'Heißhunger vermeiden'],
  training: ['Workout für Anfänger', 'Plan für Zuhause', 'Muskelaufbau-Tipps'],
  sleep: ['Einschlaf-Routine aufbauen', 'Morgens fitter aufwachen', 'Mittagsschlaf ok?'],
  focus: ['Handy-Sucht reduzieren', 'Konzentration verbessern', 'Tiefenarbeit lernen'],
  learning: ['Prüfungsvorbereitung', 'Lernplan erstellen', 'Vokabeln schneller lernen', 'Prokrastination stoppen'],
  procrastination: ['Prüfungsstress bewältigen', 'Lernplan erstellen', 'Fokus steigern'],
  streak: ['Gewohnheit aufbauen', 'Streak retten', 'Belohnungssystem'],
  skincare: ['Skincare-Routine für Anfänger', 'Gegen Pickel', 'Sonnencreme wirklich wichtig?'],
  grooming: ['Bartpflege Basics', 'Kleiderschrank upgraden', 'Frisur finden'],
  faceshape: ['Welche Gesichtsform habe ich?', 'Frisur für ovales Gesicht', 'Frisur für rundes Gesicht'],
  facescore: ['Was bedeutet mein Face-Score?', 'Wie steigere ich meinen Score?', 'Was bringt der Face Scan?'],
  money: ['Budget erstellen', 'Sparen automatisieren', 'Schulden abbauen'],
  career: ['Gehaltsverhandlung vorbereiten', 'Bewerbung verbessern', 'Beförderung erreichen'],
  social: ['Smalltalk verbessern', 'Neue Leute kennenlernen', 'Einsamkeit überwinden'],
  digital_balance: ['Handysucht reduzieren', 'Screentime reduzieren', 'Besser schlafen ohne Handy'],
  stress: ['Prüfungsstress bewältigen', 'Me-Time einplanen', 'Motivation nach Tiefpunkt'],
  water: ['Mehr trinken lernen', 'Trinkroutine aufbauen', 'Kaffee vs. Wasser'],
  coffee: ['Koffein-Timing optimieren', 'Müde ohne Kaffee', 'Schlaf verbessern'],
  shop_gems: ['Wie verdiene ich schnell Juwelen?', 'Was gibt es im Shop?', 'Tagesziele erklären'],
  selfimprovement: ['Wo soll ich anfangen?', 'Gewohnheiten aufbauen', 'Ziele richtig setzen'],
};
