const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const archiveSection = document.getElementById('archiveSection');
const archiveStatus = document.getElementById('archiveStatus');
const archiveBody = document.getElementById('archiveBody');
const archivePagination = document.getElementById('archivePagination');
const archivePrevBtn = document.getElementById('archivePrevBtn');
const archiveNextBtn = document.getElementById('archiveNextBtn');
const archivePageInfo = document.getElementById('archivePageInfo');
const deleteRaidOverlay = document.getElementById('deleteRaidOverlay');
const deleteRaidTitle = document.getElementById('deleteRaidTitle');
const deleteRaidConfirmBtn = document.getElementById('deleteRaidConfirmBtn');
const deleteRaidCancelBtn = document.getElementById('deleteRaidCancelBtn');

const createRaidOpenBtn = document.getElementById('createRaidOpenBtn');
const createRaidModal = document.getElementById('createRaidModal');
const createRaidModalBackdrop = document.getElementById('createRaidModalBackdrop');
const createRaidCancelBtn = document.getElementById('createRaidCancelBtn');
const createForm = document.getElementById('createRaidForm');
const raidInstanceToggle = document.getElementById('raidInstanceToggle');
const raidInstanceInput = document.getElementById('raidInstance');
const raidSoftLimitToggle = document.getElementById('raidSoftLimitToggle');
const raidSoftLimitInput = document.getElementById('raidSoftLimitTotal');
const raidTitleInput = document.getElementById('raidTitle');
const raidAllowMountSoftsInput = document.getElementById('raidAllowMountSofts');
const raidAllowMountSoftsLabel = document.getElementById('raidAllowMountSoftsLabel');
const raidLkOnlyInput = document.getElementById('raidLkOnly');
const raidLkOnlyLabel = document.getElementById('raidLkOnlyLabel');

const raidOtherInstanceField = document.getElementById('raidOtherInstanceField');
const raidOtherInstanceSelect = document.getElementById('raidOtherInstance');
const raidDifficultySelect = document.getElementById('raidDifficulty');

const TITLE_INSTANCE_ABBR_UK = {
  ICC: "ЦЛК", RS: "РС",
  NAXX: "Накс", OS: "ОС", EOE: "Око", VOA: "СА", ULD: "Ульда", TOC: "ВХ", ONY: "Оня"
};
const TITLE_DIFFICULTY_ABBR_UK = { "25H": "25ХМ", "25N": "25Н", "10H": "10ХМ", "10N": "10Н" };

const PAGE_SIZE = 20;
let currentPage = 0;
let isAdmin = false;
// Гільдійський офіцер - лише він бачить галочку "Опублікувати в Discord".
let isGuildOfficer = false;
// Видаляти будь-які рейди з архіву можуть адмін і гільдійські офіцери; решта -
// лише свої (де вони лідер).
let canDeleteRaids = false;
let myDiscordId = null;
const canDeleteRaid = (raid) => canDeleteRaids || (Boolean(myDiscordId) && raid.leader_discord_id === myDiscordId);
let titleAutoFilled = true;
const raidDateInput = document.getElementById('raidDate');
const raidTimeInput = document.getElementById('raidTime');
const DEFAULT_RAID_TIME = '20:00';

function setStatus(text) {
  archiveStatus.textContent = text;
}

function renderPagination(total) {
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  archivePagination.hidden = totalPages <= 1;
  archivePageInfo.textContent = `Сторінка ${currentPage + 1} з ${totalPages}`;
  archivePrevBtn.disabled = currentPage === 0;
  archiveNextBtn.disabled = currentPage >= totalPages - 1;
}

function renderArchiveList(raids, total) {
  archiveBody.innerHTML = '';

  const archiveTable = document.getElementById('archiveTable');
  const thead = archiveTable.querySelector('thead tr');

  const existingDeleteTh = thead.querySelector('.archive-delete-th');
  const showDeleteColumn = raids.some(canDeleteRaid);
  if (showDeleteColumn && !existingDeleteTh) {
    const th = document.createElement('th');
    th.className = 'archive-delete-th';
    thead.appendChild(th);
  } else if (!showDeleteColumn && existingDeleteTh) {
    existingDeleteTh.remove();
  }

  if (!raids.length) {
    const emptyText = listStatus === 'completed' ? 'Ще немає завершених рейдів.' : 'Немає активних чи запланованих рейдів.';
    setStatus(currentPage === 0 ? emptyText : '');
    archivePagination.hidden = true;
    return;
  }

  setStatus(listStatus === 'completed' ? `Завершених рейдів: ${total}` : `Активних і запланованих рейдів: ${total}`);
  renderPagination(total);

  raids.forEach((raid) => {
    const tr = document.createElement('tr');

    const titleTd = document.createElement('td');
    const link = document.createElement('a');
    link.className = 'archive-row-link';
    link.href = `../raid/?id=${encodeURIComponent(raid.id)}`;
    link.textContent = raid.title.replace(/\s*-\s*\d{2}\.\d{2}\.\d{4}$/, '');
    titleTd.appendChild(link);
    tr.appendChild(titleTd);

    const createdTd = document.createElement('td');
    createdTd.textContent = formatDateTimeKyiv(raidStartIso(raid));
    tr.appendChild(createdTd);

    const leaderTd = document.createElement('td');
    leaderTd.textContent = raid.leader_display_name || '—';
    tr.appendChild(leaderTd);

    const statusTd = document.createElement('td');
    statusTd.appendChild(raidStatusChip(raid));
    tr.appendChild(statusTd);

    if (showDeleteColumn) {
      const actionsTd = document.createElement('td');
      actionsTd.className = 'archive-delete-td';
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'archive-delete-btn';
      deleteBtn.setAttribute('aria-label', "Видалити рейд");
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
      if (canDeleteRaid(raid)) {
        deleteBtn.addEventListener('click', () => openConfirm(raid.id, raid.title, Number(raid.soft_count) || 0));
        actionsTd.appendChild(deleteBtn);
      }
      tr.appendChild(actionsTd);
    }

    archiveBody.appendChild(tr);
  });
}

let pendingDeleteId = null;

// Рейд із софтами - окреме попередження: софти зникнуть разом із рейдом
// (softsWord - raid-manager-shared.js).
function openConfirm(raidId, raidTitle, softCount = 0) {
  pendingDeleteId = raidId;
  deleteRaidTitle.textContent = `«${raidTitle}»`;
  const softsNote = document.getElementById('deleteRaidSofts');
  softsNote.hidden = !softCount;
  if (softCount) softsNote.textContent = `Рейд містить ${softCount} ${softsWord(softCount)} - їх буде видалено разом із рейдом.`;
  openModal(deleteRaidOverlay);
}

function closeConfirm() {
  pendingDeleteId = null;
  setModalBusy(deleteRaidOverlay, false);
  closeModal(deleteRaidOverlay);
  deleteRaidConfirmBtn.disabled = false;
}

deleteRaidCancelBtn.addEventListener('click', closeConfirm);
onModalCancel(deleteRaidOverlay, closeConfirm);

deleteRaidOverlay.addEventListener('click', (e) => {
  if (e.target === deleteRaidOverlay) closeConfirm();
});

deleteRaidConfirmBtn.addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  deleteRaidConfirmBtn.disabled = true;
  setModalBusy(deleteRaidOverlay, true);
  try {
    await apiCall('DELETE', `/raids/${encodeURIComponent(pendingDeleteId)}`, { token: getSessionToken() });
    closeConfirm();
    await loadArchive();
  } catch (err) {
    closeConfirm();
    setStatus(`Помилка видалення: ${err.message}`);
  }
});

// 'YYYY-MM-DD' + days -> 'YYYY-MM-DD' (календарна арифметика без часових поясів).
function addDaysToKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Тиждень для нумерації рейдів рахується не з понеділка, а з п'ятниці
// 04:00 за Києвом (скидання рейдових КД) - тому "тиждень" тут власний, не
// календарний. Береться тиждень обраної дати рейду, а не сьогоднішній.
function getResetWeekRange(startIso) {
  const dateKey = kyivDateKey(startIso);
  const [y, m, d] = dateKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=нд ... 5=пт
  let fridayKey = addDaysToKey(dateKey, -((weekday - 5 + 7) % 7));
  if (kyivLocalToIso(fridayKey, '04:00') > startIso) fridayKey = addDaysToKey(fridayKey, -7);
  return { from: kyivLocalToIso(fridayKey, '04:00'), to: kyivLocalToIso(addDaysToKey(fridayKey, 7), '04:00') };
}

let recentRaids = [];

async function loadRecentRaids() {
  try {
    const { raids } = await apiCall('GET', '/raids?limit=50&offset=0', { token: getSessionToken() });
    recentRaids = raids;
  } catch (err) {
    console.error(err);
    recentRaids = [];
  }
}

function selectedStartIso() {
  return kyivLocalToIso(raidDateInput.value || kyivDateKey(new Date()), raidTimeInput.value || DEFAULT_RAID_TIME);
}

function generateTitle() {
  const instance = raidInstanceInput.value;
  const difficulty = document.getElementById('raidDifficulty').value;
  const startIso = selectedStartIso();
  const [yyyy, mm, dd] = kyivDateKey(startIso).split('-');
  const { from, to } = getResetWeekRange(startIso);
  const weekRaids = recentRaids.filter((r) => {
    const iso = new Date(raidStartIso(r)).toISOString();
    return iso >= from && iso < to;
  });
  // Рейд лише на Ліча — у назві "Король-ліч" замість "ЦЛК"; номер рахується як для ЦЛК.
  const inst = instance === 'ICC' && raidLkOnlyInput.checked
    ? 'Король-ліч'
    : (TITLE_INSTANCE_ABBR_UK[instance] || instance);
  const diff = SOFT_INSTANCES.has(instance)
    ? (TITLE_DIFFICULTY_ABBR_UK[difficulty] || difficulty)
    : `${difficulty.slice(0, 2)}${difficulty.endsWith('H') ? 'ХМ' : ''}`;
  const seq = weekRaids.filter((r) => r.instance === instance && r.difficulty === difficulty).length + 1;
  return `${inst} ${diff} #${seq} - ${dd}.${mm}.${yyyy}`;
}

function updateTitleIfAuto() {
  if (titleAutoFilled) raidTitleInput.value = generateTitle();
}

// Маунти є лише в лут-каталозі ICC (Lich King, Blood-Queen) - для Ruby
// Sanctum опція не має сенсу.
function updateMountSoftsVisibility() {
  const supportsMounts = raidInstanceInput.value === 'ICC';
  // Повернулись на ЦЛК після Рубінового — маунти знову за замовчуванням увімкнені.
  if (supportsMounts && raidAllowMountSoftsLabel.hidden) raidAllowMountSoftsInput.checked = true;
  raidAllowMountSoftsLabel.hidden = !supportsMounts;
  if (!supportsMounts) raidAllowMountSoftsInput.checked = false;
  // "Тільки Король-ліч" — теж лише для ЦЛК.
  raidLkOnlyLabel.hidden = !supportsMounts;
  if (!supportsMounts) raidLkOnlyInput.checked = false;
}

function setupToggleGroup(toggleEl, hiddenInput, datasetKey, onChange) {
  toggleEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.raid-toggle-btn');
    if (!btn) return;
    hiddenInput.value = btn.dataset[datasetKey];
    toggleEl.querySelectorAll('.raid-toggle-btn').forEach((b) => {
      b.classList.toggle('raid-toggle-btn--active', b === btn);
    });
    if (onChange) onChange();
  });
}

// "Інші" - рейди без софтів (OTHER_INSTANCES, raid-manager-shared.js): сам
// рейд обирається зі списку, а поля софтів ховаються.
function applyInstanceChoice() {
  const other = raidInstanceInput.value === 'OTHER' || !SOFT_INSTANCES.has(raidInstanceInput.value);
  raidOtherInstanceField.hidden = !other;
  if (other) raidInstanceInput.value = raidOtherInstanceSelect.value;
  // Лише складності, що є в цьому рейді (героїк - ЦЛК, РС, ВХ).
  const allowed = INSTANCE_DIFFICULTIES[raidInstanceInput.value] || [];
  [...raidDifficultySelect.options].forEach((opt) => { opt.hidden = !allowed.includes(opt.value); opt.disabled = opt.hidden; });
  if (!allowed.includes(raidDifficultySelect.value)) raidDifficultySelect.value = allowed[0];
  const withSofts = SOFT_INSTANCES.has(raidInstanceInput.value);
  document.getElementById('raidSoftLimitField').hidden = !withSofts;
  document.getElementById('raidHiddenReservesLabel').hidden = !withSofts;
  document.getElementById('raidTransferField').hidden = !withSofts;
  // Вступний пункт про софт-резерв - лише для ЦЛК/РС.
  document.getElementById('raidSoftIntroItem').hidden = !withSofts;
  updateMountSoftsVisibility();
  updateTitleIfAuto();
}

setupToggleGroup(raidInstanceToggle, raidInstanceInput, 'instance', applyInstanceChoice);
raidOtherInstanceSelect.addEventListener('change', () => {
  raidInstanceInput.value = raidOtherInstanceSelect.value;
  applyInstanceChoice();
});
// Ліміт передачі не може бути більшим за ліміт софтів: зайві варіанти
// вимикаємо, а вибраний — опускаємо до ліміту софтів.
function syncTransferLimitOptions() {
  const select = document.getElementById('raidTransferWeightLimit');
  const softLimit = Number(raidSoftLimitInput.value);
  [...select.options].forEach((opt) => {
    opt.disabled = Number(opt.value) > softLimit;
  });
  if (Number(select.value) > softLimit) select.value = String(softLimit);
}

setupToggleGroup(raidSoftLimitToggle, raidSoftLimitInput, 'value', syncTransferLimitOptions);

document.getElementById('raidDifficulty').addEventListener('change', updateTitleIfAuto);
// Рейд лише на Ліча — за замовчуванням 1 софт; 2 і 3 лідер може обрати сам.
raidLkOnlyInput.addEventListener('change', () => {
  if (raidLkOnlyInput.checked) {
    raidSoftLimitInput.value = '1';
    syncTransferLimitOptions();
    raidSoftLimitToggle.querySelectorAll('.raid-toggle-btn').forEach((b) => {
      b.classList.toggle('raid-toggle-btn--active', b.dataset.value === '1');
    });
  }
  updateTitleIfAuto();
});
raidTitleInput.addEventListener('input', () => { titleAutoFilled = false; });

function applyNameLanguageToCreateForm() {
  raidInstanceToggle.querySelectorAll('.raid-toggle-btn').forEach((btn) => {
    if (btn.dataset.instance === 'OTHER') return; // "Інші" - без перекладу
    btn.textContent = translateInstance(btn.dataset.instance, INSTANCE_LABELS);
  });
  const selectedOther = raidOtherInstanceSelect.value;
  raidOtherInstanceSelect.innerHTML = '';
  OTHER_INSTANCES.forEach((code) => raidOtherInstanceSelect.add(new Option(translateInstance(code, INSTANCE_LABELS), code)));
  if (selectedOther) raidOtherInstanceSelect.value = selectedOther;
  document.getElementById('raidDifficulty').querySelectorAll('option').forEach((opt) => {
    opt.textContent = translateDifficulty(opt.value, DIFFICULTY_LABELS);
  });
  document.getElementById('raidLkOnlyText').textContent = `Тільки ${translateBoss('The Lich King')}`;
}

// dateKey - 'YYYY-MM-DD' (з календаря); без нього - сьогодні. Минулі дні
// недоступні (min), сервер теж перевіряє.
// Рейд з Discord, для якого створюється рейд на сайті (календар ->
// "Нерозпізнані рейди з Discord"): prefill { title, time, rhEventId }.
let createRhEventId = null;

async function openCreateRaidModal(dateKey, prefill = null) {
  titleAutoFilled = !prefill;
  createRhEventId = prefill ? prefill.rhEventId : null;
  // Публікувати в Discord можуть лише гільдійські офіцери (перевіряє й
  // воркер); рейд з Discord уже там є - галочка не потрібна.
  document.getElementById('raidPublishDiscordLabel').hidden = Boolean(prefill) || !isGuildOfficer;
  document.getElementById('raidPublishDiscord').checked = false;
  const today = kyivDateKey(new Date());
  raidDateInput.min = today;
  raidDateInput.value = typeof dateKey === 'string' && dateKey >= today ? dateKey : today;
  raidTimeInput.value = prefill ? prefill.time : DEFAULT_RAID_TIME;
  await loadRecentRaids();
  updateTitleIfAuto();
  if (prefill) document.getElementById('raidTitle').value = prefill.title;
  updateMountSoftsVisibility();
  openModal(createRaidModal);
}

function closeCreateRaidModal() {
  closeModal(createRaidModal);
}

createRaidOpenBtn.addEventListener('click', () => openCreateRaidModal());
raidDateInput.addEventListener('change', updateTitleIfAuto);
raidTimeInput.addEventListener('change', updateTitleIfAuto);
createRaidCancelBtn.addEventListener('click', closeCreateRaidModal);
createRaidModalBackdrop.addEventListener('click', closeCreateRaidModal);
onModalCancel(createRaidModal, closeCreateRaidModal);

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitBtn = createForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  setModalBusy(createRaidModal, true);

  try {
    const body = {
      title: document.getElementById('raidTitle').value.trim(),
      instance: document.getElementById('raidInstance').value,
      difficulty: document.getElementById('raidDifficulty').value,
      softLimitTotal: Number(document.getElementById('raidSoftLimitTotal').value),
      hiddenReserves: document.getElementById('raidHiddenReserves').checked,
      allowMountSofts: document.getElementById('raidAllowMountSofts').checked,
      lkOnly: raidLkOnlyInput.checked,
      transferWeightLimit: Number(document.getElementById('raidTransferWeightLimit').value),
      startsAt: selectedStartIso()
    };
    if (createRhEventId) body.rhEventId = createRhEventId;
    else body.publishToDiscord = document.getElementById('raidPublishDiscord').checked;

    const raid = await apiCall('POST', '/raids', { token: getSessionToken(), body });
    window.location.href = `../raid/?id=${encodeURIComponent(raid.id)}`;
  } catch (err) {
    console.error(err);
    showMessageModal(`Не вдалося створити рейд: ${err.message}`);
    submitBtn.disabled = false;
    setModalBusy(createRaidModal, false);
  }
});

// Вкладка "Рейди" - активні й заплановані (status=open), "Архів" - завершені
// (status=completed). Перемикає scripts/raid-manager-calendar.js.
let listStatus = 'open';
let listLoadedStatus = null;

function showRaidsList(status) {
  // Створювати рейд - лише з "Рейдів": в архіві кнопка зайва.
  createRaidOpenBtn.hidden = status === 'completed';
  if (status === listLoadedStatus) return;
  listStatus = status;
  currentPage = 0;
  loadArchive();
}

async function loadArchive() {
  try {
    const offset = currentPage * PAGE_SIZE;
    const status = listStatus;
    listLoadedStatus = status;
    const { raids, total } = await apiCall('GET', `/raids?limit=${PAGE_SIZE}&offset=${offset}&status=${status}`, { token: getSessionToken() });
    if (status !== listStatus) return; // встигли перемкнути вкладку
    renderArchiveList(raids, total);
  } catch (err) {
    console.error(err);
    setStatus('Не вдалося завантажити архів рейдів.');
  }
}

archivePrevBtn.addEventListener('click', () => {
  if (currentPage === 0) return;
  currentPage -= 1;
  loadArchive();
});

archiveNextBtn.addEventListener('click', () => {
  currentPage += 1;
  loadArchive();
});

async function init() {
  applyNameLanguageToCreateForm();
  loginGateBtn.href = discordLoginUrl();

  const user = await fetchCurrentUser();
  if (!user) {
    loginGate.hidden = false;
    return;
  }

  isAdmin = !!user.isAdmin;
  isGuildOfficer = !!user.isGuildOfficer;
  canDeleteRaids = isAdmin || isGuildOfficer;
  myDiscordId = user.discordId || null;

  archiveSection.hidden = false;
  // Вкладки "Рейди | Календар" - scripts/raid-manager-calendar.js.
  // Вкладка з адреси (#calendar / #archive) - сама завантажує свій список.
  initRaidsTabs(user);
}

init();
