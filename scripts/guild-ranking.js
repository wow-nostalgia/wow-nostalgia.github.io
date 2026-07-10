const classSelect = document.getElementById('classSelect');
const specSelect = document.getElementById('specSelect');
const legionnairesCheckbox = document.getElementById('legionnairesCheckbox');
const tableStatus = document.getElementById('tableStatus');
const rankingHead = document.getElementById('rankingHead');
const rankingBody = document.getElementById('rankingBody');
const compareBtn = document.getElementById('compareBtn');

const selectedPlayers = new Set();

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

async function init() {
  try {
    setStatus('Завантаження даних...');
    const [rankingResponse, playersResponse, ownersResponse] = await Promise.all([
      fetch('/data/guild-data.json?t=' + Date.now()),
      fetch('/data/players.json?t=' + Date.now()),
      fetch(`${AUTH_API_BASE}/characters/owners`).catch(() => null)
    ]);

    if (!rankingResponse.ok) {
      throw new Error(`HTTP ${rankingResponse.status}`);
    }

    data = await rankingResponse.json();

    if (playersResponse.ok) {
      const players = await playersResponse.json();
      guildMemberNames = new Set(players.map(player => player.name));
    }

    if (ownersResponse?.ok) {
      characterOwnerNames = new Map(Object.entries(await ownersResponse.json()));
    }

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

init();