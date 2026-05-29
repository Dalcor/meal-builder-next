import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';

// Розпізнавання етикетки продукту через Google Gemini (vision).
// Клієнт надсилає фото як data URI (base64), сервер просить модель повернути
// КБЖУ на 100г у вигляді JSON і віддає його назад у форму.
//
// DeepSeek API не підтримує зображення (chat-endpoint приймає лише текст),
// тому для розпізнавання фото використовується Gemini. Потрібен GEMINI_API_KEY.

// gemini-2.5-flash — швидка GA-модель з vision. Перевизначається через env.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Ти — асистент, що зчитує харчову цінність продукту з фотографії етикетки (або сам оцінює продукт, якщо це фото їжі).
Поверни СТРОГО JSON-обʼєкт без пояснень такого вигляду:
{"name": string, "calories": number, "protein": number, "fat": number, "carbs": number, "confidence": "high"|"medium"|"low"}
Правила:
- Усі значення calories/protein/fat/carbs — НА 100 грамів продукту. Якщо на етикетці вказано на порцію — перерахуй на 100г.
- calories у кілокалоріях (ккал). Якщо вказано лише кДж — поділи на 4.184.
- name — коротка назва продукту українською (1-4 слова). Якщо невідомо — порожній рядок.
- Числа — десяткові дроби з крапкою, без одиниць виміру. Якщо значення не видно — постав 0.
- confidence: наскільки впевнено зчитано дані.
- Жодного тексту поза JSON.`;

interface Analysis {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  confidence?: string;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
}

// Розбирає data URI на mime-тип і чистий base64 (без префікса).
function parseDataUri(uri: string): { mime: string; data: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(uri);
  if (!m) return null;
  return { mime: m[1], data: m[2] };
}

export async function POST(req: Request) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY не налаштовано на сервері' },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const image = (body as { image?: unknown })?.image;
  if (typeof image !== 'string') {
    return NextResponse.json(
      { error: 'Очікується поле image з data URI зображення' },
      { status: 400 },
    );
  }

  // Запобіжник проти надто великих зображень (~7MB base64).
  if (image.length > 7_000_000) {
    return NextResponse.json({ error: 'Зображення завелике' }, { status: 413 });
  }

  const parsed = parseDataUri(image);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Невірний формат зображення (очікується data:image/...;base64,...)' },
      { status: 400 },
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let gRes: Response;
  try {
    gRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Зчитай харчову цінність із цього фото і поверни JSON на 100г.' },
              { inline_data: { mime_type: parsed.mime, data: parsed.data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          maxOutputTokens: 800,
          // Вимикаємо «роздуми» 2.5-flash: інакше вони зʼїдають бюджет токенів
          // і JSON обрізається на MAX_TOKENS. Для простого OCR вони не потрібні.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } catch (e) {
    clearTimeout(timeout);
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json(
      { error: aborted ? 'Перевищено час очікування Gemini' : 'Не вдалося звʼязатися з Gemini' },
      { status: 504 },
    );
  }
  clearTimeout(timeout);

  if (!gRes.ok) {
    const text = await gRes.text().catch(() => '');
    console.error('Gemini error', gRes.status, text.slice(0, 500));
    return NextResponse.json(
      { error: `Gemini повернув помилку (${gRes.status})`, detail: text.slice(0, 300) },
      { status: 502 },
    );
  }

  const data = await gRes.json().catch(() => null);
  const content: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof content !== 'string') {
    // Можливі причини: спрацював safety-фільтр або порожня відповідь.
    const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
    return NextResponse.json(
      { error: `Порожня відповідь Gemini${reason ? ` (${reason})` : ''}` },
      { status: 502 },
    );
  }

  let result: Record<string, unknown>;
  try {
    // На випадок якщо модель обгорнула JSON у markdown-блок.
    const clean = content.replace(/```json|```/g, '').trim();
    result = JSON.parse(clean);
  } catch {
    return NextResponse.json(
      { error: 'Не вдалося розпізнати відповідь Gemini', raw: content.slice(0, 300) },
      { status: 502 },
    );
  }

  const out: Analysis = {
    name: typeof result.name === 'string' ? result.name.trim() : '',
    calories: num(result.calories),
    protein: num(result.protein),
    fat: num(result.fat),
    carbs: num(result.carbs),
    confidence: typeof result.confidence === 'string' ? result.confidence : undefined,
  };

  return NextResponse.json(out);
}
