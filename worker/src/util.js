export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function generateRaidId(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

export function generateToken() {
  return crypto.randomUUID();
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Невалідний JSON у тілі запиту');
  }
}

// Для ендпоінтів, де тіло не обов'язкове (lock/unlock/delete) — порожнє/відсутнє
// тіло не повинно валити запит, лише officerName із нього опційний.
export async function readJsonSafe(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// Імена гравців завжди з великої літери, незалежно від того, як ввів сам
// гравець — впливає на однаковість відображення й на UNIQUE-збіги в БД.
// "1 софт", "2 софти", "0 софтів" - ліміти маленькі (0-3), тож повні
// правила відмінювання для 11-14 не потрібні. Дублює softsWord() у
// scripts/raid-manager-shared.js: спільного коду між воркером і фронтом
// у проєкті немає.
export function softsWord(count) {
  if (count === 1) return 'софт';
  if (count >= 2 && count <= 4) return 'софти';
  return 'софтів';
}

export function capitalizeName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Дата й час початку рейду. Клієнт шле ISO-рядок з часовою зоною (UTC);
// "минулий день" рахуємо за київським календарем, бо рейди плануються за
// Києвом: рейд на сьогодні можна створити навіть після його часу початку,
// на вчора - ні.
const KYIV_DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' });

export function kyivDateKey(date) {
  return KYIV_DATE_FMT.format(date); // YYYY-MM-DD
}

export function parseRaidStartsAt(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new HttpError(400, 'startsAt має бути датою й часом у форматі ISO');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Невалідна дата рейду');
  if (kyivDateKey(date) < kyivDateKey(new Date())) {
    throw new HttpError(400, 'Не можна призначити рейд на минулий день');
  }
  return date.toISOString();
}

// Софти (свої, офіцерські, передача, бонуси) відкриваються в час початку
// рейду. Старі рейди без starts_at - без обмежень.
export function requireRaidStarted(raid) {
  if (!raid.starts_at) return;
  const start = new Date(raid.starts_at);
  if (Date.now() >= start.getTime()) return;
  const when = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(start);
  throw new HttpError(423, `Софти відкриються ${when.replace(', ', ' о ')}`);
}
