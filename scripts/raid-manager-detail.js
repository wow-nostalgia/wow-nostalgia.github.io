const raidTitleHeading = document.getElementById('raidTitleHeading');
const raidSettingsBanner = document.getElementById('raidSettingsBanner');
const copyLinkBtn = document.getElementById('copyLinkBtn');
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
const itemsSearchInput = document.getElementById('itemsSearch');
const itemsBossFilter = document.getElementById('itemsBossFilter');
const itemsSoftedOnlyCheckbox = document.getElementById('itemsSoftedOnly');
const raidItemsBody = document.getElementById('raidItemsBody');

const itemTooltipEl = document.getElementById('raidItemTooltip');
let currentTooltipItemId = null;

let raidId = null;
let raid = null;
let currentUser = null;
let myCharacters = [];
let raidOfficerIds = new Set();
let itemsCatalog = {};
let guildMemberNames = new Set();
let guildMemberNamesSorted = [];
let reserves = [];
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
  badge.textContent = isGuild ? 'Н' : 'Л';
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
    INSTANCE_LABELS[raid.instance] || raid.instance,
    DIFFICULTY_LABELS[raid.difficulty] || raid.difficulty,
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

  settingsTab.hidden = !isLeader();
  settingsTitleInput.value = raid.title;
  settingsSoftLimitInput.value = raid.soft_limit_total;

  applyWeightLimits();
  applySoftFormLockState();
}

// Лок блокує самософт лише для звичайних гравців — офіцери/лідер обходять
// лок на бекенді (reserves.js), тож для них форму не вимикаємо.
function applySoftFormLockState() {
  const locked = raid.is_locked && !isOfficerMode();

  softPlayerNameInput.disabled = locked || !myCharacters.length;
  softBoss.disabled = locked;
  softItemTrigger.disabled = locked;
  softForm.querySelector('button[type="submit"]').disabled = locked;

  softWeightToggle.querySelectorAll('.raid-weight-toggle-btn').forEach((btn) => {
    btn.disabled = locked || Number(btn.dataset.weight) > raid.soft_limit_total;
  });
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

function renderOfficersPanel(officers) {
  addOfficerSection.hidden = !isLeader();
  officersList.innerHTML = '';

  const leaderLi = document.createElement('li');
  leaderLi.className = 'raid-list-item';
  const leaderNameWrap = document.createElement('span');
  leaderNameWrap.className = 'raid-list-item-name';
  leaderNameWrap.appendChild(createPlayerBadge(raid.leader_display_name));
  leaderNameWrap.appendChild(document.createTextNode(`${raid.leader_display_name} (Лідер)`));
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
    nameWrap.appendChild(document.createTextNode(officer.display_name));
    li.appendChild(nameWrap);

    if (isLeader()) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'link-button-std';
      removeBtn.textContent = 'Видалити';
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
  triggerBtn.appendChild(document.createTextNode(`${item.name} (${item.slot})`));
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
    label.textContent = `${item.name} (${item.slot})`;
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

function populateMyCharacters() {
  softPlayerNameInput.innerHTML = '';
  noCharactersHint.hidden = myCharacters.length > 0;

  myCharacters.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    softPlayerNameInput.appendChild(opt);
  });

  applySoftFormLockState();
}

function populateBossSelect(selectEl) {
  selectEl.innerHTML = '';
  bossesWithCatalog().forEach((boss) => {
    const opt = document.createElement('option');
    opt.value = boss;
    opt.textContent = boss;
    selectEl.appendChild(opt);
  });
}

function renderItemsBossFilterOptions() {
  itemsBossFilter.innerHTML = '<option value="">Усі боси</option>';
  bossesWithCatalog().forEach((boss) => {
    const opt = document.createElement('option');
    opt.value = boss;
    opt.textContent = boss;
    itemsBossFilter.appendChild(opt);
  });
}

function groupReservesByPlayer(list) {
  const map = new Map();
  list.forEach((r) => {
    if (!map.has(r.player_name)) map.set(r.player_name, []);
    map.get(r.player_name).push(r);
  });
  return map;
}

function renderPlayersTable() {
  raidPlayersBody.innerHTML = '';

  const grouped = groupReservesByPlayer(reserves);
  const names = [...grouped.keys()].sort((a, b) => a.localeCompare(b, 'uk'));

  if (!names.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'Ще немає софтів.';
    tr.appendChild(td);
    raidPlayersBody.appendChild(tr);
    return;
  }

  names.forEach((name, index) => {
    const tr = document.createElement('tr');

    const numTd = document.createElement('td');
    numTd.textContent = index + 1;
    tr.appendChild(numTd);

    const nameTd = document.createElement('td');
    const nameWrap = document.createElement('span');
    nameWrap.className = 'raid-player-name-cell';
    nameWrap.appendChild(createPlayerBadge(name));
    nameWrap.appendChild(document.createTextNode(name));
    nameTd.appendChild(nameWrap);
    tr.appendChild(nameTd);

    const itemsTd = document.createElement('td');
    const manageable = canManage(name);

    grouped.get(name).forEach((r) => {
      const itemSpan = document.createElement('span');
      itemSpan.className = 'raid-reserve-item';
      itemSpan.dataset.itemId = r.item_id;

      const weightBadge = document.createElement('span');
      weightBadge.className = 'raid-weight-badge';
      weightBadge.textContent = formatWeight(r.weight);
      itemSpan.appendChild(weightBadge);

      const itemInfo = findItemInfo(r.item_id, r.boss);
      itemSpan.appendChild(createItemIcon(r.item_id));
      const nameEl = document.createElement('span');
      nameEl.className = `${itemRarityClass(r.item_id)}${r.is_received ? ' raid-item-received' : ''}`;
      nameEl.textContent = ` ${itemInfo ? itemInfo.name : `#${r.item_id}`}`;
      itemSpan.appendChild(nameEl);

      if (manageable) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'raid-remove-btn';
        delBtn.textContent = '✕';
        delBtn.title = 'Видалити цей софт';
        delBtn.addEventListener('click', () => removeReserve(r));
        itemSpan.appendChild(delBtn);
      }

      itemsTd.appendChild(itemSpan);
    });
    tr.appendChild(itemsTd);

    raidPlayersBody.appendChild(tr);
  });
}

function renderItemsTable() {
  const search = itemsSearchInput.value.trim().toLocaleLowerCase('uk');
  const bossFilter = itemsBossFilter.value;
  raidItemsBody.innerHTML = '';

  const softedOnly = itemsSoftedOnlyCheckbox.checked;

  const flat = buildFlatItemList().filter((item) => {
    if (bossFilter && item.boss !== bossFilter) return false;
    if (softedOnly && !reserves.some((r) => r.item_id === item.id)) return false;
    if (search) {
      const haystack = `${item.name} ${item.boss}`.toLocaleLowerCase('uk');
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  if (!flat.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
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
    nameSpan.textContent = item.name;
    nameWrap.appendChild(nameSpan);
    nameTd.appendChild(nameWrap);
    tr.appendChild(nameTd);

    const slotTd = document.createElement('td');
    slotTd.textContent = item.slot;
    tr.appendChild(slotTd);

    const bossTd = document.createElement('td');
    bossTd.textContent = item.boss;
    tr.appendChild(bossTd);

    const reserversTd = document.createElement('td');
    const reservers = reserves.filter((r) => r.item_id === item.id);

    if (!reservers.length) {
      reserversTd.textContent = '—';
    } else {
      reservers.forEach((r) => {
        const span = document.createElement('span');
        span.className = 'raid-reserve-item';
        span.appendChild(document.createTextNode(`${r.player_name} `));
        const weightBadge = document.createElement('span');
        weightBadge.className = 'raid-weight-badge';
        weightBadge.textContent = formatWeight(r.weight);
        span.appendChild(weightBadge);
        reserversTd.appendChild(span);
      });
    }
    tr.appendChild(reserversTd);

    raidItemsBody.appendChild(tr);
  });
}

function describeAuditAction(entry) {
  const d = entry.detail || {};
  switch (entry.action) {
    case 'raid_create': return 'створив рейд';
    case 'soft_add': return `софтнув ${d.boss} (${formatWeight(d.weight)})`;
    case 'soft_remove': return `видалив софт ${d.boss || ''}`.trim();
    case 'soft_remove_all': return 'очистив усі свої софти';
    case 'officer_assign': return `призначив софт гравцю ${d.playerName} (${d.boss})`;
    case 'lock': return 'заблокував рейд';
    case 'unlock': return 'розблокував рейд';
    case 'settings_change': return 'змінив налаштування рейду';
    case 'item_received': return d.received ? 'позначив предмет отриманим' : 'скасував "отримано"';
    case 'complete': return 'завершив рейд';
    case 'reactivate': return 'реактивував рейд';
    case 'officer_add': return `додав офіцера ${d.username || d.discordId}`;
    case 'officer_remove': return `видалив офіцера ${d.discordId}`;
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

async function loadAudit() {
  auditEntries = await apiCall('GET', `/raids/${raidId}/audit`, { token: getSessionToken() });
  renderAuditList();
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

copyLinkBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    alert('Лінк скопійовано.');
  } catch {
    alert(window.location.href);
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
  } catch (err) {
    alert(err.message);
  }
});

const TAB_PANES = { players: playersPane, items: itemsPane, audit: auditPane, officers: officersPane, settings: settingsPane };

async function setActiveTab(tab) {
  activeTab = tab;
  raidTabs.forEach((btn) => btn.classList.toggle('raid-tab--active', btn.dataset.tab === tab));
  Object.entries(TAB_PANES).forEach(([key, el]) => { el.hidden = key !== tab; });
  if (tab === 'audit') await loadAudit();
}

raidTabs.forEach((btn) => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));

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
itemsSearchInput.addEventListener('input', renderItemsTable);
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

  try {
    raid = await apiCall('PATCH', `/raids/${raidId}`, { token: getSessionToken(), body: { title, softLimitTotal } });
    raidTitleHeading.textContent = raid.title;
    document.title = `${raid.title} — Рейд-менеджер`;
    renderBanner();
    setStatus('Налаштування збережено.', 'success');
  } catch (err) {
    setStatus(`Помилка: ${err.message}`, 'error');
  }
});

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
    const [itemsRes, playersRes] = await Promise.all([
      fetch('/data/raid-items.json'),
      fetch('/data/players.json'),
      loadItemIconData()
    ]);
    itemsCatalog = await itemsRes.json();
    if (playersRes.ok) {
      const players = await playersRes.json();
      guildMemberNames = new Set(players.map((p) => p.name));
      setGuildMemberNamesSorted(players);
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
  renderPlayersTable();
  renderItemsTable();

  raidContent.hidden = false;
  setStatus('');

  setInterval(async () => {
    try {
      await loadReserves();
      renderPlayersTable();
      renderItemsTable();
      if (activeTab === 'audit') await loadAudit();
    } catch (err) {
      console.error(err);
    }
  }, 4000);
}

init();
