// Спільні константи/хелпери для raid-manager.js і raid-manager-detail.js.
// Підключати тегом <script> ДО них (без бандлера, як і інші клієнтські скрипти).

const API_BASE = 'https://raid-manager-api.wow-nostalgia.workers.dev/api/v1';

const INSTANCE_LABELS = { ICC: 'Льодяна Цитадель', RS: 'Рубінове Святилище' };
const DIFFICULTY_LABELS = { '10N': '10 Звичайний', '10H': '10 Героїчний', '25N': '25 Звичайний', '25H': '25 Героїчний' };

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

const ITEM_RARITY_CLASS_BY_QUALITY = {
  0: 'raid-rarity--common',
  1: 'raid-rarity--common',
  2: 'raid-rarity--uncommon',
  3: 'raid-rarity--rare',
  4: 'raid-rarity--epic',
  5: 'raid-rarity--epic'
};

let itemIconData = {};

async function loadItemIconData() {
  try {
    const res = await fetch('/data/item-icons.json');
    itemIconData = await res.json();
  } catch (err) {
    console.error(err);
  }
}

function itemIconUrl(itemId, size = 'small') {
  const icon = itemIconData[itemId]?.icon || 'inv_misc_questionmark';
  return `https://wow.zamimg.com/images/wow/icons/${size}/${icon}.jpg`;
}

function itemRarityClass(itemId) {
  return ITEM_RARITY_CLASS_BY_QUALITY[itemIconData[itemId]?.quality] || 'raid-rarity--rare';
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

