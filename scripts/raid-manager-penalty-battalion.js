const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const battalionSection = document.getElementById('battalionSection');
const battalionStatus = document.getElementById('battalionStatus');
const battalionBody = document.getElementById('battalionBody');
const templatesStatus = document.getElementById('templatesStatus');
const templatesBody = document.getElementById('templatesBody');
const pendingPane = document.getElementById('pendingPane');
const templatesPane = document.getElementById('templatesPane');

const addPenaltyOpenBtn = document.getElementById('addPenaltyOpenBtn');
const addPenaltyModal = document.getElementById('addPenaltyModal');
const addPenaltyModalBackdrop = document.getElementById('addPenaltyModalBackdrop');
const addPenaltyCancelBtn = document.getElementById('addPenaltyCancelBtn');
const addPenaltyForm = document.getElementById('addPenaltyForm');
const penaltyPlayerNameInput = document.getElementById('penaltyPlayerName');
const penaltyPlayerNameList = document.getElementById('penaltyPlayerNameList');
const penaltyTemplateSelect = document.getElementById('penaltyTemplateSelect');
const penaltyInstanceLabel = document.getElementById('penaltyInstanceLabel');
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

setupToggleGroup(penaltyInstanceToggle, penaltyInstanceInput, 'instance');
setupToggleGroup(templateTypeToggle, templateTypeInput, 'type', applyTemplateValueLimits);

// ---- Вкладки ----

document.querySelectorAll('.raid-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.raid-tab').forEach((t) => t.classList.toggle('raid-tab--active', t === tab));
    pendingPane.hidden = tab.dataset.tab !== 'pending';
    templatesPane.hidden = tab.dataset.tab !== 'templates';
  });
});

// ---- Спільні елементи таблиць ----

function iconButton(className, label, iconHtml, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `${className} tooltipped`;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = iconHtml;
  btn.addEventListener('click', onClick);
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

function renderBattalionTable() {
  battalionBody.innerHTML = '';
  battalionStatus.textContent = battalionEntries.length
    ? `Усього записів: ${battalionEntries.length}`
    : 'Штрафбат порожній.';
  if (!battalionEntries.length) return;

  battalionEntries.forEach((entry) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.appendChild(createPlayerBadge(entry.player_name));
    nameTd.appendChild(document.createTextNode(' ' + entry.player_name));
    tr.appendChild(nameTd);

    // Старі записи (до шаблонів) без боса й шаблону — лише причина.
    tr.appendChild(textCell(entry.template_id || entry.boss ? penaltyBossLabel(entry.boss) : '—'));
    tr.appendChild(textCell(entry.reason || '—'));
    tr.appendChild(textCell(formatPenaltyValue(entry.roll_penalty, entry.soft_penalty)));
    tr.appendChild(textCell(translateInstance(entry.instance, INSTANCE_LABELS)));

    if (isOfficer) {
      const actionsTd = document.createElement('td');
      actionsTd.className = 'archive-delete-td';
      actionsTd.appendChild(iconButton('archive-delete-btn', 'Видалити', TRASH_ICON, () => {
        showConfirm('Видалити зі Штрафбату?', `${entry.player_name}: ${entry.reason || 'штраф'}`, () => deleteEntry(entry.id));
      }));
      tr.appendChild(actionsTd);
    }

    battalionBody.appendChild(tr);
  });
}

async function deleteEntry(id) {
  try {
    battalionEntries = await apiCall('DELETE', `/penalty-battalion/${id}`, { token: getSessionToken() });
    renderBattalionTable();
  } catch (err) {
    console.error(err);
    alert(`Не вдалося видалити запис: ${err.message}`);
  }
}

// Інстанс задає бос шаблону; перемикач потрібен лише для загального.
function selectedPenaltyTemplate() {
  return penaltyTemplates.find((t) => String(t.id) === penaltyTemplateSelect.value) || null;
}

function syncPenaltyInstanceVisibility() {
  const template = selectedPenaltyTemplate();
  const general = Boolean(template) && !template.boss;
  penaltyInstanceLabel.hidden = !general;
  penaltyInstanceToggle.hidden = !general;
}

penaltyTemplateSelect.addEventListener('change', syncPenaltyInstanceVisibility);

function openAddPenaltyModal() {
  if (!penaltyTemplates.length) {
    alert('Спершу створи шаблон на вкладці "Шаблони штрафів".');
    return;
  }
  addPenaltyForm.reset();
  fillPenaltyTemplateSelect(penaltyTemplateSelect, penaltyTemplates);
  setToggleValue(penaltyInstanceToggle, penaltyInstanceInput, 'instance', 'ICC');
  syncPenaltyInstanceVisibility();
  addPenaltyModal.hidden = false;
}

function closeAddPenaltyModal() {
  addPenaltyModal.hidden = true;
}

addPenaltyOpenBtn.addEventListener('click', openAddPenaltyModal);
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
    alert(`Не вдалося додати запис: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---- Шаблони штрафів ----

function renderTemplatesTable() {
  templatesBody.innerHTML = '';
  templatesStatus.textContent = penaltyTemplates.length
    ? `Усього шаблонів: ${penaltyTemplates.length}`
    : 'Шаблонів ще немає.';
  if (!penaltyTemplates.length) return;

  sortPenaltyTemplates(penaltyTemplates).forEach((template) => {
    const tr = document.createElement('tr');
    tr.appendChild(textCell(penaltyBossLabel(template.boss)));
    tr.appendChild(textCell(template.reason));
    tr.appendChild(textCell(formatTemplateValue(template)));

    if (isOfficer) {
      const actionsTd = document.createElement('td');
      actionsTd.className = 'archive-delete-td penalty-template-actions';
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

    templatesBody.appendChild(tr);
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
    alert(`Не вдалося зберегти шаблон: ${err.message}`);
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
    alert(`Не вдалося видалити шаблон: ${err.message}`);
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
