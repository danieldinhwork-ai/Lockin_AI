// LOCKIN.AI – Echtzeit-KI-Coach
// Optionaler OpenAI-kompatibler Server-Adapter. Der API-Key bleibt ausschließlich
// auf dem Server; ohne Konfiguration fällt der Coach auf bot.js zurück.

const API_KEY = process.env.OPENAI_API_KEY || process.env.COACH_AI_API_KEY || '';
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2_000;

const SYSTEM_PROMPT = `Du bist der Coach von LOCKIN.AI, ein hilfreicher, freundlicher und ehrlicher KI-Assistent.
Beantworte grundsätzlich allgemeine Fragen zu Lernen, Arbeit, Karriere, Geld, Beziehungen, Kommunikation,
Alltag, Technologie, Kreativität, Fitness, Ernährung, Schlaf, Hautpflege, Style, Fokus und persönlicher Entwicklung.
Du darfst auch bei völlig anderen Themen helfen. Antworte in der Sprache der Nutzerfrage; wenn die Frage deutsch ist,
antworte auf Deutsch. Schreibe klar, konkret und nicht unnötig lang. Bei praktischen Fragen gib umsetzbare Schritte,
Beispiele und frage bei fehlendem Kontext kurz nach. Behaupte nichts als Tatsache, wenn du unsicher bist.

Sicherheitsregeln: Du bist kein Arzt, Therapeut, Anwalt oder Finanzberater. Gib bei medizinischen, psychischen,
rechtlichen oder finanziellen Themen nur allgemeine Informationen, nenne relevante Risiken und empfehle bei ernsten
oder dringenden Situationen eine qualifizierte Fachperson. Bei akuter Gefahr oder Selbstverletzungsäußerungen sollst
du empathisch reagieren und sofort lokale Notdienste bzw. Krisenhilfe empfehlen. Keine Diagnose, keine gefährlichen
Anleitungen, keine illegalen oder schädlichen Hilfestellungen. Face-/Life-Scores von LOCKIN.AI sind spielerische
Fortschrittswerte und niemals objektive, medizinische oder wissenschaftliche Bewertungen.`;

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({ role: item.role, content: item.content.slice(0, MAX_MESSAGE_CHARS) }));
}

export function isExternalCoachConfigured() {
  return Boolean(API_KEY);
}

export async function generateExternalCoachReply(message, history = []) {
  if (!API_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 700,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...cleanHistory(history),
          { role: 'user', content: String(message).slice(0, MAX_MESSAGE_CHARS) },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Coach provider HTTP ${response.status}: ${detail.slice(0, 300)}`);
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) throw new Error('Coach provider returned no text');
    return { reply: reply.trim(), mode: 'cloud', model: data.model || MODEL };
  } finally {
    clearTimeout(timer);
  }
}
