const playerSelect = document.getElementById('playerSelect');
const player2Select = document.getElementById('player2Select');
const bossCheckboxes = document.getElementById('bossCheckboxes');
const selectAllBossesBtn = document.getElementById('selectAllBosses');
const deselectAllBossesBtn = document.getElementById('deselectAllBosses');
const tableStatus = document.getElementById('tableStatus');

let personalStats = [];
let chart = null;

const BOSS_ORDER = [
  'Lord Marrowgar',
  'Lady Deathwhisper',
  'Deathbringer Saurfang',
  'Festergut',
  'Rotface',
  'Professor Putricide',
  'Blood Prince Council',
  "Blood-Queen Lana'thel",
  'Sindragosa',
  'The Lich King',
  'Toravon the Ice Watcher',
  'Halion',
  "Anub'arak",
  'Valithria Dreamwalker'
];

const EXCLUDED_BOSSES = new Set([
  'Valithria Dreamwalker',
  "Anub'arak",
  'Toravon the Ice Watcher'
]);

const BOSS_COLORS = {
  'Lord Marrowgar': '#4e79a7',
  'Lady Deathwhisper': '#f28e2b',
  'Deathbringer Saurfang': '#e15759',
  'Festergut': '#59a14f',
  'Rotface': '#76b7b2',
  'Professor Putricide': '#edc948',
  'Blood Prince Council': '#b07aa1',
  "Blood-Queen Lana'thel": '#ff9da7',
  'Sindragosa': '#9c755f',
  'The Lich King': '#eaeaea',
  'Halion': '#d4af37'
};

function getBossColor(boss) {
  return BOSS_COLORS[boss] || '#999999';
}

function setStatus(text) {
  tableStatus.textContent = text;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

let allNames = [];

function computeAllNames() {
  const names = new Set();
  for (const record of personalStats) {
    for (const player of record.players || []) {
      names.add(player.name);
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b, 'uk'));
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
        item.textContent = name;
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

function getSelectedPlayers() {
  const known = new Set(allNames);
  return [...new Set([playerSelect.value.trim(), player2Select.value.trim()].filter((name) => known.has(name)))];
}

function getSelectedBosses() {
  return [...bossCheckboxes.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value);
}

function populateBossCheckboxes() {
  const players = getSelectedPlayers();

  if (!players.length) {
    bossCheckboxes.innerHTML = '<span class="boss-checkboxes-empty">Спочатку обери гравця</span>';
    setStatus('Оберіть гравця і боса.');
    return;
  }

  const bossesWithData = new Set(
    personalStats
      .filter((record) => (record.players || []).some((p) => players.includes(p.name)))
      .map((record) => record.boss)
  );

  const available = BOSS_ORDER.filter((boss) => !EXCLUDED_BOSSES.has(boss) && bossesWithData.has(boss));

  if (!available.length) {
    bossCheckboxes.innerHTML = '<span class="boss-checkboxes-empty">Для цього гравця немає даних</span>';
    setStatus('Для цього гравця немає даних.');
    return;
  }

  bossCheckboxes.innerHTML = '';
  available.forEach((boss) => {
    const label = document.createElement('label');
    label.className = 'boss-checkbox';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = boss;
    input.checked = true;

    const swatch = document.createElement('span');
    swatch.className = 'boss-checkbox-swatch';
    swatch.style.backgroundColor = getBossColor(boss);

    label.appendChild(input);
    label.appendChild(swatch);
    label.appendChild(document.createTextNode(boss));
    bossCheckboxes.appendChild(label);
  });
}

function buildSeries(playerName, bossName) {
  const records = personalStats.filter(
    (record) => record.boss === bossName && (record.players || []).some((p) => p.name === playerName)
  );

  return records
    .map((record) => {
      const player = record.players.find((p) => p.name === playerName);
      return { date: record.date, dps: player.dps };
    })
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year.slice(2)}`;
}

function render() {
  const players = getSelectedPlayers();
  const bosses = getSelectedBosses();

  if (chart) {
    chart.destroy();
    chart = null;
  }

  if (!players.length || !bosses.length) {
    setStatus(players.length ? 'Оберіть хоча б одного боса.' : 'Оберіть гравця і боса.');
    return;
  }

  const combos = [];
  for (const player of players) {
    for (const boss of bosses) {
      combos.push({ player, boss, series: buildSeries(player, boss) });
    }
  }

  const allDates = new Set();
  combos.forEach((combo) => combo.series.forEach((point) => allDates.add(point.date)));
  const labels = [...allDates].sort();

  if (!labels.length) {
    setStatus('Для обраної комбінації немає даних.');
    return;
  }

  const primaryPlayer = players[0];
  const seriesByDataset = [];

  const datasets = combos.map((combo) => {
    const byDate = new Map(combo.series.map((point) => [point.date, point]));
    const aligned = labels.map((date) => byDate.get(date) || null);
    seriesByDataset.push(aligned);

    const isSecondPlayer = combo.player !== primaryPlayer;
    const color = getBossColor(combo.boss);

    return {
      label: `${combo.boss} — ${combo.player}`,
      data: aligned.map((point) => (point ? point.dps : null)),
      borderColor: color,
      backgroundColor: color,
      borderDash: isSecondPlayer ? [6, 4] : [],
      spanGaps: false,
      tension: 0.2,
      pointRadius: 4,
      pointHoverRadius: 6
    };
  });

  const canvas = document.getElementById('chartPersonalDps');

  chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels.map(formatDateLabel),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const point = seriesByDataset[ctx.datasetIndex][ctx.dataIndex];
              if (!point) return null;

              return `${ctx.dataset.label}: ${Math.round(point.dps).toLocaleString('en-US')} DPS`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Дата рейду' } },
        y: { title: { display: true, text: 'DPS' }, beginAtZero: true }
      }
    }
  });

  setStatus(`Ліній на графіку: ${datasets.length}`);
}

async function init() {
  Chart.defaults.color = cssVar('--color-text');
  Chart.defaults.borderColor = cssVar('--color-border');
  Chart.defaults.font.family = "'Roboto', 'Open Sans', sans-serif";

  try {
    setStatus('Завантаження даних...');
    const personalResponse = await fetch('/data/personal-stats.json');

    if (!personalResponse.ok) throw new Error(`HTTP ${personalResponse.status}`);

    personalStats = await personalResponse.json();
    allNames = computeAllNames();

    const onPlayerChange = () => {
      populateBossCheckboxes();
      render();
    };

    setupAutocomplete(playerSelect, document.getElementById('playerSelectList'), onPlayerChange);
    setupAutocomplete(player2Select, document.getElementById('player2SelectList'), onPlayerChange);

    setStatus('Оберіть гравця і боса.');
  } catch (error) {
    console.error(error);
    setStatus('Не вдалося завантажити дані.');
  }
}

bossCheckboxes.addEventListener('change', (event) => {
  if (event.target.matches('input[type="checkbox"]')) {
    render();
  }
});

selectAllBossesBtn.addEventListener('click', () => {
  bossCheckboxes.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    el.checked = true;
  });
  render();
});

deselectAllBossesBtn.addEventListener('click', () => {
  bossCheckboxes.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    el.checked = false;
  });
  render();
});

init();
