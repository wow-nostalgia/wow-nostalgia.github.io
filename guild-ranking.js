const classSelect = document.getElementById('classSelect');
const specSelect = document.getElementById('specSelect');
const tableStatus = document.getElementById('tableStatus');
const rankingHead = document.getElementById('rankingHead');
const rankingBody = document.getElementById('rankingBody');

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
  data.classes.forEach(cls => {
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
  const bossOrder = (data.bossOrder || []).filter(b => !excludedBosses.has(b));
  const bossSet = new Set();
  rows.forEach(row => {
    Object.keys(row.bosses || {}).forEach(b => {
      if (!excludedBosses.has(b)) bossSet.add(b);
    });
  });
  return bossOrder.filter(b => bossSet.has(b));
}

function renderTable(className, specName) {
  clearTable();

  if (!className || !specName) {
    setStatus('Оберіть клас і спеціалізацію.');
    return;
  }

  const rows = (data.rows || []).filter(row => row.class === className && row.spec === specName);

  if (!rows.length) {
    setStatus('Для цієї комбінації даних немає.');
    return;
  }

  const bossColumns = getBossColumns(rows);
  const columns = [
    { key: '__index', label: '#' },
    { key: 'name', label: 'Нік' },
    { key: 'overallRank', label: 'Rank' },
    { key: 'overallScore', label: 'Score' },
    ...bossColumns.map(b => ({ key: `bosses.${b}`, label: b }))
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
    .sort((a, b) => a.overallRank - b.overallRank)
    .forEach((row, idx) => {
      const tr = document.createElement('tr');
      columns.forEach(col => {
        const td = document.createElement('td');
        if (col.key === '__index') {
          td.textContent = idx + 1;
        } else if (col.key.startsWith('bosses.')) {
          const boss = col.key.slice(7);
          const val = row.bosses?.[boss];
          td.textContent = val === undefined || val === null || val === 0
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
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    populateClasses();
    setStatus('Оберіть клас і спеціалізацію.');
  } catch (error) {
    console.error(error);
    setStatus('Не вдалося завантажити дані рейтингу.');
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