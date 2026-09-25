// Черга на посилення (Істерія, Придання Сил, ...) — побудована за зразком
// shard-queue.js: той самий Discord-auth, та сама жива черга, ті самі
// вкладки днів. Відмінності:
//   - черга окрема на кожну трійку "день + бос ЦЛК + тип посилення";
//   - прогрес — статуси "Очікує" → "Посилений" → "Виконано", міняють лише
//     офіцери гільдії (призначає адмін у профілі);
//   - типи посилень і список босів налаштовують офіцери.
// Сервер — worker/src/routes/buff-queue.js, схема — migrations/0019.

const WEEKDAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
const STATUS_LABELS = { waiting: 'Очікує', buffed: 'Посилений' };
const AUDIT_PAGE_SIZE = 20;
const DONE_PAGE_SIZE = 10;
// "Посилений" означає "прямо зараз у рейді" — гравець має побачити це без
// перезавантаження, тому сторінка сама підтягує зміни, поки відкрита.
const POLL_INTERVAL_MS = 15000;

// Primer Octicons (правило проєкту — жодних намальованих вручну іконок).
const ICON_GRABBER = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M10 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm0-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm-4 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm5-9a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>';
const ICON_UNDO ='<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M1.22 6.28a.749.749 0 0 1 0-1.06l3.5-3.5a.749.749 0 1 1 1.06 1.06L3.561 5h7.188l.001.007L10.749 5c.058 0 .116.007.171.019A4.501 4.501 0 0 1 10.5 14H8.796a.75.75 0 0 1 0-1.5H10.5a3 3 0 1 0 0-6H3.561L5.78 8.72a.749.749 0 1 1-1.06 1.06l-3.5-3.5Z"/></svg>';
const ICON_MOVE ='<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M5.22 14.78a.75.75 0 0 0 1.06-1.06L4.56 12h8.69a.75.75 0 0 0 0-1.5H4.56l1.72-1.72a.75.75 0 0 0-1.06-1.06l-3 3a.75.75 0 0 0 0 1.06l3 3Zm5.56-6.5a.75.75 0 1 1-1.06-1.06l1.72-1.72H2.75a.75.75 0 0 1 0-1.5h8.69L9.72 2.28a.75.75 0 0 1 1.06-1.06l3 3a.75.75 0 0 1 0 1.06l-3 3Z"/></svg>';

const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const dayTabs = document.getElementById('dayTabs');
const queueContent = document.getElementById('queueContent');
const queueStatus = document.getElementById('queueStatus');

const moveDayModal = document.getElementById('moveDayModal');
const moveDayModalBackdrop = document.getElementById('moveDayModalBackdrop');
const moveDayModalText = document.getElementById('moveDayModalText');
const moveDayModalSelect = document.getElementById('moveDayModalSelect');
const moveDayModalConfirmBtn = document.getElementById('moveDayModalConfirmBtn');
const moveDayModalCancelBtn = document.getElementById('moveDayModalCancelBtn');

const addOtherModal = document.getElementById('addOtherModal');
const addOtherModalBackdrop = document.getElementById('addOtherModalBackdrop');
const addOtherModalText = document.getElementById('addOtherModalText');
const addOtherModalForm = document.getElementById('addOtherModalForm');
const addOtherName = document.getElementById('addOtherName');
const addOtherNameList = document.getElementById('addOtherNameList');
const addOtherBoss = document.getElementById('addOtherBoss');
const addOtherType = document.getElementById('addOtherType');
const addOtherModalError = document.getElementById('addOtherModalError');
const addOtherModalConfirmBtn = document.getElementById('addOtherModalConfirmBtn');
const addOtherModalCancelBtn = document.getElementById('addOtherModalCancelBtn');

const confirmModal = document.getElementById('confirmModal');
const confirmModalBackdrop = document.getElementById('confirmModalBackdrop');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalText = document.getElementById('confirmModalText');
const confirmModalConfirmBtn = document.getElementById('confirmModalConfirmBtn');
const confirmModalCancelBtn = document.getElementById('confirmModalCancelBtn');
let confirmModalAction = null;

let user = null;
let days = [];
let types = [];
let bosses = [];
let entries = [];
let auditEntries = [];
let auditActors = [];
let auditPage = 0;
// Фільтри історії живуть, поки відкрита сторінка (не скидаються між вкладками).
const auditFilter = { from: '', to: '', actor: '', category: '' };
let userCharacters = [];
let userCharacterNamesLower = new Set();
let rosterNames = [];
let guildMemberNames = new Set();
let classColorMap = new Map();
let characterOwnerNames = new Map();
let activeTab = null; // { type: 'day', dayId } | { type: 'done' } | { type: 'audit' } | { type: 'settings' }
let settingsStatusEl = null;
let dataSignature = '';
let isDragging = false;
let renamingTypeId = null;
// Сторінки таблиць "Архіву" окремо для кожної пари бос+посилення.
const donePages = new Map();
// Вибір у формах запису переживає перемальовування (автооновлення, інші дії).
const signupState = { character: '', boss: '', buffTypeId: '' };

function setQueueStatus(text, isError) {
  queueStatus.textContent = text || '';
  queueStatus.classList.toggle('shard-queue-status--error', Boolean(isError));
}

async function readErrorMessage(res) {
  try {
    const data = await res.json();
    if (data?.error) return data.error;
  } catch { /* без JSON-тіла */ }
  return `HTTP ${res.status}`;
}

function authHeaders(json) {
  const headers = { Authorization: `Bearer ${getSessionToken()}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function apiRequest(method, path, body) {
  const res = await fetch(`${AUTH_API_BASE}/buff-queue${path}`, {
    method,
    headers: authHeaders(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

function isOfficer() {
  return Boolean(user?.isGuildOfficer);
}

function isOwnCharacter(name) {
  return userCharacterNamesLower.has(String(name).toLocaleLowerCase('uk'));
}

// Перенести чи прибрати запис можна лише поки він "Очікує". Для власника
// це правило перевіряє й сервер; офіцеру сервер дозволяє більше, але в UI
// у "Посиленого" лишаються тільки "Посилення виконано" і скасування —
// інакше чотири дії не влазили в колонку черги. Офіцер за потреби спершу
// скасує посилення.
function canTouchEntry(entry) {
  if (entry.status !== 'waiting') return false;
  return isOfficer() || isOwnCharacter(entry.player_name);
}

function dayLabel(dayId) {
  return days.find((d) => d.id === dayId)?.label || '?';
}

function typeLabel(typeId) {
  return types.find((t) => t.id === typeId)?.label || '?';
}

function bossLabel(boss) {
  return translateBoss(boss);
}

function activeDays() {
  return days.filter((d) => d.is_active);
}

function activeTypes() {
  return types.filter((t) => t.is_active);
}

function activeBosses() {
  return bosses.filter((b) => b.is_active);
}

function queueFor(dayId, boss, typeId) {
  return entries
    .filter((e) => e.day_id === dayId && e.boss === boss && e.buff_type_id === typeId && e.status !== 'done')
    .sort((a, b) => a.priority_rank - b.priority_rank);
}

function iconButton(className, label, iconHtml, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = iconHtml;
  btn.addEventListener('click', onClick);
  // JS-тултіп (#raidBtnTooltip), як і в решті рядка черги.
  bindTooltip(btn);
  return btn;
}

function textButton(className, text, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

// ---- Модалки замість window.confirm ----

function showConfirmModal({ title, text, confirmLabel, cancelLabel = 'Скасувати', onConfirm }) {
  confirmModalTitle.textContent = title;
  confirmModalText.textContent = text;
  confirmModalConfirmBtn.textContent = confirmLabel;
  confirmModalCancelBtn.textContent = cancelLabel;
  confirmModalAction = onConfirm;
  confirmModal.hidden = false;
}

function hideConfirmModal() {
  confirmModal.hidden = true;
  confirmModalAction = null;
}

confirmModalConfirmBtn.addEventListener('click', async () => {
  if (!confirmModalAction) return;
  confirmModalConfirmBtn.disabled = true;
  try {
    await confirmModalAction();
  } finally {
    confirmModalConfirmBtn.disabled = false;
  }
  hideConfirmModal();
});
confirmModalCancelBtn.addEventListener('click', hideConfirmModal);
confirmModalBackdrop.addEventListener('click', hideConfirmModal);

// ---- Дані ----

async function loadRosterSources() {
  try {
    const [playersRes, guildDataRes, ownersRes] = await Promise.all([
      fetch('/data/players.json?t=' + Date.now()),
      fetch('/data/guild-data.json?t=' + Date.now()),
      fetch(`${AUTH_API_BASE}/characters/owners`).catch(() => null)
    ]);
    if (playersRes.ok) {
      const players = await playersRes.json();
      guildMemberNames = new Set(players.map((p) => p.name));
    }
    if (guildDataRes.ok) {
      const guildData = await guildDataRes.json();
      const rows = guildData.rows || [];
      rosterNames = [...new Set(rows.map((row) => row.name))].sort((a, b) => a.localeCompare(b, 'uk'));
      classColorMap = buildClassColorMap(rows);
    }
    if (ownersRes?.ok) {
      characterOwnerNames = new Map(Object.entries(await ownersRes.json()));
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadOwnCharacters() {
  const res = await fetch(`${AUTH_API_BASE}/auth/me/characters`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const list = await res.json();
  userCharacters = list.map((c) => c.characterName);
  userCharacterNamesLower = new Set(userCharacters.map((n) => n.toLocaleLowerCase('uk')));
}

async function loadQueueData() {
  [days, types, bosses, entries] = await Promise.all([
    apiRequest('GET', '/days'),
    apiRequest('GET', '/types'),
    apiRequest('GET', '/bosses'),
    apiRequest('GET', '/entries')
  ]);
  dataSignature = JSON.stringify([days, types, bosses, entries]);
}

// Зсув часу Києва від UTC (мс) у момент ts — з урахуванням переходу на літній час.
function kyivOffsetMs(ts) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Kyiv', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(ts));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - ts;
}

// Північ дати "YYYY-MM-DD" (+dayShift днів) за Києвом — як ISO-момент в UTC,
// у тому ж форматі, що created_at у БД.
function kyivMidnightIso(dateStr, dayShift = 0) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const localMidnight = Date.UTC(y, m - 1, d + dayShift);
  let ts = localMidnight - kyivOffsetMs(localMidnight);
  ts = localMidnight - kyivOffsetMs(ts);
  return new Date(ts).toISOString();
}

function auditQueryString() {
  const params = new URLSearchParams();
  if (auditFilter.from) params.set('from', kyivMidnightIso(auditFilter.from));
  if (auditFilter.to) params.set('to', kyivMidnightIso(auditFilter.to, 1));
  if (auditFilter.actor) params.set('actor', auditFilter.actor);
  if (auditFilter.category) params.set('category', auditFilter.category);
  const query = params.toString();
  return query ? `?${query}` : '';
}

let auditRequestSeq = 0;

async function loadAudit() {
  const seq = ++auditRequestSeq;
  try {
    const data = await apiRequest('GET', `/audit${auditQueryString()}`);
    // Швидко змінені фільтри: застарілу відповідь відкидаємо.
    if (seq !== auditRequestSeq) return false;
    auditEntries = data.entries;
    auditActors = data.actors;
    auditPage = 0;
    return true;
  } catch (err) {
    if (seq === auditRequestSeq) setQueueStatus(`Помилка завантаження історії: ${err.message}`, true);
    return false;
  }
}

function fallbackTab() {
  const firstActiveDay = activeDays()[0];
  return firstActiveDay ? { type: 'day', dayId: firstActiveDay.id } : { type: 'done' };
}

function ensureValidTab() {
  if (!activeTab) activeTab = fallbackTab();
  else if (activeTab.type === 'day' && !days.some((d) => d.id === activeTab.dayId && d.is_active)) activeTab = fallbackTab();
  else if (activeTab.type === 'settings' && !isOfficer()) activeTab = fallbackTab();
}

function renderAll() {
  ensureValidTab();
  renderDayTabs();
  renderQueueContent();
}

async function refreshAll() {
  await loadQueueData();
  renderAll();
}

// ---- Автооновлення ----

// Не перемальовуємо сторінку під руками користувача: відкрита модалка,
// перетягування, фокус у полі чи дропдауні, перейменування посилення.
function isUserBusy() {
  if (!confirmModal.hidden || !moveDayModal.hidden || !addOtherModal.hidden || isDragging || renamingTypeId !== null) return true;
  const focused = document.activeElement;
  return Boolean(focused && queueContent.contains(focused) && /^(INPUT|SELECT|TEXTAREA)$/.test(focused.tagName));
}

async function pollQueue() {
  if (document.visibilityState !== 'visible' || isUserBusy()) return;
  if (activeTab?.type === 'audit') return;
  try {
    const previous = dataSignature;
    await loadQueueData();
    if (dataSignature !== previous && !isUserBusy()) renderAll();
  } catch (err) {
    console.error(err);
  }
}

// ---- Вкладки ----

function tabButton(type, label, extra = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  const isActive = activeTab?.type === type && (type !== 'day' || activeTab.dayId === extra.dayId);
  btn.className = 'raid-tab' + (isActive ? ' raid-tab--active' : '');
  btn.dataset.tabType = type;
  if (extra.dayId !== undefined) btn.dataset.dayId = String(extra.dayId);
  btn.textContent = label;
  return btn;
}

function renderDayTabs() {
  dayTabs.innerHTML = '';
  activeDays().forEach((day) => dayTabs.appendChild(tabButton('day', day.label, { dayId: day.id })));
  dayTabs.appendChild(tabButton('done', 'Архів'));
  dayTabs.appendChild(tabButton('audit', 'Історія дій'));
  if (isOfficer()) dayTabs.appendChild(tabButton('settings', 'Налаштування'));
}

dayTabs.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-tab-type]');
  if (!btn) return;
  const type = btn.dataset.tabType;
  activeTab = type === 'day' ? { type, dayId: Number(btn.dataset.dayId) } : { type };
  renamingTypeId = null;
  renderDayTabs();
  if (type === 'audit') await loadAudit();
  renderQueueContent();
});

function renderQueueContent() {
  queueContent.innerHTML = '';
  if (!activeTab) return;
  if (activeTab.type === 'done') renderDoneView();
  else if (activeTab.type === 'audit') renderAuditView();
  else if (activeTab.type === 'settings') renderSettingsView();
  else renderDayView(activeTab.dayId);
}

// ---- Вкладка дня ----

function playerNameCell(name) {
  const wrap = document.createElement('span');
  wrap.className = 'shard-queue-name-cell';
  wrap.appendChild(createPlayerBadge(name));
  const color = classColorMap.get(name);
  if (color) {
    const span = document.createElement('span');
    span.textContent = name;
    span.style.color = color;
    wrap.appendChild(span);
  } else {
    wrap.appendChild(document.createTextNode(name));
  }

  const ownerName = characterOwnerNames.get(name);
  if (ownerName) {
    wrap.setAttribute('aria-label', ownerName);
    bindTooltip(wrap);
  }
  return wrap;
}

function renderDayView(dayId) {
  const day = days.find((d) => d.id === dayId);
  if (!day) return;

  queueContent.appendChild(buildSignupForms(day));

  const bossList = activeBosses();
  const typeList = activeTypes();
  if (!bossList.length || !typeList.length) {
    const hint = document.createElement('p');
    hint.className = 'shard-queue-hint';
    hint.textContent = 'Офіцери ще не налаштували босів або посилення.';
    queueContent.appendChild(hint);
    return;
  }

  const columns = queueColumns(isOfficer());
  const board = buildBoard(typeList, columns);
  bossList.forEach((boss) => board.appendChild(buildBossBlock(day, boss.boss, typeList, columns)));
  queueContent.appendChild(board);
}

// ---- Спільна шапка для всіх босів ----
// Назви посилень і колонок — один раз над усіма босами (прилипає під
// топбаром при прокрутці), а не в кожному блоці боса: так кожен бос займає
// на 2–3 рядки менше. Щоб рядки стояли рівно під шапкою, у шапці й у
// кожного боса ті самі колонки сітки й та сама фіксована ширина колонок
// таблиці (colgroup + table-layout: fixed). На вузькому екрані посилення
// йдуть одне під одним, тож там шапку ховаємо, а назву посилення
// показуємо біля кожної черги (.buff-queue-type-col-label).

// [ключ колонки (клас col → ширина в CSS), заголовок]
function queueColumns(officer) {
  return officer
    ? [['drag', ''], ['index', '№'], ['name', "Ім'я"], ['status', 'Статус'], ['actions', 'Дія']]
    : [['index', '№'], ['name', "Ім'я"], ['status', 'Статус'], ['icons', '']];
}

const DONE_COLUMNS = [['name', "Ім'я"], ['day', 'День'], ['date', 'Дата']];

function buildQueueTable(columns, withHead) {
  const table = document.createElement('table');
  table.className = 'raid-table buff-queue-table';
  const colgroup = document.createElement('colgroup');
  columns.forEach(([key]) => {
    const col = document.createElement('col');
    col.className = `buff-queue-col--${key}`;
    colgroup.appendChild(col);
  });
  table.appendChild(colgroup);

  if (withHead) {
    const headRow = document.createElement('tr');
    columns.forEach(([, label]) => {
      const th = document.createElement('th');
      th.textContent = label;
      headRow.appendChild(th);
    });
    const thead = document.createElement('thead');
    thead.appendChild(headRow);
    table.appendChild(thead);
  }
  return table;
}

function typeGrid(typeCount) {
  const grid = document.createElement('div');
  grid.className = 'buff-queue-type-grid';
  grid.style.setProperty('--buff-type-count', String(typeCount));
  return grid;
}

function buildBoard(typeList, columns) {
  const board = document.createElement('div');
  board.className = 'buff-queue-board';

  const head = document.createElement('div');
  head.className = 'buff-queue-board-head';
  const grid = typeGrid(typeList.length);
  typeList.forEach((type) => {
    const col = document.createElement('div');
    col.className = 'buff-queue-type-col';
    const heading = document.createElement('h3');
    heading.textContent = type.label;
    col.append(heading, buildQueueTable(columns, true));
    grid.appendChild(col);
  });
  head.appendChild(grid);
  board.appendChild(head);
  return board;
}

// Колонка черги в блоці боса: назва посилення (видно лише на вузькому
// екрані) + таблиця без власної шапки.
function typeColumn(type) {
  const column = document.createElement('div');
  column.className = 'buff-queue-type-col';
  const label = document.createElement('h3');
  label.className = 'buff-queue-type-col-label';
  label.textContent = type.label;
  column.appendChild(label);
  return column;
}

function emptyRow(colSpan, text) {
  const tr = document.createElement('tr');
  tr.className = 'buff-queue-empty-row';
  const td = document.createElement('td');
  td.colSpan = colSpan;
  td.textContent = text;
  tr.appendChild(td);
  return tr;
}

// Топбар липкий, тож шапка черги прилипає під ним, а не під краєм вікна.
function syncTopbarOffset() {
  const topbar = document.querySelector('.topbar');
  document.body.style.setProperty('--topbar-offset', `${topbar ? topbar.offsetHeight : 0}px`);
}
window.addEventListener('resize', syncTopbarOffset);
syncTopbarOffset();

function bossChip(text, active) {
  const chip = document.createElement('span');
  chip.className = 'raid-chip' + (active ? ' raid-chip--active' : '');
  chip.textContent = text;
  return chip;
}

// Блок боса — одна рамка, як у вкладці "Предмети" на сторінці рейду:
// ім'я боса рядком-заголовком усередині рамки, під ним черги посилень.
// Праворуч у заголовку — скільки людей у черзі й скільки посилені зараз,
// щоб бачити, на якому босі йде рейд, не гортаючи таблиці.
function buildBossFrame(boss, chips) {
  const section = document.createElement('section');
  section.className = 'buff-queue-boss';

  const header = document.createElement('div');
  header.className = 'buff-queue-boss-header';
  const heading = document.createElement('h2');
  heading.textContent = bossLabel(boss);
  header.appendChild(heading);

  const chipsWrap = document.createElement('span');
  chipsWrap.className = 'buff-queue-boss-chips';
  chips.forEach((chip) => chipsWrap.appendChild(chip));
  header.appendChild(chipsWrap);

  section.appendChild(header);
  return section;
}

function buildBossBlock(day, boss, typeList, columns) {
  const queues = typeList.map((type) => ({ type, list: queueFor(day.id, boss, type.id) }));
  const all = queues.flatMap((q) => q.list);

  // Боси без жодного запису — лише рядок-заголовок, інакше 12 порожніх
  // блоків з таблицями розтягнули б сторінку на кілька екранів.
  if (!all.length) {
    const hint = document.createElement('span');
    hint.className = 'shard-queue-hint';
    hint.textContent = 'Ще ніхто не записався';
    const section = buildBossFrame(boss, [hint]);
    section.classList.add('buff-queue-boss--empty');
    return section;
  }

  const buffedCount = all.filter((e) => e.status === 'buffed').length;
  const chips = [bossChip(`У черзі: ${all.length}`, false)];
  if (buffedCount) chips.push(bossChip(`Посилених: ${buffedCount}`, true));

  const section = buildBossFrame(boss, chips);
  const grid = typeGrid(typeList.length);
  queues.forEach(({ type, list }) => grid.appendChild(buildQueueColumn(day, boss, type, list, columns)));
  section.appendChild(grid);
  return section;
}

function buildQueueColumn(day, boss, type, list, columns) {
  const column = typeColumn(type);
  const officer = isOfficer();
  const table = buildQueueTable(columns, false);

  const tbody = document.createElement('tbody');
  if (!list.length) tbody.appendChild(emptyRow(columns.length, 'Черга порожня.'));
  list.forEach((entry, index) => tbody.appendChild(buildQueueRow(day, entry, index, officer)));

  table.appendChild(tbody);
  column.appendChild(table);

  if (officer && list.length > 1) enableDragReorder(tbody, day.id, boss, type.id);
  return column;
}

function buildQueueRow(day, entry, index, officer) {
  const tr = document.createElement('tr');
  tr.dataset.id = String(entry.id);
  if (entry.status === 'buffed') tr.classList.add('buff-queue-row--buffed');

  if (officer) {
    tr.draggable = true;
    const dragTd = document.createElement('td');
    dragTd.className = 'shard-queue-drag-handle';
    dragTd.innerHTML = ICON_GRABBER;
    dragTd.setAttribute('aria-label', 'Перетягни, щоб змінити порядок');
    bindTooltip(dragTd);
    tr.appendChild(dragTd);
  }

  const indexTd = document.createElement('td');
  indexTd.textContent = String(index + 1);
  tr.appendChild(indexTd);

  const nameTd = document.createElement('td');
  nameTd.appendChild(playerNameCell(entry.player_name));
  tr.appendChild(nameTd);

  // Статус — іконкою замість чіпа, щоб колонка займала менше місця:
  // годинник — "Очікує", зелена галочка — "Посилений". Назва статусу
  // лишається в підказці й для скрінрідера.
  const statusTd = document.createElement('td');
  const statusIcon = document.createElement('span');
  statusIcon.className = `buff-queue-status-icon buff-queue-status-icon--${entry.status}`;
  statusIcon.setAttribute('role', 'img');
  statusIcon.setAttribute('aria-label', STATUS_LABELS[entry.status]);
  statusIcon.innerHTML = entry.status === 'buffed' ? ICON_CHECK : ICON_CLOCK;
  bindTooltip(statusIcon);
  statusTd.appendChild(statusIcon);
  tr.appendChild(statusTd);

  // Усі дії рядка — в одній клітинці, що за нестачі місця переносить іконки
  // на новий рядок. Окремі колонки під статус-кнопки й під перенос/кошик
  // таблиця резервувала б під найширший варіант кожної, і в колонці черги
  // (~половина сторінки) край обрізався.
  const actionTd = document.createElement('td');
  const actions = document.createElement('div');
  actions.className = 'buff-queue-actions';
  // Іконки — окремою групою біля правого краю колонки, щоб кошик і
  // скасування стояли рівним стовпчиком незалежно від ширини текстової кнопки.
  const icons = document.createElement('span');
  icons.className = 'buff-queue-row-icons';
  if (officer && entry.status === 'waiting') {
    actions.appendChild(textButton('link-button-std', 'Посилити', () => changeStatus(entry, 'buffed')));
  } else if (officer && entry.status === 'buffed') {
    actions.appendChild(textButton('link-button-std buff-queue-btn--success', 'Прибрати', () => confirmDone(entry)));
    icons.appendChild(iconButton('account-delete-btn buff-queue-icon-btn', 'Скасувати посилення — повернути в "Очікує"', ICON_UNDO, () => changeStatus(entry, 'waiting')));
  }
  if (canTouchEntry(entry)) {
    if (activeDays().some((d) => d.id !== day.id)) {
      icons.appendChild(iconButton('account-delete-btn buff-queue-icon-btn', 'Перенести на інший день', ICON_MOVE, () => openMoveDayModal(entry, day)));
    }
    icons.appendChild(iconButton('account-delete-btn', 'Прибрати з черги', ICON_TRASH, () => deleteEntry(entry)));
  }
  if (icons.childElementCount) actions.appendChild(icons);
  actionTd.appendChild(actions);
  tr.appendChild(actionTd);

  return tr;
}

// ---- Форми запису ----

function buildSelect(options, selectedValue, onChange) {
  const select = document.createElement('select');
  options.forEach(({ value, label, color }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (color !== undefined) opt.style.color = color;
    select.appendChild(opt);
  });
  if (options.some((o) => o.value === selectedValue)) select.value = selectedValue;
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function bossAndTypeSelects() {
  const bossOptions = activeBosses().map((b) => ({ value: b.boss, label: bossLabel(b.boss) }));
  const typeOptions = activeTypes().map((t) => ({ value: String(t.id), label: t.label }));
  const bossSelect = buildSelect(bossOptions, signupState.boss, (v) => { signupState.boss = v; });
  const typeSelect = buildSelect(typeOptions, signupState.buffTypeId, (v) => { signupState.buffTypeId = v; });
  bossSelect.setAttribute('aria-label', 'Бос');
  typeSelect.setAttribute('aria-label', 'Посилення');
  return { bossSelect, typeSelect };
}

// Один рядок запису для всіх — "записатись самому". Офіцер записує чужих
// персонажів через окремий попап (кнопка в кінці рядка), а не другою
// формою під першою: дві однакові на вигляд форми лише засмічували сторінку.
function buildSignupForms(day) {
  const wrap = document.createElement('div');
  wrap.className = 'shard-queue-add-forms buff-queue-signup';

  if (!activeBosses().length || !activeTypes().length) return wrap;

  const addOtherBtn = isOfficer()
    ? textButton('compare-btn', 'Додати чужого персонажа', () => openAddOtherModal(day))
    : null;

  if (userCharacters.length) {
    const form = document.createElement('form');
    form.className = 'buff-queue-signup-form' + (addOtherBtn ? ' buff-queue-signup-form--officer' : '');

    // Колір імені в дропдауні — як у черзі на уламки: кожна опція фарбується
    // явно, інакше вона успадкувала б колір поточно обраного персонажа.
    const charOptions = userCharacters.map((name) => ({
      value: name,
      label: name,
      color: classColorMap.get(name) || 'var(--color-text-strong)'
    }));
    const charSelect = buildSelect(charOptions, signupState.character, (v) => {
      signupState.character = v;
      syncCharColor();
    });
    charSelect.setAttribute('aria-label', 'Персонаж');
    const syncCharColor = () => { charSelect.style.color = classColorMap.get(charSelect.value) || ''; };
    syncCharColor();

    const { bossSelect, typeSelect } = bossAndTypeSelects();

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'compare-btn shard-queue-self-add-btn';
    btn.textContent = 'Записатись';

    form.append(charSelect, bossSelect, typeSelect, btn);
    if (addOtherBtn) form.appendChild(addOtherBtn);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      createEntry(day.id, bossSelect.value, Number(typeSelect.value), charSelect.value, form);
    });
    wrap.appendChild(form);
  } else if (user) {
    const hint = document.createElement('p');
    hint.className = 'shard-queue-hint';
    hint.innerHTML = 'Щоб записатись самому, спершу додай персонажа на сторінці <a href="../account/">"Акаунт"</a>.';
    wrap.appendChild(hint);
    if (addOtherBtn) wrap.appendChild(addOtherBtn);
  }

  return wrap;
}

// ---- Попап "Додати чужого персонажа" (лише офіцери) ----

function fillSelect(select, options, selectedValue) {
  select.innerHTML = '';
  options.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  });
  if (options.some((o) => o.value === selectedValue)) select.value = selectedValue;
}

function openAddOtherModal(day) {
  addOtherModal._dayId = day.id;
  addOtherModalText.textContent = `Запис на день "${day.label}".`;
  addOtherName.value = '';
  addOtherModalError.textContent = '';
  // Бос і посилення підставляємо ті, що вже обрані в рядку запису: офіцер
  // зазвичай записує кількох гравців на одне й те саме.
  fillSelect(addOtherBoss, activeBosses().map((b) => ({ value: b.boss, label: bossLabel(b.boss) })), signupState.boss);
  fillSelect(addOtherType, activeTypes().map((t) => ({ value: String(t.id), label: t.label })), signupState.buffTypeId);
  addOtherModal.hidden = false;
  setTimeout(() => addOtherName.focus(), 0);
}

function hideAddOtherModal() {
  addOtherModal.hidden = true;
  addOtherModal._dayId = null;
  addOtherNameList.innerHTML = '';
  addOtherNameList.classList.remove('is-open');
}

// Помилку показуємо в самому попапі, а не в рядку статусу під ним: інакше
// її не видно, і офіцер не розуміє, чому нічого не додалось.
addOtherModalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const playerName = addOtherName.value.trim();
  if (!playerName) {
    addOtherModalError.textContent = "Вкажи ім'я персонажа.";
    return;
  }

  addOtherModalConfirmBtn.disabled = true;
  try {
    await apiRequest('POST', '/entries', {
      dayId: addOtherModal._dayId,
      boss: addOtherBoss.value,
      buffTypeId: Number(addOtherType.value),
      playerName
    });
    hideAddOtherModal();
    setQueueStatus('');
    await refreshAll();
  } catch (err) {
    addOtherModalError.textContent = `Помилка: ${err.message}`;
  } finally {
    addOtherModalConfirmBtn.disabled = false;
  }
});
addOtherModalCancelBtn.addEventListener('click', hideAddOtherModal);
addOtherModalBackdrop.addEventListener('click', hideAddOtherModal);
addOtherName.addEventListener('input', () => { addOtherModalError.textContent = ''; });

function setupNameAutocomplete(inputEl, listEl, names) {
  function closeList() {
    listEl.innerHTML = '';
    listEl.classList.remove('is-open');
  }
  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim().toLocaleLowerCase('uk');
    if (!q) { closeList(); return; }
    const matches = names.filter((n) => n.toLocaleLowerCase('uk').includes(q)).slice(0, 8);
    listEl.innerHTML = '';
    if (!matches.length) { closeList(); return; }
    matches.forEach((name) => {
      const item = document.createElement('div');
      item.className = 'raid-autocomplete-item';
      item.textContent = name;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        inputEl.value = name;
        closeList();
      });
      listEl.appendChild(item);
    });
    listEl.classList.add('is-open');
  });
  inputEl.addEventListener('blur', () => setTimeout(closeList, 150));
}

// ---- Перетягування (лише офіцери) ----

function enableDragReorder(tbody, dayId, boss, buffTypeId) {
  let draggedRow = null;
  let originalIds = null;
  const currentIds = () => Array.from(tbody.children).filter((tr) => tr.dataset.id).map((tr) => Number(tr.dataset.id));

  tbody.querySelectorAll('tr[draggable="true"]').forEach((row) => {
    row.addEventListener('dragstart', () => {
      draggedRow = row;
      isDragging = true;
      row.classList.add('is-dragging');
      originalIds = currentIds();
    });

    row.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (!draggedRow || draggedRow === row) return;
      const rect = row.getBoundingClientRect();
      const before = event.clientY - rect.top < rect.height / 2;
      tbody.insertBefore(draggedRow, before ? row : row.nextSibling);
    });

    row.addEventListener('dragend', async () => {
      row.classList.remove('is-dragging');
      isDragging = false;
      if (!draggedRow) return;
      draggedRow = null;
      const orderedIds = currentIds();
      const unchanged = originalIds
        && orderedIds.length === originalIds.length
        && orderedIds.every((id, i) => id === originalIds[i]);
      originalIds = null;
      if (unchanged) return;

      try {
        await apiRequest('PATCH', '/reorder', { dayId, boss, buffTypeId, orderedIds });
        setQueueStatus('');
      } catch (err) {
        setQueueStatus(`Помилка: ${err.message}`, true);
      }
      await refreshAll();
    });
  });
}

// ---- Вкладка "Архів" ----

function renderDoneView() {
  const done = entries.filter((e) => e.status === 'done');
  if (!done.length) {
    const empty = document.createElement('p');
    empty.className = 'shard-queue-hint';
    empty.textContent = 'Ще нікого немає.';
    queueContent.appendChild(empty);
    return;
  }

  // Колонки — усі посилення, що є в архіві (включно з прихованими), у
  // порядку налаштувань. У боса, де якогось посилення не було, — порожня
  // клітинка, щоб колонки не з'їжджали відносно спільної шапки.
  const doneTypes = types.filter((t) => done.some((e) => e.buff_type_id === t.id));
  const board = buildBoard(doneTypes, DONE_COLUMNS);

  // Порядок босів — як у налаштуваннях, включно з прихованими: історія
  // лишається видимою, навіть якщо боса вже прибрали з вкладок днів.
  bosses.forEach(({ boss }) => {
    const bossDone = done.filter((e) => e.boss === boss);
    if (!bossDone.length) return;

    const section = buildBossFrame(boss, [bossChip(`Виконано: ${bossDone.length}`, false)]);

    const grid = typeGrid(doneTypes.length);
    doneTypes.forEach((type) => {
      const list = bossDone
        .filter((e) => e.buff_type_id === type.id)
        .sort((a, b) => (a.done_at < b.done_at ? 1 : -1));
      grid.appendChild(buildDoneColumn(boss, type, list));
    });
    section.appendChild(grid);
    board.appendChild(section);
  });
  queueContent.appendChild(board);
}

function buildDoneColumn(boss, type, list) {
  const column = typeColumn(type);

  const key = `${boss}|${type.id}`;
  const totalPages = Math.max(Math.ceil(list.length / DONE_PAGE_SIZE), 1);
  const page = Math.min(donePages.get(key) || 0, totalPages - 1);
  const pageRows = list.slice(page * DONE_PAGE_SIZE, (page + 1) * DONE_PAGE_SIZE);

  const table = buildQueueTable(DONE_COLUMNS, false);
  const tbody = document.createElement('tbody');
  if (!list.length) tbody.appendChild(emptyRow(DONE_COLUMNS.length, '—'));
  pageRows.forEach((entry) => {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.appendChild(playerNameCell(entry.player_name));
    const dayTd = document.createElement('td');
    dayTd.textContent = dayLabel(entry.day_id);
    const dateTd = document.createElement('td');
    dateTd.textContent = formatDateKyiv(entry.done_at);
    tr.append(nameTd, dayTd, dateTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  column.appendChild(table);

  if (totalPages > 1) {
    column.appendChild(buildPagination(page, totalPages, (next) => {
      donePages.set(key, next);
      renderQueueContent();
    }));
  }
  return column;
}

function buildPagination(page, totalPages, onChange) {
  const pagination = document.createElement('div');
  pagination.className = 'raid-pagination';

  const prevBtn = textButton('link-button-std', '← Попередня', () => onChange(page - 1));
  prevBtn.disabled = page === 0;
  const pageInfo = document.createElement('span');
  pageInfo.textContent = `Сторінка ${page + 1} з ${totalPages}`;
  const nextBtn = textButton('link-button-std', 'Наступна →', () => onChange(page + 1));
  nextBtn.disabled = page >= totalPages - 1;

  pagination.append(prevBtn, pageInfo, nextBtn);
  return pagination;
}

// ---- Історія дій ----

function queueName(d) {
  return `"${typeLabel(d.buffTypeId)}" — ${bossLabel(d.boss)}`;
}

function describeAuditAction(entry) {
  const d = entry.detail || {};
  switch (entry.action) {
    case 'day_create':
      return `створив день "${d.label}"`;
    case 'day_update': {
      const parts = [];
      if (d.label !== undefined) parts.push(`перейменував день у "${d.label}"`);
      if (d.isActive !== undefined) parts.push(d.isActive ? `повернув день "${dayLabel(d.dayId)}"` : `видалив день "${dayLabel(d.dayId)}"`);
      return parts.join(', ') || `оновив день "${dayLabel(d.dayId)}"`;
    }
    case 'type_create':
      return `додав посилення "${d.label}"`;
    case 'type_update': {
      const parts = [];
      if (d.label !== undefined && d.label !== d.previousLabel) parts.push(`перейменував посилення "${d.previousLabel}" на "${d.label}"`);
      if (d.isActive !== undefined) parts.push(`${d.isActive ? 'повернув' : 'приховав'} посилення "${d.label || d.previousLabel}"`);
      return parts.join(', ') || `оновив посилення "${d.previousLabel}"`;
    }
    case 'boss_update':
      return `${d.isActive ? 'повернув' : 'приховав'} боса ${bossLabel(d.boss)}`;
    case 'entry_create':
      return `записав ${d.playerName} на ${queueName(d)} (${dayLabel(d.dayId)})`;
    case 'status_update':
      if (d.to === 'buffed') return `посилив ${d.playerName}: ${queueName(d)}`;
      if (d.to === 'done') return `підтвердив посилення ${d.playerName}: ${queueName(d)}`;
      return `скасував посилення ${d.playerName}: ${queueName(d)}`;
    case 'entries_reorder':
      return `змінив порядок черги на ${queueName(d)} (${dayLabel(d.dayId)})`;
    case 'entry_move_day':
      return `переніс ${d.playerName} (${queueName(d)}) з "${dayLabel(d.fromDayId)}" на "${dayLabel(d.toDayId)}"`;
    case 'entry_delete':
      return `прибрав ${d.playerName} з черги на ${queueName(d)} (${dayLabel(d.dayId)})`;
    default:
      return entry.action;
  }
}

// Категорії мають збігатися з AUDIT_CATEGORIES у worker/src/routes/buff-queue.js.
const AUDIT_CATEGORY_OPTIONS = [
  ['entry_create', 'Запис у чергу'],
  ['buffed', 'Посилення'],
  ['done', 'Виконано'],
  ['unbuffed', 'Скасування посилення'],
  ['entry_delete', 'Прибрано з черги'],
  ['entry_move_day', 'Перенесено на інший день'],
  ['entries_reorder', 'Зміна порядку'],
  ['settings', 'Налаштування']
];

function filterField(labelText, control) {
  const label = document.createElement('label');
  label.className = 'buff-queue-audit-filter';
  const caption = document.createElement('span');
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

function filterSelect(value, placeholder, options) {
  const select = document.createElement('select');
  [['', placeholder], ...options].forEach(([optValue, optLabel]) => {
    const opt = document.createElement('option');
    opt.value = optValue;
    opt.textContent = optLabel;
    select.appendChild(opt);
  });
  select.value = value;
  return select;
}

function filterDate(value) {
  const input = document.createElement('input');
  input.type = 'date';
  input.value = value;
  return input;
}

function buildAuditFilters(listHost) {
  const bar = document.createElement('div');
  bar.className = 'buff-queue-audit-filters';

  const fromInput = filterDate(auditFilter.from);
  const toInput = filterDate(auditFilter.to);
  // Ім'я з фільтра могло зникнути зі списку (напр. після зміни даних) — лишаємо його видимим.
  const actorNames = auditFilter.actor && !auditActors.includes(auditFilter.actor)
    ? [auditFilter.actor, ...auditActors]
    : auditActors;
  const actorSelect = filterSelect(auditFilter.actor, 'Усі', actorNames.map((n) => [n, n]));
  const categorySelect = filterSelect(auditFilter.category, 'Усі події', AUDIT_CATEGORY_OPTIONS);
  const resetBtn = textButton('link-button-std', 'Скинути', () => {
    fromInput.value = toInput.value = actorSelect.value = categorySelect.value = '';
    applyFilters();
  });

  // Перемальовуємо лише список, не рядок фільтрів — інакше поле дати
  // губило б фокус посеред введення року.
  async function applyFilters() {
    auditFilter.from = fromInput.value;
    auditFilter.to = toInput.value;
    auditFilter.actor = actorSelect.value;
    auditFilter.category = categorySelect.value;
    resetBtn.disabled = !Object.values(auditFilter).some(Boolean);
    setQueueStatus('');
    if (await loadAudit()) renderAuditList(listHost);
  }

  [fromInput, toInput, actorSelect, categorySelect].forEach((el) => el.addEventListener('change', applyFilters));
  resetBtn.disabled = !Object.values(auditFilter).some(Boolean);

  bar.append(
    filterField('З', fromInput),
    filterField('По', toInput),
    filterField('Хто', actorSelect),
    filterField('Подія', categorySelect),
    resetBtn
  );
  return bar;
}

function renderAuditView() {
  const section = document.createElement('section');
  section.className = 'shard-queue-resource-block';

  const heading = document.createElement('h2');
  heading.textContent = 'Історія дій';
  const listHost = document.createElement('div');
  section.append(heading, buildAuditFilters(listHost), listHost);
  renderAuditList(listHost);
  queueContent.appendChild(section);
}

function renderAuditList(host) {
  host.innerHTML = '';

  const totalPages = Math.max(Math.ceil(auditEntries.length / AUDIT_PAGE_SIZE), 1);
  auditPage = Math.min(Math.max(auditPage, 0), totalPages - 1);
  const pageEntries = auditEntries.slice(auditPage * AUDIT_PAGE_SIZE, (auditPage + 1) * AUDIT_PAGE_SIZE);

  const list = document.createElement('div');
  list.className = 'raid-audit-list';
  if (!pageEntries.length) {
    list.textContent = Object.values(auditFilter).some(Boolean) ? 'За цими фільтрами подій немає.' : 'Історія порожня.';
  } else {
    pageEntries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'raid-audit-row';
      const time = document.createElement('span');
      time.className = 'raid-audit-time';
      time.textContent = formatDateTimeKyiv(entry.created_at);
      const text = document.createElement('span');
      text.textContent = ` ${entry.actor_name} — ${describeAuditAction(entry)}`;
      row.append(time, text);
      list.appendChild(row);
    });
  }
  host.appendChild(list);

  if (totalPages > 1) {
    host.appendChild(buildPagination(auditPage, totalPages, (next) => {
      auditPage = next;
      renderAuditList(host);
    }));
  }
}

// ---- Налаштування (лише офіцери) ----

function manageSection(title) {
  const section = document.createElement('section');
  section.className = 'shard-queue-manage';
  const heading = document.createElement('h2');
  heading.textContent = title;
  section.appendChild(heading);
  return section;
}

function manageItem(labelText, inactive) {
  const li = document.createElement('li');
  li.className = 'shard-queue-manage-item' + (inactive ? ' shard-queue-manage-item--inactive' : '');
  const label = document.createElement('span');
  label.textContent = labelText;
  li.appendChild(label);
  return li;
}

// Кнопка "Видалити/Приховати" неактивна, поки на цьому є черга — пояснюємо
// чому тултіпом (JS: див. коментар у iconButton), а сервер однаково відмовить.
function toggleActiveButton({ isActive, hideLabel, blockedReason, onToggle }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'link-button-std' + (isActive ? ' link-button-std--danger' : '');
  btn.textContent = isActive ? hideLabel : 'Повернути';
  if (isActive && blockedReason) {
    btn.disabled = true;
    btn.setAttribute('aria-label', blockedReason);
    bindTooltip(btn);
  } else {
    btn.addEventListener('click', onToggle);
  }
  return btn;
}

function hasActiveEntries(predicate) {
  return entries.some((e) => e.status !== 'done' && predicate(e));
}

function renderSettingsView() {
  // Дні й типи посилень — короткі списки, тож поруч у дві колонки.
  const grid = document.createElement('div');
  grid.className = 'buff-queue-settings-grid';
  grid.append(buildDaysSettings(), buildTypesSettings());
  queueContent.appendChild(grid);
  queueContent.appendChild(buildBossesSettings());
  settingsStatusEl = document.createElement('p');
  queueContent.appendChild(settingsStatusEl);
}

function setSettingsStatus(text) {
  if (settingsStatusEl) settingsStatusEl.textContent = text || '';
}

async function settingsAction(fn) {
  try {
    await fn();
    setSettingsStatus('');
    await refreshAll();
  } catch (err) {
    setSettingsStatus(`Помилка: ${err.message}`);
  }
}

function buildDaysSettings() {
  const section = manageSection('Керування днями');

  const usedLabels = new Set(days.map((d) => d.label.trim().toLocaleLowerCase('uk')));
  const availableWeekdays = WEEKDAYS.filter((w) => !usedLabels.has(w.toLocaleLowerCase('uk')));

  if (availableWeekdays.length) {
    const form = document.createElement('form');
    form.className = 'account-form';
    const select = buildSelect(availableWeekdays.map((w) => ({ value: w, label: w })), '', () => {});
    select.setAttribute('aria-label', 'День тижня');
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'compare-btn';
    btn.textContent = 'Додати день';
    form.append(select, btn);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      settingsAction(() => apiRequest('POST', '/days', { label: select.value }));
    });
    section.appendChild(form);
  } else {
    const hint = document.createElement('p');
    hint.className = 'shard-queue-hint';
    hint.textContent = 'Усі дні тижня вже додані.';
    section.appendChild(hint);
  }

  const list = document.createElement('ul');
  list.className = 'shard-queue-manage-list';
  days.forEach((day) => {
    const li = manageItem(day.is_active ? day.label : `${day.label} (анульовано)`, !day.is_active);
    const blocked = day.is_active && hasActiveEntries((e) => e.day_id === day.id);
    li.appendChild(toggleActiveButton({
      isActive: Boolean(day.is_active),
      hideLabel: 'Видалити',
      blockedReason: blocked ? 'У черзі цього дня ще є гравці — спершу перенеси їх на інший день' : null,
      onToggle: () => {
        const run = () => settingsAction(() => apiRequest('PATCH', `/days/${day.id}`, { isActive: !day.is_active }));
        if (!day.is_active) { run(); return; }
        showConfirmModal({
          title: 'Видалити день',
          text: `Видалити день "${day.label}"? Він зникне з активних вкладок для всіх.`,
          confirmLabel: 'Видалити',
          onConfirm: run
        });
      }
    }));
    list.appendChild(li);
  });
  section.appendChild(list);
  return section;
}

function buildTypesSettings() {
  const section = manageSection('Типи посилень');

  const form = document.createElement('form');
  form.className = 'account-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 40;
  input.placeholder = 'Назва посилення';
  input.setAttribute('aria-label', 'Назва посилення');
  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'compare-btn';
  btn.textContent = 'Додати посилення';
  form.append(input, btn);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const label = input.value.trim();
    if (!label) return;
    settingsAction(() => apiRequest('POST', '/types', { label }));
  });
  section.appendChild(form);

  const list = document.createElement('ul');
  list.className = 'shard-queue-manage-list';
  types.forEach((type) => list.appendChild(buildTypeItem(type)));
  section.appendChild(list);
  return section;
}

function buildTypeItem(type) {
  const inactive = !type.is_active;
  const li = manageItem(inactive ? `${type.label} (приховано)` : type.label, inactive);

  if (renamingTypeId === type.id) {
    li.innerHTML = '';
    const form = document.createElement('form');
    form.className = 'account-form buff-queue-rename-form';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 40;
    input.value = type.label;
    input.setAttribute('aria-label', 'Нова назва посилення');
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'compare-btn';
    saveBtn.textContent = 'Зберегти';
    const cancelBtn = textButton('link-button-std', 'Скасувати', () => {
      renamingTypeId = null;
      renderQueueContent();
    });
    form.append(input, saveBtn, cancelBtn);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const label = input.value.trim();
      if (!label || label === type.label) {
        renamingTypeId = null;
        renderQueueContent();
        return;
      }
      settingsAction(async () => {
        await apiRequest('PATCH', `/types/${type.id}`, { label });
        renamingTypeId = null;
      });
    });
    li.appendChild(form);
    setTimeout(() => input.focus(), 0);
    return li;
  }

  li.appendChild(textButton('link-button-std', 'Перейменувати', () => {
    renamingTypeId = type.id;
    renderQueueContent();
  }));

  const blocked = type.is_active && hasActiveEntries((e) => e.buff_type_id === type.id);
  li.appendChild(toggleActiveButton({
    isActive: Boolean(type.is_active),
    hideLabel: 'Приховати',
    blockedReason: blocked ? 'На це посилення ще є черга — спершу її треба завершити або прибрати' : null,
    onToggle: () => settingsAction(() => apiRequest('PATCH', `/types/${type.id}`, { isActive: !type.is_active }))
  }));
  return li;
}

function buildBossesSettings() {
  const section = manageSection('Боси');

  const hint = document.createElement('p');
  hint.className = 'shard-queue-hint';
  hint.textContent = 'Прихований бос зникає з вкладок днів і форм запису, але його історія лишається в "Архіві".';
  section.appendChild(hint);

  const list = document.createElement('ul');
  list.className = 'shard-queue-manage-list';
  bosses.forEach((boss) => {
    const inactive = !boss.is_active;
    const li = manageItem(inactive ? `${bossLabel(boss.boss)} (приховано)` : bossLabel(boss.boss), inactive);
    const blocked = boss.is_active && hasActiveEntries((e) => e.boss === boss.boss);
    li.appendChild(toggleActiveButton({
      isActive: Boolean(boss.is_active),
      hideLabel: 'Приховати',
      blockedReason: blocked ? 'На цього боса ще є черга — спершу її треба завершити або прибрати' : null,
      onToggle: () => settingsAction(() => apiRequest('PATCH', `/bosses/${encodeURIComponent(boss.boss)}`, { isActive: !boss.is_active }))
    }));
    list.appendChild(li);
  });
  section.appendChild(list);
  return section;
}

// ---- Дії над записами ----

async function createEntry(dayId, boss, buffTypeId, playerName, form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    await apiRequest('POST', '/entries', { dayId, boss, buffTypeId, playerName });
    setQueueStatus('');
    await refreshAll();
    return true;
  } catch (err) {
    setQueueStatus(`Помилка: ${err.message}`, true);
    return false;
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function changeStatus(entry, status) {
  try {
    await apiRequest('PATCH', `/entries/${entry.id}/status`, { status });
    setQueueStatus('');
  } catch (err) {
    setQueueStatus(`Помилка: ${err.message}`, true);
  }
  await refreshAll();
}

function confirmDone(entry) {
  showConfirmModal({
    title: 'Посилення виконано?',
    text: `${entry.player_name} — "${typeLabel(entry.buff_type_id)}", ${bossLabel(entry.boss)}. Запис переїде в "Архів".`,
    confirmLabel: 'Так',
    cancelLabel: 'Відмінити',
    onConfirm: () => changeStatus(entry, 'done')
  });
}

function openMoveDayModal(entry, day) {
  const otherDays = activeDays().filter((d) => d.id !== day.id);
  if (!otherDays.length) return;

  moveDayModalSelect.innerHTML = '';
  otherDays.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = String(d.id);
    opt.textContent = d.label;
    moveDayModalSelect.appendChild(opt);
  });
  moveDayModalText.textContent = 'Персонажа буде перенесено в кінець черги обраного дня.';
  moveDayModal._entry = entry;
  moveDayModal.hidden = false;
}

function hideMoveDayModal() {
  moveDayModal.hidden = true;
  moveDayModal._entry = null;
}

moveDayModalConfirmBtn.addEventListener('click', async () => {
  const entry = moveDayModal._entry;
  if (!entry) return;
  moveDayModalConfirmBtn.disabled = true;
  try {
    await apiRequest('PATCH', `/entries/${entry.id}/day`, { dayId: Number(moveDayModalSelect.value) });
    setQueueStatus('');
  } catch (err) {
    setQueueStatus(`Помилка: ${err.message}`, true);
  } finally {
    moveDayModalConfirmBtn.disabled = false;
  }
  hideMoveDayModal();
  await refreshAll();
});
moveDayModalCancelBtn.addEventListener('click', hideMoveDayModal);
moveDayModalBackdrop.addEventListener('click', hideMoveDayModal);

function deleteEntry(entry) {
  showConfirmModal({
    title: 'Прибрати з черги',
    text: `Прибрати "${entry.player_name}" з черги на "${typeLabel(entry.buff_type_id)}" — ${bossLabel(entry.boss)}?`,
    confirmLabel: 'Прибрати',
    onConfirm: async () => {
      try {
        await apiRequest('DELETE', `/entries/${entry.id}`);
        setQueueStatus('');
      } catch (err) {
        setQueueStatus(`Помилка: ${err.message}`, true);
      }
      await refreshAll();
    }
  });
}

// ---- Ініціалізація ----

async function init() {
  loginGateBtn.href = discordLoginUrl();
  user = await fetchCurrentUser();

  if (!user) {
    loginGate.hidden = false;
    return;
  }
  loginGate.hidden = true;

  try {
    await loadRosterSources();
    // Після завантаження ростера: функція запам'ятовує масив імен на момент виклику.
    setupNameAutocomplete(addOtherName, addOtherNameList, rosterNames);
    await loadOwnCharacters();
    await refreshAll();
  } catch (err) {
    setQueueStatus(`Помилка завантаження: ${err.message}`, true);
    return;
  }

  setInterval(pollQueue, POLL_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pollQueue();
  });
}

init();
