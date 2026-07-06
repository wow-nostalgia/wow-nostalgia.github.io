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
  linearNoPoints: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 },
  trend: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 }
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
let guildMemberNames = new Set();

function createPlayerBadge(name) {
  const isGuild = guildMemberNames.has(name);
  const badge = document.createElement('span');
  badge.className = `player-badge ${isGuild ? 'player-badge--guild' : 'player-badge--legion'}`;
  badge.title = isGuild ? 'Ностальгія' : 'Легіонер';
  badge.textContent = isGuild ? 'N' : 'L';
  return badge;
}

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
      option.textContent = translateSpecKey(key);
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
    label.appendChild(document.createTextNode(translateBoss(boss)));
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

function computeTrendLine(points) {
  const n = points.length;
  if (n < 2) return null;

  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }

  if (den === 0) return { slope: 0, intercept: meanY };

  const slope = num / den;
  return { slope, intercept: meanY - slope * meanX };
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
  const isTrendMode = splineSelect.value === 'trend';

  const datasets = combos.map((combo) => {
    const byDate = new Map(combo.series.map((point) => [point.date, point]));
    let aligned = labels.map((date) => byDate.get(date) || null);

    if (isTrendMode) {
      const knownIndices = [];
      aligned.forEach((point, idx) => {
        if (point) knownIndices.push(idx);
      });

      const trend = computeTrendLine(knownIndices.map((idx) => ({ x: idx, y: aligned[idx].dps })));
      const firstIdx = knownIndices[0];
      const lastIdx = knownIndices[knownIndices.length - 1];

      aligned = aligned.map((point, idx) => {
        if (!trend || idx < firstIdx || idx > lastIdx) return null;
        return { date: labels[idx], dps: trend.slope * idx + trend.intercept, isTrend: true };
      });
    }

    seriesByDataset.push(aligned);

    const isSecondPlayer = combo.player !== primaryPlayer;
    const color = getBossColor(combo.boss);
    const spline = SPLINE_MODES[splineSelect.value] || SPLINE_MODES.smoothNoPoints;

    return {
      label: `${translateBoss(combo.boss)} — ${combo.player}`,
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

              const suffix = point.isTrend ? ' (тренд)' : '';
              return `${ctx.dataset.label}${suffix}: ${Math.round(point.dps).toLocaleString('en-US')} DPS`;
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

function applyUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const presetPlayer1 = urlParams.get('player');
  const presetSpec1 = urlParams.get('spec');
  const presetPlayer2 = urlParams.get('player2');
  const presetSpec2 = urlParams.get('spec2');

  if (presetPlayer1 && allNames.includes(presetPlayer1)) {
    playerSelect.value = presetPlayer1;
    populateSpecSelect(player1SpecSelect, presetPlayer1);
    if (presetSpec1 && [...player1SpecSelect.options].some((o) => o.value === presetSpec1)) {
      player1SpecSelect.value = presetSpec1;
    }
    renderRaidCount(player1RaidCount, presetPlayer1, player1SpecSelect.value);
  }

  if (presetPlayer2 && allNames.includes(presetPlayer2)) {
    player2Select.value = presetPlayer2;
    populateSpecSelect(player2SpecSelect, presetPlayer2);
    if (presetSpec2 && [...player2SpecSelect.options].some((o) => o.value === presetSpec2)) {
      player2SpecSelect.value = presetSpec2;
    }
    renderRaidCount(player2RaidCount, presetPlayer2, player2SpecSelect.value);
  }
}

async function init() {
  Chart.defaults.color = cssVar('--color-text');
  Chart.defaults.borderColor = cssVar('--color-border');
  Chart.defaults.font.family = "'Roboto', 'Open Sans', sans-serif";

  renderBossCheckboxes();

  try {
    setStatus('Завантаження даних...');
    const [personalResponse, playersResponse] = await Promise.all([
      fetch('/data/personal-stats.json?t=' + Date.now()),
      fetch('/data/players.json?t=' + Date.now())
    ]);

    if (!personalResponse.ok) throw new Error(`HTTP ${personalResponse.status}`);

    personalStats = await personalResponse.json();
    allNames = computeAllNames();

    if (playersResponse.ok) {
      const players = await playersResponse.json();
      guildMemberNames = new Set(players.map((p) => p.name));
    }

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

    applyUrlParams();
    render();
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
