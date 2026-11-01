const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const battalionSection = document.getElementById('battalionSection');
const battalionStatus = document.getElementById('battalionStatus');
const battalionBody = document.getElementById('battalionBody');
const templatesStatus = document.getElementById('templatesStatus');
const templatesGroups = document.getElementById('templatesGroups');
const pendingPane = document.getElementById('pendingPane');
const templatesPane = document.getElementById('templatesPane');
const auditPane = document.getElementById('auditPane');
const auditFiltersEl = document.getElementById('auditFilters');
const auditListEl = document.getElementById('auditList');

const addPenaltyOpenBtn = document.getElementById('addPenaltyOpenBtn');
const addPenaltyModal = document.getElementById('addPenaltyModal');
const addPenaltyModalBackdrop = document.getElementById('addPenaltyModalBackdrop');
const addPenaltyCancelBtn = document.getElementById('addPenaltyCancelBtn');
const addPenaltyForm = document.getElementById('addPenaltyForm');
const penaltyPlayerNameInput = document.getElementById('penaltyPlayerName');
const penaltyPlayerNameList = document.getElementById('penaltyPlayerNameList');
const penaltyTemplateSelect = document.getElementById('penaltyTemplateSelect');
const penaltyInstanceToggle = document.getElementById('penaltyInstanceToggle');
const penaltyInstanceInput = document.getElementById('penaltyInstance');
const penaltyCountInput = document.getElementById('penaltyCount');

const addTemplateOpenBtn = document.getElementById('addTemplateOpenBtn');
const templateModal = document.getElementById('templateModal');
const templateModalBackdrop = document.getElementById('templateModalBackdrop');
const templateModalTitle = document.getElementById('templateModalTitle');
const templateForm = document.getElementById('templateForm');
const templateBossSelect = document.getElementById('templateBossSelect');
const templateReasonInput = document.getElementById('templateReason');
const templateTypeToggle = document.getElementById('templateTypeToggle');
const templateTypeInput = document.getElementById('templateType');
const templateValueInput = document.getElementById('templateValue');
const templateSubmitBtn = document.getElementById('templateSubmitBtn');
const templateCancelBtn = document.getElementById('templateCancelBtn');

const confirmModal = document.getElementById('confirmModal');
const confirmModalBackdrop = document.getElementById('confirmModalBackdrop');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalText = document.getElementById('confirmModalText');
const confirmModalConfirmBtn = document.getElementById('confirmModalConfirmBtn');
const confirmModalCancelBtn = document.getElementById('confirmModalCancelBtn');

const PENCIL_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"/></svg>';
const CHEVRON_ICON = '<svg class="battalion-expand-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg>';
const TRASH_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/></svg>';

// guildMemberNames читає createPlayerBadge (ui-shared.js).
let guildMemberNames = new Set();
let guildMemberNamesSorted = [];
let battalionEntries = [];
let penaltyTemplates = [];
let isOfficer = false;
let editingTemplateId = null;
let confirmAction = null;

function setGuildMemberNamesSorted(players) {
  guildMemberNamesSorted = players.map((p) => p.name).sort((a, b) => a.localeCompare(b, 'uk'));
}

// Той самий патерн, що в raid-manager-detail.js: підказки гільдії, але
// вільний текст лишається доступним (легіонера можна вписати вручну).
function setupNameAutocomplete(inputEl, listEl) {
  function closeList() {
    listEl.classList.remove('is-open');
    listEl.innerHTML = '';
  }

  function openList() {
    const query = inputEl.value.trim().toLocaleLowerCase('uk');
    const matches = query
      ? guildMemberNamesSorted.filter((name) => name.toLocaleLowerCase('uk').includes(query))
      : guildMemberNamesSorted;

    listEl.innerHTML = '';

    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'raid-autocomplete-empty';
      empty.textContent = 'Гравця гільдії не знайдено — можна вписати легіонера вручну';
      listEl.appendChild(empty);
    } else {
      matches.forEach((name) => {
        const item = document.createElement('div');
        item.className = 'raid-autocomplete-item';
        item.appendChild(createPlayerBadge(name));
        item.appendChild(document.createTextNode(name));
        item.addEventListener('mousedown', (event) => {
          event.preventDefault();
          inputEl.value = name;
          closeList();
        });
        listEl.appendChild(item);
      });
    }

    listEl.classList.add('is-open');
  }

  inputEl.addEventListener('input', openList);
  inputEl.addEventListener('focus', openList);
  inputEl.addEventListener('blur', () => setTimeout(closeList, 100));
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeList();
  });
}

setupNameAutocomplete(penaltyPlayerNameInput, penaltyPlayerNameList);

function setupToggleGroup(toggleEl, hiddenInput, datasetKey, onChange) {
  toggleEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.raid-toggle-btn');
    if (!btn) return;
    setToggleValue(toggleEl, hiddenInput, datasetKey, btn.dataset[datasetKey]);
    if (onChange) onChange();
  });
}

function setToggleValue(toggleEl, hiddenInput, datasetKey, value) {
  hiddenInput.value = value;
  toggleEl.querySelectorAll('.raid-toggle-btn').forEach((b) => {
    b.classList.toggle('raid-toggle-btn--active', b.dataset[datasetKey] === value);
  });
}

setupToggleGroup(penaltyInstanceToggle, penaltyInstanceInput, 'instance', () => fillPenaltyTemplatesForInstance());
setupToggleGroup(templateTypeToggle, templateTypeInput, 'type', applyTemplateValueLimits);

// ---- Вкладки ----

document.querySelectorAll('.raid-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.raid-tab').forEach((t) => t.classList.toggle('raid-tab--active', t === tab));
    pendingPane.hidden = tab.dataset.tab !== 'pending';
    templatesPane.hidden = tab.dataset.tab !== 'templates';
    auditPane.hidden = tab.dataset.tab !== 'audit';
    // Історію завжди перечитуємо: зміни могли щойно статися на інших вкладках.
    if (tab.dataset.tab === 'audit') reloadAudit();
  });
});

// ---- Спільні елементи таблиць ----

// Підказка — JS (#raidBtnTooltip, bindTooltip), а не CSS .tooltipped: кнопки
// стоять в останній колонці таблиці з overflow-x:auto, і невидимий
// .tooltipped::after розширював область прокрутки — з'являвся скролбар.
function iconButton(className, label, iconHtml, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = iconHtml;
  bindTooltip(btn);
  btn.addEventListener('click', () => {
    hideBtnTooltip();
    onClick();
  });
  return btn;
}

function emptyRow(tbody, colSpan, text) {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = colSpan;
  td.textContent = text;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function textCell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function showConfirm(title, text, action) {
  confirmModalTitle.textContent = title;
  confirmModalText.textContent = text;
  confirmAction = action;
  confirmModal.hidden = false;
}

function hideConfirm() {
  confirmModal.hidden = true;
  confirmAction = null;
}

confirmModalConfirmBtn.addEventListener('click', async () => {
  if (!confirmAction) return;
  confirmModalConfirmBtn.disabled = true;
  try {
    await confirmAction();
  } finally {
    confirmModalConfirmBtn.disabled = false;
    hideConfirm();
  }
});
confirmModalCancelBtn.addEventListener('click', hideConfirm);
confirmModalBackdrop.addEventListener('click', hideConfirm);

// ---- Відкладені штрафи ----

// Розгорнуті картки ("гравець|інстанс") — переживають перемальовування.
const expandedBattalionRows = new Set();

// Один рядок на гравця в кожному інстансі: штрафи застосовуються в рейді
// саме цього інстансу, тож і суми рахуємо окремо.
function groupBattalionEntries() {
  const groups = new Map();
  battalionEntries.forEach((entry) => {
    const key = `${entry.player_name}|${entry.instance}`;
    if (!groups.has(key)) {
      groups.set(key, { key, playerName: entry.player_name, instance: entry.instance, rollPenalty: 0, softPenalty: 0, entries: [] });
    }
    const group = groups.get(key);
    group.rollPenalty += entry.roll_penalty || 0;
    group.softPenalty += entry.soft_penalty || 0;
    group.entries.push(entry);
  });
  const instanceRank = (instance) => (instance === 'ICC' ? 0 : 1);
  return [...groups.values()].sort((a, b) =>
    a.playerName.localeCompare(b.playerName, 'uk') || instanceRank(a.instance) - instanceRank(b.instance));
}

function renderBattalionTable() {
  battalionBody.innerHTML = '';
  const groups = groupBattalionEntries();
  const playerCount = new Set(groups.map((g) => g.playerName)).size;
  battalionStatus.textContent = playerCount
    ? `Усього гравців: ${playerCount}`
    : 'Штрафбат порожній.';
  if (!groups.length) return;

  const colCount = isOfficer ? 5 : 4;
  groups.forEach((group) => {
    const expanded = expandedBattalionRows.has(group.key);

    const tr = document.createElement('tr');
    tr.className = 'battalion-summary-row';
    if (expanded) tr.classList.add('battalion-summary-row--expanded');

    const nameTd = document.createElement('td');
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'battalion-expand-btn';
    toggleBtn.setAttribute('aria-expanded', String(expanded));
    toggleBtn.innerHTML = CHEVRON_ICON;
    toggleBtn.appendChild(createPlayerBadge(group.playerName));
    toggleBtn.appendChild(document.createTextNode(group.playerName));
    nameTd.appendChild(toggleBtn);
    tr.appendChild(nameTd);

    tr.appendChild(penaltyTotalCell(group.rollPenalty));
    tr.appendChild(penaltyTotalCell(group.softPenalty));
    tr.appendChild(textCell(translateInstance(group.instance, INSTANCE_LABELS)));

    if (isOfficer) {
      const actionsTd = document.createElement('td');
      actionsTd.className = 'archive-delete-td';
      // Клік по кошику не має розгортати рядок.
      actionsTd.addEventListener('click', (event) => event.stopPropagation());
      actionsTd.appendChild(iconButton('archive-delete-btn', 'Видалити всі штрафи', TRASH_ICON, () => {
        showConfirm(
          'Видалити зі Штрафбату?',
          `Усі штрафи ${group.playerName} (${group.entries.length}) для інстансу ${translateInstance(group.instance, INSTANCE_LABELS)}.`,
          () => deleteEntries(group.entries.map((e) => e.id))
        );
      }));
      tr.appendChild(actionsTd);
    }

    // Розгортання — клік будь-де в рядку; кнопка з ім'ям дає те саме з клавіатури.
    tr.addEventListener('click', () => {
      if (expandedBattalionRows.has(group.key)) expandedBattalionRows.delete(group.key);
      else expandedBattalionRows.add(group.key);
      renderBattalionTable();
    });
    battalionBody.appendChild(tr);

    if (expanded) battalionBody.appendChild(buildBattalionCard(group, colCount));
  });
}

// Картка гравця — чіпи штрафів, як на вкладці "Штрафи" рейду.
function buildBattalionCard(group, colCount) {
  const tr = document.createElement('tr');
  tr.className = 'battalion-card-row';
  const td = document.createElement('td');
  td.colSpan = colCount;

  const list = document.createElement('div');
  list.className = 'penalty-chip-list';
  group.entries.forEach((entry) => {
    list.appendChild(buildPenaltyChip(entry, isOfficer ? () => deleteEntries([entry.id]) : null));
  });
  if (isOfficer) {
    list.appendChild(buildPenaltyAddButton(() => openAddPenaltyModal(group.playerName, group.instance)));
  }

  td.appendChild(list);
  tr.appendChild(td);
  return tr;
}

// Видаляє записи по одному (наявний DELETE); у відповідь — актуальний список.
async function deleteEntries(ids) {
  try {
    for (const id of ids) {
      battalionEntries = await apiCall('DELETE', `/penalty-battalion/${id}`, { token: getSessionToken() });
    }
  } catch (err) {
    console.error(err);
    showMessageModal(`Не вдалося видалити запис: ${err.message}`);
  }
  renderBattalionTable();
}

// Список штрафів — загальні шаблони і шаблони босів обраного інстансу.
function fillPenaltyTemplatesForInstance() {
  const count = fillPenaltyTemplateSelect(penaltyTemplateSelect, penaltyTemplates, penaltyInstanceInput.value);
  addPenaltyForm.querySelector('button[type="submit"]').disabled = count === 0;
}

// "+" у картці гравця відкриває форму з його ім'ям та інстансом.
function openAddPenaltyModal(playerName = '', instance = 'ICC') {
  if (!penaltyTemplates.length) {
    showMessageModal('Спершу створи шаблон на вкладці "Шаблони штрафів".');
    return;
  }
  addPenaltyForm.reset();
  penaltyPlayerNameInput.value = playerName;
  setToggleValue(penaltyInstanceToggle, penaltyInstanceInput, 'instance', instance);
  fillPenaltyTemplatesForInstance();
  addPenaltyModal.hidden = false;
}

function closeAddPenaltyModal() {
  addPenaltyModal.hidden = true;
}

addPenaltyOpenBtn.addEventListener('click', () => openAddPenaltyModal());
addPenaltyCancelBtn.addEventListener('click', closeAddPenaltyModal);
addPenaltyModalBackdrop.addEventListener('click', closeAddPenaltyModal);

addPenaltyForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitBtn = addPenaltyForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const body = {
      playerName: penaltyPlayerNameInput.value.trim(),
      templateId: Number(penaltyTemplateSelect.value),
      instance: penaltyInstanceInput.value,
      count: Number(penaltyCountInput.value)
    };

    battalionEntries = await apiCall('POST', '/penalty-battalion', { token: getSessionToken(), body });
    renderBattalionTable();
    closeAddPenaltyModal();
  } catch (err) {
    console.error(err);
    showMessageModal(`Не вдалося додати запис: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---- Шаблони штрафів ----

// Кожен тип штрафу (загальний / бос) — окрема секція, як боси на вкладці
// "Предмети" сторінки рейду: рядок-заголовок і шаблони під ним.
function renderTemplatesTable() {
  templatesGroups.innerHTML = '';
  templatesStatus.textContent = penaltyTemplates.length
    ? `Усього шаблонів: ${penaltyTemplates.length}`
    : 'Шаблонів ще немає.';
  if (!penaltyTemplates.length) return;

  const groups = new Map();
  sortPenaltyTemplates(penaltyTemplates).forEach((template) => {
    const key = template.boss || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(template);
  });

  groups.forEach((templates, boss) => {
    const wrap = document.createElement('div');
    wrap.className = 'ranking-table-wrap';
    const table = document.createElement('table');
    table.className = 'raid-table penalty-template-table';

    // Ширини колонок задає <colgroup>: рядок-заголовок іде через colspan і
    // при table-layout:fixed сам їх не визначає.
    const colgroup = document.createElement('colgroup');
    ['penalty-col-reason', 'penalty-col-value', ...(isOfficer ? ['penalty-col-actions'] : [])].forEach((cls) => {
      const col = document.createElement('col');
      col.className = cls;
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const tbody = document.createElement('tbody');
    const headRow = document.createElement('tr');
    headRow.className = 'penalty-group-head';
    const headCell = document.createElement('td');
    headCell.colSpan = isOfficer ? 3 : 2;
    headCell.textContent = penaltyBossLabel(boss || null);
    headRow.appendChild(headCell);
    tbody.appendChild(headRow);

    templates.forEach((template) => {
      const tr = document.createElement('tr');
      tr.appendChild(textCell(template.reason));
      tr.appendChild(textCell(formatTemplateValue(template)));

      if (isOfficer) {
        const actionsTd = document.createElement('td');
        actionsTd.className = 'penalty-template-actions';
        actionsTd.appendChild(iconButton('archive-delete-btn penalty-edit-btn', 'Редагувати', PENCIL_ICON, () => openTemplateModal(template)));
        actionsTd.appendChild(iconButton('archive-delete-btn', 'Видалити', TRASH_ICON, () => {
          showConfirm(
            'Видалити шаблон?',
            `${penaltyBossLabel(template.boss)}: ${template.reason}. Уже застосовані штрафи лишаться без змін.`,
            () => deleteTemplate(template.id)
          );
        }));
        tr.appendChild(actionsTd);
      }

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    templatesGroups.appendChild(wrap);
  });
}

function fillTemplateBossSelect() {
  templateBossSelect.innerHTML = '';
  const general = document.createElement('option');
  general.value = '';
  general.textContent = 'Загальний (без боса)';
  templateBossSelect.appendChild(general);

  [['ICC', ICC_BOSSES], ['RS', RS_BOSSES]].forEach(([instance, bosses]) => {
    const group = document.createElement('optgroup');
    group.label = translateInstance(instance, INSTANCE_LABELS);
    bosses.forEach((boss) => {
      const opt = document.createElement('option');
      opt.value = boss;
      opt.textContent = translateBoss(boss);
      group.appendChild(opt);
    });
    templateBossSelect.appendChild(group);
  });
}

// Мінус до ролу — 5..100 кроком 5, мінус до софту — 1..3.
function applyTemplateValueLimits() {
  const roll = templateTypeInput.value === 'roll';
  templateValueInput.min = roll ? '5' : '1';
  templateValueInput.max = roll ? '100' : '3';
  templateValueInput.step = roll ? '5' : '1';
  const value = Number(templateValueInput.value);
  if (!value || value < Number(templateValueInput.min) || value > Number(templateValueInput.max) || value % Number(templateValueInput.step)) {
    templateValueInput.value = roll ? '5' : '1';
  }
}

function openTemplateModal(template = null) {
  editingTemplateId = template ? template.id : null;
  templateModalTitle.textContent = template ? 'Редагувати шаблон' : 'Новий шаблон';
  templateSubmitBtn.textContent = template ? 'Зберегти' : 'Створити';
  templateBossSelect.value = template?.boss || '';
  templateReasonInput.value = template?.reason || '';
  setToggleValue(templateTypeToggle, templateTypeInput, 'type', template?.penalty_type || 'roll');
  templateValueInput.value = template ? String(template.value) : '';
  applyTemplateValueLimits();
  templateModal.hidden = false;
}

function closeTemplateModal() {
  templateModal.hidden = true;
}

addTemplateOpenBtn.addEventListener('click', () => openTemplateModal());
templateCancelBtn.addEventListener('click', closeTemplateModal);
templateModalBackdrop.addEventListener('click', closeTemplateModal);

templateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  templateSubmitBtn.disabled = true;

  try {
    const body = {
      boss: templateBossSelect.value || null,
      reason: templateReasonInput.value.trim(),
      penaltyType: templateTypeInput.value,
      value: Number(templateValueInput.value)
    };
    penaltyTemplates = editingTemplateId
      ? await apiCall('PUT', `/penalty-templates/${editingTemplateId}`, { token: getSessionToken(), body })
      : await apiCall('POST', '/penalty-templates', { token: getSessionToken(), body });
    renderTemplatesTable();
    closeTemplateModal();
  } catch (err) {
    console.error(err);
    showMessageModal(`Не вдалося зберегти шаблон: ${err.message}`);
  } finally {
    templateSubmitBtn.disabled = false;
  }
});

async function deleteTemplate(id) {
  try {
    penaltyTemplates = await apiCall('DELETE', `/penalty-templates/${id}`, { token: getSessionToken() });
    renderTemplatesTable();
  } catch (err) {
    console.error(err);
    showMessageModal(`Не вдалося видалити шаблон: ${err.message}`);
  }
}

// ---- Історія змін (шаблони й відкладені штрафи) ----

const AUDIT_PAGE_SIZE = 20;
const AUDIT_ACTION_OPTIONS = [
  ['template_create', 'Створення шаблону'],
  ['template_update', 'Зміна шаблону'],
  ['template_delete', 'Видалення шаблону'],
  ['battalion_add', 'Додано у Штрафбат'],
  ['battalion_delete', 'Прибрано зі Штрафбату'],
  ['battalion_apply', 'Застосовано в рейді']
];

const auditFilter = { from: '', to: '', actor: '', action: '' };
let auditEntries = [];
let auditActors = [];
let auditPage = 0;
let auditRequestSeq = 0;

// Зсув часу Києва від UTC (мс) у момент ts — з урахуванням переходу на літній час.
function kyivOffsetMs(ts) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Kyiv', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(ts));
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - ts;
}

// Північ дати "YYYY-MM-DD" (+dayShift днів) за Києвом — як ISO-момент в UTC.
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
  if (auditFilter.action) params.set('action', auditFilter.action);
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function loadAudit() {
  const seq = ++auditRequestSeq;
  try {
    const data = await apiCall('GET', `/penalty-templates/audit${auditQueryString()}`, { token: getSessionToken() });
    // Швидко змінені фільтри: застарілу відповідь відкидаємо.
    if (seq !== auditRequestSeq) return false;
    auditEntries = data.entries;
    auditActors = data.actors;
    auditPage = 0;
    return true;
  } catch (err) {
    if (seq === auditRequestSeq) showMessageModal(`Не вдалося завантажити історію: ${err.message}`);
    return false;
  }
}

async function reloadAudit() {
  if (await loadAudit()) {
    buildAuditFilters();
    renderAuditList();
  }
}

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

// Рядок фільтрів будується один раз на відкриття вкладки; зміна фільтра
// перемальовує лише список — інакше поле дати губило б фокус.
function buildAuditFilters() {
  auditFiltersEl.innerHTML = '';
  const fromInput = filterDate(auditFilter.from);
  const toInput = filterDate(auditFilter.to);
  const actorNames = auditFilter.actor && !auditActors.includes(auditFilter.actor)
    ? [auditFilter.actor, ...auditActors]
    : auditActors;
  const actorSelect = filterSelect(auditFilter.actor, 'Усі', actorNames.map((n) => [n, n]));
  const actionSelect = filterSelect(auditFilter.action, 'Усі події', AUDIT_ACTION_OPTIONS);
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'link-button-std';
  resetBtn.textContent = 'Скинути';
  resetBtn.addEventListener('click', () => {
    fromInput.value = toInput.value = actorSelect.value = actionSelect.value = '';
    applyFilters();
  });

  async function applyFilters() {
    auditFilter.from = fromInput.value;
    auditFilter.to = toInput.value;
    auditFilter.actor = actorSelect.value;
    auditFilter.action = actionSelect.value;
    resetBtn.disabled = !Object.values(auditFilter).some(Boolean);
    if (await loadAudit()) renderAuditList();
  }

  [fromInput, toInput, actorSelect, actionSelect].forEach((el) => el.addEventListener('change', applyFilters));
  resetBtn.disabled = !Object.values(auditFilter).some(Boolean);

  auditFiltersEl.append(
    filterField('З', fromInput),
    filterField('По', toInput),
    filterField('Хто', actorSelect),
    filterField('Подія', actionSelect),
    resetBtn
  );
}

// Шаблон / штраф одним рядком: "Халіон — Смерть від леза (−5 до ролу)".
function describePenalty(d) {
  const value = d.penaltyType
    ? formatTemplateValue({ penalty_type: d.penaltyType, value: d.value })
    : formatPenaltyValue(d.rollPenalty, d.softPenalty);
  return `${penaltyBossLabel(d.boss)} — ${d.reason} (${value})`;
}

// Лише змінені параметри шаблону: "значення −5 → −10 до ролу".
function describeTemplateChanges(before, after) {
  const changes = [];
  if ((before.boss || null) !== (after.boss || null)) {
    changes.push(`бос ${penaltyBossLabel(before.boss)} → ${penaltyBossLabel(after.boss)}`);
  }
  if (before.reason !== after.reason) changes.push(`причина "${before.reason}" → "${after.reason}"`);
  if (before.penaltyType !== after.penaltyType || before.value !== after.value) {
    const fmt = (t) => formatTemplateValue({ penalty_type: t.penaltyType, value: t.value });
    changes.push(`штраф ${fmt(before)} → ${fmt(after)}`);
  }
  return changes.join('; ') || 'без змін';
}

function describeAuditAction(entry) {
  const d = entry.detail || {};
  const instance = d.instance ? `, ${translateInstance(d.instance, INSTANCE_LABELS)}` : '';
  switch (entry.action) {
    case 'template_create': return `створив шаблон: ${describePenalty(d)}`;
    case 'template_update': return `змінив шаблон ${penaltyBossLabel(d.before.boss)} — ${d.before.reason}: ${describeTemplateChanges(d.before, d.after)}`;
    case 'template_delete': return `видалив шаблон: ${describePenalty(d)}`;
    case 'battalion_add': return `додав у Штрафбат ${d.playerName}: ${describePenalty(d)}${d.count > 1 ? ` ×${d.count}` : ''}${instance}`;
    case 'battalion_delete': return `прибрав зі Штрафбату ${d.playerName}: ${describePenalty(d)}${instance}`;
    case 'battalion_apply': return `штраф ${d.playerName} застосовано в рейді "${d.raidTitle}": ${describePenalty(d)}`;
    default: return entry.action;
  }
}

function renderAuditList() {
  auditListEl.innerHTML = '';

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
  auditListEl.appendChild(list);

  if (totalPages > 1) {
    const pagination = document.createElement('div');
    pagination.className = 'raid-pagination';
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'link-button-std';
    prevBtn.textContent = '← Попередня';
    prevBtn.disabled = auditPage === 0;
    prevBtn.addEventListener('click', () => { auditPage -= 1; renderAuditList(); });
    const info = document.createElement('span');
    info.textContent = `Сторінка ${auditPage + 1} з ${totalPages}`;
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'link-button-std';
    nextBtn.textContent = 'Наступна →';
    nextBtn.disabled = auditPage >= totalPages - 1;
    nextBtn.addEventListener('click', () => { auditPage += 1; renderAuditList(); });
    pagination.append(prevBtn, info, nextBtn);
    auditListEl.appendChild(pagination);
  }
}

function applyNameLanguageToForm() {
  penaltyInstanceToggle.querySelectorAll('.raid-toggle-btn').forEach((btn) => {
    btn.textContent = translateInstance(btn.dataset.instance, INSTANCE_LABELS);
  });
  fillTemplateBossSelect();
}

async function init() {
  applyNameLanguageToForm();
  loginGateBtn.href = discordLoginUrl();

  const user = await fetchCurrentUser();
  if (!user) {
    loginGate.hidden = false;
    return;
  }

  // Сторінку бачать усі залогінені гравці; змінювати — лише офіцери гільдії.
  isOfficer = Boolean(user.isGuildOfficer);
  addPenaltyOpenBtn.hidden = !isOfficer;
  addTemplateOpenBtn.hidden = !isOfficer;
  document.querySelectorAll('.officer-only').forEach((el) => { el.hidden = !isOfficer; });
  battalionSection.hidden = false;

  const playersPromise = fetch('/data/players.json?t=' + Date.now())
    .then((res) => (res.ok ? res.json() : []))
    .catch(() => []);
  const entriesPromise = apiCall('GET', '/penalty-battalion', { token: getSessionToken() }).catch((err) => {
    console.error(err);
    battalionStatus.textContent = 'Не вдалося завантажити Штрафбат.';
    return null;
  });
  const templatesPromise = apiCall('GET', '/penalty-templates', { token: getSessionToken() }).catch((err) => {
    console.error(err);
    templatesStatus.textContent = 'Не вдалося завантажити шаблони.';
    return null;
  });

  const [players, entries, templates] = await Promise.all([playersPromise, entriesPromise, templatesPromise]);
  guildMemberNames = new Set(players.map((p) => p.name));
  setGuildMemberNamesSorted(players);

  if (templates) {
    penaltyTemplates = templates;
    renderTemplatesTable();
  }
  if (entries) {
    battalionEntries = entries;
    renderBattalionTable();
  }
}

init();
