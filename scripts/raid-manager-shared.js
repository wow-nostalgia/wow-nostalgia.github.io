// Спільні константи/хелпери для raid-manager.js і raid-manager-detail.js.
// Підключати тегом <script> ДО них (без бандлера, як і інші клієнтські скрипти).

// ЗАМІНИТИ на реальний URL після деплою Worker'а (wrangler deploy виведе його).
const API_BASE = 'https://raid-manager-api.YOUR_SUBDOMAIN.workers.dev/api/v1';

const INSTANCE_LABELS = { ICC: 'Льодяна Цитадель', RS: 'Рубіновий Святилище' };
const DIFFICULTY_LABELS = { '10N': '10 ХМ', '10H': '10 ГМ', '25N': '25 ХМ', '25H': '25 ГМ' };

const ICC_BOSSES = [
  'Lord Marrowgar', 'Lady Deathwhisper', 'Gunship Battle', 'Deathbringer Saurfang',
  'Festergut', 'Rotface', 'Professor Putricide', 'Blood Prince Council',
  "Blood-Queen Lana'thel", 'Valithria Dreamwalker', 'Sindragosa', 'The Lich King'
];
const RS_BOSSES = ['Halion'];

function bossesForInstance(instance) {
  return instance === 'RS' ? RS_BOSSES : ICC_BOSSES;
}

function formatWeight(weight) {
  return `${weight}x`;
}

function formatDateTimeKyiv(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(date);
}

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function apiCall(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let data = null;
  try { data = await res.json(); } catch { /* без тіла */ }

  if (!res.ok) {
    const message = data?.error || `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return data;
}

function officerTokenKey(raidId) {
  return `officerToken:${raidId}`;
}

function claimTokenKey(raidId, playerName) {
  return `claimToken:${raidId}:${playerName}`;
}

function getOfficerToken(raidId) {
  return localStorage.getItem(officerTokenKey(raidId));
}

function setOfficerToken(raidId, token) {
  localStorage.setItem(officerTokenKey(raidId), token);
}

function clearOfficerToken(raidId) {
  localStorage.removeItem(officerTokenKey(raidId));
}

function getClaimToken(raidId, playerName) {
  return localStorage.getItem(claimTokenKey(raidId, playerName));
}

function setClaimToken(raidId, playerName, token) {
  localStorage.setItem(claimTokenKey(raidId, playerName), token);
}
