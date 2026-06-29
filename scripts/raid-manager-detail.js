const raidTitleHeading = document.getElementById('raidTitleHeading');
const raidSettingsBanner = document.getElementById('raidSettingsBanner');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const officerAccessBtn = document.getElementById('officerAccessBtn');
const officerNameBtn = document.getElementById('officerNameBtn');
const lockToggleBtn = document.getElementById('lockToggleBtn');
const statusToggleBtn = document.getElementById('statusToggleBtn');
const raidStatus = document.getElementById('raidStatus');
const raidTabs = document.querySelectorAll('.raid-tab');
const raidContent = document.getElementById('raidContent');

const softForm = document.getElementById('softForm');
const softPlayerNameInput = document.getElementById('softPlayerName');
const softBoss = document.getElementById('softBoss');
const softItem = document.getElementById('softItem');
const softWeight = document.getElementById('softWeight');

const officerPanel = document.getElementById('officerPanel');
const officerAssignForm = document.getElementById('officerAssignForm');
const assignPlayerNameInput = document.getElementById('assignPlayerName');
const assignPlayerNameClear = document.getElementById('assignPlayerNameClear');
const assignPlayerNameList = document.getElementById('assignPlayerNameList');
const assignBoss = document.getElementById('assignBoss');
const assignItem = document.getElementById('assignItem');
const assignWeight = document.getElementById('assignWeight');

const playersPane = document.getElementById('playersPane');
const playersSearchInput = document.getElementById('playersSearch');
const raidPlayersBody = document.getElementById('raidPlayersBody');

const auditPane = document.getElementById('auditPane');
const auditListEl = document.getElementById('auditList');

const itemsPane = document.getElementById('itemsPane');
const itemsSearchInput = document.getElementById('itemsSearch');
const itemsBossFilter = document.getElementById('itemsBossFilter');
const itemsSoftedOnlyCheckbox = document.getElementById('itemsSoftedOnly');
const raidItemsBody = document.getElementById('raidItemsBody');

let raidId = null;
let raid = null;
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

function isOfficerMode() {
  return Boolean(getOfficerToken(raidId));
}

function canManage(playerName) {
  return isOfficerMode() || Boolean(getClaimToken(raidId, playerName));
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
    `Ліміт предметів: ${raid.soft_limit_items}`,
    raid.allow_duplicate_soft ? 'Дублі дозволені' : 'Без дублів'
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
}

function updateOfficerButton() {
  officerAccessBtn.textContent = isOfficerMode() ? 'Скопіювати токен офіцера' : 'Ввести токен офіцера';
  officerNameBtn.hidden = !isOfficerMode();
  officerNameBtn.textContent = `Я: ${getOfficerName(raidId) || '(вказати ім\'я)'}`;
}

function promptOfficerName() {
  const current = getOfficerName(raidId);
  const name = window.prompt("Як тебе записати в Raid History?", current);
  if (name === null) return;
  setOfficerName(raidId, name.trim());
  updateOfficerButton();
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

function populateBossSelect(selectEl) {
  selectEl.innerHTML = '';
  bossesWithCatalog().forEach((boss) => {
    const opt = document.createElement('option');
    opt.value = boss;
    opt.textContent = boss;
    selectEl.appendChild(opt);
  });
}

function populateItemSelect(selectEl, boss) {
  selectEl.innerHTML = '';
  const items = (itemsCatalog[boss] || {})[raid.difficulty] || [];
  items.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.name} (${item.slot})`;
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
  const search = playersSearchInput.value.trim().toLocaleLowerCase('uk');
  raidPlayersBody.innerHTML = '';

  const grouped = groupReservesByPlayer(reserves);
  const names = [...grouped.keys()]
    .filter((n) => !search || n.toLocaleLowerCase('uk').includes(search))
    .sort((a, b) => a.localeCompare(b, 'uk'));

  if (!names.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'Ще немає софтів.';
    tr.appendChild(td);
    raidPlayersBody.appendChild(tr);
    return;
  }

  names.forEach((name) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.appendChild(createPlayerBadge(name));
    nameTd.appendChild(document.createTextNode(name));
    tr.appendChild(nameTd);

    const itemsTd = document.createElement('td');
    grouped.get(name).forEach((r) => {
      const itemSpan = document.createElement('span');
      itemSpan.className = 'raid-reserve-item';

      const weightBadge = document.createElement('span');
      weightBadge.className = 'raid-weight-badge';
      weightBadge.textContent = formatWeight(r.weight);
      itemSpan.appendChild(weightBadge);

      const itemInfo = findItemInfo(r.item_id, r.boss);
      const nameEl = document.createElement('span');
      nameEl.className = `raid-rarity--rare${r.is_received ? ' raid-item-received' : ''}`;
      nameEl.textContent = ` ${itemInfo ? itemInfo.name : `#${r.item_id}`}`;
      itemSpan.appendChild(nameEl);

      if (canManage(name)) {
        const recvBtn = document.createElement('button');
        recvBtn.type = 'button';
        recvBtn.className = 'raid-remove-btn';
        recvBtn.textContent = r.is_received ? '↺' : '✓';
        recvBtn.title = r.is_received ? 'Скасувати "отримано"' : 'Позначити отриманим';
        recvBtn.addEventListener('click', () => toggleReceived(r));
        itemSpan.appendChild(recvBtn);

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

    const actionsTd = document.createElement('td');
    if (canManage(name)) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'link-button-std';
      clearBtn.textContent = 'Очистити всі';
      clearBtn.addEventListener('click', () => clearAllForPlayer(name));
      actionsTd.appendChild(clearBtn);
    }
    tr.appendChild(actionsTd);

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
    nameTd.className = 'raid-rarity--rare';
    nameTd.textContent = item.name;
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
        span.appendChild(createPlayerBadge(r.player_name));
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
  raid = await apiCall('GET', `/raids/${raidId}`);
}

async function loadReserves() {
  reserves = await apiCall('GET', `/raids/${raidId}/reserves`);
}

async function loadAudit() {
  auditEntries = await apiCall('GET', `/raids/${raidId}/audit`);
  renderAuditList();
}

async function removeReserve(reserve) {
  const token = isOfficerMode() ? getOfficerToken(raidId) : getClaimToken(raidId, reserve.player_name);
  const body = isOfficerMode() ? { officerName: getOfficerName(raidId) } : undefined;
  try {
    await apiCall('DELETE', `/raids/${raidId}/reserves/${reserve.id}`, { token, body });
    await loadReserves();
    renderPlayersTable();
    renderItemsTable();
  } catch (err) {
    setStatus(`Помилка: ${err.message}`, 'error');
  }
}

async function toggleReceived(reserve) {
  const token = isOfficerMode() ? getOfficerToken(raidId) : getClaimToken(raidId, reserve.player_name);
  try {
    await apiCall('POST', `/raids/${raidId}/reserves/${reserve.id}/received`, { token });
    await loadReserves();
    renderPlayersTable();
  } catch (err) {
    setStatus(`Помилка: ${err.message}`, 'error');
  }
}

async function clearAllForPlayer(name) {
  const token = isOfficerMode() ? getOfficerToken(raidId) : getClaimToken(raidId, name);
  const body = isOfficerMode() ? { officerName: getOfficerName(raidId) } : undefined;
  try {
    await apiCall('DELETE', `/raids/${raidId}/players/${encodeURIComponent(name)}/reserves`, { token, body });
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

officerAccessBtn.addEventListener('click', async () => {
  if (isOfficerMode()) {
    const token = getOfficerToken(raidId);
    try {
      await navigator.clipboard.writeText(token);
      alert('Токен офіцера скопійовано. Передай його іншому офіцеру.');
    } catch {
      alert(`Токен офіцера: ${token}`);
    }
    return;
  }

  const token = window.prompt('Встав токен офіцера, отриманий при створенні рейду:');
  if (!token) return;

  try {
    await apiCall('PATCH', `/raids/${raidId}`, { token, body: {} });
    setOfficerToken(raidId, token);
    renderBanner();
    updateOfficerButton();
    officerPanel.hidden = !isOfficerMode();
    populateBossSelect(assignBoss);
    populateItemSelect(assignItem, assignBoss.value);
    renderPlayersTable();
    if (!getOfficerName(raidId)) promptOfficerName();
  } catch (err) {
    alert(`Невірний токен: ${err.message}`);
  }
});

officerNameBtn.addEventListener('click', promptOfficerName);

lockToggleBtn.addEventListener('click', async () => {
  const token = getOfficerToken(raidId);
  try {
    raid = await apiCall('POST', `/raids/${raidId}/${raid.is_locked ? 'unlock' : 'lock'}`, {
      token,
      body: { officerName: getOfficerName(raidId) }
    });
    renderBanner();
  } catch (err) {
    alert(err.message);
  }
});

statusToggleBtn.addEventListener('click', async () => {
  const token = getOfficerToken(raidId);
  const action = raid.status === 'completed' ? 'reactivate' : 'complete';
  try {
    raid = await apiCall('POST', `/raids/${raidId}/${action}`, {
      token,
      body: { officerName: getOfficerName(raidId) }
    });
    renderBanner();
  } catch (err) {
    alert(err.message);
  }
});

const TAB_PANES = { players: playersPane, items: itemsPane, audit: auditPane };

async function setActiveTab(tab) {
  activeTab = tab;
  raidTabs.forEach((btn) => btn.classList.toggle('raid-tab--active', btn.dataset.tab === tab));
  Object.entries(TAB_PANES).forEach(([key, el]) => { el.hidden = key !== tab; });
  if (tab === 'audit') await loadAudit();
}

raidTabs.forEach((btn) => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));

softBoss.addEventListener('change', () => populateItemSelect(softItem, softBoss.value));
assignBoss.addEventListener('change', () => populateItemSelect(assignItem, assignBoss.value));
assignPlayerNameClear.addEventListener('click', () => {
  assignPlayerNameInput.value = '';
  assignPlayerNameInput.focus();
});
setupNameAutocomplete(assignPlayerNameInput, assignPlayerNameList);
playersSearchInput.addEventListener('input', renderPlayersTable);
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

  const token = getClaimToken(raidId, playerName) || (isOfficerMode() ? getOfficerToken(raidId) : undefined);

  try {
    const result = await apiCall('POST', `/raids/${raidId}/reserves`, { token, body: { playerName, itemId, boss, weight } });
    if (result.claimToken) setClaimToken(raidId, playerName, result.claimToken);
    localStorage.setItem('lastPlayerName', playerName);
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

  const officerName = getOfficerName(raidId);

  try {
    await apiCall('POST', `/raids/${raidId}/officer/assign`, {
      token: getOfficerToken(raidId),
      body: { playerName, itemId, boss, weight, officerName }
    });
    await loadReserves();
    renderPlayersTable();
    renderItemsTable();
    setStatus(`Софт призначено офіцером${officerName ? ' ' + officerName : ''}.`, 'success');
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

  try {
    const [itemsRes, playersRes] = await Promise.all([fetch('/data/raid-items.json'), fetch('/data/players.json')]);
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

  renderBanner();
  updateOfficerButton();
  officerPanel.hidden = !isOfficerMode();

  populateBossSelect(softBoss);
  populateItemSelect(softItem, softBoss.value);
  populateBossSelect(assignBoss);
  populateItemSelect(assignItem, assignBoss.value);
  renderItemsBossFilterOptions();

  const lastName = localStorage.getItem('lastPlayerName');
  if (lastName) softPlayerNameInput.value = lastName;

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
