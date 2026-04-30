const classSelect = document.getElementById('classSelect');
const specSelect = document.getElementById('specSelect');
const tableStatus = document.getElementById('tableStatus');
const rankingHead = document.getElementById('rankingHead');
const rankingBody = document.getElementById('rankingBody');

let lastUpdatedText = document.getElementById('lastUpdatedText');

if (!lastUpdatedText && tableStatus) {
  lastUpdatedText = document.createElement('p');
  lastUpdatedText.id = 'lastUpdatedText';
  lastUpdatedText.className = 'last-updated-text';
  tableStatus.insertAdjacentElement('afterend', lastUpdatedText);
}

let data = null;

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
  classSelect.innerHTML = '<option value="">Оберіть клас</option>';

  (data.classes || []).forEach(cls => {
    const option = document.createElement('option');
    option.value = cls;
    option.textContent = cls;
    classSelect.appendChild(option);
  });
}

function populateSpecs(className) {
  specSelect.innerHTML = '<option value="">Оберіть спеціалізацію</option>';
  clearTable();

  if (!className) {
    setStatus('Оберіть клас і спеціалізацію.');
    return;
  }

  const specs = data.specsByClass?.[className] || [];
  specs.forEach(spec => {
    const option = document.createElement('option');
    option.value = spec;
    option.textContent = spec;
    specSelect.appendChild(option);
  });

  setStatus('Оберіть спеціалізацію.');
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

function renderTable(className, specName) {
  clearTable();

  if (!className || !specName) {
    setStatus('Оберіть клас і спеціалізацію.');
    return;
  }

  let rows = (data.rows || []).filter(
    row => row.class === className && row.spec === specName
  );

  if (!rows.length) {
    setStatus('Для цієї комбінації даних немає.');
    return;
  }

  const bossColumns = getBossColumns(rows);

  const columns = [
    { key: '__index', label: '#' },
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
    const wrap = document.createElement('div');
    wrap.className = 'boss-header';
    wrap.textContent = col.label;
    th.appendChild(wrap);
    headRow.appendChild(th);
  });

  rankingHead.appendChild(headRow);

  rows
    .slice()
    .sort((a, b) => {
      const rankA = Number.isFinite(Number(a.overallRank)) ? Number(a.overallRank) : Infinity;
      const rankB = Number.isFinite(Number(b.overallRank)) ? Number(b.overallRank) : Infinity;
      return rankA - rankB;
    })
    .forEach((row, idx) => {
      const tr = document.createElement('tr');

      columns.forEach(col => {
        const td = document.createElement('td');

        if (col.key === '__index') {
          td.textContent = idx + 1;
        } else if (col.key.startsWith('bosses.')) {
          const boss = col.key.slice(7);
          const val = row.bosses?.[boss];

          td.textContent =
            val === undefined || val === null || Number(val) === 0
              ? '—'
              : Math.round(Number(val)).toLocaleString('en-US');
        } else if (col.key === 'overallScore') {
          td.textContent = Number(row[col.key] ?? 0).toFixed(2);
        } else {
          td.textContent = row[col.key] ?? '';
        }

        tr.appendChild(td);
      });

      rankingBody.appendChild(tr);
    });

  setStatus(`Знайдено гравців: ${rows.length}`);
}

async function init() {
  try {
    setStatus('Завантаження даних...');
    const response = await fetch('./data/guild-data.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    data = await response.json();
    populateClasses();
    renderLastUpdated();
    setStatus('Оберіть клас і спеціалізацію.');
  } catch (error) {
    console.error(error);
    setStatus('Не вдалося завантажити дані рейтингу.');
    renderLastUpdated();
  }
}

classSelect.addEventListener('change', () => {
  populateSpecs(classSelect.value);
  specSelect.value = '';
});

specSelect.addEventListener('change', () => {
  renderTable(classSelect.value, specSelect.value);
});

init();