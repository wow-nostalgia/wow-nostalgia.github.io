const SORT_ICON_ASC = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M3.47 7.78a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018L9 4.81v7.44a.75.75 0 0 1-1.5 0V4.81L4.53 7.78a.75.75 0 0 1-1.06 0Z"/></svg>';
const SORT_ICON_DESC = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M13.03 8.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.47 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018l2.97 2.97V3.75a.75.75 0 0 1 1.5 0v7.44l2.97-2.97a.75.75 0 0 1 1.06 0Z"/></svg>';

const HEAL_TANK_SPECS = new Set(['Holy', 'Discipline', 'Restoration', 'Blood', 'Protection']);

const classSelect = document.getElementById('classSelect');
const specSelect = document.getElementById('specSelect');
const legionnairesCheckbox = document.getElementById('legionnairesCheckbox');
const tableStatus = document.getElementById('tableStatus');
const rankingHead = document.getElementById('rankingHead');
const rankingBody = document.getElementById('rankingBody');
const compareBtn = document.getElementById('compareBtn');

const characterViewEl = document.getElementById('characterView');
const playerViewEl = document.getElementById('playerView');
const viewButtons = document.querySelectorAll('.potion-view-btn');
const playerViewCharacterSelect = document.getElementById('playerViewCharacterSelect');
const playerViewCharacterSelectList = document.getElementById('playerViewCharacterSelectList');
const playerViewCharacterSelectClear = document.getElementById('playerViewCharacterSelectClear');
const playerViewStatus = document.getElementById('playerViewStatus');
const playerSiblingsTableWrap = document.getElementById('playerSiblingsTableWrap');
const playerSiblingsBody = document.getElementById('playerSiblingsBody');
const hideHealTankSpecsCheckbox = document.getElementById('hideHealTankSpecs');

const selectedPlayers = new Set();
let honorBoard = [];
let primaryCharacterNames = new Set();
let allNames = [];
let siblingSortState = { column: 'name', direction: 'asc' };
let currentSiblingRows = [];

const HEADER_ICONS = {
  __index: {
    title: 'Рейтинг гільдії',
    svg: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M1.75 16A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0h8.5C11.216 0 12 .784 12 1.75v12.5c0 .085-.006.168-.018.25h2.268a.25.25 0 0 0 .25-.25V8.285a.25.25 0 0 0-.111-.208l-1.055-.703a.749.749 0 1 1 .832-1.248l1.055.703c.487.325.779.871.779 1.456v5.965A1.75 1.75 0 0 1 14.25 16h-3.5a.766.766 0 0 1-.197-.026c-.099.017-.2.026-.303.026h-3a.75.75 0 0 1-.75-.75V14h-1v1.25a.75.75 0 0 1-.75.75Zm-.25-1.75c0 .138.112.25.25.25H4v-1.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 .75.75v1.25h2.25a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25ZM3.75 6h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 3.75A.75.75 0 0 1 3.75 3h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 3.75Zm4 3A.75.75 0 0 1 7.75 6h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 7 6.75ZM7.75 3h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 9.75A.75.75 0 0 1 3.75 9h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 9.75ZM7.75 9h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5Z"/></svg>'
  },
  overallRank: {
    title: 'Рейтинг сервера',
    svg: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.78 8.75a9.64 9.64 0 0 0 1.363 4.177c.255.426.542.832.857 1.215.245-.296.551-.705.857-1.215A9.64 9.64 0 0 0 10.22 8.75Zm4.44-1.5a9.64 9.64 0 0 0-1.363-4.177c-.307-.51-.612-.919-.857-1.215a9.927 9.927 0 0 0-.857 1.215A9.64 9.64 0 0 0 5.78 7.25Zm-5.944 1.5H1.543a6.507 6.507 0 0 0 4.666 5.5c-.123-.181-.24-.365-.352-.552-.715-1.192-1.437-2.874-1.581-4.948Zm-2.733-1.5h2.733c.144-2.074.866-3.756 1.58-4.948.12-.197.237-.381.353-.552a6.507 6.507 0 0 0-4.666 5.5Zm10.181 1.5c-.144 2.074-.866 3.756-1.58 4.948-.12.197-.237.381-.353.552a6.507 6.507 0 0 0 4.666-5.5Zm2.733-1.5a6.507 6.507 0 0 0-4.666-5.5c.123.181.24.365.353.552.714 1.192 1.436 2.874 1.58 4.948Z"/></svg>'
  }
};

let lastUpdatedText = document.getElementById('lastUpdatedText');

if (!lastUpdatedText && tableStatus) {
  lastUpdatedText = document.createElement('p');
  lastUpdatedText.id = 'lastUpdatedText';
  lastUpdatedText.className = 'last-updated-text';
  tableStatus.insertAdjacentElement('afterend', lastUpdatedText);
}

let data = null;
let guildMemberNames = new Set();
let characterOwnerNames = new Map();

const excludedBosses = new Set([
  "Valithria Dreamwalker",
  "Anub'arak",
  "Toravon the Ice Watcher"
]);

function setStatus(text) {
  tableStatus.textContent = text;
}

function clearTable() {
  rankingHead.innerHTML = '';
  rankingBody.innerHTML = '';
}

function populateClasses() {
  classSelect.innerHTML = '';

  (data.classes || []).forEach(cls => {
    const option = document.createElement('option');
    option.value = cls;
    option.textContent = translateClass(cls);
    if (WOW_CLASS_COLORS[cls]) option.style.color = WOW_CLASS_COLORS[cls];
    classSelect.appendChild(option);
  });
}

function populateSpecs(className) {
  specSelect.innerHTML = '';
  clearTable();

  const specs = data.specsByClass?.[className] || [];
  specs.forEach(spec => {
    const option = document.createElement('option');
    option.value = spec;
    option.textContent = translateSpec(spec);
    specSelect.appendChild(option);
  });
}

function getBossColumns(rows) {
  const bossOrder = (data.bossOrder || []).filter(bossName => !excludedBosses.has(bossName));
  const bossSet = new Set();

  rows.forEach(row => {
    Object.entries(row.bosses || {}).forEach(([bossName, value]) => {
      if (!excludedBosses.has(bossName) && Number(value) > 0) {
        bossSet.add(bossName);
      }
    });
  });

  return bossOrder.filter(bossName => bossSet.has(bossName));
}


function renderLastUpdated() {
  if (!lastUpdatedText) return;

  const formatted = formatDateTimeKyiv(data?.lastUpdated);

  lastUpdatedText.textContent = formatted
    ? `Останнє оновлення: ${formatted}`
    : '';
}

function buildPersonalAnalyticsUrl(players) {
  const specKey = `${classSelect.value} — ${specSelect.value}`;
  const params = new URLSearchParams();
  params.set('player', players[0]);
  params.set('spec', specKey);

  if (players[1]) {
    params.set('player2', players[1]);
    params.set('spec2', specKey);
  }

  return `../personal-analytics/?${params.toString()}`;
}

function updateCompareButton() {
  const count = selectedPlayers.size;
  compareBtn.disabled = count === 0;
  compareBtn.textContent =
    count === 2 ? 'Порівняти' : count === 1 ? 'Переглянути' : 'Переглянути/Порівняти';
}

function updateCheckboxAvailability() {
  const atLimit = selectedPlayers.size >= 2;
  rankingBody.querySelectorAll('input.player-row-checkbox').forEach(checkbox => {
    checkbox.disabled = atLimit && !checkbox.checked;
  });
}

function renderTable(className, specName) {
  clearTable();
  selectedPlayers.clear();
  updateCompareButton();

  if (!className || !specName) {
    setStatus('Оберіть клас і спеціалізацію.');
    return;
  }

  let rows = (data.rows || []).filter(
    row => row.class === className && row.spec === specName
  );

  if (!legionnairesCheckbox.checked) {
    rows = rows.filter(row => guildMemberNames.has(row.name));
  }

  if (!rows.length) {
    setStatus('Для цієї комбінації даних немає.');
    return;
  }

  const bossColumns = getBossColumns(rows);

  const columns = [
    { key: '__checkbox', label: '' },
    { key: '__index', label: 'Рейтинг гільдії' },
    { key: 'name', label: "Ім'я гравця" },
    { key: 'overallRank', label: 'Рейтинг сервера' },
    { key: 'overallScore', label: 'Очки' },
    ...bossColumns.map(bossName => ({
      key: `bosses.${bossName}`,
      label: translateBoss(bossName),
      isBoss: true,
      bossName
    }))
  ];

  const headRow = document.createElement('tr');

  columns.forEach(col => {
    const th = document.createElement('th');
    if (col.key === '__checkbox') th.classList.add('checkbox-cell');
    if (col.key !== '__checkbox' && col.key !== 'name') th.classList.add('ranking-table-numeric');
    const headerIcon = HEADER_ICONS[col.key];
    if (col.isBoss) {
      const abbr = document.createElement('abbr');
      abbr.className = 'boss-header';
      abbr.title = col.label;
      abbr.textContent = bossAbbr(col.bossName);
      th.appendChild(abbr);
    } else if (headerIcon) {
      const abbr = document.createElement('abbr');
      abbr.className = 'table-header-icon';
      abbr.title = headerIcon.title;
      abbr.setAttribute('aria-label', headerIcon.title);
      abbr.innerHTML = headerIcon.svg;
      th.appendChild(abbr);
    } else {
      th.textContent = col.label;
    }
    headRow.appendChild(th);
  });

  rankingHead.appendChild(headRow);

  const bodyFragment = document.createDocumentFragment();

  rows
    .slice()
    .sort((a, b) => {
      const rankA = Number.isFinite(Number(a.overallRank)) ? Number(a.overallRank) : Infinity;
      const rankB = Number.isFinite(Number(b.overallRank)) ? Number(b.overallRank) : Infinity;
      return rankA - rankB;
    })
    .forEach((row, idx) => {
      const tr = document.createElement('tr');
      const scoreTier = getScoreTier(row.overallScore);

      columns.forEach(col => {
        const td = document.createElement('td');
        if (col.key !== '__checkbox' && col.key !== 'name') td.classList.add('ranking-table-numeric');

        if (col.key === '__checkbox') {
          td.classList.add('checkbox-cell');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'player-row-checkbox';
          checkbox.dataset.name = row.name;
          checkbox.setAttribute('aria-label', `Обрати ${row.name}`);
          td.appendChild(checkbox);
        } else if (col.key === '__index') {
          td.textContent = idx + 1;
        } else if (col.key === 'name') {
          const link = document.createElement('a');
          link.href = buildPersonalAnalyticsUrl([row.name]);
          link.textContent = row.name;
          const ownerName = characterOwnerNames.get(row.name);
          if (ownerName) link.title = ownerName;
          td.appendChild(createPlayerBadge(row.name));
          td.appendChild(link);
        } else if (col.key.startsWith('bosses.')) {
          const boss = col.key.slice(7);
          const val = row.bosses?.[boss];

          td.textContent =
            val === undefined || val === null || Number(val) === 0
              ? '—'
              : Math.round(Number(val)).toLocaleString('en-US');
        } else if (col.key === 'overallScore') {
          const score = Number(row[col.key] ?? 0);
          const icon = scoreTier ? scoreTier.medal : '🤷‍♂️';
          td.textContent = `${icon} ${score.toFixed(2)}`;
        } else if (col.key === 'overallRank') {
          td.textContent = row.overallRank ?? '';
        } else {
          td.textContent = row[col.key] ?? '';
        }

        tr.appendChild(td);
      });

      bodyFragment.appendChild(tr);
    });

  rankingBody.appendChild(bodyFragment);

  setStatus(`Знайдено гравців: ${rows.length}`);
}

function switchView(viewName) {
  characterViewEl.hidden = viewName !== 'character';
  playerViewEl.hidden = viewName !== 'player';

  viewButtons.forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive.toString());
  });
}

function attachViewSwitch() {
  viewButtons.forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(button.dataset.view);
    });
  });
}

function setupAutocomplete(inputEl, listEl, onSelect) {
  function closeList() {
    listEl.classList.remove('is-open');
    listEl.innerHTML = '';
  }

  function openList() {
    const query = inputEl.value.trim().toLocaleLowerCase('uk');
    const matches = query
      ? allNames.filter((name) => name.toLocaleLowerCase('uk').includes(query))
      : allNames;

    listEl.innerHTML = '';

    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'autocomplete-empty';
      empty.textContent = 'Нічого не знайдено';
      listEl.appendChild(empty);
    } else {
      matches.forEach((name) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.appendChild(createPlayerBadge(name));
        item.appendChild(document.createTextNode(name));
        item.addEventListener('mousedown', (event) => {
          event.preventDefault();
          inputEl.value = name;
          closeList();
          onSelect();
        });
        listEl.appendChild(item);
      });
    }

    listEl.classList.add('is-open');
  }

  inputEl.addEventListener('input', () => {
    openList();
    onSelect();
  });

  inputEl.addEventListener('focus', openList);

  inputEl.addEventListener('blur', () => {
    setTimeout(closeList, 100);
  });

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeList();
  });
}

function siblingPotions(row) {
  const entry = honorBoard.find((e) => e.name === row.name);
  return entry ? entry.averagePotionsPerBoss : -1;
}

function sortSiblingRows(rows) {
  const { column, direction } = siblingSortState;
  return [...rows].sort((a, b) => {
    let av;
    let bv;
    switch (column) {
      case 'spec':
        av = translateSpecKey(`${a.class} — ${a.spec}`);
        bv = translateSpecKey(`${b.class} — ${b.spec}`);
        break;
      case 'overallRank':
        av = Number(a.overallRank ?? Infinity);
        bv = Number(b.overallRank ?? Infinity);
        break;
      case 'overallScore':
        av = Number(a.overallScore ?? 0);
        bv = Number(b.overallScore ?? 0);
        break;
      case 'potions':
        av = siblingPotions(a);
        bv = siblingPotions(b);
        break;
      default:
        av = a.name;
        bv = b.name;
    }

    if (typeof av === 'string') {
      const cmp = av.localeCompare(bv, 'uk');
      return direction === 'asc' ? cmp : -cmp;
    }

    if (av < bv) return direction === 'asc' ? -1 : 1;
    if (av > bv) return direction === 'asc' ? 1 : -1;
    return a.name.localeCompare(b.name, 'uk');
  });
}

function updateSiblingSortIndicators() {
  document.querySelectorAll('#playerSiblingsTable .sortable').forEach((th) => {
    th.classList.remove('active');
    const indicator = th.querySelector('.sort-indicator');
    if (indicator) indicator.textContent = '';
  });

  const active = document.querySelector(`#playerSiblingsTable .sortable[data-sort="${siblingSortState.column}"]`);
  if (active) {
    active.classList.add('active');
    const indicator = active.querySelector('.sort-indicator');
    if (indicator) indicator.innerHTML = siblingSortState.direction === 'asc' ? SORT_ICON_ASC : SORT_ICON_DESC;
  }
}

function getVisibleSiblingRows() {
  const hideHealTank = hideHealTankSpecsCheckbox.checked;
  return hideHealTank ? currentSiblingRows.filter((row) => !HEAL_TANK_SPECS.has(row.spec)) : currentSiblingRows;
}

function buildCharacterAnalyticsLink(name, guildRow) {
  const link = document.createElement('a');
  const params = new URLSearchParams({ player: name });
  if (guildRow) params.set('spec', `${guildRow.class} — ${guildRow.spec}`);
  link.href = `../personal-analytics/?${params.toString()}`;
  link.appendChild(createPlayerBadge(name));
  link.appendChild(document.createTextNode(name));
  return link;
}

function renderSiblingRows() {
  playerSiblingsBody.innerHTML = '';

  if (!currentSiblingRows.length) {
    playerSiblingsTableWrap.hidden = true;
    updateSiblingSortIndicators();
    return;
  }

  const visibleRows = getVisibleSiblingRows();

  if (!visibleRows.length) {
    playerViewStatus.textContent = 'Усі персонажі цього профілю — хіли/танки, приховано фільтром.';
    playerSiblingsTableWrap.hidden = true;
    updateSiblingSortIndicators();
    return;
  }

  playerViewStatus.textContent = '';
  playerSiblingsTableWrap.hidden = false;

  sortSiblingRows(visibleRows).forEach((row) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.className = 'player-siblings-name-cell';
    nameTd.appendChild(buildCharacterAnalyticsLink(row.name, row));
    if (primaryCharacterNames.has(row.name)) {
      const primaryBadge = document.createElement('span');
      primaryBadge.className = 'primary-character-badge';
      primaryBadge.textContent = 'Основний';
      nameTd.appendChild(primaryBadge);
    }
    tr.appendChild(nameTd);

    const specTd = document.createElement('td');
    specTd.textContent = translateSpecKey(`${row.class} — ${row.spec}`);
    if (WOW_CLASS_COLORS[row.class]) specTd.style.color = WOW_CLASS_COLORS[row.class];
    tr.appendChild(specTd);

    const rankTd = document.createElement('td');
    rankTd.textContent = row.overallRank ?? '';
    tr.appendChild(rankTd);

    const scoreTd = document.createElement('td');
    const score = Number(row.overallScore ?? 0);
    const scoreTier = getScoreTier(score);
    const scoreIcon = scoreTier ? scoreTier.medal : '🤷‍♂️';
    scoreTd.textContent = `${scoreIcon} ${score.toFixed(2)}`;
    tr.appendChild(scoreTd);

    const potionTd = document.createElement('td');
    const potions = siblingPotions(row);
    potionTd.textContent = potions >= 0 ? potions.toFixed(2) : '—';
    tr.appendChild(potionTd);

    playerSiblingsBody.appendChild(tr);
  });

  updateSiblingSortIndicators();
}

function attachSiblingTableSorting() {
  document.querySelectorAll('#playerSiblingsTable .sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort;
      if (!column) return;

      if (siblingSortState.column === column) {
        siblingSortState.direction = siblingSortState.direction === 'desc' ? 'asc' : 'desc';
      } else {
        siblingSortState.column = column;
        siblingSortState.direction = th.dataset.direction || 'asc';
      }

      renderSiblingRows();
    });
  });
}

function renderPlayerSiblings(characterName) {
  playerSiblingsBody.innerHTML = '';
  currentSiblingRows = [];

  if (!characterName) {
    playerViewStatus.textContent = '';
    playerSiblingsTableWrap.hidden = true;
    return;
  }

  const ownerDisplayName = characterOwnerNames.get(characterName);
  if (!ownerDisplayName) {
    playerViewStatus.textContent = 'Цей персонаж не прив’язаний до жодного профілю.';
    playerSiblingsTableWrap.hidden = true;
    return;
  }

  const siblingNames = [...characterOwnerNames.entries()]
    .filter(([, displayName]) => displayName === ownerDisplayName)
    .map(([name]) => name);

  const rows = siblingNames.flatMap((name) => (data.rows || []).filter((row) => row.name === name));

  if (!rows.length) {
    playerViewStatus.textContent = 'Для персонажів цього профілю немає даних рейтингу.';
    playerSiblingsTableWrap.hidden = true;
    return;
  }

  currentSiblingRows = rows;
  renderSiblingRows();
}

async function init() {
  try {
    setStatus('Завантаження даних...');
    const [rankingResponse, playersResponse, ownersResponse, honorResponse, primaryResponse] = await Promise.all([
      fetch('/data/guild-data.json?t=' + Date.now()),
      fetch('/data/players.json?t=' + Date.now()),
      fetch(`${AUTH_API_BASE}/characters/owners`).catch(() => null),
      fetch('/data/honor-board.json?t=' + Date.now()).catch(() => null),
      fetch(`${AUTH_API_BASE}/characters/primary`).catch(() => null)
    ]);

    if (!rankingResponse.ok) {
      throw new Error(`HTTP ${rankingResponse.status}`);
    }

    data = await rankingResponse.json();
    allNames = [...new Set((data.rows || []).map((row) => row.name))].sort((a, b) => a.localeCompare(b, 'uk'));

    if (playersResponse.ok) {
      const players = await playersResponse.json();
      guildMemberNames = new Set(players.map(player => player.name));
    }

    if (ownersResponse?.ok) {
      characterOwnerNames = new Map(Object.entries(await ownersResponse.json()));
    }

    if (honorResponse?.ok) {
      honorBoard = await honorResponse.json();
    }

    if (primaryResponse?.ok) {
      primaryCharacterNames = new Set(await primaryResponse.json());
    }

    const onPlayerViewChange = () => {
      const name = playerViewCharacterSelect.value.trim();
      renderPlayerSiblings(allNames.includes(name) ? name : '');
    };

    setupAutocomplete(playerViewCharacterSelect, playerViewCharacterSelectList, onPlayerViewChange);

    playerViewCharacterSelectClear.addEventListener('click', () => {
      playerViewCharacterSelect.value = '';
      onPlayerViewChange();
      playerViewCharacterSelect.focus();
    });

    populateClasses();
    renderLastUpdated();

    if (data.classes?.length) {
      classSelect.value = data.classes[0];
      populateSpecs(classSelect.value);

      const specs = data.specsByClass?.[classSelect.value] || [];
      if (specs.length) {
        specSelect.value = specs[0];
        renderTable(classSelect.value, specSelect.value);
      }
    } else {
      setStatus('Немає доступних класів.');
    }
  } catch (error) {
    console.error(error);
    setStatus('Не вдалося завантажити дані рейтингу.');
    renderLastUpdated();
  }
}

classSelect.addEventListener('change', () => {
  populateSpecs(classSelect.value);

  const specs = data.specsByClass?.[classSelect.value] || [];
  if (specs.length) {
    specSelect.value = specs[0];
    renderTable(classSelect.value, specSelect.value);
  }
});

specSelect.addEventListener('change', () => {
  renderTable(classSelect.value, specSelect.value);
});

legionnairesCheckbox.addEventListener('change', () => {
  renderTable(classSelect.value, specSelect.value);
});

rankingBody.addEventListener('change', event => {
  if (!event.target.matches('input.player-row-checkbox')) return;

  const name = event.target.dataset.name;

  if (event.target.checked) {
    if (selectedPlayers.size >= 2) {
      event.target.checked = false;
      return;
    }
    selectedPlayers.add(name);
  } else {
    selectedPlayers.delete(name);
  }

  updateCompareButton();
  updateCheckboxAvailability();
});

compareBtn.addEventListener('click', () => {
  if (!selectedPlayers.size) return;
  window.location.href = buildPersonalAnalyticsUrl([...selectedPlayers]);
});

hideHealTankSpecsCheckbox.addEventListener('change', renderSiblingRows);

attachViewSwitch();
attachSiblingTableSorting();
init();