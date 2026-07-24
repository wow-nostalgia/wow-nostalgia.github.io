// Черга на уламки і кров — self-service + офіцерська сторінка поверх
// того самого Discord-auth + Cloudflare D1 воркера, що й рейд-менеджер.

const RESOURCE_CAPS = { shard: 50, blood: 2 };
const RESOURCE_LABELS = { blood: 'Кров', shard: 'Уламки' };
const RESOURCE_LABELS_LOWER = { blood: 'кров', shard: 'уламки' };
const WEEKDAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
// Фармити уламки/кров можуть лише танкові класи — так влаштований сам фарм.
const FARM_ELIGIBLE_CLASSES = new Set(['Warrior', 'Death Knight', 'Paladin']);

const loggedOutHint = document.getElementById('loggedOutHint');
const dayTabs = document.getElementById('dayTabs');
const queueContent = document.getElementById('queueContent');
const queueStatus = document.getElementById('queueStatus');
const btnTooltipEl = document.getElementById('raidBtnTooltip');

const renameDayModal = document.getElementById('renameDayModal');
const renameDayModalBackdrop = document.getElementById('renameDayModalBackdrop');
const renameDayForm = document.getElementById('renameDayForm');
const renameDayInput = document.getElementById('renameDayInput');
const renameDayModalStatus = document.getElementById('renameDayModalStatus');
const renameDayCancelBtn = document.getElementById('renameDayCancelBtn');

const moveDayModal = document.getElementById('moveDayModal');
const moveDayModalBackdrop = document.getElementById('moveDayModalBackdrop');
const moveDayModalText = document.getElementById('moveDayModalText');
const moveDayModalSelect = document.getElementById('moveDayModalSelect');
const moveDayModalConfirmBtn = document.getElementById('moveDayModalConfirmBtn');
const moveDayModalCancelBtn = document.getElementById('moveDayModalCancelBtn');

const confirmModal = document.getElementById('confirmModal');
const confirmModalBackdrop = document.getElementById('confirmModalBackdrop');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalText = document.getElementById('confirmModalText');
const confirmModalConfirmBtn = document.getElementById('confirmModalConfirmBtn');
const confirmModalCancelBtn = document.getElementById('confirmModalCancelBtn');
let confirmModalAction = null;

let user = null;
let days = [];
let entries = [];
let userCharacters = [];
let userCharacterNamesLower = new Set();
let rosterNames = [];
let farmEligibleRosterNames = [];
let guildMemberNames = new Set();
let classColorMap = new Map();
let nameClassMap = new Map();
let characterOwnerNames = new Map();
let activeTab = null; // { type: 'day', dayId } | { type: 'backlog' } | { type: 'settings' }
let dayManageStatusEl = null;

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

function isOfficer() {
  return Boolean(user?.isGuildOfficer);
}

function isOwnCharacter(name) {
  return userCharacterNamesLower.has(String(name).toLocaleLowerCase('uk'));
}

function canEditEntry(entry) {
  return isOfficer() || isOwnCharacter(entry.player_name);
}

function isFarmEligible(name) {
  return FARM_ELIGIBLE_CLASSES.has(nameClassMap.get(name));
}

// Для власних персонажів клас відомий лише якщо вони вже відвідали хоч
// один рейд (guild-data.json будується з рейд-логів) — новий/невідвіданий
// альт трактуємо як дозволений, а не ховаємо через відсутність даних.
function isFarmEligibleOrUnknownClass(name) {
  const cls = nameClassMap.get(name);
  return !cls || FARM_ELIGIBLE_CLASSES.has(cls);
}

function dayLabel(dayId) {
  return days.find((d) => d.id === dayId)?.label || '?';
}

// ---- Модалки замість window.confirm/window.prompt ----

function showConfirmModal({ title, text, confirmLabel, onConfirm }) {
  confirmModalTitle.textContent = title;
  confirmModalText.textContent = text;
  confirmModalConfirmBtn.textContent = confirmLabel;
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

function hideRenameDayModal() {
  renameDayModal.hidden = true;
  renameDayModal._day = null;
}

renameDayForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const day = renameDayModal._day;
  const label = renameDayInput.value.trim();
  if (!label || label === day.label) { hideRenameDayModal(); return; }
  const submitBtn = renameDayForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await fetch(`${AUTH_API_BASE}/shard-queue/days/${day.id}`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ label })
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    hideRenameDayModal();
    if (dayManageStatusEl) dayManageStatusEl.textContent = '';
    await refreshAll();
  } catch (err) {
    renameDayModalStatus.textContent = `Помилка: ${err.message}`;
    renameDayModalStatus.classList.add('shard-queue-status--error');
  } finally {
    submitBtn.disabled = false;
  }
});
renameDayCancelBtn.addEventListener('click', hideRenameDayModal);
renameDayModalBackdrop.addEventListener('click', hideRenameDayModal);

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
      nameClassMap = new Map();
      for (const row of rows) {
        if (!nameClassMap.has(row.name)) nameClassMap.set(row.name, row.class);
      }
      farmEligibleRosterNames = rosterNames.filter((name) => FARM_ELIGIBLE_CLASSES.has(nameClassMap.get(name)));
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

async function loadShardQueueDays() {
  const res = await fetch(`${AUTH_API_BASE}/shard-queue/days`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  days = await res.json();
}

async function loadShardQueueEntries() {
  const res = await fetch(`${AUTH_API_BASE}/shard-queue/entries`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  entries = await res.json();
}

async function refreshAll() {
  await Promise.all([loadShardQueueDays(), loadShardQueueEntries()]);
  if (!activeTab) {
    const firstActiveDay = days.find((d) => d.is_active);
    activeTab = firstActiveDay ? { type: 'day', dayId: firstActiveDay.id } : { type: 'backlog' };
  } else if (activeTab.type === 'day' && !days.some((d) => d.id === activeTab.dayId && d.is_active)) {
    // Поточна вкладка зникла (анульована іншим офіцером) — падаємо на першу активну.
    const firstActiveDay = days.find((d) => d.is_active);
    activeTab = firstActiveDay ? { type: 'day', dayId: firstActiveDay.id } : { type: 'backlog' };
  } else if (activeTab.type === 'settings' && !isOfficer()) {
    // Права офіцера забрали, поки вкладка була відкрита.
    const firstActiveDay = days.find((d) => d.is_active);
    activeTab = firstActiveDay ? { type: 'day', dayId: firstActiveDay.id } : { type: 'backlog' };
  }
  renderDayTabs();
  renderQueueContent();
}

// ---- Вкладки днів ----

function renderDayTabs() {
  dayTabs.innerHTML = '';
  const activeDays = days.filter((d) => d.is_active);

  activeDays.forEach((day) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'raid-tab' + (activeTab?.type === 'day' && activeTab.dayId === day.id ? ' raid-tab--active' : '');
    btn.dataset.tabType = 'day';
    btn.dataset.dayId = String(day.id);
    btn.textContent = day.label;
    dayTabs.appendChild(btn);
  });

  const backlogBtn = document.createElement('button');
  backlogBtn.type = 'button';
  backlogBtn.className = 'raid-tab' + (activeTab?.type === 'backlog' ? ' raid-tab--active' : '');
  backlogBtn.dataset.tabType = 'backlog';
  backlogBtn.textContent = 'Вже зібрано';
  dayTabs.appendChild(backlogBtn);

  if (isOfficer()) {
    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'raid-tab' + (activeTab?.type === 'settings' ? ' raid-tab--active' : '');
    settingsBtn.dataset.tabType = 'settings';
    settingsBtn.textContent = 'Налаштування';
    dayTabs.appendChild(settingsBtn);
  }
}

dayTabs.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-tab-type]');
  if (!btn) return;
  if (btn.dataset.tabType === 'backlog') activeTab = { type: 'backlog' };
  else if (btn.dataset.tabType === 'settings') activeTab = { type: 'settings' };
  else activeTab = { type: 'day', dayId: Number(btn.dataset.dayId) };
  renderDayTabs();
  renderQueueContent();
});

// ---- Керування днями (тільки офіцер) ----

function renderSettingsView() {
  const section = document.createElement('section');
  section.className = 'shard-queue-manage';

  const heading = document.createElement('h2');
  heading.textContent = 'Керування днями';
  section.appendChild(heading);

  const usedLabels = new Set(days.map((d) => d.label.trim().toLocaleLowerCase('uk')));
  const availableWeekdays = WEEKDAYS.filter((w) => !usedLabels.has(w.toLocaleLowerCase('uk')));

  if (availableWeekdays.length) {
    const form = document.createElement('form');
    form.className = 'account-form';

    const select = document.createElement('select');
    availableWeekdays.forEach((w) => {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = w;
      select.appendChild(opt);
    });
    form.appendChild(select);

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'compare-btn';
    btn.textContent = 'Додати день';
    form.appendChild(btn);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      addDay(select.value);
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
    const li = document.createElement('li');
    li.className = 'shard-queue-manage-item' + (day.is_active ? '' : ' shard-queue-manage-item--inactive');

    const label = document.createElement('span');
    label.textContent = day.is_active ? day.label : `${day.label} (анульовано)`;
    li.appendChild(label);

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'link-button-std';
    renameBtn.textContent = 'Перейменувати';
    renameBtn.addEventListener('click', () => renameDay(day));
    li.appendChild(renameBtn);

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'link-button-std' + (day.is_active ? ' link-button-std--danger' : '');
    toggleBtn.textContent = day.is_active ? 'Анулювати' : 'Повернути';
    toggleBtn.addEventListener('click', () => toggleDayActive(day));
    li.appendChild(toggleBtn);

    list.appendChild(li);
  });
  section.appendChild(list);

  dayManageStatusEl = document.createElement('p');
  section.appendChild(dayManageStatusEl);

  queueContent.appendChild(section);
}

async function addDay(label) {
  try {
    const res = await fetch(`${AUTH_API_BASE}/shard-queue/days`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ label })
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    if (dayManageStatusEl) dayManageStatusEl.textContent = '';
    await refreshAll();
  } catch (err) {
    if (dayManageStatusEl) dayManageStatusEl.textContent = `Помилка: ${err.message}`;
  }
}

function renameDay(day) {
  renameDayInput.value = day.label;
  renameDayModalStatus.textContent = '';
  renameDayModalStatus.classList.remove('shard-queue-status--error');
  renameDayModal._day = day;
  renameDayModal.hidden = false;
  renameDayInput.focus();
}

async function performToggleDayActive(day) {
  try {
    const res = await fetch(`${AUTH_API_BASE}/shard-queue/days/${day.id}`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ isActive: !day.is_active })
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    if (dayManageStatusEl) dayManageStatusEl.textContent = '';
    await refreshAll();
  } catch (err) {
    if (dayManageStatusEl) dayManageStatusEl.textContent = `Помилка: ${err.message}`;
  }
}

function toggleDayActive(day) {
  if (!day.is_active) {
    performToggleDayActive(day);
    return;
  }
  showConfirmModal({
    title: 'Анулювати день',
    text: `Анулювати день "${day.label}"? Він зникне з активних вкладок для всіх.`,
    confirmLabel: 'Анулювати',
    onConfirm: () => performToggleDayActive(day)
  });
}

// ---- Вміст вкладки ----

function renderQueueContent() {
  queueContent.innerHTML = '';
  if (!activeTab) return;
  if (activeTab.type === 'backlog') {
    renderBacklogView();
  } else if (activeTab.type === 'settings') {
    renderSettingsView();
  } else {
    renderDayView(activeTab.dayId);
  }
}

function activeEntriesFor(dayId, resourceType) {
  return entries
    .filter((e) => e.day_id === dayId && e.resource_type === resourceType && e.progress < RESOURCE_CAPS[resourceType])
    .sort((a, b) => a.priority_rank - b.priority_rank);
}

function renderDayView(dayId) {
  const day = days.find((d) => d.id === dayId);
  if (!day) return;

  ['shard', 'blood'].forEach((resourceType) => {
    queueContent.appendChild(buildResourceBlock(day, resourceType));
  });
}

// CSS .tooltipped (::after) обрізається всередині .ranking-table-wrap
// (overflow-x:auto змушує браузер обчислити overflow-y як auto теж) —
// той самий фікс, що вже є в raid-manager-detail.js.
function showBtnTooltip(el) {
  btnTooltipEl.textContent = el.getAttribute('aria-label') || '';
  btnTooltipEl.hidden = false;
  const rect = el.getBoundingClientRect();
  const tipRect = btnTooltipEl.getBoundingClientRect();
  let x = rect.left + rect.width / 2 - tipRect.width / 2;
  let y = rect.top - tipRect.height - 8;
  if (y < 0) y = rect.bottom + 8;
  x = Math.max(4, Math.min(x, window.innerWidth - tipRect.width - 4));
  btnTooltipEl.style.left = `${x}px`;
  btnTooltipEl.style.top = `${y}px`;
}

function hideBtnTooltip() {
  btnTooltipEl.hidden = true;
}

function bindTooltip(el) {
  el.addEventListener('mouseenter', () => showBtnTooltip(el));
  el.addEventListener('mouseleave', hideBtnTooltip);
  el.addEventListener('focus', () => showBtnTooltip(el));
  el.addEventListener('blur', hideBtnTooltip);
}

function playerNameCell(name) {
  const wrap = document.createElement('span');
  wrap.className = 'shard-queue-name-cell';
  if (typeof createPlayerBadge === 'function') {
    wrap.appendChild(createPlayerBadge(name));
  }
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

function buildResourceBlock(day, resourceType) {
  const section = document.createElement('section');
  section.className = 'shard-queue-resource-block';

  const heading = document.createElement('h2');
  heading.textContent = RESOURCE_LABELS[resourceType];
  section.appendChild(heading);

  const list = activeEntriesFor(day.id, resourceType);
  const cap = RESOURCE_CAPS[resourceType];

  const wrap = document.createElement('div');
  wrap.className = 'ranking-table-wrap';
  const table = document.createElement('table');
  table.className = 'raid-table';

  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th></th><th>№</th><th>Ім’я</th><th>Прогрес</th><th>Перенести на інший день</th><th></th></tr>';
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  if (!list.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'Черга порожня.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  list.forEach((entry, index) => {
    const canEdit = canEditEntry(entry);
    const tr = document.createElement('tr');
    tr.dataset.id = String(entry.id);
    if (isOfficer()) tr.draggable = true;

    const dragTd = document.createElement('td');
    if (isOfficer()) {
      dragTd.className = 'shard-queue-drag-handle';
      dragTd.textContent = '⠿';
      dragTd.title = 'Перетягни, щоб змінити порядок';
    }
    tr.appendChild(dragTd);

    const indexTd = document.createElement('td');
    indexTd.textContent = String(index + 1);
    tr.appendChild(indexTd);

    const nameTd = document.createElement('td');
    nameTd.appendChild(playerNameCell(entry.player_name));
    tr.appendChild(nameTd);

    const progressTd = document.createElement('td');
    if (canEdit) {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'shard-queue-progress-input';
      input.min = '0';
      input.max = String(cap);
      input.value = String(entry.progress);
      const commit = () => {
        let val = Math.round(Number(input.value));
        if (!Number.isFinite(val)) val = entry.progress;
        val = Math.max(0, Math.min(cap, val));
        if (val !== entry.progress) updateProgress(entry.id, val);
        else input.value = String(entry.progress);
      };
      input.addEventListener('change', commit);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') input.blur();
      });
      progressTd.appendChild(input);

      const capLabel = document.createElement('span');
      capLabel.textContent = `/${cap}`;
      progressTd.appendChild(capLabel);
    } else {
      const progressLabel = document.createElement('span');
      progressLabel.textContent = `${entry.progress}/${cap}`;
      progressTd.appendChild(progressLabel);
    }
    tr.appendChild(progressTd);

    const moveTd = document.createElement('td');
    if (canEdit && days.some((d) => d.is_active && d.id !== day.id)) {
      const chooseDayBtn = document.createElement('button');
      chooseDayBtn.type = 'button';
      chooseDayBtn.className = 'link-button-std';
      chooseDayBtn.textContent = 'Обрати день';
      chooseDayBtn.addEventListener('click', () => openMoveDayModal(entry, day));
      moveTd.appendChild(chooseDayBtn);
    }
    tr.appendChild(moveTd);

    const deleteTd = document.createElement('td');
    if (canEdit) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'account-delete-btn';
      deleteBtn.setAttribute('aria-label', 'Видалити з черги');
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
      deleteBtn.addEventListener('click', () => deleteEntry(entry));
      deleteTd.appendChild(deleteBtn);
    }
    tr.appendChild(deleteTd);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);

  if (isOfficer()) enableDragReorder(tbody, day.id, resourceType);

  section.appendChild(buildAddForms(day, resourceType));

  return section;
}

function buildAddForms(day, resourceType) {
  const wrap = document.createElement('div');
  wrap.className = 'shard-queue-add-forms';

  if (isOfficer()) {
    const form = document.createElement('form');
    form.className = 'account-form';

    const inputWrap = document.createElement('div');
    inputWrap.className = 'raid-input-wrap';
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.placeholder = "Ім'я персонажа";
    const list = document.createElement('div');
    list.className = 'raid-autocomplete-list';
    inputWrap.appendChild(input);
    inputWrap.appendChild(list);
    form.appendChild(inputWrap);

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'compare-btn';
    btn.textContent = 'Додати персонажа';
    form.appendChild(btn);

    setupNameAutocomplete(input, list, farmEligibleRosterNames);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      createEntry(day.id, resourceType, name, form);
    });

    wrap.appendChild(form);
  }

  const eligibleCharacters = userCharacters.filter(isFarmEligibleOrUnknownClass);

  if (user && eligibleCharacters.length) {
    const form = document.createElement('form');
    form.className = 'account-form';

    const select = document.createElement('select');
    eligibleCharacters.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      const color = classColorMap.get(name);
      if (color) opt.style.color = color;
      select.appendChild(opt);
    });
    const syncSelectColor = () => {
      select.style.color = classColorMap.get(select.value) || '';
    };
    syncSelectColor();
    select.addEventListener('change', syncSelectColor);
    form.appendChild(select);

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'compare-btn shard-queue-self-add-btn';
    btn.textContent = 'Додати';
    form.appendChild(btn);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      createEntry(day.id, resourceType, select.value, form);
    });

    wrap.appendChild(form);
  } else if (user && !userCharacters.length) {
    const hint = document.createElement('p');
    hint.className = 'shard-queue-hint';
    hint.innerHTML = 'Щоб записатись самому, спершу додай персонажа на сторінці <a href="../account/">"Акаунт"</a>.';
    wrap.appendChild(hint);
  } else if (user && userCharacters.length && !eligibleCharacters.length) {
    const hint = document.createElement('p');
    hint.className = 'shard-queue-hint';
    hint.textContent = 'Фармити уламки й кров можуть лише Воїни, Лицарі смерті та Паладини — серед твоїх персонажів таких немає.';
    wrap.appendChild(hint);
  }

  return wrap;
}

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

function enableDragReorder(tbody, dayId, resourceType) {
  let draggedRow = null;

  tbody.querySelectorAll('tr[draggable="true"]').forEach((row) => {
    row.addEventListener('dragstart', () => {
      draggedRow = row;
      row.classList.add('is-dragging');
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
      if (!draggedRow) return;
      draggedRow = null;
      const orderedIds = Array.from(tbody.children)
        .filter((tr) => tr.dataset.id)
        .map((tr) => Number(tr.dataset.id));
      try {
        const res = await fetch(`${AUTH_API_BASE}/shard-queue/reorder`, {
          method: 'PATCH',
          headers: authHeaders(true),
          body: JSON.stringify({ dayId, resourceType, orderedIds })
        });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        setQueueStatus('');
        await refreshAll();
      } catch (err) {
        setQueueStatus(`Помилка: ${err.message}`, true);
        await refreshAll();
      }
    });
  });
}

function renderBacklogView() {
  ['shard', 'blood'].forEach((resourceType) => {
    const section = document.createElement('section');
    section.className = 'shard-queue-resource-block shard-queue-resource-block--backlog';

    const heading = document.createElement('h2');
    heading.textContent = RESOURCE_LABELS[resourceType];
    section.appendChild(heading);

    const cap = RESOURCE_CAPS[resourceType];
    const list = entries
      .filter((e) => e.resource_type === resourceType && e.progress >= cap)
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'shard-queue-hint';
      empty.textContent = 'Ще нікого немає.';
      section.appendChild(empty);
      queueContent.appendChild(section);
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'ranking-table-wrap';
    const table = document.createElement('table');
    table.className = 'raid-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Ім’я</th><th>Прогрес</th><th>День</th><th>Дата</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    list.forEach((entry) => {
      const tr = document.createElement('tr');

      const nameTd = document.createElement('td');
      nameTd.appendChild(playerNameCell(entry.player_name));
      tr.appendChild(nameTd);

      const progressTd = document.createElement('td');
      progressTd.textContent = `${entry.progress}/${cap}`;
      tr.appendChild(progressTd);

      const dayTd = document.createElement('td');
      dayTd.textContent = dayLabel(entry.day_id);
      tr.appendChild(dayTd);

      const dateTd = document.createElement('td');
      dateTd.textContent = new Date(entry.updated_at).toLocaleDateString('uk-UA');
      tr.appendChild(dateTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    section.appendChild(wrap);
    queueContent.appendChild(section);
  });
}

// ---- Дії над записами ----

async function createEntry(dayId, resourceType, playerName, form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    const res = await fetch(`${AUTH_API_BASE}/shard-queue/entries`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ dayId, resourceType, playerName })
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    setQueueStatus('');
    await refreshAll();
  } catch (err) {
    setQueueStatus(`Помилка: ${err.message}`, true);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function updateProgress(entryId, progress) {
  try {
    const res = await fetch(`${AUTH_API_BASE}/shard-queue/entries/${entryId}/progress`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ progress })
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    setQueueStatus('');
    await refreshAll();
  } catch (err) {
    setQueueStatus(`Помилка: ${err.message}`, true);
  }
}

async function performMoveEntryDay(entry, targetDayId) {
  try {
    const res = await fetch(`${AUTH_API_BASE}/shard-queue/entries/${entry.id}/day`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ dayId: targetDayId })
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    setQueueStatus('');
    await refreshAll();
  } catch (err) {
    setQueueStatus(`Помилка: ${err.message}`, true);
  }
}

function openMoveDayModal(entry, day) {
  const otherDays = days.filter((d) => d.is_active && d.id !== day.id);
  if (!otherDays.length) return;

  moveDayModalSelect.innerHTML = '';
  otherDays.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = String(d.id);
    opt.textContent = d.label;
    moveDayModalSelect.appendChild(opt);
  });
  moveDayModalText.textContent = isOfficer()
    ? ''
    : 'Персонажа буде перенесено в кінець черги обраного дня.';
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
  const targetDayId = Number(moveDayModalSelect.value);
  moveDayModalConfirmBtn.disabled = true;
  try {
    await performMoveEntryDay(entry, targetDayId);
  } finally {
    moveDayModalConfirmBtn.disabled = false;
  }
  hideMoveDayModal();
});
moveDayModalCancelBtn.addEventListener('click', hideMoveDayModal);
moveDayModalBackdrop.addEventListener('click', hideMoveDayModal);

async function performDeleteEntry(entry) {
  try {
    const res = await fetch(`${AUTH_API_BASE}/shard-queue/entries/${entry.id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    setQueueStatus('');
    await refreshAll();
  } catch (err) {
    setQueueStatus(`Помилка: ${err.message}`, true);
  }
}

function deleteEntry(entry) {
  showConfirmModal({
    title: 'Прибрати з черги',
    text: `Прибрати "${entry.player_name}" з черги?`,
    confirmLabel: 'Прибрати',
    onConfirm: () => performDeleteEntry(entry)
  });
}

// ---- Ініціалізація ----

async function init() {
  user = await fetchCurrentUser();

  if (!user) {
    loggedOutHint.hidden = false;
    setQueueStatus('Увійди через Discord, щоб побачити чергу.');
    return;
  }

  loggedOutHint.hidden = true;

  try {
    await loadRosterSources();
    await loadOwnCharacters();
    await refreshAll();
  } catch (err) {
    setQueueStatus(`Помилка завантаження: ${err.message}`, true);
  }
}

init();
