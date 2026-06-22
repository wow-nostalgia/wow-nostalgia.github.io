const playerSelect = document.getElementById('playerSelect');
const player2Select = document.getElementById('player2Select');
const player1SpecSelect = document.getElementById('player1Spec');
const player2SpecSelect = document.getElementById('player2Spec');
const player1RaidCount = document.getElementById('player1RaidCount');
const player2RaidCount = document.getElementById('player2RaidCount');
const bossCheckboxes = document.getElementById('bossCheckboxes');
const selectAllBossesBtn = document.getElementById('selectAllBosses');
const deselectAllBossesBtn = document.getElementById('deselectAllBosses');
const tableStatus = document.getElementById('tableStatus');
const splineSelect = document.getElementById('splineSelect');

let personalStats = [];
let chart = null;

const SPLINE_MODES = {
  smooth: { tension: 0.3, cubicInterpolationMode: 'default', pointRadius: 4, hitRadius: 1 },
  smoothNoPoints: { tension: 0.3, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 },
  linear: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 4, hitRadius: 1 },
  linearNoPoints: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 }
};

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
  'Toravon the Ice Watcher',
  'Halion'
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

function specKey(player) {
  return `${player.class} — ${player.spec}`;
}

function playerMatchesPair(player, pair) {
  return player.name === pair.name && (!pair.specFilter || specKey(player) === pair.specFilter);
}

function getPlayerSpecPairs() {
  const known = new Set(allNames);
  const pairs = [
    { name: playerSelect.value.trim(), specFilter: player1SpecSelect.value },
    { name: player2Select.value.trim(), specFilter: player2SpecSelect.value }
  ].filter((pair) => known.has(pair.name));

  const seenNames = new Set();
  return pairs.filter((pair) => {
    if (seenNames.has(pair.name)) return false;
    seenNames.add(pair.name);
    return true;
  });
}

function populateSpecSelect(selectEl, playerName) {
  selectEl.innerHTML = '<option value="">Усі спеки</option>';

  const isValidPlayer = playerName && allNames.includes(playerName);
  selectEl.disabled = !isValidPlayer;

  if (!isValidPlayer) return;

  const counts = new Map();
  for (const record of personalStats) {
    const player = (record.players || []).find((p) => p.name === playerName);
    if (!player) continue;
    const key = specKey(player);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([key]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key;
      selectEl.appendChild(option);
    });
}

function countPlayerRaids(playerName, specFilter) {
  if (!playerName) return 0;

  const raidUrls = new Set();
  for (const record of personalStats) {
    const player = (record.players || []).find((p) => p.name === playerName);
    if (!player) continue;
    if (specFilter && specKey(player) !== specFilter) continue;
    raidUrls.add(record.raidUrl);
  }

  return raidUrls.size;
}

function renderRaidCount(el, playerName, specFilter) {
  if (!playerName || !allNames.includes(playerName)) {
    el.textContent = '';
    return;
  }

  el.textContent = `Рейдів: ${countPlayerRaids(playerName, specFilter)}`;
}

function getSelectedBosses() {
  return [...bossCheckboxes.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value);
}

function renderBossCheckboxes() {
  const bosses = BOSS_ORDER.filter((boss) => !EXCLUDED_BOSSES.has(boss));

  bossCheckboxes.innerHTML = '';
  bosses.forEach((boss, index) => {
    const label = document.createElement('label');
    label.className = 'boss-checkbox';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = boss;
    input.checked = index === 0;

    const swatch = document.createElement('span');
    swatch.className = 'boss-checkbox-swatch';
    swatch.style.backgroundColor = getBossColor(boss);

    label.appendChild(input);
    label.appendChild(swatch);
    label.appendChild(document.createTextNode(boss));
    bossCheckboxes.appendChild(label);
  });
}

function buildSeries(playerName, bossName, specFilter) {
  const records = personalStats.filter(
    (record) => record.boss === bossName && (record.players || []).some((p) => playerMatchesPair(p, { name: playerName, specFilter }))
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
  const pairs = getPlayerSpecPairs();
  const bosses = getSelectedBosses();

  if (chart) {
    chart.destroy();
    chart = null;
  }

  if (!pairs.length || !bosses.length) {
    setStatus('');
    return;
  }

  const combos = [];
  for (const pair of pairs) {
    for (const boss of bosses) {
      combos.push({ player: pair.name, boss, series: buildSeries(pair.name, boss, pair.specFilter) });
    }
  }

  const allDates = new Set();
  combos.forEach((combo) => combo.series.forEach((point) => allDates.add(point.date)));
  const labels = [...allDates].sort();

  if (!labels.length) {
    setStatus('Для обраної комбінації немає даних.');
    return;
  }

  const primaryPlayer = pairs[0].name;
  const seriesByDataset = [];

  const datasets = combos.map((combo) => {
    const byDate = new Map(combo.series.map((point) => [point.date, point]));
    const aligned = labels.map((date) => byDate.get(date) || null);
    seriesByDataset.push(aligned);

    const isSecondPlayer = combo.player !== primaryPlayer;
    const color = getBossColor(combo.boss);
    const spline = SPLINE_MODES[splineSelect.value] || SPLINE_MODES.smoothNoPoints;

    return {
      label: `${combo.boss} — ${combo.player}`,
      data: aligned.map((point) => (point ? point.dps : null)),
      borderColor: color,
      backgroundColor: color,
      borderDash: isSecondPlayer ? [6, 4] : [],
      spanGaps: true,
      tension: spline.tension,
      cubicInterpolationMode: spline.cubicInterpolationMode,
      pointRadius: spline.pointRadius,
      hitRadius: spline.hitRadius,
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
        legend: {
          display: true,
          labels: {
            usePointStyle: true,
            generateLabels: (chartInstance) => {
              const items = Chart.defaults.plugins.legend.labels.generateLabels(chartInstance);
              items.forEach((item) => {
                const dataset = chartInstance.data.datasets[item.datasetIndex];
                item.pointStyle = 'line';
                item.lineDash = dataset.borderDash || [];
              });
              return items;
            }
          }
        },
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

  setStatus('');
}

async function init() {
  Chart.defaults.color = cssVar('--color-text');
  Chart.defaults.borderColor = cssVar('--color-border');
  Chart.defaults.font.family = "'Roboto', 'Open Sans', sans-serif";

  renderBossCheckboxes();

  try {
    setStatus('Завантаження даних...');
    const personalResponse = await fetch('/data/personal-stats.json');

    if (!personalResponse.ok) throw new Error(`HTTP ${personalResponse.status}`);

    personalStats = await personalResponse.json();
    allNames = computeAllNames();

    const onPlayer1Change = () => {
      const name = playerSelect.value.trim();
      populateSpecSelect(player1SpecSelect, name);
      renderRaidCount(player1RaidCount, name, player1SpecSelect.value);
      render();
    };

    const onPlayer2Change = () => {
      const name = player2Select.value.trim();
      populateSpecSelect(player2SpecSelect, name);
      renderRaidCount(player2RaidCount, name, player2SpecSelect.value);
      render();
    };

    setupAutocomplete(playerSelect, document.getElementById('playerSelectList'), onPlayer1Change);
    setupAutocomplete(player2Select, document.getElementById('player2SelectList'), onPlayer2Change);

    document.getElementById('playerSelectClear').addEventListener('click', () => {
      playerSelect.value = '';
      onPlayer1Change();
      playerSelect.focus();
    });

    document.getElementById('player2SelectClear').addEventListener('click', () => {
      player2Select.value = '';
      onPlayer2Change();
      player2Select.focus();
    });

    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus('Не вдалося завантажити дані.');
  }
}

player1SpecSelect.addEventListener('change', () => {
  renderRaidCount(player1RaidCount, playerSelect.value.trim(), player1SpecSelect.value);
  render();
});

player2SpecSelect.addEventListener('change', () => {
  renderRaidCount(player2RaidCount, player2Select.value.trim(), player2SpecSelect.value);
  render();
});

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

splineSelect.addEventListener('change', render);

init();
