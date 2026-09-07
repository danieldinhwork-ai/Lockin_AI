// LOCKIN.AI – Lokales KI-Modul (läuft offline, keine API-Keys nötig)
// Extraktive Zusammenfassung + automatische Lernkarten & Quizfragen.
// Hinweis: Dies ist ein deterministischer Text-Analyse-Algorithmus („lokale KI“).

const STOPWORDS = new Set(`
  der die das den dem des ein eine einen einem einer und oder aber als wenn weil dass da dort hier
  ist sind war waren wird wurden wurde habe hast hat haben hatten sein ihre ihrem ihren seiner seinem
  seine seiner sein mit von zu auf für an in über unter nach vor zwischen aus bei durch gegen ohne um
  nicht nur auch noch schon immer wieder sehr viel viele wenig wenige mehr weniger als wie als ob man
  mich dich sich uns euch ihm ihr sie es er du wir ihr so also dann dann mal bitte jetzt heute gestern
  morgen können konnte konnten muss musste müssen soll solltest sollte sollen will willst wollen wollte
  würde würden wäre wären habe hätte hätten the a an and or but if then this that these those is are
  was were be been being have has had do does did will would can could shall should may might must
  of to in on at for with by from up about into over after before between out off under again further
  my your his her its our their me him them us it you i we they not no nor so than too very can't don't
`.split(/\s+/).filter(Boolean));

const PUNCT = /[.,;:!?„“"()\[\]{}<>/\\|–—…•·*_+=@#$%^&~`'"’]/g;

function cleanToken(w) {
  return w.toLowerCase().replace(PUNCT, '').trim();
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function tokenize(text) {
  return text.split(/\s+/).map(cleanToken).filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function wordFrequencies(text) {
  const freq = new Map();
  for (const t of tokenize(text)) freq.set(t, (freq.get(t) || 0) + 1);
  return freq;
}

function scoreSentence(sentence, freq) {
  const tokens = tokenize(sentence);
  if (tokens.length === 0) return 0;
  let score = 0;
  for (const t of tokens) score += freq.get(t) || 0;
  // Leicht kürzere Sätze bevorzugen, aber nicht zu kurz
  const lenFactor = tokens.length >= 6 && tokens.length <= 28 ? 1.15 : 0.85;
  return (score / Math.sqrt(tokens.length)) * lenFactor;
}

export function summarize(text, maxSentences = 5) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return { summary: '', keyPoints: [] };
  const freq = wordFrequencies(text);
  const ranked = sentences
    .map((s, i) => ({ s, i, score: scoreSentence(s, freq) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.i - b.i)
    .map((r) => r.s);

  // Wichtigste Begriffe als Stichpunkte
  const topTerms = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  const keyPoints = topTerms
    .map((term) => {
      const match = sentences.find((s) => new RegExp(`\\b${escapeRegex(term)}\\w*`, 'i').test(s));
      return match ? `🔑 ${match.replace(new RegExp(`\\b${escapeRegex(term)}\\w*`, 'i'), (m) => `**${m}**`)}` : null;
    })
    .filter(Boolean)
    .slice(0, 6);

  return { summary: ranked.join(' '), keyPoints };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keyTermFor(sentence, freq) {
  const tokens = tokenize(sentence);
  if (tokens.length === 0) return null;
  const scored = tokens
    .map((t) => ({ t, score: freq.get(t) || 0 }))
    .sort((a, b) => b.score - a.score);
  // Bevorzugt Begriffe mit mittlerer Länge (Substantive)
  const good = scored.find((x) => x.t.length >= 5) || scored[0];
  return good.t;
}

export function generateFlashcards(text, count = 8) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];
  const freq = wordFrequencies(text);
  const ranked = sentences
    .map((s, i) => ({ s, i, score: scoreSentence(s, freq) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(count, 10));

  const cards = [];
  for (const { s } of ranked) {
    if (cards.length >= count) break;
    const term = keyTermFor(s, freq);
    if (!term) continue;
    const cloze = s.replace(new RegExp(`\\b${escapeRegex(term)}\\w*`, 'i'), '______');
    if (cards.length % 3 === 0) {
      cards.push({ q: `Erkläre den Begriff „${term}“ in eigenen Worten:`, a: s });
    } else {
      cards.push({ q: `Vervollständige: ${cloze}`, a: term });
    }
  }
  // Sicherstellen, dass mindestens ein paar Karten existieren
  if (cards.length === 0) cards.push({ q: 'Was ist das Thema dieses Texts?', a: sentences[0] });
  return cards.slice(0, count);
}

export function generateQuiz(text, count = 6) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];
  const freq = wordFrequencies(text);
  const ranked = sentences
    .map((s, i) => ({ s, i, score: scoreSentence(s, freq) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count * 2);

  const allTerms = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t]) => t);
  const questions = [];
  const used = new Set();

  for (const { s } of ranked) {
    if (questions.length >= count) break;
    const term = keyTermFor(s, freq);
    if (!term || used.has(term)) continue;
    used.add(term);
    const cloze = s.replace(new RegExp(`\\b${escapeRegex(term)}\\w*`, 'i'), '______');
    const distractors = shuffle(allTerms.filter((t) => t !== term && !used.has(t))).slice(0, 3);
    if (distractors.length < 2) continue;
    const options = shuffle([term, ...distractors]);
    const isFirst = questions.length % 2 === 0;
    questions.push({
      q: isFirst ? `Worum geht es in diesem Abschnitt? ${cloze}` : `Welcher Begriff passt in die Lücke: „${cloze}“?`,
      options,
      answer: term,
    });
  }
  return questions.slice(0, count);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Face-Scan: rein illustrativer Score ----------
// Deterministischer Pseudo-Score aus Bild-Hash + User-ID.
// Ausdrücklich KEINE Gesichtserkennung – nur Unterhaltung.
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SCAN_CATEGORIES = ['grooming', 'skincare', 'hairstyle', 'style', 'fitness'];

// ---------- Gesichtsform-Erkennung (illustrativ) ----------
export const FACE_SHAPES = {
  oval: {
    label: 'Oval',
    icon: '🥚',
    description: 'Die oval Form gilt als die ausgewogenste – Stirn, Wangenknochen und Kinn laufen harmonisch zusammen. Fast jede Frisur passt zu dir!',
  },
  round: {
    label: 'Rund',
    icon: '🌕',
    description: 'Weiche Konturen mit ähnlicher Breite und Länge. Strukturierte Schnitte mit Volumen oben ajoutieren Definition und lassen das Gesicht länger wirken.',
  },
  square: {
    label: 'Quadratisch',
    icon: '🔲',
    description: 'Starke Kieferkante und markante Wangenknochen. Das gibt einen markanten Look – Texture und etwas Länge oben balancieren die Kantigkeit aus.',
  },
  heart: {
    label: 'Herz',
    icon: '💜',
    description: 'Breite Stirn, schmaleres Kinn. Frisuren mit Kinnlänge oder Curtain Bangs ergänzen das fehlende Volumen am unteren Gesicht.',
  },
  oblong: {
    label: 'Lang',
    icon: '📭',
    description: 'Länglicher als breit mit gerader Kieferlinie. Volumen an den Seiten und ein Pony缩短 das Gesicht optisch und runden es ab.',
  },
  diamond: {
    label: 'Diamant',
    icon: '💎',
    description: 'Schmal an Stirn und Kinn, breite Wangenknochen. Fransen und Volumen oben und unten gleichen die Wangenpartie harmonisch aus.',
  },
};

export const HAIRCUT_RECOMMENDATIONS = {
  oval: {
    best: [
      { name: 'Classic Short Back & Sides', detail: 'Eine favorisierte Länge oben gibt dir Flexibilität – oval ist die vielseitigste Form.' },
      { name: 'Mid-Length Textured', detail: 'Lockere Texture auf mittlerer Länge betont die natürliche Balance deiner Form.' },
      { name: 'Curtain Bangs', detail: 'Seitliche Frangen schmeicheln der ovalen Form, ohne sie zu überladen.' },
    ],
    avoid: 'Vermeide extreme Kurzhaar-Schnitte ohne Volumen oben – sie können das Gesicht flach wirken lassen.',
  },
  round: {
    best: [
      { name: 'Pompadour / Quiff', detail: 'Volumen oben streckt das Gesicht optisch und definiert die Wangenknochen.' },
      { name: 'High Fade + Textured Top', detail: 'Die Kontrast zwischen kurzen Seiten und Volumen oben créiert eine längere Silhouette.' },
      { name: 'Side Part Combover', detail: 'Ein tiefer Seitenscheitel asymmetrisiert das Gesicht ansprechend.' },
    ],
    avoid: 'Vermeide gerade Ponys und kinnlange Schnitte – sie lassen das Gesicht breiter wirken.',
  },
  square: {
    best: [
      { name: 'Textured Crop', detail: 'Kurze, strukturierte Spitzen oben weichen die markante Kieferkante auf.' },
      { name: 'Medium-Length Wavy', detail: 'Lockere Wellen auf mittlerer Länge ergänzen die kantige Struktur sanft.' },
      { name: 'Side-Swept Fringe', detail: 'Ein seitlicher Fransenschnitt balanciert die breite Stirn aus.' },
    ],
    avoid: 'Vermeide sehr kurze Buz-Cuts ohne Struktur – sie betonen die Härte der Kanten zu stark.',
  },
  heart: {
    best: [
      { name: 'Curtain Bangs', detail: 'Seitliche Fransen balancieren die breite Stirn und betonen die Augen.' },
      { name: 'Chin-Length Bob', detail: 'Eine kinnlange Länge fügt Volumen am schmaleren Kinn hinzu.' },
      { name: 'Layered Medium Cut', detail: 'Stufenschnitt auf mittlerer Länge rahmt das Gesicht sanft ein.' },
    ],
    avoid: 'Vermeide Volumen oben ohne Ausgleich am Kinn – das betont die Herzform zu stark.',
  },
  oblong: {
    best: [
      { name: 'Full Fringe / Bangs', detail: 'Ein gerader oder strukturierte Pony verkürzt das Gesicht optisch.' },
      { name: 'Layered Mid-Length', detail: 'Stufen und Volumen an den Seiten fügen optisch Breite hinzu.' },
      { name: 'Side-Swept Bangs', detail: 'Seitlicher Frangen bricht die Längsachse angenehm auf.' },
    ],
    avoid: 'Vermeide sehr lange, glatte Schnitte ohne Pony – sie strecken das Gesicht noch weiter.',
  },
  diamond: {
    best: [
      { name: 'Textured Fringe', detail: 'Fransen oben oben betonen die Schläfe und ergänzen die schmale Stirn.' },
      { name: 'Medium-Length Wavy', detail: 'Wellen auf mittlerer Länge gleichen die breiten Wangenknochen harmonisch aus.' },
      { name: 'Chin-Length Cut', detail: 'Eine kinnlange Länge fügt Breite am schmalen Kinn hinzu.' },
    ],
    avoid: 'Vermeide sehr kurze Seiten ohne Volumen oben – das betont die Wangenknochen zu stark.',
  },
};

export function detectFaceShape(imageData, userId) {
  const seed = fnv1a(String(imageData).slice(100, 3000) + '|shape|' + userId);
  const rand = mulberry32(seed);
  const shapes = Object.keys(FACE_SHAPES);
  const shape = shapes[Math.floor(rand() * shapes.length)];
  const confidence = Math.round(72 + rand() * 22); // 72–94 %
  return { shape, confidence };
}

export function computeIllustrativeScan(imageData, userId) {
  const seed = fnv1a(String(imageData).slice(0, 4000) + '|' + userId);
  const rand = mulberry32(seed);
  // Bereich 55–99 mit Dreiecksverteilung (Mitte wahrscheinlicher, Extreme möglich).
  // Bewusst keine niedrigen Werte: der Score ist Unterhaltung, nicht Abwertung.
  // Leichte Dämpfung oben (pow 1.25): „Griechischer Gott" (90+) bleibt etwas seltener.
  const r = (rand() + rand()) / 2;
  const score = Math.max(55, Math.min(99, Math.round(55 + Math.pow(r, 1.25) * 44)));
  // Potenzial: wie viel mit konsequenten Tipps möglich wäre (+5 bis +18, max. 99)
  const potential = Math.max(55, Math.min(99, score + Math.round(5 + rand() * 13)));
  // Subratings: eng am Gesamtscore bleiben (±7), damit ein 55er-Score nicht plötzlich
  // vier 92er-Kategorien hat. Etwas Varianz bleibt – Stärken/Schwächen sind realistisch.
  const breakdown = {};
  for (const c of SCAN_CATEGORIES) {
    breakdown[c] = Math.max(50, Math.min(99, Math.round(score + (rand() * 14 - 7))));
  }
  const tips = pickTips(breakdown, rand);
  const faceShape = detectFaceShape(imageData, userId);
  const haircuts = HAIRCUT_RECOMMENDATIONS[faceShape.shape];
  return { score, potential, breakdown, tips, faceShape, haircuts };
}

// Bild-Hash für die Einmal-Bewertung (gleiches Foto → gleiche Bewertung)
export function imageFingerprint(imageData) {
  return fnv1a(String(imageData).slice(0, 20000));
}

export const TIP_POOLS = {
  grooming: [
    'Eine konsistente Morgen- und Abendroutine ist der schnellste Weg zu einem gepflegten Look.',
    'Probiere einen strukturierten Haarschnitt – er braucht kaum Styling und wirkt sofort aufgeräumt.',
    'Augenbrauen leicht in Form bringen (nicht überzupfen) rahmt das Gesicht sofort besser ein.',
    'Lippenpeeling 1× pro Woche macht dein Lächeln zum Hingucker.',
    'Bart/Nachschatten regelmäßig pflegen – ein definierter Rand wirkt sofort professioneller.',
    'Zwei Farben: Dein Pflegelook wirkt am stärksten, wenn du Haut, Haare und Stil aufeinander abstimmst.',
  ],
  skincare: [
    'Sonnencreme ist dein bester Anti-Aging-Wirkstoff – täglich, auch im Winter.',
    'Reinigen, befeuchten, schützen: Drei Schritte reichen für eine solide Basis.',
    'Trink ausreichend Wasser – deine Haut dankt es dir sichtbar schneller als jedes Serum.',
    'Neue Produkte immer 2 Wochen testen, bevor du urteilst.',
    'Ein sanftes Peeling (1–2× pro Woche) lässt deine Haut strahlen.',
    'Schlaf ist das unterschätzte Skincare-Produkt: 7–9 Stunden machen den Unterschied.',
  ],
  hairstyle: [
    'Ein Schnitt, der zur Gesichtsform passt, wirkt sofort wie ein Upgrade.',
    'Trockenshampoo oder Textur-Spray für mehr Volumen am Ansatz.',
    'Hitzeschutz nicht vergessen, wenn du mit Styling-Tools arbeitest.',
    'Dein Stil gewinnt, wenn die Haare zur Kopf-/Gesichtsform passen – frag beim nächsten Schnitt danach.',
    'Ein Seitenscheitel oder Undercut kann deinen Look in 5 Minuten verändern.',
  ],
  style: [
    'Drei neutrale Basics + ein Statement-Teil = Outfit ohne Nachdenken.',
    'Gut sitzende Kleidung schlägt teure Kleidung – Passform ist König.',
    'Ein Paar saubere Schuhe macht 50 % des ersten Eindrucks aus.',
    'Farben: Maximal drei Farben pro Outfit wirkt immer ausgewogen.',
    'Investiere in Basics in deiner Farbe – sie kombinieren sich mit allem.',
    'Ein minimalistischer Look mit klaren Linien wirkt futuristisch und clean.',
  ],
  fitness: [
    '3× pro Woche Krafttraining schlägt 7× Joggen, wenn du Form aufbauen willst.',
    'Mobilität vor dem Training: 5 Minuten Aufwärmen verhindert Verletzungen.',
    'Proteine zu jeder Mahlzeit halten dich länger satt und unterstützen den Muskelaufbau.',
    'Schlaf ist Training: Erholung ist der eigentliche Wachstumsmoment.',
    'Konstanz schlägt Intensität – 20 Minuten täglich gewinnen auf Dauer.',
    'Spaziergänge (10k Schritte) sind das unterschätzte Fitness-Hack.',
  ],
};

export function pickTips(breakdown, rand) {
  const tips = [];
  for (const c of SCAN_CATEGORIES) {
    const pool = TIP_POOLS[c];
    const idx = Math.floor(rand() * pool.length);
    tips.push({ category: c, categoryScore: breakdown[c], tip: pool[idx] });
  }
  return tips;
}
