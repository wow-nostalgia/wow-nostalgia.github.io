const classSelect = document.getElementById('classSelect');
const specSelect = document.getElementById('specSelect');
const legionnairesCheckbox = document.getElementById('legionnairesCheckbox');
const tableStatus = document.getElementById('tableStatus');
const rankingHead = document.getElementById('rankingHead');
const rankingBody = document.getElementById('rankingBody');
const compareBtn = document.getElementById('compareBtn');

const selectedPlayers = new Set();

let lastUpdatedText = document.getElementById('lastUpdatedText');

if (!lastUpdatedText && tableStatus) {
  lastUpdatedText = document.createElement('p');
  lastUpdatedText.id = 'lastUpdatedText';
  lastUpdatedText.className = 'last-updated-text';
  tableStatus.insertAdjacentElement('afterend', lastUpdatedText);
}

let data = null;
let guildMemberNames = new Set();

const excludedBosses = new Set([
  "Valithria Dreamwalker",
  "Anub'arak",
  "Toravon the Ice Watcher"
]);

const RANK_TIERS = [
  { max: 50, medal: '🥇' },
  { max: 100, medal: '🥈' },
  { max: 150, medal: '🥉' }
];

function getRankTier(rank) {
  const num = Number(rank);
  if (!Number.isFinite(num)) return null;
  return RANK_TIERS.find(tier => num <= tier.max) || null;
}

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
    option.textContent = cls;
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
    option.textContent = spec;
    specSelect.appendChild(option);
  });
}

function createPlayerBadge(name) {
  const isGuild = guildMemberNames.has(name);
  const badge = document.createElement('span');
  badge.className = `player-badge ${isGuild ? 'player-badge--guild' : 'player-badge--legion'}`;
  badge.title = isGuild ? 'Ностальгія' : 'Легіонер';
  badge.textContent = isGuild ? 'Н' : 'Л';
  return badge;
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

function formatLastUpdatedKyiv(isoString) {
  if (!isoString) return '';

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(date);
}

function renderLastUpdated() {
  if (!lastUpdatedText) return;

  const formatted = formatLastUpdatedKyiv(data?.lastUpdated);

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
    { key: '__index', label: 'Guild Rank' },
    { key: 'name', label: 'Player Name' },
    { key: 'overallRank', label: 'Server Rank' },
    { key: 'overallScore', label: 'Score' },
    ...bossColumns.map(bossName => ({
      key: `bosses.${bossName}`,
      label: bossName
    }))
  ];

  const headRow = document.createElement('tr');

  columns.forEach(col => {
    const th = document.createElement('th');
    if (col.key === '__checkbox') th.classList.add('checkbox-cell');
    const wrap = document.createElement('div');
    wrap.className = 'boss-header';
    wrap.textContent = col.label;
    th.appendChild(wrap);
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
      const rankTier = getRankTier(row.overallRank);

      columns.forEach(col => {
        const td = document.createElement('td');

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
          td.textContent = Number(row[col.key] ?? 0).toFixed(2);
        } else if (col.key === 'overallRank') {
          td.classList.add('server-rank-cell');
          const rank = row.overallRank ?? '';
          const icon = rankTier ? rankTier.medal : (rank !== '' ? '🤷‍♂️' : '');
          td.textContent = icon ? `${icon} ${rank}` : rank;
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
    const [rankingResponse, playersResponse] = await Promise.all([
      fetch('/data/guild-data.json'),
      fetch('/data/players.json')
    ]);

    if (!rankingResponse.ok) {
      throw new Error(`HTTP ${rankingResponse.status}`);
    }

    data = await rankingResponse.json();

    if (playersResponse.ok) {
      const players = await playersResponse.json();
      guildMemberNames = new Set(players.map(player => player.name));
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