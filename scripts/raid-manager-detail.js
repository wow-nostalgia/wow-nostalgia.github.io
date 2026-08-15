const raidTitleHeading = document.getElementById('raidTitleHeading');

function stripDateFromTitle(title) {
  return (title || '').replace(/\s*-\s*\d{2}\.\d{2}\.\d{4}$/, '');
}
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
const benchmarkPanel = document.getElementById('benchmarkPanel');
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
const bonusGrantOpenBtn = document.getElementById('bonusGrantOpenBtn');

const officersTab = document.getElementById('officersTab');
const penaltiesTab = document.getElementById('penaltiesTab');
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
const raidItemsList = document.getElementById('raidItemsList');

const potionsPane = document.getElementById('potionsPane');
const potionsAddBtn = document.getElementById('potionsAddBtn');
const potionsClearBtn = document.getElementById('potionsClearBtn');
const potionsHideHealTankLabel = document.getElementById('potionsHideHealTankLabel');
const potionsHideHealTankCheckbox = document.getElementById('potionsHideHealTank');
const potionsSoftedOnlyLabel = document.getElementById('potionsSoftedOnlyLabel');
const potionsSoftedOnlyCheckbox = document.getElementById('potionsSoftedOnly');
const potionsBossCount = document.getElementById('potionsBossCount');
const potionsMetaLabel = document.getElementById('potionsMetaLabel');
const potionsContent = document.getElementById('potionsContent');
const potionLogModal = document.getElementById('potionLogModal');
const potionLogModalBackdrop = document.getElementById('potionLogModalBackdrop');
const potionLogSelect = document.getElementById('potionLogSelect');
const potionLogConfirmBtn = document.getElementById('potionLogConfirmBtn');
const potionLogCancelBtn = document.getElementById('potionLogCancelBtn');

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
const settingsAllowMountSoftsInput = document.getElementById('settingsAllowMountSoftsInput');
const settingsAllowMountSoftsLabel = document.getElementById('settingsAllowMountSoftsLabel');
const bonusGrantModal = document.getElementById('bonusGrantModal');
const bonusGrantModalBackdrop = document.getElementById('bonusGrantModalBackdrop');
const bonusGrantTableBody = document.getElementById('bonusGrantTableBody');
const bonusGrantSaveBtn = document.getElementById('bonusGrantSaveBtn');
const bonusGrantCancelBtn = document.getElementById('bonusGrantCancelBtn');
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
let personalStatsRecords = [];
let potionBossesByRaidUrl = null;
let reserves = [];
let weightTransfers = [];
let bonusGrants = [];
let penaltiesList = [];
let classColorMap = new Map();
// "ім'я::спек" -> { overallRank, rankDelta } з guild-data.json - для колонки
// "Рейтинг сервера" у табі "Лог" (спек беремо з ростеру конкретного рейду,
// бо той самий персонаж може мати різний ранг для різних спеків).
let guildRankByNameSpec = new Map();
let auditEntries = [];
let potionStatsRaids = null;
let raidRosters = null;
let activeTab = 'players';
let honorBoard = [];
let shardQueueIconsByName = new Map(); // player_name -> Set('shard' | 'blood')
let personalStatsPromise = null;
let initialRenderDone = false;

// Реальний день тижня (за Києвом) на момент створення рейду — дні черги
// "Черга на уламки та кров" тепер завжди мають назви днів тижня (без
// перейменування), тому зіставлення напряму за назвою надійне.
function kyivWeekdayLabel(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', weekday: 'long' }).format(date);
}

// Intl повертає "пʼятниця" з апострофом U+02BC, а не звичайним U+0027 —
// прибираємо будь-які варіанти апострофа перед порівнянням назв днів.
function normalizeWeekday(str) {
  return str.replace(/['’ʼ]/g, '').trim().toLocaleLowerCase('uk');
}

// Розбито на фетч (не залежить від raid, можна пускати паралельно з іншими
// запитами в init()/поллінгу) і apply (потребує raid.created_at - викликати,
// тільки коли raid вже завантажений).
async function fetchShardQueueRaw() {
  try {
    const [days, entries] = await Promise.all([
      apiCall('GET', '/shard-queue/days', { token: getSessionToken() }),
      apiCall('GET', '/shard-queue/entries', { token: getSessionToken() })
    ]);
    return { days, entries };
  } catch (err) {
    console.error(err);
    return null;
  }
}

function applyShardQueueRaw(raw) {
  if (!raw) return;
  const { days, entries } = raw;
  const weekday = kyivWeekdayLabel(raid.created_at);
  const matchedDay = days.find((d) => d.is_active && weekday && normalizeWeekday(d.label) === normalizeWeekday(weekday));
  if (!matchedDay) return;

  const caps = { shard: 50, blood: 2 };
  const map = new Map();
  entries
    .filter((e) => e.day_id === matchedDay.id && e.progress < caps[e.resource_type])
    .forEach((e) => {
      if (!map.has(e.player_name)) map.set(e.player_name, new Set());
      map.get(e.player_name).add(e.resource_type);
    });
  shardQueueIconsByName = map;
}

async function loadShardQueueIcons() {
  applyShardQueueRaw(await fetchShardQueueRaw());
}

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
    `Лідер: ${raid.leader_display_name || '—'}`,
    formatDateKyiv(raid.created_at)
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
  penaltiesTab.hidden = !isOfficerMode();
  potionsAddBtn.hidden = !isOfficerMode() || Boolean(raid.potion_log_url);
  potionsClearBtn.hidden = !isOfficerMode() || !raid.potion_log_url;
  // document.activeElement-перевірка: після додавання loadRaid() у 10с
  // поллінг renderBanner() викликається постійно, і без цього застереження
  // він затирав би поле, яке лідер саме зараз редагує на вкладці "Налаштування".
  if (document.activeElement !== settingsTitleInput) settingsTitleInput.value = raid.title;
  if (document.activeElement !== settingsSoftLimitInput) settingsSoftLimitInput.value = raid.soft_limit_total;

  const tl = raid.transfer_weight_limit;
  if (document.activeElement !== transferWeightLimitInput) {
    transferWeightLimitInput.value = (tl === null || tl === undefined || tl > 3) ? '0' : String(tl);
  }
  settingsAllowMountSoftsLabel.hidden = raid.instance !== 'ICC';
  if (document.activeElement !== settingsAllowMountSoftsInput) {
    settingsAllowMountSoftsInput.checked = Boolean(raid.allow_mount_softs);
  }

  applySoftFormLockState();
  applyOfficerFormLockState();
  applySettingsFormLockState();
}

const BENCHMARK_CONTENT = {
  ICC: {
    title: "Планка ЦЛК25ХМ (замір на Орку):",
    items: [
      "Для ролу тринек і пухи з ліча на замірі треба дати загально 16к+ DPS (60к мінімум в треш або +1к в боса. Окрім фмагів та котів - вони треш не б'ють). Для демона -1к. Для кота +1к.",
      "Меньше 13к - софт 1 шмотка (перша з прописаних)"
    ]
  },
  RS: {
    title: "Планка РС25ХМ (замір на генералі):",
    items: [
      "Для ролу тринек на замірі на генералі треба дати 11к+. Для демона, сови, ретріка: 10к. Для кота: 12к.",
      "Недобір дпс на замірі можна перекрити дпс-ом на Халіоні, якщо дати дпс більше планки (цифри по планці div. вище). Остаточне рішення приймає РЛ",
      "Меньше 8к - без шмоту, йдете за льодом"
    ]
  }
};

function renderBenchmarkPanel() {
  const data = BENCHMARK_CONTENT[raid.instance];
  const show = !isOfficerMode() && raid.difficulty === '25H' && data;
  benchmarkPanel.hidden = !show;
  if (!show) return;

  benchmarkPanel.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = data.title;
  benchmarkPanel.appendChild(title);

  const ul = document.createElement('ul');
  ul.className = 'raid-benchmark-list';
  data.items.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    ul.appendChild(li);
  });
  benchmarkPanel.appendChild(ul);

  const note = document.createElement('p');
  note.className = 'raid-benchmark-note';
  note.textContent = 'З детальними правилами наших рейдів можна ознайомитись ';
  const link = document.createElement('a');
  link.href = '../../index.html#rules25hero';
  link.textContent = 'тут';
  note.appendChild(link);
  note.appendChild(document.createTextNode('.'));
  benchmarkPanel.appendChild(note);
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

function getMyBonusGrant() {
  const names = myCharNames();
  return bonusGrants.find((g) => names.includes(g.player_name)) || null;
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

  applyWeightLimit(softWeightToggle, softWeight, locked, remainingWeightFor(softPlayerNameInput.value.trim()));

  const transfersEnabled = (raid.transfer_weight_limit ?? 0) !== 0;
  const myReceived = getMyReceivedTransfer();
  const myBonusGrant = getMyBonusGrant();
  const canShowTransferBtn = currentUser && transfersEnabled && !isRaidCompleted() && !myTransfer && !myReceived && !myBonusGrant && myCharNames().length > 0;
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
  } else if (myReceived) {
    transferNotice.hidden = false;
    transferNotice.textContent = `Ти отримав софт від ${myReceived.from_player}. Розподіли його на вкладці «Предмети».`;
  } else if (myBonusGrant) {
    transferNotice.hidden = false;
    transferNotice.textContent = 'Тобі призначено бонусний софт офіцером. Розподіли його на вкладці «Предмети».';
  } else {
    transferNotice.hidden = true;
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
  bonusGrantOpenBtn.disabled = locked;

  applyWeightLimit(assignWeightToggle, assignWeight, locked, remainingWeightFor(assignPlayerNameInput.value.trim()));
}

function applySettingsFormLockState() {
  const locked = isRaidCompleted();

  settingsTitleInput.disabled = locked;
  settingsSoftLimitInput.disabled = locked;
  transferWeightLimitInput.disabled = locked;
  settingsAllowMountSoftsInput.disabled = locked;
  settingsForm.querySelector('button[type="submit"]').disabled = locked;
}

// Скільки ваги гравець уже витратив на софти в цьому рейді (бонусна вага з
// передач/грантів рахується окремим пулом і сюди не входить).
function usedWeightForPlayer(playerName) {
  if (!playerName) return 0;
  return reserves
    .filter((r) => r.player_name === playerName)
    .reduce((sum, r) => sum + (r.weight || 0), 0);
}

function remainingWeightFor(playerName) {
  return Math.max(0, raid.soft_limit_total - usedWeightForPlayer(playerName));
}

// Кнопки x2/x3 вимикаємо, якщо вони одразу перевищать залишок ваги гравця
// (soft_limit_total мінус уже витрачене на інші софти/маунти — спільний пул).
function applyWeightLimit(toggleEl, hiddenInput, locked, maxWeight) {
  const buttons = [...toggleEl.querySelectorAll('.raid-weight-toggle-btn')];
  buttons.forEach((btn) => {
    btn.disabled = locked || Number(btn.dataset.weight) > maxWeight;
  });

  if (Number(hiddenInput.value) > maxWeight) {
    const fallbackBtn = buttons.filter((b) => !b.disabled).at(-1) || buttons[0];
    hiddenInput.value = fallbackBtn.dataset.weight;
    buttons.forEach((b) => b.classList.toggle('raid-weight-toggle-btn--active', b === fallbackBtn));
  }
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

// Таб "Поти" - найпростіший референс на лог зі "Статистика Potion":
// у raids зберігається лише raidUrl обраного логу, самі дані потів
// (гравці/лічильники) ніде не дублюються в БД, а фетчаться напряму з
// data/potion-stats.json, як і на самій сторінці Статистики.
// isSafeUrl/getPlayerSpecIcon/getPlayerClassColor/getPotionRowClass/
// formatPotionLogLabel - спільні з potion-stats.js, див. potion-shared.js.

async function ensurePotionStatsLoaded() {
  if (potionStatsRaids) return potionStatsRaids;
  const res = await fetch('/data/potion-stats.json?t=' + Date.now());
  potionStatsRaids = filterAndSortPotionRaids(await res.json());
  return potionStatsRaids;
}

async function ensureRaidRostersLoaded() {
  if (raidRosters) return raidRosters;
  const res = await fetch('/data/raid-rosters.json?t=' + Date.now());
  raidRosters = buildRosterMap(await res.json());
  return raidRosters;
}

// personal-stats.json важить ~3.4 МБ (усі per-boss пули DPS усіх рейдів) —
// на цій сторінці з нього реально треба лише список імен (personalAnalyticsNames,
// чи робити ім'я гравця посиланням) і, окремо, підрахунок босів для вкладки
// "Поти" (getPotionBossMap). Замість блокувати початковий рендер сторінки
// цим файлом - вантажимо його у фоні (мемоізовано) і доре-рендерюємо
// таблиці, коли він прийде; вкладка "Поти" чекає той самий проміс явно.
function ensurePersonalStatsLoaded() {
  if (!personalStatsPromise) {
    personalStatsPromise = fetch('/data/personal-stats.json?t=' + Date.now())
      .then((res) => res.json())
      .then((personalStats) => {
        personalStatsRecords = personalStats;
        for (const record of personalStats) {
          for (const player of record.players || []) {
            personalAnalyticsNames.add(player.name);
          }
        }
        return personalStats;
      })
      .catch((err) => {
        console.error(err);
        return [];
      })
      .then((personalStats) => {
        if (initialRenderDone) {
          renderPlayersTable();
          renderItemsTable();
        }
        return personalStats;
      });
  }
  return personalStatsPromise;
}

function findRosterEntry(raidUrl) {
  return raidRosters?.get(raidUrl) || null;
}

function findPotionLogEntry(raidUrl) {
  if (!raidUrl || !potionStatsRaids) return null;
  return potionStatsRaids.find((r) => r.raidUrl === raidUrl || (r.mergedFrom || []).includes(raidUrl)) || null;
}

// Той самий підрахунок босів логу й та сама планка "потів/бос", що на
// сторінці Статистика Potion (scripts/potion-stats.js) - лише джерело
// даних тут вже завантажене раніше в init() як personalStatsRecords.
function getPotionBossMap() {
  if (!potionBossesByRaidUrl) potionBossesByRaidUrl = buildBossCountMap(personalStatsRecords);
  return potionBossesByRaidUrl;
}

function getPotionBossCount(statsRaid) {
  return countRaidBosses(getPotionBossMap(), statsRaid);
}

function renderPotionLogTable(statsRaid) {
  const bossCount = statsRaid ? getPotionBossCount(statsRaid) : 0;

  potionsBossCount.hidden = !bossCount;
  if (bossCount) potionsBossCount.textContent = `Босів: ${bossCount}`;

  potionsMetaLabel.hidden = !statsRaid;
  if (statsRaid) {
    potionsMetaLabel.textContent = `UwU-Log від ${statsRaid.date || 'Невідома дата'}`;
    potionsMetaLabel.href = isSafeUrl(statsRaid.raidUrl) ? statsRaid.raidUrl : '#';
  }
  potionsSoftedOnlyLabel.hidden = !statsRaid;
  potionsHideHealTankLabel.hidden = !statsRaid;
  potionsContent.innerHTML = '';

  if (!statsRaid) {
    const empty = document.createElement('p');
    empty.className = 'raid-potion-empty';
    empty.textContent = raid.potion_log_url
      ? 'Обраний лог не знайдено у Статистиці Potion.'
      : 'Лог ще не обрано.';
    potionsContent.appendChild(empty);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'ranking-table-wrap';
  const table = document.createElement('table');
  table.className = 'raid-table';
  table.innerHTML = "<thead><tr><th>Ім'я</th><th><abbr class=\"table-header-icon\" aria-label=\"Рейтинг сервера\">" + RANK_HEADER_ICON_SVG + "</abbr></th><th>Всього</th><th>Potion of Speed</th><th>Potion of Wild Magic</th><th>Insane Strength Potion</th><th>Потів/бос за всі рейди</th></tr></thead>";
  // .tooltipped::after тут обрізається (той самий клипаючий-контейнер
  // патерн, що й .raid-tables-grid .ranking-table-wrap - див. ui-consistency
  // SKILL.md) - тому JS-тултіп, не CSS-клас.
  applyAutoTooltip(table.querySelector('.table-header-icon'));
  const tbody = document.createElement('tbody');

  const rosterEntry = findRosterEntry(statsRaid.raidUrl);

  let players = statsRaid.players || [];
  if (potionsSoftedOnlyCheckbox.checked) {
    players = players.filter((player) => getPlayersWithSoftsSet().has(player.name));
  }
  if (potionsHideHealTankCheckbox.checked) {
    players = players.filter((player) => !isHealOrTankPlayer(rosterEntry, player.name));
  }

  players.forEach((player) => {
    const tr = document.createElement('tr');
    tr.className = getPotionRowClass(player, bossCount);
    const nameTd = document.createElement('td');
    nameTd.className = 'raid-potion-name-cell';
    const nameWrap = document.createElement('span');
    nameWrap.className = 'potion-name-wrap';
    nameWrap.style.color = getPlayerClassColor(rosterEntry, player.name, classColorMap);
    const specIcon = getPlayerSpecIcon(rosterEntry, player.name);
    if (specIcon) {
      const iconImg = document.createElement('img');
      iconImg.className = 'raid-item-icon';
      iconImg.src = specIconUrl(specIcon);
      iconImg.alt = '';
      nameWrap.appendChild(iconImg);
    }
    const nameEl = document.createElement('span');
    nameEl.textContent = player.name;
    const isGuild = guildMemberNames.has(player.name);
    const ownerName = characterOwnerNames.get(player.name);
    nameEl.setAttribute('aria-label', `${player.name} - ${isGuild ? 'Ностальгія' : 'Легіонер'}${ownerName ? ` (${ownerName})` : ''}`);
    bindTooltip(nameEl);
    nameWrap.appendChild(nameEl);
    nameTd.appendChild(nameWrap);
    tr.appendChild(nameTd);

    const playerSpec = findRosterPlayer(rosterEntry, player.name)?.spec;
    const rankTd = document.createElement('td');
    rankTd.className = 'raid-potion-rank-cell';
    renderRankCell(rankTd, guildRankByNameSpec.get(`${player.name}::${playerSpec}`));
    tr.appendChild(rankTd);

    [player.total, player.potionOfSpeed, player.potionOfWildMagic, player.potionOfInsaneStrength].forEach((value) => {
      const td = document.createElement('td');
      td.textContent = Number(value || 0);
      tr.appendChild(td);
    });

    const hbEntry = honorBoard.find((r) => r.name === player.name);
    const potionTd = document.createElement('td');
    potionTd.textContent = hbEntry ? hbEntry.averagePotionsPerBoss.toFixed(2) : '—';
    potionTd.className = 'penalty-potion-stat';
    tr.appendChild(potionTd);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  potionsContent.appendChild(wrap);
}

async function loadPotionsTab() {
  await Promise.all([ensurePotionStatsLoaded(), ensureRaidRostersLoaded(), ensurePersonalStatsLoaded()]);
  renderPotionLogTable(findPotionLogEntry(raid.potion_log_url));
}

// Дозволяє офіцеру в будь-який момент обрати інший лог замість поточного
// через кнопку видалення + повторне "Додати".
async function setPotionLog(raidUrl) {
  try {
    raid = await apiCall('PATCH', `/raids/${raidId}/potion-log`, { token: getSessionToken(), body: { raidUrl } });
    potionsAddBtn.hidden = !isOfficerMode() || Boolean(raid.potion_log_url);
    potionsClearBtn.hidden = !isOfficerMode() || !raid.potion_log_url;
    renderPotionLogTable(findPotionLogEntry(raid.potion_log_url));
  } catch (err) {
    alert(err.message);
  }
}

// Той самий патерн, що showTransferModal(): попап із <select>, а не
// інлайновий пошук - список логів однаково короткий, і зайвий автокомпліт
// був би зайвим ускладненням.
async function showPotionLogModal() {
  const raids = await ensurePotionStatsLoaded();

  potionLogSelect.innerHTML = '';
  raids.forEach((statsRaid) => {
    const opt = document.createElement('option');
    opt.value = statsRaid.raidUrl;
    opt.textContent = formatPotionLogLabel(statsRaid);
    potionLogSelect.appendChild(opt);
  });
  if (raid.potion_log_url) potionLogSelect.value = raid.potion_log_url;

  potionLogModal.hidden = false;
}

// Розбито так само, як fetchShardQueueRaw/applyShardQueueRaw - fetchOfficers
// не залежить від raid і може йти паралельно з іншими запитами, applyOfficers
// потребує вже завантаженого raid (renderOfficersPanel читає raid.leader_*).
function fetchOfficers() {
  return apiCall('GET', `/raids/${raidId}/officers`, { token: getSessionToken() });
}

function applyOfficers(officers) {
  raidOfficerIds = new Set(officers.map((o) => o.discord_id));
  officersTab.hidden = !isOfficerMode();
  renderOfficersPanel(officers);
}

async function loadOfficers() {
  applyOfficers(await fetchOfficers());
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
  let items = (itemsCatalog[boss] || {})[raid.difficulty] || [];
  if (!raid.allow_mount_softs) items = items.filter((item) => item.type !== 'Mount');
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

// showBtnTooltip/hideBtnTooltip/bindTooltip/btnTooltipEl - у ui-shared.js
// (спільні для цієї сторінки й shard-queue.js).

document.addEventListener('mousemove', (event) => {
  if (event.target.closest('.raid-remove-btn')) {
    if (currentTooltipItemId !== null) {
      itemTooltipEl.hidden = true;
      currentTooltipItemId = null;
    }
    return;
  }

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
  softPlayerNameInput.style.color = color || 'var(--color-text-faint)';
}

function populateMyCharacters() {
  softPlayerNameInput.innerHTML = '';
  noCharactersHint.hidden = myCharacters.length > 0;

  myCharacters.forEach(({ characterName: name }) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    const color = classColorMap.get(name);
    opt.style.color = color || 'var(--color-text-faint)';
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

function groupReservesByPlayer(list) {
  const map = new Map();
  list.forEach((r) => {
    if (r.player_name === null) return; // приховано сервером (режим hidden_reserves)
    if (!map.has(r.player_name)) map.set(r.player_name, []);
    map.get(r.player_name).push(r);
  });
  return map;
}

// "Мінус до софту" - штраф у вагових одиницях, не в кількості предметів.
// З'їдаємо softPenalty вагу з кінця списку речей гравця: предмет, чиєї ваги
// вистачає щоб покрити залишок штрафу - гаситься повністю (сірий), інакше
// у нього лишається (вага - штраф), відображається звичайним кольором,
// але з червоним чіпсом.
function computeSoftPenaltyDeductions(orderedReserves, softPenalty) {
  const deductions = new Map(); // reserveId -> { deduct, fullyPenalized }
  let remaining = softPenalty;
  for (let i = orderedReserves.length - 1; i >= 0 && remaining > 0; i--) {
    const r = orderedReserves[i];
    const weight = (r.weight || 0) + (r.bonus_weight || 0) + (r.officer_bonus_weight || 0);
    if (weight <= remaining) {
      deductions.set(r.id, { deduct: weight, fullyPenalized: true });
      remaining -= weight;
    } else {
      deductions.set(r.id, { deduct: remaining, fullyPenalized: false });
      remaining = 0;
    }
  }
  return deductions;
}

// Той самий набір імен, що потрапляє у таб "Гравці" - засофчені +
// учасники передач софту (можуть мати 0 власних софтів).
function getPlayersWithSoftsSet() {
  const names = new Set(groupReservesByPlayer(reserves).keys());
  weightTransfers.forEach((t) => {
    names.add(t.from_player);
    names.add(t.to_player);
  });
  return names;
}

function renderPlayersTable() {
  raidPlayersBody.innerHTML = '';

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

    let nameEl;
    if (personalAnalyticsNames.has(name)) {
      nameEl = document.createElement('a');
      nameEl.href = `../../guild-ranking/?${new URLSearchParams({ view: 'player', player: name }).toString()}`;
      nameEl.textContent = name;
    } else {
      nameEl = document.createElement('span');
      nameEl.textContent = name;
    }
    nameEl.style.color = classColorMap.get(name) || 'var(--color-text-faint)';

    const ownerName = characterOwnerNames.get(name);
    if (ownerName) {
      nameEl.setAttribute('aria-label', ownerName);
      bindTooltip(nameEl);
    }
    nameWrap.appendChild(nameEl);

    const queuedResources = shardQueueIconsByName.get(name);
    if (queuedResources) {
      const labels = { shard: 'Уламки', blood: 'Кров' };
      ['shard', 'blood'].forEach((resourceType) => {
        if (queuedResources.has(resourceType)) {
          nameWrap.appendChild(createResourceIcon(resourceType, `У черзі на ${labels[resourceType]} на сьогодні`));
        }
      });
    }
    nameTd.appendChild(nameWrap);
    tr.appendChild(nameTd);

    const itemsTd = document.createElement('td');
    itemsTd.className = 'raid-softs-col';
    const manageable = canManage(name);

    const fromTransfer = weightTransfers.find((t) => t.from_player === name);
    if (fromTransfer) {
      const indicator = document.createElement('span');
      indicator.className = 'raid-transfer-indicator raid-transfer-indicator--from';
      indicator.textContent = `→ ${fromTransfer.to_player}`;
      itemsTd.appendChild(indicator);

      const canCancel = isOfficerMode() || myNames.includes(name);
      if (canCancel && !isRaidCompleted()) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'raid-remove-btn';
        cancelBtn.setAttribute('aria-label', 'Скасувати передачу софту');
        cancelBtn.textContent = '✕';
        cancelBtn.addEventListener('click', () => deleteTransfer(name));
        bindTooltip(cancelBtn);
        itemsTd.appendChild(cancelBtn);
      }
    }

    const playerReserves = grouped.get(name);
    const softPenalty = penaltiesList.find((p) => p.player_name === name)?.soft_penalty ?? 0;
    const penaltyDeductions = computeSoftPenaltyDeductions(playerReserves, softPenalty);

    playerReserves.forEach((r) => {
      const itemSpan = document.createElement('span');
      itemSpan.className = 'raid-reserve-item';
      itemSpan.dataset.itemId = r.item_id;

      const deduction = penaltyDeductions.get(r.id);
      const effectiveWeight = (r.weight || 0) + (r.bonus_weight || 0) + (r.officer_bonus_weight || 0);

      const weightBadge = document.createElement('span');
      if (deduction && !deduction.fullyPenalized) {
        weightBadge.className = 'raid-weight-badge raid-weight-badge--penalized';
        weightBadge.textContent = formatWeight(effectiveWeight - deduction.deduct);
      } else {
        weightBadge.className = 'raid-weight-badge';
        weightBadge.textContent = formatWeight(effectiveWeight);
      }
      itemSpan.appendChild(weightBadge);

      const itemInfo = findItemInfo(r.item_id, r.boss);
      itemSpan.appendChild(createItemIcon(r.item_id));
      const nameEl = document.createElement('span');
      nameEl.className = `${itemRarityClass(r.item_id)}${r.is_received ? ' raid-item-received' : ''}`;
      nameEl.textContent = ` ${itemInfo ? translateItem(itemInfo.name) : `#${r.item_id}`}`;
      itemSpan.appendChild(nameEl);

      if (deduction && deduction.fullyPenalized) {
        itemSpan.classList.add('raid-reserve-item--penalized');
      }

      if (manageable) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'raid-remove-btn';
        delBtn.textContent = '✕';
        delBtn.setAttribute('aria-label', 'Видалити цей софт');
        delBtn.disabled = isRaidCompleted();
        delBtn.addEventListener('click', () => removeReserve(r));
        bindTooltip(delBtn);
        itemSpan.appendChild(delBtn);
      }

      itemsTd.appendChild(itemSpan);
    });

    tr.appendChild(itemsTd);

    raidPlayersBody.appendChild(tr);
  });
}

function buildBonusControls({ reserveId, bonusWeight, canAdd, canRemove, allowStackOnSameItem }) {
  const bonusSpan = document.createElement('span');
  bonusSpan.className = 'raid-bonus-controls';

  if (bonusWeight > 0) {
    const chip = document.createElement('span');
    chip.className = 'raid-bonus-chip';
    chip.textContent = `+${bonusWeight}`;
    bonusSpan.appendChild(chip);
  }

  // Для бонусного софту від офіцера (bonusGrant) вага розподіляється по
  // предмету лише раз - кнопку "+" ховаємо повністю після першого кліку.
  // Для переданої гравцем ваги (weightTransfer) обмеження нема - весь пул
  // можна стакати на одному предметі, якщо в гравця більше нема на що
  // його розподілити (allowStackOnSameItem).
  if ((bonusWeight === 0 || allowStackOnSameItem) && canAdd) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'raid-transfer-btn raid-transfer-btn--add';
    addBtn.textContent = '+';
    addBtn.setAttribute('aria-label', 'Додати бонусну вагу');
    addBtn.addEventListener('click', () => changeBonusWeight(reserveId, 1));
    bindTooltip(addBtn);
    bonusSpan.appendChild(addBtn);
  }

  if (canRemove) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'raid-remove-btn';
    removeBtn.textContent = '−';
    removeBtn.setAttribute('aria-label', 'Прибрати бонусну вагу');
    removeBtn.addEventListener('click', () => changeBonusWeight(reserveId, -1));
    bindTooltip(removeBtn);
    bonusSpan.appendChild(removeBtn);
  }

  return bonusSpan;
}

// Групує резерви по вазі — окремий рядок на кожну вагу, щоб не плодити
// купу однакових чіпсів "x1" поряд з кожним іменем.
function buildReservesByWeight(reservers, penaltyDeductions) {
  const wrap = document.createElement('div');
  wrap.className = 'raid-reserve-weight-list';

  const byWeight = new Map();
  const partialRows = [];
  reservers.forEach((r) => {
    const effectiveWeight = (r.weight || 0) + (r.bonus_weight || 0) + (r.officer_bonus_weight || 0);
    const deduction = penaltyDeductions.get(r.id);

    // Часткове "з'їдання" ваги штрафом - речі не вистачило ваги іншим
    // гравцям на цю ж вагу, показуємо окремим рядком зі зменшеним чіпсом,
    // а не ховаємо всю вагу цілком.
    if (deduction && !deduction.fullyPenalized && r.player_name !== null) {
      partialRows.push({ weight: effectiveWeight - deduction.deduct, name: r.player_name, id: r.id });
      return;
    }

    if (!byWeight.has(effectiveWeight)) byWeight.set(effectiveWeight, { visible: [], hidden: 0 });
    if (r.player_name !== null) {
      byWeight.get(effectiveWeight).visible.push({ name: r.player_name, id: r.id, fullyPenalized: !!(deduction && deduction.fullyPenalized) });
    } else byWeight.get(effectiveWeight).hidden++;
  });

  const rows = [...byWeight.keys()].map((weight) => ({ weight, entry: byWeight.get(weight), partial: null }))
    .concat(partialRows.map((p) => ({ weight: p.weight, entry: null, partial: p })))
    .sort((a, b) => a.weight - b.weight);

  rows.forEach(({ weight, entry, partial }) => {
    const row = document.createElement('div');
    row.className = 'raid-reserve-weight-row';

    const weightBadge = document.createElement('span');
    weightBadge.className = partial ? 'raid-weight-badge raid-weight-badge--penalized' : 'raid-weight-badge';
    weightBadge.textContent = formatWeight(weight);
    row.appendChild(weightBadge);

    const namesSpan = document.createElement('span');
    namesSpan.className = 'raid-reserve-weight-names';

    if (partial) {
      const nameSpan = document.createElement('span');
      nameSpan.style.color = classColorMap.get(partial.name) || 'var(--color-text-faint)';
      nameSpan.textContent = partial.name;
      namesSpan.appendChild(nameSpan);
      const p = penaltiesList.find((x) => x.player_name === partial.name);
      if (p && p.roll_penalty > 0) {
        const penSpan = document.createElement('span');
        penSpan.className = 'penalty-value--active';
        penSpan.textContent = ` (-${p.roll_penalty})`;
        namesSpan.appendChild(penSpan);
      }
      row.appendChild(namesSpan);
      wrap.appendChild(row);
      return;
    }

    const visibleNames = entry.visible;
    visibleNames.forEach(({ name, id, fullyPenalized }, i) => {
      const p = penaltiesList.find((x) => x.player_name === name);
      const nameSpan = document.createElement('span');
      if (fullyPenalized) nameSpan.className = 'raid-reserve-item--penalized';
      nameSpan.style.color = classColorMap.get(name) || 'var(--color-text-faint)';
      nameSpan.textContent = name;
      namesSpan.appendChild(nameSpan);
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
  raidItemsList.innerHTML = '';

  const myReceivedForItems = getMyReceivedTransfer();
  const myBonusGrantForItems = getMyBonusGrant();
  const myNamesForItems = myCharNames();
  let bonusPoolForItems = 0;
  let usedBonusForItems = 0;
  if ((myReceivedForItems || myBonusGrantForItems) && currentUser) {
    bonusPoolForItems = raid.transfer_weight_limit ?? raid.soft_limit_total;
    usedBonusForItems = reserves
      .filter((r) => myNamesForItems.includes(r.player_name))
      .reduce((s, r) => s + (r.bonus_weight || 0), 0);
    bonusPoolBanner.hidden = false;
    const bonusSource = myReceivedForItems ? `від ${myReceivedForItems.from_player}` : 'від офіцера';
    bonusPoolBanner.textContent = `Бонусна вага ${bonusSource}: ${usedBonusForItems}/${bonusPoolForItems} використано.`;
  } else {
    bonusPoolBanner.hidden = true;
  }

  // Показуємо лише засофчені предмети (раніше це був чекбокс "Тільки
  // засофчені", тепер поведінка постійна). Окремий фільтр маунтів більше не
  // потрібен: маунт без софтів і так не проходить умову нижче.
  const isSofted = (item) => (raid.hidden_reserves && !isOfficerMode()
    ? reserves.some((r) => r.item_id === item.id && r.discord_id === currentUser?.discordId)
    : reserves.some((r) => r.item_id === item.id));

  const penaltyDeductions = new Map();
  const groupedForPenalty = groupReservesByPlayer(reserves);
  for (const [pName, pReserves] of groupedForPenalty) {
    const softPenalty = penaltiesList.find((p) => p.player_name === pName)?.soft_penalty ?? 0;
    if (softPenalty > 0) {
      computeSoftPenaltyDeductions(pReserves, softPenalty).forEach((v, id) => penaltyDeductions.set(id, v));
    }
  }

  const bonusCtx = {
    myNames: myNamesForItems,
    hasBonusPool: Boolean(myReceivedForItems || myBonusGrantForItems),
    allowStackOnSameItem: Boolean(myReceivedForItems),
    canAdd: usedBonusForItems < bonusPoolForItems
  };

  // У режимі прихованих софтів не-офіцер бачить лише свої софти, тож
  // порожній бос там не означає "ніхто не софтив" - позначку не ставимо.
  const canTellEmpty = !raid.hidden_reserves || isOfficerMode();

  // Замість дропдауна з вибором боса - усі боси одразу, кожен окремою
  // таблицею. Бос лишається в списку навіть без жодного софта: тоді його
  // таблиця складається з одного рядка-заголовка.
  bossesWithCatalog().forEach((boss) => {
    const items = ((itemsCatalog[boss] || {})[raid.difficulty] || []).filter(isSofted);
    raidItemsList.appendChild(buildBossItemsTable(boss, items, canTellEmpty, penaltyDeductions, bonusCtx));
  });
}

function buildBossItemsTable(boss, items, canTellEmpty, penaltyDeductions, bonusCtx) {
  const wrap = document.createElement('div');
  wrap.className = 'ranking-table-wrap';

  const table = document.createElement('table');
  table.className = 'raid-table raid-items-table';

  // Ширини колонок задає <colgroup>, а не перший рядок: заголовок боса
  // йде через colspan=2 і при table-layout:fixed сам їх не визначає.
  const colgroup = document.createElement('colgroup');
  colgroup.appendChild(document.createElement('col'));
  colgroup.appendChild(document.createElement('col'));
  table.appendChild(colgroup);

  const tbody = document.createElement('tbody');
  tbody.appendChild(buildItemsBossHeaderRow(boss, canTellEmpty && items.length === 0));
  items.forEach((item) => {
    tbody.appendChild(buildItemRow(item, penaltyDeductions, bonusCtx));
  });
  table.appendChild(tbody);

  wrap.appendChild(table);
  return wrap;
}

function buildItemsBossHeaderRow(boss, isEmpty) {
  const tr = document.createElement('tr');
  tr.className = 'raid-items-boss-row';
  const td = document.createElement('td');
  td.colSpan = 2;

  const nameSpan = document.createElement('span');
  nameSpan.textContent = translateBoss(boss);
  td.appendChild(nameSpan);

  if (isEmpty) {
    const emptySpan = document.createElement('span');
    emptySpan.className = 'raid-items-boss-empty';
    emptySpan.textContent = 'Софти відсутні';
    td.appendChild(emptySpan);
  }

  tr.appendChild(td);
  return tr;
}

function buildItemRow(item, penaltyDeductions, bonusCtx) {
  const tr = document.createElement('tr');

  const nameTd = document.createElement('td');
  const nameWrap = document.createElement('span');
  nameWrap.className = 'raid-item-name-cell';

  // data-item-id (тригер тултіпа) висить на внутрішньому span з іконкою та
  // назвою, а не на .raid-item-name-cell: та розтягнута на всю ширину
  // комірки під кнопку бонусної ваги, тому тултіп виринав би й на порожньому
  // місці праворуч від назви.
  const nameHit = document.createElement('span');
  nameHit.className = 'raid-item-name-hit';
  nameHit.dataset.itemId = item.id;
  nameHit.appendChild(createItemIcon(item.id));
  const nameSpan = document.createElement('span');
  nameSpan.className = itemRarityClass(item.id);
  nameSpan.textContent = translateItem(item.name);
  nameHit.appendChild(nameSpan);
  nameWrap.appendChild(nameHit);
  nameTd.appendChild(nameWrap);
  tr.appendChild(nameTd);

  const reserversTd = document.createElement('td');
  reserversTd.className = 'raid-softs-col';
  const reservers = reserves.filter((r) => r.item_id === item.id);

  const myReserveForItem = reservers.find((r) => bonusCtx.myNames.includes(r.player_name));
  const bonusContext = bonusCtx.hasBonusPool && currentUser && !isRaidCompleted() && myReserveForItem
    ? {
      reserveId: myReserveForItem.id,
      bonusWeight: myReserveForItem.bonus_weight || 0,
      canAdd: bonusCtx.canAdd,
      canRemove: (myReserveForItem.bonus_weight || 0) > 0,
      allowStackOnSameItem: bonusCtx.allowStackOnSameItem
    }
    : null;

  // Кнопка керування бонусною вагою - приклеєна до правого краю колонки
  // "Предмет", а не до імені гравця в колонці софтів.
  if (bonusContext) nameWrap.appendChild(buildBonusControls(bonusContext));

  if (raid.hidden_reserves && !isOfficerMode()) {
    // Приховані резерви - імена інших не показуємо.
    reserversTd.textContent = '';
  } else if (!reservers.length) {
    reserversTd.textContent = '—';
  } else {
    reserversTd.appendChild(buildReservesByWeight(reservers, penaltyDeductions));
  }

  tr.appendChild(reserversTd);
  return tr;
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
    case 'officer_bonus_weight':
      return hideSoftDetails
        ? `${d.delta > 0 ? 'додав' : 'прибрав'} офіцерську вагу`
        : `${d.delta > 0 ? 'додав' : 'прибрав'} офіцерську вагу гравцю ${d.playerName} (${translateBoss(d.boss)})`;
    case 'hide_reserves': return "увімкнув режим прихованих софтів";
    case 'show_reserves': return "вимкнув режим прихованих софтів";
    case 'complete': return 'завершив рейд';
    case 'reactivate': return 'реактивував рейд';
    case 'officer_add': return `додав офіцера ${d.username || d.discordId}`;
    case 'officer_remove': return `видалив офіцера ${d.discordId}`;
    case 'weight_transfer': return `передав вагу гравцю ${d.toPlayer}`;
    case 'weight_transfer_cancel': return `скасував передачу ваги від ${d.fromPlayer} до ${d.toPlayer}`;
    case 'bonus_grant':
      return hideSoftDetails ? 'призначив бонусний софт' : `призначив бонусний софт гравцю ${d.playerName}`;
    case 'bonus_grant_cancel':
      return hideSoftDetails ? 'скасував бонусний софт' : `скасував бонусний софт гравцю ${d.playerName}`;
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

async function loadBonusGrants() {
  try {
    bonusGrants = await apiCall('GET', `/raids/${raidId}/bonus-grants`, { token: getSessionToken() });
  } catch {
    bonusGrants = [];
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
    applySoftFormLockState();
    applyOfficerFormLockState();
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

const TAB_PANES = { players: playersPane, items: itemsPane, potions: potionsPane, audit: auditPane, penalties: penaltiesPane, officers: officersPane, settings: settingsPane };

async function setActiveTab(tab) {
  activeTab = tab;
  raidTabs.forEach((btn) => btn.classList.toggle('raid-tab--active', btn.dataset.tab === tab));
  Object.entries(TAB_PANES).forEach(([key, el]) => { el.hidden = key !== tab; });
  if (tab === 'audit') await loadAudit();
  if (tab === 'penalties') await loadAndRenderPenalties();
  if (tab === 'potions') await loadPotionsTab();
}

raidTabs.forEach((btn) => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));

softPlayerNameInput.addEventListener('change', () => {
  localStorage.setItem(LS_CHAR_KEY, softPlayerNameInput.value);
  updateSoftPlayerNameColor();
  applySoftFormLockState();
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
  applyOfficerFormLockState();
});
assignPlayerNameInput.addEventListener('input', () => applyOfficerFormLockState());
setupNameAutocomplete(assignPlayerNameInput, assignPlayerNameList);
setupUserSearchAutocomplete(addOfficerInput, addOfficerList, addOfficer);
potionsAddBtn.addEventListener('click', () => showPotionLogModal());
potionsClearBtn.addEventListener('click', () => setPotionLog(null));
potionsSoftedOnlyCheckbox.addEventListener('change', () => renderPotionLogTable(findPotionLogEntry(raid.potion_log_url)));
potionsHideHealTankCheckbox.addEventListener('change', () => renderPotionLogTable(findPotionLogEntry(raid.potion_log_url)));
potionLogConfirmBtn.addEventListener('click', () => {
  const raidUrl = potionLogSelect.value;
  potionLogModal.hidden = true;
  if (raidUrl) setPotionLog(raidUrl);
});
potionLogCancelBtn.addEventListener('click', () => { potionLogModal.hidden = true; });
potionLogModalBackdrop.addEventListener('click', () => { potionLogModal.hidden = true; });

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
    applySoftFormLockState();
    applyOfficerFormLockState();
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
    applySoftFormLockState();
    applyOfficerFormLockState();
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
      body: { title, softLimitTotal, transferWeightLimit, allowMountSofts: settingsAllowMountSoftsInput.checked }
    });
    raidTitleHeading.textContent = stripDateFromTitle(raid.title);
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
    const nameEl = document.createElement('span');
    nameEl.style.color = classColorMap.get(player_name) || 'var(--color-text-faint)';
    nameEl.textContent = player_name;

    const ownerName = characterOwnerNames.get(player_name);
    if (ownerName) {
      nameEl.setAttribute('aria-label', ownerName);
      bindTooltip(nameEl);
    }

    nameWrap.appendChild(nameEl);
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

function showBonusGrantModal() {
  const names = [...getPlayersWithSoftsSet()].sort((a, b) => a.localeCompare(b, 'uk'));
  const grantedNames = new Set(bonusGrants.map((g) => g.player_name));

  bonusGrantTableBody.innerHTML = '';
  names.forEach((name) => {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.textContent = name;
    nameTd.style.color = classColorMap.get(name) || 'var(--color-text-faint)';
    const checkTd = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.player = name;
    checkbox.checked = grantedNames.has(name);
    checkTd.appendChild(checkbox);
    tr.appendChild(nameTd);
    tr.appendChild(checkTd);
    bonusGrantTableBody.appendChild(tr);
  });

  bonusGrantModal.hidden = false;
}

bonusGrantOpenBtn.addEventListener('click', () => showBonusGrantModal());

bonusGrantSaveBtn.addEventListener('click', async () => {
  const grantedNames = new Set(bonusGrants.map((g) => g.player_name));
  const checkedNames = new Set(
    [...bonusGrantTableBody.querySelectorAll('input[type="checkbox"]')]
      .filter((cb) => cb.checked)
      .map((cb) => cb.dataset.player)
  );

  const toGrant = [...checkedNames].filter((name) => !grantedNames.has(name));
  const toRevoke = [...grantedNames].filter((name) => !checkedNames.has(name));

  bonusGrantSaveBtn.disabled = true;
  try {
    await Promise.all([
      ...toGrant.map((playerName) => apiCall('POST', `/raids/${raidId}/bonus-grants`, {
        token: getSessionToken(),
        body: { playerName }
      })),
      ...toRevoke.map((playerName) => apiCall('DELETE', `/raids/${raidId}/bonus-grants/${encodeURIComponent(playerName)}`, {
        token: getSessionToken()
      }))
    ]);
    await loadBonusGrants();
    await loadReserves();
    renderPlayersTable();
    renderItemsTable();
    applySoftFormLockState();
    bonusGrantModal.hidden = true;
    setStatus('Бонусний софт оновлено.', 'success');
  } catch (err) {
    await loadBonusGrants();
    setStatus(`Помилка: ${err.message}`, 'error');
  } finally {
    bonusGrantSaveBtn.disabled = false;
  }
});

bonusGrantCancelBtn.addEventListener('click', () => { bonusGrantModal.hidden = true; });
bonusGrantModalBackdrop.addEventListener('click', () => { bonusGrantModal.hidden = true; });

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

  // personal-stats.json (~3.4 МБ) на цій сторінці потрібен лише для
  // некритичних речей (лінки на імена, вкладка "Поти") - не блокуємо ним
  // рендер, вантажимо у фоні (ensurePersonalStatsLoaded сама доре-рендерить
  // таблиці, коли дані прийдуть).
  ensurePersonalStatsLoaded();

  // Усі незалежні запити цієї сторінки запускаємо одночасно замість await
  // одне за одним - раніше це були ~9 послідовних round-trip'ів до Worker'а.
  // Кожен fetch/apiCall стартує одразу (до першого await всередині нього),
  // тож просте оголошення змінних тут вже паралелить мережеві виклики;
  // await нижче лише чекає на вже запущені запити в потрібному порядку.
  const staticDataPromise = Promise.all([
    fetch('/data/raid-items.json?t=' + Date.now()),
    fetch('/data/players.json?t=' + Date.now()),
    fetch(apiUrl('/characters/owners')).catch(() => null),
    fetch('/data/guild-data.json?t=' + Date.now()).catch(() => null),
    fetch('/data/honor-board.json?t=' + Date.now()).catch(() => null),
    loadItemIconData()
  ]);

  let raidError = null;
  const raidPromise = loadRaid().catch((err) => { raidError = err; });
  const officersPromise = fetchOfficers();
  const reservesPromise = loadReserves();
  const transfersPromise = loadTransfers();
  const bonusGrantsPromise = loadBonusGrants();
  const penaltiesPromise = loadPenalties();
  const shardQueueRawPromise = fetchShardQueueRaw();
  const myCharactersPromise = apiCall('GET', '/auth/me/characters', { token: getSessionToken() })
    .catch((err) => { console.error(err); return null; });

  try {
    const [itemsRes, playersRes, ownersRes, guildDataRes, honorBoardRes] = await staticDataPromise;
    itemsCatalog = await itemsRes.json();
    if (playersRes.ok) {
      const players = await playersRes.json();
      guildMemberNames = new Set(players.map((p) => p.name));
      setGuildMemberNamesSorted(players);
    }
    if (ownersRes?.ok) {
      characterOwnerNames = new Map(Object.entries(await ownersRes.json()));
    }
    if (guildDataRes?.ok) {
      const guildData = await guildDataRes.json();
      classColorMap = buildClassColorMap(guildData.rows || []);
      guildRankByNameSpec = new Map(
        (guildData.rows || []).map((row) => [`${row.name}::${row.spec}`, row])
      );
    }
    if (honorBoardRes?.ok) {
      honorBoard = await honorBoardRes.json();
    }
  } catch (err) {
    console.error(err);
  }

  await raidPromise;
  if (raidError) {
    setStatus(`Рейд не знайдено: ${raidError.message}`, 'error');
    return;
  }

  raidTitleHeading.textContent = raid.title;
  document.title = `${raid.title} — Рейд-менеджер`;

  applyOfficers(await officersPromise);
  renderBanner();
  officerPanel.hidden = !isOfficerMode();
  renderBenchmarkPanel();

  populateBossSelect(softBoss);
  populateItemPicker(softItem, softItemTrigger, softItemList, softBoss.value);
  populateBossSelect(assignBoss);
  populateItemPicker(assignItem, assignItemTrigger, assignItemList, assignBoss.value);

  myCharacters = (await myCharactersPromise) || [];
  populateMyCharacters();

  await reservesPromise;
  await transfersPromise;
  await bonusGrantsPromise;
  await penaltiesPromise;
  applyShardQueueRaw(await shardQueueRawPromise);
  renderPlayersTable();
  renderItemsTable();

  raidContent.hidden = false;
  setStatus('');
  initialRenderDone = true;

  setInterval(async () => {
    try {
      const [, , , , shardRaw, officers] = await Promise.all([
        loadRaid(),
        loadReserves(),
        loadTransfers(),
        loadBonusGrants(),
        fetchShardQueueRaw(),
        fetchOfficers()
      ]);
      applyShardQueueRaw(shardRaw);
      applyOfficers(officers);
      renderBanner();
      renderPlayersTable();
      renderItemsTable();
      applySoftFormLockState();
      if (activeTab === 'audit') await loadAudit();
      // Штрафи: перебудовує весь tbody, тож пропускаємо, поки офіцер
      // тримає фокус усередині таблиці (набирає суму/причину) - інакше
      // поллінг зніс би незбережений ввід разом з фокусом.
      if (activeTab === 'penalties' && !raidPenaltiesBody.contains(document.activeElement)) {
        await loadAndRenderPenalties();
      }
      if (activeTab === 'potions') await loadPotionsTab();
    } catch (err) {
      console.error(err);
    }
  }, 10000);
}

init();
