// Спільні константи/хелпери для raid-manager-archive.js і raid-manager-detail.js.
// Підключати тегом <script> ДО них (без бандлера, як і інші клієнтські скрипти).
//
// Усі <script src="...?v=N"> на raid-manager/account сторінках мають той
// самий ?v=N — при правці будь-якого з цих файлів бампай N в HTML усіх
// сторінок, що його підключають, інакше браузер може закешувати стару
// версію JS поряд зі свіжим HTML (саме так зламалась сторінка рейду раніше).

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
  return `х${weight}`;
}

// "1 софт", "2 софти", "0 софтів" - без цього в текстах вилазить
// "доступно 2 софт". Ліміти тут маленькі (0-3), тож повні правила
// відмінювання для 11-14 не потрібні.
function softsWord(count) {
  if (count === 1) return 'софт';
  if (count >= 2 && count <= 4) return 'софти';
  return 'софтів';
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
    const res = await fetch('/data/item-icons.json?t=' + Date.now());
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

function itemTooltipHtml(itemId) {
  const html = itemIconData[itemId]?.tooltip || `<b>#${itemId}</b>`;
  return html.replace(/<div class="whtt-sellprice">[\s\S]*?<\/div>/, '');
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


// ---- Шаблони штрафів — спільне для Штрафбату й сторінки рейду ----

// "−10 до ролу", "−1 до софту" (обидва — через кому; нуль не пишемо).
function formatPenaltyValue(rollPenalty, softPenalty) {
  const parts = [];
  if (rollPenalty > 0) parts.push(`−${rollPenalty} до ролу`);
  if (softPenalty > 0) parts.push(`−${softPenalty} до софту`);
  return parts.join(', ') || '—';
}

function formatTemplateValue(template) {
  return template.penalty_type === 'roll'
    ? formatPenaltyValue(template.value, 0)
    : formatPenaltyValue(0, template.value);
}

// Бос шаблону для показу: загальний шаблон — "Загальний".
function penaltyBossLabel(boss) {
  return boss ? translateBoss(boss) : 'Загальний';
}

// Загальні першими, далі боси в порядку проходження (ЦЛК, потім РС), у
// межах боса — за причиною.
function sortPenaltyTemplates(templates) {
  const order = [...ICC_BOSSES, ...RS_BOSSES];
  const rank = (boss) => (boss ? order.indexOf(boss) + 1 : 0);
  return [...templates].sort((a, b) => rank(a.boss) - rank(b.boss) || a.reason.localeCompare(b.reason, 'uk'));
}

// Дропдаун вибору шаблону з групами за босами. instance — лише загальні й
// боси цього інстансу (сторінка рейду); null — усі шаблони (Штрафбат).
// Повертає кількість доступних шаблонів.
function fillPenaltyTemplateSelect(selectEl, templates, instance = null) {
  selectEl.innerHTML = '';
  const bosses = instance ? bossesForInstance(instance) : null;
  const available = sortPenaltyTemplates(templates).filter((t) => !t.boss || !bosses || bosses.includes(t.boss));

  const groups = new Map();
  available.forEach((t) => {
    const label = penaltyBossLabel(t.boss);
    if (!groups.has(label)) {
      const group = document.createElement('optgroup');
      group.label = label;
      groups.set(label, group);
      selectEl.appendChild(group);
    }
    const opt = document.createElement('option');
    opt.value = String(t.id);
    opt.textContent = `${t.reason} (${formatTemplateValue(t)})`;
    groups.get(label).appendChild(opt);
  });
  return available.length;
}
