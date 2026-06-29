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
