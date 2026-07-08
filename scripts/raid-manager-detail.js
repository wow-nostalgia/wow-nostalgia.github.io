const raidTitleHeading = document.getElementById('raidTitleHeading');
const raidSettingsBanner = document.getElementById('raidSettingsBanner');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const copyLinkTooltip = document.getElementById('copyLinkTooltip');
const lockToggleBtn = document.getElementById('lockToggleBtn');
const statusToggleBtn = document.getElementById('statusToggleBtn');
const raidStatus = document.getElementById('raidStatus');
const raidTabs = document.querySelectorAll('.raid-tab');
const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const raidContent = document.getElementById('raidContent');

const softForm = document.getElementById('softForm');
const softPlayerNameInput = document.getElementById('softPlayerName');
const noCharactersHint = document.getElementById('noCharactersHint');
const softBoss = document.getElementById('softBoss');
const softItem = document.getElementById('softItem');
const softItemTrigger = document.getElementById('softItemTrigger');
const softItemList = document.getElementById('softItemList');
const softWeight = document.getElementById('softWeight');
const softWeightToggle = document.getElementById('softWeightToggle');

const officerPanel = document.getElementById('officerPanel');
const hiddenReservesToggle = document.getElementById('hiddenReservesToggle');
const hiddenReservesNotice = document.getElementById('hiddenReservesNotice');
const officerAssignForm = document.getElementById('officerAssignForm');
const assignPlayerNameInput = document.getElementById('assignPlayerName');
const assignPlayerNameClear = document.getElementById('assignPlayerNameClear');
const assignPlayerNameList = document.getElementById('assignPlayerNameList');
const assignBoss = document.getElementById('assignBoss');
const assignItem = document.getElementById('assignItem');
const assignItemTrigger = document.getElementById('assignItemTrigger');
const assignItemList = document.getElementById('assignItemList');
const assignWeight = document.getElementById('assignWeight');
const assignWeightToggle = document.getElementById('assignWeightToggle');

const officersTab = document.getElementById('officersTab');
const officersList = document.getElementById('officersList');
const addOfficerSection = document.getElementById('addOfficerSection');
const addOfficerInput = document.getElementById('addOfficerInput');
const addOfficerList = document.getElementById('addOfficerList');

const playersPane = document.getElementById('playersPane');
const raidPlayersBody = document.getElementById('raidPlayersBody');

const auditPane = document.getElementById('auditPane');
const auditListEl = document.getElementById('auditList');

const officersPane = document.getElementById('officersPane');

const settingsTab = document.getElementById('settingsTab');
const settingsPane = document.getElementById('settingsPane');
const settingsForm = document.getElementById('settingsForm');
const settingsTitleInput = document.getElementById('settingsTitleInput');
const settingsSoftLimitInput = document.getElementById('settingsSoftLimitInput');

const itemsPane = document.getElementById('itemsPane');
const itemsBossFilter = document.getElementById('itemsBossFilter');
const itemsSoftedOnlyCheckbox = document.getElementById('itemsSoftedOnly');
const raidItemsBody = document.getElementById('raidItemsBody');

const penaltiesPane = document.getElementById('penaltiesPane');
const raidPenaltiesBody = document.getElementById('raidPenaltiesBody');

const itemTooltipEl = document.getElementById('raidItemTooltip');

const transferModal = document.getElementById('transferModal');
const transferModalBackdrop = document.getElementById('transferModalBackdrop');
const transferModalText = document.getElementById('transferModalText');
const transferToPlayerRow = document.getElementById('transferToPlayerRow');
const transferToPlayerSelect = document.getElementById('transferToPlayerSelect');
const transferConfirmBtn = document.getElementById('transferConfirmBtn');
const transferCancelModalBtn = document.getElementById('transferCancelModalBtn');
const transferWeightBtn = document.getElementById('transferWeightBtn');
const cancelTransferModal = document.getElementById('cancelTransferModal');
const cancelTransferModalBackdrop = document.getElementById('cancelTransferModalBackdrop');
const cancelTransferModalText = document.getElementById('cancelTransferModalText');
const cancelTransferConfirmBtn = document.getElementById('cancelTransferConfirmBtn');
const cancelTransferCancelBtn = document.getElementById('cancelTransferCancelBtn');
const transferNotice = document.getElementById('transferNotice');
const bonusPoolBanner = document.getElementById('bonusPoolBanner');
const transferWeightLimitInput = document.getElementById('transferWeightLimitInput');
let currentTooltipItemId = null;

let raidId = null;
let raid = null;
let currentUser = null;
let myCharacters = [];
let raidOfficerIds = new Set();
let itemsCatalog = {};
let guildMemberNames = new Set();
let guildMemberNamesSorted = [];
let characterOwnerNames = new Map();
let personalAnalyticsNames = new Set();
let reserves = [];
let weightTransfers = [];
let penaltiesList = [];
let classColorMap = new Map();
let auditEntries = [];
let activeTab = 'players';

function setStatus(text, type = 'info') {
  raidStatus.innerHTML = '';
  if (!text) return;

  const chip = document.createElement('span');
  chip.className = `raid-status-chip raid-status-chip--${type}`;
  chip.textContent = text;
  raidStatus.appendChild(chip);
}

function isLeader() {
  return Boolean(currentUser) && currentUser.discordId === raid.leader_discord_id;
}

function isOfficerMode() {
  return Boolean(currentUser) && (isLeader() || raidOfficerIds.has(currentUser.discordId));
}

function isRaidCompleted() {
  return raid.status === 'completed';
}

function canManage(playerName) {
  if (isOfficerMode()) return true;
  if (!currentUser) return false;
  return reserves.some((r) => r.player_name === playerName && r.discord_id === currentUser.discordId);
}

function createPlayerBadge(name) {
  const isGuild = guildMemberNames.has(name);
  const badge = document.createElement('span');
  badge.className = `player-badge ${isGuild ? 'player-badge--guild' : 'player-badge--legion'}`;
  badge.title = isGuild ? 'Ностальгія' : 'Легіонер';
  badge.textContent = isGuild ? 'N' : 'L';
  return badge;
}

function findItemInfo(itemId, boss) {
  const modes = itemsCatalog[boss]?.[raid.difficulty] || [];
  return modes.find((i) => i.id === itemId);
}

function bossesWithCatalog() {
  return bossesForInstance(raid.instance).filter((b) => itemsCatalog[b]);
}

function buildFlatItemList() {
  const flat = [];
  bossesWithCatalog().forEach((boss) => {
    const items = (itemsCatalog[boss] || {})[raid.difficulty] || [];
    items.forEach((item) => flat.push({ ...item, boss }));
  });
  return flat;
}

function renderBanner() {
  raidSettingsBanner.innerHTML = '';

  const chips = [
    translateInstance(raid.instance, INSTANCE_LABELS),
    translateDifficulty(raid.difficulty, DIFFICULTY_LABELS),
    `Ліміт ваги: ${raid.soft_limit_total}`,
    `Лідер: ${raid.leader_display_name || '—'}`
  ];

  chips.forEach((text) => {
    const span = document.createElement('span');
    span.className = 'raid-chip';
    span.textContent = text;
    raidSettingsBanner.appendChild(span);
  });

  const isCompleted = raid.status === 'completed';
  const statusChip = document.createElement('span');
  statusChip.className = `raid-chip raid-chip--${isCompleted ? 'completed' : 'active'}`;
  statusChip.textContent = isCompleted ? 'Завершений' : 'Активний';
  raidSettingsBanner.appendChild(statusChip);

  lockToggleBtn.hidden = !isOfficerMode();
  lockToggleBtn.textContent = raid.is_locked ? '🔒 Розблокувати рейд' : '🔓 Заблокувати рейд';
  lockToggleBtn.classList.toggle('link-button-std--danger', raid.is_locked);

  statusToggleBtn.hidden = !isOfficerMode();
  statusToggleBtn.textContent = isCompleted ? '↩ Реактивувати рейд' : '✅ Завершити рейд';

  hiddenReservesToggle.checked = Boolean(raid.hidden_reserves);
  hiddenReservesNotice.hidden = !(raid.hidden_reserves && !isOfficerMode());

  settingsTab.hidden = !isLeader();
  settingsTitleInput.value = raid.title;
  settingsSoftLimitInput.value = raid.soft_limit_total;

  const tl = raid.transfer_weight_limit;
  transferWeightLimitInput.value = (tl === null || tl === undefined || tl > 3) ? '0' : String(tl);

  applyWeightLimits();
  applySoftFormLockState();
  applyOfficerFormLockState();
  applySettingsFormLockState();
}

function myCharNames() {
  return myCharacters.map((c) => c.characterName);
}

function getMyTransfer() {
  const names = myCharNames();
  return weightTransfers.find((t) => names.includes(t.from_player)) || null;
}

function getMyReceivedTransfer() {
  const names = myCharNames();
  return weightTransfers.find((t) => names.includes(t.to_player)) || null;
}

// Лок блокує самософт лише для звичайних гравців — офіцери/лідер обходять
// лок на бекенді (reserves.js). Завершення рейду (isRaidCompleted) блокує
// форму для всіх без винятку, включно з лідером/офіцерами.
function applySoftFormLockState() {
  const myTransfer = getMyTransfer();
  const locked = isRaidCompleted() || (raid.is_locked && !isOfficerMode()) || Boolean(myTransfer);

  softPlayerNameInput.disabled = locked || !myCharacters.length;
  softBoss.disabled = locked;
  softItemTrigger.disabled = locked;
  softForm.querySelector('button[type="submit"]').disabled = locked;

  softWeightToggle.querySelectorAll('.raid-weight-toggle-btn').forEach((btn) => {
    btn.disabled = locked || Number(btn.dataset.weight) > raid.soft_limit_total;
  });

  const transfersEnabled = (raid.transfer_weight_limit ?? 0) !== 0;
  const myReceived = getMyReceivedTransfer();
  const canShowTransferBtn = currentUser && transfersEnabled && !isRaidCompleted() && !myTransfer && !myReceived && myCharNames().length > 0;
  transferWeightBtn.hidden = !canShowTransferBtn;

  if (myTransfer) {
    transferNotice.hidden = false;
    transferNotice.textContent = `Софти передано гравцю ${myTransfer.to_player}. Додавати власні софти неможливо. `;
    if (!isRaidCompleted()) {
      const cancelLink = document.createElement('button');
      cancelLink.type = 'button';
      cancelLink.className = 'raid-transfer-cancel-link';
      cancelLink.textContent = 'Скасувати';
      cancelLink.addEventListener('click', () => deleteTransfer(myTransfer.from_player));
      transferNotice.appendChild(cancelLink);
    }
  } else {
    if (myReceived) {
      transferNotice.hidden = false;
      transferNotice.textContent = `Ти отримав софт від ${myReceived.from_player}. Розподіли його на вкладці «Предмети».`;
    } else {
      transferNotice.hidden = true;
    }
  }
}

// Офіцерська панель і налаштування рейду — завершення блокує їх для всіх,
// на відміну від is_locked (той обходять офіцери/лідер).
function applyOfficerFormLockState() {
  const locked = isRaidCompleted();

  hiddenReservesToggle.disabled = locked;
  assignPlayerNameInput.disabled = locked;
  assignPlayerNameClear.disabled = locked;
  assignBoss.disabled = locked;
  assignItemTrigger.disabled = locked;
  officerAssignForm.querySelector('button[type="submit"]').disabled = locked;

  assignWeightToggle.querySelectorAll('.raid-weight-toggle-btn').forEach((btn) => {
    btn.disabled = locked || Number(btn.dataset.weight) > raid.soft_limit_total;
  });
}

function applySettingsFormLockState() {
  const locked = isRaidCompleted();

  settingsTitleInput.disabled = locked;
  settingsSoftLimitInput.disabled = locked;
  transferWeightLimitInput.disabled = locked;
  settingsForm.querySelector('button[type="submit"]').disabled = locked;
}

// Кнопки x2/x3 вимикаємо, якщо ліміт ваги рейду нижчий — обирати вагу,
// яка одразу перевищить soft_limit_total, безглуздо.
function applyWeightLimit(toggleEl, hiddenInput) {
  const maxWeight = raid.soft_limit_total;
  const buttons = [...toggleEl.querySelectorAll('.raid-weight-toggle-btn')];
  buttons.forEach((btn) => {
    btn.disabled = Number(btn.dataset.weight) > maxWeight;
  });

  if (Number(hiddenInput.value) > maxWeight) {
    const fallbackBtn = buttons.filter((b) => !b.disabled).at(-1) || buttons[0];
    hiddenInput.value = fallbackBtn.dataset.weight;
    buttons.forEach((b) => b.classList.toggle('raid-weight-toggle-btn--active', b === fallbackBtn));
  }
}

function applyWeightLimits() {
  applyWeightLimit(softWeightToggle, softWeight);
  applyWeightLimit(assignWeightToggle, assignWeight);
}

function setGuildMemberNamesSorted(players) {
  guildMemberNamesSorted = players.map((p) => p.name).sort((a, b) => a.localeCompare(b, 'uk'));
}

// Той самий патерн, що в personal-analytics.js: підказки гільдії, але вільний
// текст лишається доступним (легіонера можна вписати вручну, він не в списку).
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

// Автокомпліт пошуку зареєстрованих (раніше залогінених) користувачів —
// для "додати офіцера". Б'є в /auth/users?q= — порожній запит повертає
// весь список (як готовий дропдаун), типобраний текст лише звужує його.
function setupUserSearchAutocomplete(inputEl, listEl, onPick) {
  let debounceTimer = null;

  function closeList() {
    listEl.classList.remove('is-open');
    listEl.innerHTML = '';
  }

  async function search() {
    const query = inputEl.value.trim();

    let users;
    try {
      users = await apiCall('GET', `/auth/users?q=${encodeURIComponent(query)}`, { token: getSessionToken() });
    } catch (err) {
      console.error(err);
      return;
    }

    listEl.innerHTML = '';

    if (!users.length) {
      const empty = document.createElement('div');
      empty.className = 'raid-autocomplete-empty';
      empty.textContent = 'Нікого не знайдено — людина має хоч раз увійти через Discord на сайті';
      listEl.appendChild(empty);
    } else {
      users.forEach((user) => {
        const item = document.createElement('div');
        item.className = 'raid-autocomplete-item';
        item.textContent = user.username;
        item.addEventListener('mousedown', (event) => {
          event.preventDefault();
          inputEl.value = '';
          closeList();
          onPick(user);
        });
        listEl.appendChild(item);
      });
    }

    listEl.classList.add('is-open');
  }

  inputEl.addEventListener('focus', search);
  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(search, 250);
  });
  inputEl.addEventListener('blur', () => setTimeout(closeList, 100));
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeList();
  });
}

async function loadOfficers() {
  const officers = await apiCall('GET', `/raids/${raidId}/officers`, { token: getSessionToken() });
  raidOfficerIds = new Set(officers.map((o) => o.discord_id));
  officersTab.hidden = !isOfficerMode();
  renderOfficersPanel(officers);
}

// username і display_name збігаються, якщо основний персонаж не позначено
// (display_name тоді — фолбек на username) — без цього рядок дублюється:
// "Boro - Boro".
function usernameWithDisplayName(username, displayName) {
  return username === displayName ? username : `${username} - ${displayName}`;
}

function renderOfficersPanel(officers) {
  addOfficerSection.hidden = !isLeader();
  addOfficerInput.disabled = isRaidCompleted();
  officersList.innerHTML = '';

  const leaderLi = document.createElement('li');
  leaderLi.className = 'raid-list-item';
  const leaderNameWrap = document.createElement('span');
  leaderNameWrap.className = 'raid-list-item-name';
  leaderNameWrap.appendChild(createPlayerBadge(raid.leader_display_name));
  leaderNameWrap.appendChild(
    document.createTextNode(`${usernameWithDisplayName(raid.leader_username, raid.leader_display_name)} (Лідер)`)
  );
  leaderLi.appendChild(leaderNameWrap);
  officersList.appendChild(leaderLi);

  if (!officers.length) {
    const li = document.createElement('li');
    li.className = 'raid-list-item';
    li.textContent = 'Поки немає доданих офіцерів.';
    officersList.appendChild(li);
    return;
  }

  officers.forEach((officer) => {
    const li = document.createElement('li');
    li.className = 'raid-list-item';
    const nameWrap = document.createElement('span');
    nameWrap.className = 'raid-list-item-name';
    nameWrap.appendChild(createPlayerBadge(officer.display_name));
    nameWrap.appendChild(document.createTextNode(usernameWithDisplayName(officer.username, officer.display_name)));
    li.appendChild(nameWrap);

    if (isLeader()) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'link-button-std';
      removeBtn.textContent = 'Видалити';
      removeBtn.disabled = isRaidCompleted();
      removeBtn.addEventListener('click', async () => {
        try {
          await apiCall('DELETE', `/raids/${raidId}/officers/${encodeURIComponent(officer.discord_id)}`, { token: getSessionToken() });
          await loadOfficers();
          renderBanner();
        } catch (err) {
          alert(err.message);
        }
      });
      li.appendChild(removeBtn);
    }

    officersList.appendChild(li);
  });
}

async function addOfficer(user) {
  try {
    await apiCall('POST', `/raids/${raidId}/officers`, { token: getSessionToken(), body: { discordId: user.discordId } });
    await loadOfficers();
    renderBanner();
  } catch (err) {
    alert(err.message);
  }
}

function createItemIcon(itemId) {
  const icon = document.createElement('img');
  icon.className = 'raid-item-icon';
  icon.src = itemIconUrl(itemId, 'small');
  icon.alt = '';
  icon.dataset.itemId = itemId;
  return icon;
}

function closeItemPicker(listEl) {
  listEl.classList.remove('is-open');
}

function selectItemOption(hiddenInput, triggerBtn, item) {
  hiddenInput.value = item ? item.id : '';
  triggerBtn.innerHTML = '';

  if (!item) {
    triggerBtn.appendChild(document.createTextNode('Немає предметів'));
    return;
  }

  triggerBtn.dataset.itemId = item.id;
  triggerBtn.appendChild(createItemIcon(item.id));
  triggerBtn.appendChild(document.createTextNode(translateItem(item.name)));
}

function renderItemPickerOptions(listEl, hiddenInput, triggerBtn, items) {
  listEl.innerHTML = '';
  items.forEach((item) => {
    const opt = document.createElement('div');
    opt.className = 'raid-item-picker-option';
    opt.setAttribute('role', 'option');
    opt.dataset.itemId = item.id;
    opt.appendChild(createItemIcon(item.id));

    const label = document.createElement('span');
    label.className = itemRarityClass(item.id);
    label.textContent = translateItem(item.name);
    opt.appendChild(label);

    opt.addEventListener('mousedown', (event) => {
      event.preventDefault();
      selectItemOption(hiddenInput, triggerBtn, item);
      closeItemPicker(listEl);
    });

    listEl.appendChild(opt);
  });
}

function populateItemPicker(hiddenInput, triggerBtn, listEl, boss) {
  const items = (itemsCatalog[boss] || {})[raid.difficulty] || [];
  renderItemPickerOptions(listEl, hiddenInput, triggerBtn, items);
  selectItemOption(hiddenInput, triggerBtn, items[0]);
  closeItemPicker(listEl);
}

function setupItemPickerToggle(triggerBtn, listEl) {
  triggerBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = !listEl.classList.contains('is-open');
    document.querySelectorAll('.raid-item-picker-list.is-open').forEach((el) => closeItemPicker(el));
    listEl.classList.toggle('is-open', willOpen);
  });
}

function setupWeightToggle(toggleEl, hiddenInput) {
  toggleEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.raid-weight-toggle-btn');
    if (!btn) return;
    hiddenInput.value = btn.dataset.weight;
    toggleEl.querySelectorAll('.raid-weight-toggle-btn').forEach((b) => {
      b.classList.toggle('raid-weight-toggle-btn--active', b === btn);
    });
  });
}

document.addEventListener('click', () => {
  document.querySelectorAll('.raid-item-picker-list.is-open').forEach((el) => closeItemPicker(el));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.querySelectorAll('.raid-item-picker-list.is-open').forEach((el) => closeItemPicker(el));
  }
});

function positionItemTooltip(event) {
  const offset = 16;
  const rect = itemTooltipEl.getBoundingClientRect();
  let x = event.clientX + offset;
  let y = event.clientY + offset;
  if (x + rect.width > window.innerWidth) x = event.clientX - rect.width - offset;
  if (y + rect.height > window.innerHeight) y = event.clientY - rect.height - offset;
  itemTooltipEl.style.left = `${Math.max(0, x)}px`;
  itemTooltipEl.style.top = `${Math.max(0, y)}px`;
}

document.addEventListener('mousemove', (event) => {
  const target = event.target.closest('[data-item-id]');
  if (!target) {
    if (currentTooltipItemId !== null) {
      itemTooltipEl.hidden = true;
      currentTooltipItemId = null;
    }
    return;
  }

  if (target.dataset.itemId !== currentTooltipItemId) {
    itemTooltipEl.innerHTML = itemTooltipHtml(target.dataset.itemId);
    currentTooltipItemId = target.dataset.itemId;
  }

  itemTooltipEl.hidden = false;
  positionItemTooltip(event);
});

document.addEventListener('mouseout', (event) => {
  if (!event.relatedTarget) {
    itemTooltipEl.hidden = true;
    currentTooltipItemId = null;
  }
});

const LS_CHAR_KEY = 'rm_selected_character';

function updateSoftPlayerNameColor() {
  const color = classColorMap.get(softPlayerNameInput.value);
  softPlayerNameInput.style.color = color || '';
}

function populateMyCharacters() {
  softPlayerNameInput.innerHTML = '';
  noCharactersHint.hidden = myCharacters.length > 0;

  myCharacters.forEach(({ characterName: name }) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    const color = classColorMap.get(name);
    opt.style.color = color || '';
    softPlayerNameInput.appendChild(opt);
  });

  const saved = localStorage.getItem(LS_CHAR_KEY);
  if (saved && softPlayerNameInput.querySelector(`option[value="${CSS.escape(saved)}"]`)) {
    softPlayerNameInput.value = saved;
  }
  updateSoftPlayerNameColor();
  applySoftFormLockState();
}

function populateBossSelect(selectEl) {
  selectEl.innerHTML = '';
  bossesWithCatalog().forEach((boss) => {
    const opt = document.createElement('option');
    opt.value = boss;
    opt.textContent = translateBoss(boss);
    selectEl.appendChild(opt);
  });
}

function renderItemsBossFilterOptions() {
  itemsBossFilter.innerHTML = '<option value="">Усі боси</option>';
  bossesWithCatalog().forEach((boss) => {
    const opt = document.createElement('option');
    opt.value = boss;
    opt.textContent = translateBoss(boss);
    itemsBossFilter.appendChild(opt);
  });
}

function groupReservesByPlayer(list) {
  const map = new Map();
  list.forEach((r) => {
    if (r.player_name === null) return; // приховано сервером (режим hidden_reserves)
    if (!map.has(r.player_name)) map.set(r.player_name, []);
    map.get(r.player_name).push(r);
  });
  return map;
}

function renderPlayersTable() {
  raidPlayersBody.innerHTML = '';

  const transfersDisabled = (raid.transfer_weight_limit ?? 0) === 0;
  raidPlayersBody.closest('table').classList.toggle('raid-transfers-disabled', transfersDisabled);

  const grouped = groupReservesByPlayer(reserves);

  // Гравці з трансферами (можуть мати 0 власних софтів) теж повинні з'являтись
  weightTransfers.forEach((t) => {
    if (!grouped.has(t.from_player)) grouped.set(t.from_player, []);
    if (!grouped.has(t.to_player)) grouped.set(t.to_player, []);
  });

  const names = [...grouped.keys()].sort((a, b) => a.localeCompare(b, 'uk'));

  if (!names.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = 'Ще немає софтів.';
    tr.appendChild(td);
    raidPlayersBody.appendChild(tr);
    return;
  }

  const myNames = myCharNames();
  const myTransfer = getMyTransfer();

  names.forEach((name, index) => {
    const tr = document.createElement('tr');

    const numTd = document.createElement('td');
    numTd.textContent = index + 1;
    tr.appendChild(numTd);

    const nameTd = document.createElement('td');
    const nameWrap = document.createElement('span');
    nameWrap.className = 'raid-player-name-cell';
    nameWrap.appendChild(createPlayerBadge(name));

    if (personalAnalyticsNames.has(name)) {
      const link = document.createElement('a');
      link.href = `../../personal-analytics/?${new URLSearchParams({ player: name }).toString()}`;
      link.textContent = name;
      nameWrap.appendChild(link);
    } else {
      nameWrap.appendChild(document.createTextNode(name));
    }

    const ownerName = characterOwnerNames.get(name);
    if (ownerName) nameWrap.title = ownerName;
    nameTd.appendChild(nameWrap);
    tr.appendChild(nameTd);

    // --- Колонка "Передати" ---
    const transferTd = document.createElement('td');
    transferTd.className = 'raid-transfer-col';

    const fromTransfer = weightTransfers.find((t) => t.from_player === name);
    const toTransfer = weightTransfers.find((t) => t.to_player === name);

    if (fromTransfer) {
      const indicator = document.createElement('span');
      indicator.className = 'raid-transfer-indicator raid-transfer-indicator--from';
      indicator.textContent = `→ ${fromTransfer.to_player}`;
      transferTd.appendChild(indicator);

      const canCancel = isOfficerMode() || myNames.includes(name);
      if (canCancel && !isRaidCompleted()) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'raid-remove-btn';
        cancelBtn.title = 'Скасувати передачу софту';
        cancelBtn.textContent = '✕';
        cancelBtn.addEventListener('click', () => deleteTransfer(name));
        transferTd.appendChild(cancelBtn);
      }
    } else if (toTransfer) {
      const indicator = document.createElement('span');
      indicator.className = 'raid-transfer-indicator raid-transfer-indicator--to';
      indicator.title = `Отримує софти від ${toTransfer.from_player}`;
      indicator.textContent = `+${toTransfer.from_player}`;
      transferTd.appendChild(indicator);
    }

    tr.appendChild(transferTd);

    const itemsTd = document.createElement('td');
    const manageable = canManage(name);

    grouped.get(name).forEach((r) => {
      const itemSpan = document.createElement('span');
      itemSpan.className = 'raid-reserve-item';
      itemSpan.dataset.itemId = r.item_id;

      const weightBadge = document.createElement('span');
      weightBadge.className = 'raid-weight-badge';
      weightBadge.textContent = formatWeight((r.weight || 0) + (r.bonus_weight || 0));
      itemSpan.appendChild(weightBadge);

      const itemInfo = findItemInfo(r.item_id, r.boss);
      itemSpan.appendChild(createItemIcon(r.item_id));
      const nameEl = document.createElement('span');
      nameEl.className = `${itemRarityClass(r.item_id)}${r.is_received ? ' raid-item-received' : ''}`;
      nameEl.textContent = ` ${itemInfo ? translateItem(itemInfo.name) : `#${r.item_id}`}`;
      itemSpan.appendChild(nameEl);

      if (manageable) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'raid-remove-btn';
        delBtn.textContent = '✕';
        delBtn.title = 'Видалити цей софт';
        delBtn.disabled = isRaidCompleted();
        delBtn.addEventListener('click', () => removeReserve(r));
        itemSpan.appendChild(delBtn);
      }

      itemsTd.appendChild(itemSpan);
    });
    tr.appendChild(itemsTd);

    raidPlayersBody.appendChild(tr);
  });
}

// Групує резерви по вазі — окремий рядок на кожну вагу, щоб не плодити
// купу однакових чіпсів "x1" поряд з кожним іменем.
function buildReservesByWeight(reservers) {
  const wrap = document.createElement('div');
  wrap.className = 'raid-reserve-weight-list';

  const byWeight = new Map();
  reservers.forEach((r) => {
    const effectiveWeight = (r.weight || 0) + (r.bonus_weight || 0);
    if (!byWeight.has(effectiveWeight)) byWeight.set(effectiveWeight, { visible: [], hidden: 0 });
    if (r.player_name !== null) byWeight.get(effectiveWeight).visible.push(r.player_name);
    else byWeight.get(effectiveWeight).hidden++;
  });

  [...byWeight.keys()].sort((a, b) => a - b).forEach((weight) => {
    const entry = byWeight.get(weight);
    if (!entry) return;

    const row = document.createElement('div');
    row.className = 'raid-reserve-weight-row';

    const weightBadge = document.createElement('span');
    weightBadge.className = 'raid-weight-badge';
    weightBadge.textContent = formatWeight(weight);
    row.appendChild(weightBadge);

    const namesSpan = document.createElement('span');
    namesSpan.className = 'raid-reserve-weight-names';
    const visibleNames = entry.visible;
    visibleNames.forEach((name, i) => {
      const p = penaltiesList.find((x) => x.player_name === name);
      if (p && p.soft_penalty > 0) {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'penalty-value--active';
        nameSpan.textContent = name;
        namesSpan.appendChild(nameSpan);
      } else {
        namesSpan.appendChild(document.createTextNode(name));
      }
      if (p && p.roll_penalty > 0) {
        const penSpan = document.createElement('span');
        penSpan.className = 'penalty-value--active';
        penSpan.textContent = ` (-${p.roll_penalty})`;
        namesSpan.appendChild(penSpan);
      }
      const isLast = i === visibleNames.length - 1 && !entry.hidden;
      if (!isLast) namesSpan.appendChild(document.createTextNode(', '));
    });
    if (entry.hidden) {
      if (visibleNames.length) namesSpan.appendChild(document.createTextNode(', '));
      namesSpan.appendChild(document.createTextNode(`+${entry.hidden} гравців`));
    }
    row.appendChild(namesSpan);

    wrap.appendChild(row);
  });

  return wrap;
}

function renderItemsTable() {
  const bossFilter = itemsBossFilter.value;
  raidItemsBody.innerHTML = '';

  const myReceivedForItems = getMyReceivedTransfer();
  const myNamesForItems = myCharNames();
  let bonusPoolForItems = 0;
  let usedBonusForItems = 0;
  if (myReceivedForItems && currentUser) {
    bonusPoolForItems = raid.transfer_weight_limit ?? raid.soft_limit_total;
    usedBonusForItems = reserves
      .filter((r) => myNamesForItems.includes(r.player_name))
      .reduce((s, r) => s + (r.bonus_weight || 0), 0);
    bonusPoolBanner.hidden = false;
    bonusPoolBanner.textContent = `Бонусна вага від ${myReceivedForItems.from_player}: ${usedBonusForItems}/${bonusPoolForItems} використано.`;
  } else {
    bonusPoolBanner.hidden = true;
  }

  const softedOnly = itemsSoftedOnlyCheckbox.checked;

  const flat = buildFlatItemList().filter((item) => {
    if (bossFilter && item.boss !== bossFilter) return false;
    if (raid.hidden_reserves && !isOfficerMode()) {
      if (!reserves.some((r) => r.item_id === item.id && r.discord_id === currentUser?.discordId)) return false;
    } else if (softedOnly && !reserves.some((r) => r.item_id === item.id)) return false;
    return true;
  });

  if (!flat.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'Нічого не знайдено.';
    tr.appendChild(td);
    raidItemsBody.appendChild(tr);
    return;
  }

  flat.forEach((item) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    const nameWrap = document.createElement('span');
    nameWrap.className = 'raid-item-name-cell';
    nameWrap.dataset.itemId = item.id;
    nameWrap.appendChild(createItemIcon(item.id));
    const nameSpan = document.createElement('span');
    nameSpan.className = itemRarityClass(item.id);
    nameSpan.textContent = translateItem(item.name);
    nameWrap.appendChild(nameSpan);
    nameTd.appendChild(nameWrap);
    tr.appendChild(nameTd);

    const bossTd = document.createElement('td');
    bossTd.textContent = translateBoss(item.boss);
    tr.appendChild(bossTd);

    const reserversTd = document.createElement('td');
    const reservers = reserves.filter((r) => r.item_id === item.id);

    if (raid.hidden_reserves && !isOfficerMode()) {
      reserversTd.textContent = '';
    } else if (!reservers.length) {
      reserversTd.textContent = '—';
    } else {
      reserversTd.appendChild(buildReservesByWeight(reservers));
    }

    if (myReceivedForItems && currentUser && !isRaidCompleted()) {
      const myReserveForItem = reservers.find((r) => myNamesForItems.includes(r.player_name));
      if (myReserveForItem) {
        const canAdd = usedBonusForItems < bonusPoolForItems;
        const canRemove = (myReserveForItem.bonus_weight || 0) > 0;

        const bonusDiv = document.createElement('div');
        bonusDiv.className = 'raid-bonus-controls';

        if (myReserveForItem.bonus_weight > 0) {
          const chip = document.createElement('span');
          chip.className = 'raid-bonus-chip';
          chip.textContent = `+${myReserveForItem.bonus_weight}`;
          bonusDiv.appendChild(chip);
        }

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'raid-transfer-btn';
        addBtn.textContent = '+';
        addBtn.title = "Додати бонусну вагу";
        addBtn.disabled = !canAdd;
        addBtn.addEventListener('click', () => changeBonusWeight(myReserveForItem.id, 1));
        bonusDiv.appendChild(addBtn);

        if (canRemove) {
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'raid-remove-btn';
          removeBtn.textContent = '−';
          removeBtn.title = "Прибрати бонусну вагу";
          removeBtn.addEventListener('click', () => changeBonusWeight(myReserveForItem.id, -1));
          bonusDiv.appendChild(removeBtn);
        }

        reserversTd.appendChild(bonusDiv);
      }
    }

    tr.appendChild(reserversTd);

    raidItemsBody.appendChild(tr);
  });
}

function describeAuditAction(entry) {
  const d = entry.detail || {};
  const hideSoftDetails = raid.hidden_reserves && !isOfficerMode();
  switch (entry.action) {
    case 'raid_create': return 'створив рейд';
    case 'soft_add': return hideSoftDetails ? 'софтнув' : `софтнув ${translateBoss(d.boss)} (${formatWeight(d.weight)})`;
    case 'soft_remove': return hideSoftDetails ? 'видалив софт' : `видалив софт ${d.boss ? translateBoss(d.boss) : ''}`.trim();
    case 'soft_remove_all': return 'очистив усі свої софти';
    case 'officer_assign': return hideSoftDetails ? 'призначив софт гравцю' : `призначив софт гравцю ${d.playerName} (${translateBoss(d.boss)})`;
    case 'lock': return 'заблокував рейд';
    case 'unlock': return 'розблокував рейд';
    case 'settings_change': return 'змінив налаштування рейду';
    case 'item_received': return d.received ? 'позначив предмет отриманим' : 'скасував "отримано"';
    case 'hide_reserves': return "увімкнув режим прихованих софтів";
    case 'show_reserves': return "вимкнув режим прихованих софтів";
    case 'complete': return 'завершив рейд';
    case 'reactivate': return 'реактивував рейд';
    case 'officer_add': return `додав офіцера ${d.username || d.discordId}`;
    case 'officer_remove': return `видалив офіцера ${d.discordId}`;
    case 'weight_transfer': return `передав вагу гравцю ${d.toPlayer}`;
    case 'weight_transfer_cancel': return `скасував передачу ваги від ${d.fromPlayer} до ${d.toPlayer}`;
    default: return entry.action;
  }
}

function renderAuditList() {
  auditListEl.innerHTML = '';

  if (!auditEntries.length) {
    auditListEl.textContent = 'Аудит порожній.';
    return;
  }

  auditEntries.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'raid-audit-row';

    const time = document.createElement('span');
    time.className = 'raid-audit-time';
    time.textContent = formatDateTimeKyiv(entry.created_at);
    row.appendChild(time);

    const text = document.createElement('span');
    text.textContent = ` ${entry.actor_name} — ${describeAuditAction(entry)}`;
    row.appendChild(text);

    auditListEl.appendChild(row);
  });
}

async function loadRaid() {
  raid = await apiCall('GET', `/raids/${raidId}`, { token: getSessionToken() });
}

async function loadReserves() {
  reserves = await apiCall('GET', `/raids/${raidId}/reserves`, { token: getSessionToken() });
}

async function loadTransfers() {
  try {
    weightTransfers = await apiCall('GET', `/raids/${raidId}/transfers`, { token: getSessionToken() });
  } catch {
    weightTransfers = [];
  }
}

function showTransferModal() {
  const names = myCharNames();
  if (!names.length) return;

  const myNamesLower = new Set(names.map((n) => n.toLowerCase()));
  const takenLower = new Set([
    ...weightTransfers.map((t) => t.from_player.toLowerCase()),
    ...weightTransfers.map((t) => t.to_player.toLowerCase()),
  ]);
  const eligible = [...new Set(reserves.map((r) => r.player_name))]
    .filter((n) => !myNamesLower.has(n.toLowerCase()) && !takenLower.has(n.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'uk'));

  transferToPlayerSelect.innerHTML = '';
  eligible.forEach((n) => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    transferToPlayerSelect.appendChild(opt);
  });
  transferToPlayerRow.hidden = eligible.length === 0;

  transferModalText.textContent = "Обери кому ти хочеш передати свої софти - відповідний гравець отримає сповіщення";
  transferModal.hidden = false;
}

function deleteTransfer(fromPlayer) {
  cancelTransferModalText.textContent = `Скасувати передачу софту від ${fromPlayer}?`;
  cancelTransferModal._fromPlayer = fromPlayer;
  cancelTransferModal.hidden = false;
}

cancelTransferConfirmBtn.addEventListener('click', async () => {
  const fromPlayer = cancelTransferModal._fromPlayer;
  cancelTransferConfirmBtn.disabled = true;
  try {
    await apiCall('DELETE', `/raids/${raidId}/transfers/${encodeURIComponent(fromPlayer)}`, { token: getSessionToken() });
    cancelTransferModal.hidden = true;
    await loadTransfers();
    await loadReserves();
    renderPlayersTable();
    renderItemsTable();
    applySoftFormLockState();
  } catch (err) {
    alert(err.message);
  } finally {
    cancelTransferConfirmBtn.disabled = false;
  }
});

cancelTransferCancelBtn.addEventListener('click', () => { cancelTransferModal.hidden = true; });
cancelTransferModalBackdrop.addEventListener('click', () => { cancelTransferModal.hidden = true; });

async function loadAudit() {
  auditEntries = await apiCall('GET', `/raids/${raidId}/audit`, { token: getSessionToken() });
  renderAuditList();
}

async function changeBonusWeight(reserveId, delta) {
  try {
    await apiCall('PATCH', `/raids/${raidId}/reserves/${reserveId}/bonus`, {
      token: getSessionToken(),
      body: { delta }
    });
    await loadReserves();
    renderPlayersTable();
    renderItemsTable();
  } catch (err) {
    setStatus(`Помилка: ${err.message}`, 'error');
  }
}

async function removeReserve(reserve) {
  try {
    await apiCall('DELETE', `/raids/${raidId}/reserves/${reserve.id}`, { token: getSessionToken() });
    await loadReserves();
    renderPlayersTable();
    renderItemsTable();
  } catch (err) {
    setStatus(`Помилка: ${err.message}`, 'error');
  }
}

let copyLinkTooltipTimeout = null;

function showCopyLinkTooltip(text) {
  copyLinkTooltip.textContent = text;
  copyLinkTooltip.classList.add('is-visible');
  clearTimeout(copyLinkTooltipTimeout);
  copyLinkTooltipTimeout = setTimeout(() => copyLinkTooltip.classList.remove('is-visible'), 1800);
}

copyLinkBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showCopyLinkTooltip('Скопійовано!');
  } catch {
    showCopyLinkTooltip('Не вдалося скопіювати');
  }
});

lockToggleBtn.addEventListener('click', async () => {
  try {
    raid = await apiCall('POST', `/raids/${raidId}/${raid.is_locked ? 'unlock' : 'lock'}`, { token: getSessionToken() });
    renderBanner();
  } catch (err) {
    alert(err.message);
  }
});

statusToggleBtn.addEventListener('click', async () => {
  const action = raid.status === 'completed' ? 'reactivate' : 'complete';
  try {
    raid = await apiCall('POST', `/raids/${raidId}/${action}`, { token: getSessionToken() });
    renderBanner();
    await loadOfficers();
    renderPlayersTable();
  } catch (err) {
    alert(err.message);
  }
});

hiddenReservesToggle.addEventListener('change', async () => {
  try {
    raid = await apiCall('POST', `/raids/${raidId}/toggle-hidden`, { token: getSessionToken() });
    renderBanner();
    await loadReserves();
    renderPlayersTable();
    renderItemsTable();
  } catch (err) {
    hiddenReservesToggle.checked = !hiddenReservesToggle.checked; // rollback
    alert(err.message);
  }
});

const TAB_PANES = { players: playersPane, items: itemsPane, audit: auditPane, penalties: penaltiesPane, officers: officersPane, settings: settingsPane };

async function setActiveTab(tab) {
  activeTab = tab;
  raidTabs.forEach((btn) => btn.classList.toggle('raid-tab--active', btn.dataset.tab === tab));
  Object.entries(TAB_PANES).forEach(([key, el]) => { el.hidden = key !== tab; });
  if (tab === 'audit') await loadAudit();
  if (tab === 'penalties') await loadAndRenderPenalties();
}

raidTabs.forEach((btn) => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));

softPlayerNameInput.addEventListener('change', () => {
  localStorage.setItem(LS_CHAR_KEY, softPlayerNameInput.value);
  updateSoftPlayerNameColor();
});
softBoss.addEventListener('change', () => populateItemPicker(softItem, softItemTrigger, softItemList, softBoss.value));
assignBoss.addEventListener('change', () => populateItemPicker(assignItem, assignItemTrigger, assignItemList, assignBoss.value));
setupItemPickerToggle(softItemTrigger, softItemList);
setupItemPickerToggle(assignItemTrigger, assignItemList);
setupWeightToggle(softWeightToggle, softWeight);
setupWeightToggle(assignWeightToggle, assignWeight);
assignPlayerNameClear.addEventListener('click', () => {
  assignPlayerNameInput.value = '';
  assignPlayerNameInput.focus();
});
setupNameAutocomplete(assignPlayerNameInput, assignPlayerNameList);
setupUserSearchAutocomplete(addOfficerInput, addOfficerList, addOfficer);
itemsBossFilter.addEventListener('change', renderItemsTable);
itemsSoftedOnlyCheckbox.addEventListener('change', renderItemsTable);

softForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const playerName = softPlayerNameInput.value.trim();
  const boss = softBoss.value;
  const itemId = Number(softItem.value);
  const weight = Number(softWeight.value);
  if (!playerName || !boss || !itemId) return;

  try {
    await apiCall('POST', `/raids/${raidId}/reserves`, { token: getSessionToken(), body: { playerName, itemId, boss, weight } });
    await loadReserves();
    renderPlayersTable();
    renderItemsTable();
    setStatus('Софт додано.', 'success');
  } catch (err) {
    setStatus(`Помилка: ${err.message}`, 'error');
  }
});

officerAssignForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const playerName = assignPlayerNameInput.value.trim();
  const boss = assignBoss.value;
  const itemId = Number(assignItem.value);
  const weight = Number(assignWeight.value);
  if (!playerName || !boss || !itemId) return;

  try {
    await apiCall('POST', `/raids/${raidId}/officer/assign`, {
      token: getSessionToken(),
      body: { playerName, itemId, boss, weight }
    });
    await loadReserves();
    renderPlayersTable();
    renderItemsTable();
    setStatus(`Софт призначено гравцю ${playerName}.`, 'success');
  } catch (err) {
    setStatus(`Помилка: ${err.message}`, 'error');
  }
});

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const title = settingsTitleInput.value.trim();
  const softLimitTotal = Number(settingsSoftLimitInput.value);
  if (!title || !Number.isInteger(softLimitTotal) || softLimitTotal < 1) return;

  const transferWeightLimit = Number(transferWeightLimitInput.value);

  try {
    raid = await apiCall('PATCH', `/raids/${raidId}`, {
      token: getSessionToken(),
      body: { title, softLimitTotal, transferWeightLimit }
    });
    raidTitleHeading.textContent = raid.title;
    document.title = `${raid.title} — Рейд-менеджер`;
    renderBanner();
    setStatus('Налаштування збережено.', 'success');
  } catch (err) {
    setStatus(`Помилка: ${err.message}`, 'error');
  }
});

async function loadPenalties() {
  try {
    penaltiesList = await apiCall('GET', `/raids/${raidId}/penalties`, { token: getSessionToken() });
  } catch (err) {
    console.error(err);
    penaltiesList = [];
  }
}

async function loadAndRenderPenalties() {
  await loadPenalties();
  renderPenaltiesTable();
}

async function savePenalty(playerName, rollPenalty, softPenalty, reason) {
  try {
    penaltiesList = await apiCall('PUT', `/raids/${raidId}/penalties/${encodeURIComponent(playerName)}`, {
      token: getSessionToken(),
      body: { rollPenalty, softPenalty, reason }
    });
    renderPenaltiesTable();
    renderItemsTable();
  } catch (err) {
    setStatus(`Помилка: ${err.message}`, 'error');
  }
}

function renderPenaltiesTable() {
  raidPenaltiesBody.innerHTML = '';

  if (!penaltiesList.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = "Ще немає учасників рейду.";
    tr.appendChild(td);
    raidPenaltiesBody.appendChild(tr);
    return;
  }

  const officerMode = isOfficerMode() && !isRaidCompleted();

  for (const { player_name, roll_penalty, soft_penalty, reason } of penaltiesList) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    const nameWrap = document.createElement('span');
    nameWrap.className = 'raid-player-name-cell';
    nameWrap.appendChild(createPlayerBadge(player_name));
    nameWrap.appendChild(document.createTextNode(player_name));
    nameTd.appendChild(nameWrap);
    tr.appendChild(nameTd);

    if (officerMode) {
      const rollInput = document.createElement('input');
      rollInput.type = 'number';
      rollInput.min = '0';
      rollInput.step = '5';
      rollInput.value = String(roll_penalty);
      rollInput.className = 'penalty-input' + (roll_penalty > 0 ? ' penalty-input--nonzero' : '');

      const softInput = document.createElement('input');
      softInput.type = 'number';
      softInput.min = '0';
      softInput.max = String(raid.soft_limit_total);
      softInput.step = '1';
      softInput.value = String(soft_penalty);
      softInput.className = 'penalty-input' + (soft_penalty > 0 ? ' penalty-input--nonzero' : '');

      const reasonInput = document.createElement('input');
      reasonInput.type = 'text';
      reasonInput.value = reason || '';
      reasonInput.className = 'penalty-reason-input';
      reasonInput.maxLength = 500;
      reasonInput.placeholder = 'Причина...';

      const save = () => {
        rollInput.classList.toggle('penalty-input--nonzero', Number(rollInput.value) > 0);
        softInput.classList.toggle('penalty-input--nonzero', Number(softInput.value) > 0);
        savePenalty(player_name, Number(rollInput.value), Number(softInput.value), reasonInput.value);
      };
      rollInput.addEventListener('change', save);
      softInput.addEventListener('change', save);
      reasonInput.addEventListener('change', save);

      const rollTd = document.createElement('td');
      rollTd.appendChild(rollInput);
      const softTd = document.createElement('td');
      softTd.appendChild(softInput);
      const reasonTd = document.createElement('td');
      reasonTd.appendChild(reasonInput);
      tr.appendChild(rollTd);
      tr.appendChild(softTd);
      tr.appendChild(reasonTd);
    } else {
      const rollTd = document.createElement('td');
      if (roll_penalty > 0) {
        rollTd.textContent = `-${roll_penalty}`;
        rollTd.className = 'penalty-value--active';
      } else {
        rollTd.textContent = '—';
        rollTd.className = 'penalty-value--none';
      }

      const softTd = document.createElement('td');
      if (soft_penalty > 0) {
        softTd.textContent = `-${soft_penalty}`;
        softTd.className = 'penalty-value--active';
      } else {
        softTd.textContent = '—';
        softTd.className = 'penalty-value--none';
      }

      const reasonTd = document.createElement('td');
      reasonTd.textContent = reason || '';
      reasonTd.className = 'penalty-reason-text';

      tr.appendChild(rollTd);
      tr.appendChild(softTd);
      tr.appendChild(reasonTd);
    }

    raidPenaltiesBody.appendChild(tr);
  }
}

transferConfirmBtn.addEventListener('click', async () => {
  const toPlayer = transferToPlayerSelect.value;
  const fromPlayer = softPlayerNameInput.value;
  if (!fromPlayer || !toPlayer) return;

  transferConfirmBtn.disabled = true;
  try {
    await apiCall('POST', `/raids/${raidId}/transfers`, {
      token: getSessionToken(),
      body: { fromPlayer, toPlayer }
    });
    transferModal.hidden = true;
    await loadTransfers();
    await loadReserves();
    renderPlayersTable();
    renderItemsTable();
    applySoftFormLockState();
  } catch (err) {
    alert(err.message);
  } finally {
    transferConfirmBtn.disabled = false;
  }
});

transferCancelModalBtn.addEventListener('click', () => { transferModal.hidden = true; });
transferModalBackdrop.addEventListener('click', () => { transferModal.hidden = true; });
transferWeightBtn.addEventListener('click', () => showTransferModal());


async function init() {
  raidId = new URLSearchParams(window.location.search).get('id');
  if (!raidId) {
    setStatus('Не вказано id рейду.', 'error');
    return;
  }

  loginGateBtn.href = discordLoginUrl();
  currentUser = await fetchCurrentUser();

  if (!currentUser) {
    loginGate.hidden = false;
    return;
  }

  try {
    const [itemsRes, playersRes, ownersRes, personalStatsRes, guildDataRes] = await Promise.all([
      fetch('/data/raid-items.json?t=' + Date.now()),
      fetch('/data/players.json?t=' + Date.now()),
      fetch(apiUrl('/characters/owners')).catch(() => null),
      fetch('/data/personal-stats.json?t=' + Date.now()).catch(() => null),
      fetch('/data/guild-data.json?t=' + Date.now()).catch(() => null),
      loadItemIconData()
    ]);
    itemsCatalog = await itemsRes.json();
    if (playersRes.ok) {
      const players = await playersRes.json();
      guildMemberNames = new Set(players.map((p) => p.name));
      setGuildMemberNamesSorted(players);
    }
    if (ownersRes?.ok) {
      characterOwnerNames = new Map(Object.entries(await ownersRes.json()));
    }
    if (personalStatsRes?.ok) {
      const personalStats = await personalStatsRes.json();
      for (const record of personalStats) {
        for (const player of record.players || []) {
          personalAnalyticsNames.add(player.name);
        }
      }
    }
    if (guildDataRes?.ok) {
      const guildData = await guildDataRes.json();
      classColorMap = buildClassColorMap(guildData.rows || []);
    }
  } catch (err) {
    console.error(err);
  }

  try {
    await loadRaid();
  } catch (err) {
    setStatus(`Рейд не знайдено: ${err.message}`, 'error');
    return;
  }

  raidTitleHeading.textContent = raid.title;
  document.title = `${raid.title} — Рейд-менеджер`;

  await loadOfficers();
  renderBanner();
  officerPanel.hidden = !isOfficerMode();

  populateBossSelect(softBoss);
  populateItemPicker(softItem, softItemTrigger, softItemList, softBoss.value);
  populateBossSelect(assignBoss);
  populateItemPicker(assignItem, assignItemTrigger, assignItemList, assignBoss.value);
  renderItemsBossFilterOptions();

  try {
    myCharacters = await apiCall('GET', '/auth/me/characters', { token: getSessionToken() });
  } catch (err) {
    console.error(err);
  }
  populateMyCharacters();

  await loadReserves();
  await loadTransfers();
  await loadPenalties();
  renderPlayersTable();
  renderItemsTable();

  raidContent.hidden = false;
  setStatus('');

  setInterval(async () => {
    try {
      await loadReserves();
      await loadTransfers();
      renderPlayersTable();
      renderItemsTable();
      applySoftFormLockState();
      if (activeTab === 'audit') await loadAudit();
    } catch (err) {
      console.error(err);
    }
  }, 4000);
}

init();
