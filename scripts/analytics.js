const statusEl = document.getElementById('analyticsStatus');
const lastUpdatedText = document.getElementById('lastUpdatedText');
const bossSumOverTimeSelect = document.getElementById('bossSumOverTimeSelect');
const bossSumOverTimeSplineSelect = document.getElementById('bossSumOverTimeSplineSelect');
const bossSumDayFilter = document.getElementById('bossSumDayFilter');

const SPLINE_MODES = {
  smooth: { tension: 0.3, cubicInterpolationMode: 'default', pointRadius: 4, hitRadius: 1 },
  smoothNoPoints: { tension: 0.3, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 },
  linear: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 4, hitRadius: 1 },
  linearNoPoints: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 },
  trend: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 }
};

const ROLE_BY_SPEC = {
  Blood: 'Tank',
  Protection: 'Tank',
  Holy: 'Healer',
  Discipline: 'Healer',
  Restoration: 'Healer'
};

const EXCLUDED_BOSSES = new Set([
  'Valithria Dreamwalker',
  "Anub'arak",
  'Toravon the Ice Watcher'
]);

const RANK_THRESHOLDS = [50, 100, 200, 500];
const SCORE_THRESHOLDS = [95, 90, 80, 70];

function getClassColor(className) {
  return WOW_CLASS_COLORS[className] || '#999999';
}

function classTickColor(stats) {
  return (context) => getClassColor(stats[context.index]?.className);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function specKey(row) {
  return `${row.class} — ${row.spec}`;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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

function renderLastUpdated(data) {
  const formatted = formatLastUpdatedKyiv(data?.lastUpdated);
  lastUpdatedText.textContent = formatted ? `Останнє оновлення: ${formatted}` : '';
}

function computeTopRanks(rows) {
  const groups = new Map();

  for (const row of rows) {
    const key = specKey(row);
    if (!groups.has(key)) groups.set(key, { top50: 0, top100: 0, top200: 0, className: row.class });

    const rank = Number(row.overallRank);
    if (!Number.isFinite(rank)) continue;

    const group = groups.get(key);
    if (rank <= 50) group.top50 += 1;
    if (rank <= 100) group.top100 += 1;
    if (rank <= 200) group.top200 += 1;
  }

  return [...groups.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.top200 - a.top200 || b.top100 - a.top100 || b.top50 - a.top50);
}

function computePopularity(rows) {
  const counts = new Map();

  for (const row of rows) {
    const key = specKey(row);
    if (!counts.has(key)) counts.set(key, { count: 0, className: row.class });
    counts.get(key).count += 1;
  }

  return [...counts.entries()]
    .map(([key, { count, className }]) => ({ key, count, className }))
    .sort((a, b) => b.count - a.count);
}

function computeAvgScore(rows) {
  const sums = new Map();

  for (const row of rows) {
    const key = specKey(row);
    if (!sums.has(key)) sums.set(key, { total: 0, count: 0, className: row.class });

    const sum = sums.get(key);
    sum.total += Number.isFinite(Number(row.overallScore)) ? Number(row.overallScore) : 0;
    sum.count += 1;
  }

  return [...sums.entries()]
    .map(([key, { total, count, className }]) => ({ key, avg: count ? total / count : 0, className }))
    .sort((a, b) => b.avg - a.avg);
}

function roleOf(spec) {
  return ROLE_BY_SPEC[spec] || 'DPS';
}


function bestPerPlayer(rows, field, isBetter) {
  const best = new Map();

  for (const row of rows) {
    const value = Number(row[field]);
    if (!Number.isFinite(value)) continue;

    const current = best.get(row.name);
    if (current === undefined || isBetter(value, current)) {
      best.set(row.name, value);
    }
  }

  return best;
}

function computeGuildVsServer(rows) {
  const bestRank = bestPerPlayer(rows, 'overallRank', (value, current) => value < current);
  const total = bestRank.size;
  const ranks = [...bestRank.values()];

  return RANK_THRESHOLDS.map((threshold) => {
    const count = ranks.filter((rank) => rank <= threshold).length;
    return { threshold, count, percent: total ? (count / total) * 100 : 0 };
  });
}

function computeEliteThresholds(rows) {
  const bestScore = bestPerPlayer(rows, 'overallScore', (value, current) => value > current);
  const total = bestScore.size;
  const scores = [...bestScore.values()];

  return SCORE_THRESHOLDS.map((threshold) => {
    const count = scores.filter((score) => score >= threshold).length;
    return { threshold, count, percent: total ? (count / total) * 100 : 0 };
  });
}

function computeBossAverages(rows, bossOrder) {
  const sums = new Map();

  for (const boss of bossOrder || []) {
    if (!EXCLUDED_BOSSES.has(boss)) sums.set(boss, { total: 0, count: 0 });
  }

  for (const row of rows) {
    for (const [boss, value] of Object.entries(row.bosses || {})) {
      if (!sums.has(boss)) continue;

      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) continue;

      const sum = sums.get(boss);
      sum.total += num;
      sum.count += 1;
    }
  }

  return [...sums.entries()]
    .map(([boss, { total, count }]) => ({ boss, avg: count ? total / count : 0, count }))
    .filter((entry) => entry.count > 0);
}

function computeGuildVsLegion(rows, legionNames) {
  const groups = {
    guild: rows.filter((row) => !legionNames.has(row.name)),
    legion: rows.filter((row) => legionNames.has(row.name))
  };

  const result = {};
  for (const [key, groupRows] of Object.entries(groups)) {
    const bestScore = bestPerPlayer(groupRows, 'overallScore', (value, current) => value > current);
    const bestRank = bestPerPlayer(groupRows, 'overallRank', (value, current) => value < current);
    const total = bestScore.size;
    const scores = [...bestScore.values()];
    const ranks = [...bestRank.values()];

    result[key] = {
      activePlayers: total,
      avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      top100Pct: ranks.length ? (ranks.filter((r) => r <= 100).length / ranks.length) * 100 : 0,
      top200Pct: ranks.length ? (ranks.filter((r) => r <= 200).length / ranks.length) * 100 : 0
    };
  }

  return result;
}

function computeScoreHistogram(rows) {
  const bestScore = bestPerPlayer(rows, 'overallScore', (value, current) => value > current);
  const bins = Array.from({ length: 10 }, (_, i) => ({ label: `${i * 10}-${i * 10 + 10}`, count: 0 }));

  for (const score of bestScore.values()) {
    const index = Math.min(9, Math.max(0, Math.floor(score / 10)));
    bins[index].count += 1;
  }

  return bins;
}

function computeTopPlayersBySpec(rows, role, topN) {
  const bySpec = new Map();

  for (const row of rows) {
    if (roleOf(row.spec) !== role) continue;

    const score = Number(row.overallScore);
    if (!Number.isFinite(score)) continue;

    const key = specKey(row);
    if (!bySpec.has(key)) bySpec.set(key, { className: row.class, players: new Map() });

    const players = bySpec.get(key).players;
    const current = players.get(row.name);
    if (current === undefined || score > current) players.set(row.name, score);
  }

  const groups = [...bySpec.entries()].map(([key, { className, players }]) => ({
    key,
    className,
    top: [...players.entries()]
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
  }));

  groups.sort((a, b) => (b.top[0]?.score || 0) - (a.top[0]?.score || 0));

  const flat = [];
  for (const group of groups) {
    group.top.forEach((player, i) => {
      flat.push({ key: group.key, className: group.className, name: player.name, score: player.score, rank: i + 1 });
    });
  }

  return flat;
}

function computeRaidAttendance(potionStats, isIncluded) {
  const counts = new Map();

  for (const raid of potionStats || []) {
    for (const player of raid.players || []) {
      if (!isIncluded(player.name)) continue;
      counts.set(player.name, (counts.get(player.name) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

function getRaidRolesByPlayer(personalStats) {
  const rolesByPlayerRaid = new Map();

  for (const record of personalStats || []) {
    if (record.error) continue;

    for (const player of record.players || []) {
      if (!rolesByPlayerRaid.has(player.name)) rolesByPlayerRaid.set(player.name, new Map());
      const raidMap = rolesByPlayerRaid.get(player.name);
      if (!raidMap.has(record.raidUrl)) raidMap.set(record.raidUrl, new Set());
      raidMap.get(record.raidUrl).add(roleOf(player.spec));
    }
  }

  return rolesByPlayerRaid;
}

function wasNonDpsInRaid(rolesByPlayerRaid, name, raidUrl) {
  const roles = rolesByPlayerRaid.get(name)?.get(raidUrl);
  if (!roles) return false;
  return roles.has('Tank') || roles.has('Healer');
}

function countBossesByRaid(personalStats) {
  const counts = new Map();

  for (const record of personalStats || []) {
    if (record.error || !record.boss) continue;
    counts.set(record.raidUrl, (counts.get(record.raidUrl) || 0) + 1);
  }

  return counts;
}

function computePotionScoreCorrelation(potionStats, rows, personalStats, guildNames) {
  const rolesByPlayerRaid = getRaidRolesByPlayer(personalStats);
  const raidBossCounts = countBossesByRaid(personalStats);
  const potionTotals = new Map();
  const bossCounts = new Map();

  for (const raid of potionStats || []) {
    const bossCount = raidBossCounts.get(raid.raidUrl);
    if (!bossCount) continue; // no personal-stats data for this raid, can't weight it

    for (const player of raid.players || []) {
      if (wasNonDpsInRaid(rolesByPlayerRaid, player.name, raid.raidUrl)) continue;

      potionTotals.set(player.name, (potionTotals.get(player.name) || 0) + Number(player.total || 0));
      bossCounts.set(player.name, (bossCounts.get(player.name) || 0) + bossCount);
    }
  }

  const bestScore = bestPerPlayer(rows, 'overallScore', (value, current) => value > current);

  const points = [];
  for (const [name, totalPotions] of potionTotals.entries()) {
    if (!bestScore.has(name)) continue;

    const bosses = bossCounts.get(name) || 1;
    points.push({
      name,
      x: Number((totalPotions / bosses).toFixed(2)),
      y: bestScore.get(name),
      isGuild: guildNames.has(name)
    });
  }

  return points;
}

function renderTopRanksChart(canvasId, rows) {
  const stats = computeTopRanks(rows);

  const canvas = document.getElementById(canvasId);
  canvas.parentElement.style.height = `${Math.max(320, stats.length * 30)}px`;

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: stats.map((s) => translateSpecKey(s.key)),
      datasets: [
        {
          label: 'Топ-200',
          data: stats.map((s) => s.top200),
          backgroundColor: cssVar('--color-brand')
        },
        {
          label: 'Топ-100',
          data: stats.map((s) => s.top100),
          backgroundColor: cssVar('--color-accent-gold')
        },
        {
          label: 'Топ-50',
          data: stats.map((s) => s.top50),
          backgroundColor: cssVar('--color-danger')
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { ticks: { color: classTickColor(stats) } }
      }
    }
  });
}

function renderPopularityChart(canvasId, rows) {
  const stats = computePopularity(rows);

  const canvas = document.getElementById(canvasId);
  canvas.parentElement.style.height = `${Math.max(320, stats.length * 26)}px`;

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: stats.map((s) => translateSpecKey(s.key)),
      datasets: [
        {
          label: 'Гравців',
          data: stats.map((s) => s.count),
          backgroundColor: stats.map((s) => getClassColor(s.className))
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { ticks: { color: classTickColor(stats) } }
      }
    }
  });
}

function renderAvgScoreChart(canvasId, rows) {
  const stats = computeAvgScore(rows);

  const canvas = document.getElementById(canvasId);
  canvas.parentElement.style.height = `${Math.max(320, stats.length * 26)}px`;

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: stats.map((s) => translateSpecKey(s.key)),
      datasets: [
        {
          label: 'Середній Score',
          data: stats.map((s) => Number(s.avg.toFixed(1))),
          backgroundColor: stats.map((s) => getClassColor(s.className))
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true },
        y: { ticks: { color: classTickColor(stats) } }
      }
    }
  });
}

function renderGuildVsServerChart(rows) {
  const stats = computeGuildVsServer(rows);

  new Chart(document.getElementById('chartGuildVsServer'), {
    type: 'bar',
    data: {
      labels: stats.map((s) => `Топ-${s.threshold}`),
      datasets: [
        {
          label: '% гільдії',
          data: stats.map((s) => Number(s.percent.toFixed(1))),
          backgroundColor: cssVar('--color-link')
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const s = stats[ctx.dataIndex];
              return `${s.count} гравців (${s.percent.toFixed(1)}%)`;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } }
      }
    }
  });
}

function renderEliteChart(rows) {
  const stats = computeEliteThresholds(rows);

  new Chart(document.getElementById('chartElite'), {
    type: 'bar',
    data: {
      labels: stats.map((s) => `Score ≥ ${s.threshold}`),
      datasets: [
        {
          label: 'Гравців',
          data: stats.map((s) => s.count),
          backgroundColor: cssVar('--color-success')
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const s = stats[ctx.dataIndex];
              return `${s.count} гравців (${s.percent.toFixed(1)}%)`;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function renderBossAveragesChart(rows, bossOrder) {
  const stats = computeBossAverages(rows, bossOrder);

  new Chart(document.getElementById('chartBossAvg'), {
    type: 'bar',
    data: {
      labels: stats.map((s) => translateBoss(s.boss)),
      datasets: [
        {
          label: 'Середній DPS',
          data: stats.map((s) => Math.round(s.avg)),
          backgroundColor: cssVar('--color-brand')
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true }
      }
    }
  });
}

function renderGuildVsLegionChart(rows, legionNames, guildRosterSize) {
  const stats = computeGuildVsLegion(rows, legionNames);

  const captionEl = document.getElementById('guildVsLegionCaption');
  if (captionEl) {
    captionEl.textContent =
      `Гільдія: ${guildRosterSize} в ростері (players.json), ${stats.guild.activePlayers} з активними логами · ` +
      `Легіонери (є в логах, але не в players.json): ${stats.legion.activePlayers} гравців.`;
  }

  new Chart(document.getElementById('chartGuildVsLegion'), {
    type: 'bar',
    data: {
      labels: ['Середній Score', '% в топ-100', '% в топ-200'],
      datasets: [
        {
          label: 'Гільдія',
          data: [
            Number(stats.guild.avgScore.toFixed(1)),
            Number(stats.guild.top100Pct.toFixed(1)),
            Number(stats.guild.top200Pct.toFixed(1))
          ],
          backgroundColor: cssVar('--color-success')
        },
        {
          label: 'Легіонери',
          data: [
            Number(stats.legion.avgScore.toFixed(1)),
            Number(stats.legion.top100Pct.toFixed(1)),
            Number(stats.legion.top200Pct.toFixed(1))
          ],
          backgroundColor: '#f2994a'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });
}

function renderScoreHistogramChart(rows) {
  const bins = computeScoreHistogram(rows);

  new Chart(document.getElementById('chartScoreHistogram'), {
    type: 'bar',
    data: {
      labels: bins.map((b) => b.label),
      datasets: [
        {
          label: 'Гравців',
          data: bins.map((b) => b.count),
          backgroundColor: cssVar('--color-brand')
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function computeTopHealersByHps(healerRankings, topN, allowedNames) {
  const specs = healerRankings?.specs || [];

  const groups = specs.map((spec) => ({
    key: `${spec.class} — ${spec.spec}`,
    className: spec.class,
    top: (spec.players || [])
      .filter((player) => allowedNames.has(player.name))
      .slice(0, topN)
  }));

  groups.sort((a, b) => (b.top[0]?.hps || 0) - (a.top[0]?.hps || 0));

  const flat = [];
  for (const group of groups) {
    group.top.forEach((player, i) => {
      flat.push({ key: group.key, className: group.className, name: player.name, hps: player.hps, rank: i + 1 });
    });
  }

  return flat;
}

function renderTopHealersChart(healerRankings, allowedNames) {
  const stats = computeTopHealersByHps(healerRankings, 3, allowedNames);

  const canvas = document.getElementById('chartTopByClassHealer');
  canvas.parentElement.style.height = `${Math.max(320, stats.length * 26)}px`;

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: stats.map((s) => `${translateSpecKey(s.key)} #${s.rank} — ${s.name}`),
      datasets: [
        {
          label: 'HPS',
          data: stats.map((s) => Math.round(s.hps)),
          backgroundColor: stats.map((s) => getClassColor(s.className))
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true },
        y: { ticks: { color: classTickColor(stats) } }
      }
    }
  });
}

function renderTopByClassChart(rows, role, canvasId) {
  const stats = computeTopPlayersBySpec(rows, role, 3);

  const canvas = document.getElementById(canvasId);
  canvas.parentElement.style.height = `${Math.max(320, stats.length * 26)}px`;

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: stats.map((s) => `${translateSpecKey(s.key)} #${s.rank} — ${s.name}`),
      datasets: [
        {
          label: 'Score',
          data: stats.map((s) => Number(s.score.toFixed(1))),
          backgroundColor: stats.map((s) => getClassColor(s.className))
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true },
        y: { ticks: { color: classTickColor(stats) } }
      }
    }
  });
}

function renderRaidAttendanceChart(canvasId, stats, color) {
  new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels: stats.map((s) => s.name),
      datasets: [
        {
          label: 'Рейдів',
          data: stats.map((s) => s.count),
          backgroundColor: color
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function buildPotionScoreTrendDataset(categoryPoints, label, color, maxX) {
  if (categoryPoints.length < 2) return null;

  const trend = computeTrendLine(categoryPoints);
  if (!trend) return null;

  return {
    type: 'line',
    label,
    data: [
      { x: 0, y: trend.intercept },
      { x: maxX, y: trend.slope * maxX + trend.intercept }
    ],
    borderColor: color,
    backgroundColor: color,
    borderDash: [6, 4],
    borderWidth: 2,
    pointRadius: 0,
    fill: false,
    isTrend: true
  };
}

function renderPotionScoreChart(potionStats, rows, personalStats, guildNames) {
  const points = computePotionScoreCorrelation(potionStats, rows, personalStats, guildNames);
  const guildPoints = points.filter((p) => p.isGuild);
  const legionPoints = points.filter((p) => !p.isGuild);
  const maxX = points.length ? Math.max(...points.map((p) => p.x)) : 0;

  const datasets = [
    {
      label: 'Гільдія',
      data: guildPoints,
      backgroundColor: cssVar('--color-success')
    },
    {
      label: 'Легіонери',
      data: legionPoints,
      backgroundColor: '#f2994a'
    },
    buildPotionScoreTrendDataset(guildPoints, 'Гільдія — лінія тренду', cssVar('--color-success'), maxX),
    buildPotionScoreTrendDataset(legionPoints, 'Легіонери — лінія тренду', '#f2994a', maxX)
  ].filter(Boolean);

  new Chart(document.getElementById('chartPotionScore'), {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { filter: (item, data) => !data.datasets[item.datasetIndex]?.isTrend }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.isTrend) return `${ctx.dataset.label}: Score ${ctx.raw.y.toFixed(1)}`;
              const p = ctx.raw;
              return `${p.name}: ${p.x} потів/боса, Score ${p.y}`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Потів за боса (середнє)' }, beginAtZero: true },
        y: { title: { display: true, text: 'Score' }, beginAtZero: true }
      }
    }
  });
}

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year.slice(2)}`;
}

const DAY_LABELS = ['НД', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const DAY_COLORS = ['#f48cba', '#7baaf5', '#63d471', '#ffd700', '#ff7c0a', '#c41e3a', '#9382c9'];

function dayOfWeek(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function getSelectedDays() {
  return [...bossSumDayFilter.querySelectorAll('input:checked')].map((cb) => Number(cb.value));
}

function computeBossSumOverTime(personalStats, boss) {
  const points = [];

  for (const record of personalStats) {
    if (record.error || record.boss !== boss) continue;

    const players = record.players || [];
    if (!players.length) continue;

    const value = players.reduce((sum, p) => sum + Number(p.dps || 0), 0);
    points.push({ date: record.date, value });
  }

  return points.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function computeBossSumByDay(personalStats, boss) {
  const byDay = new Map();

  for (const record of personalStats) {
    if (record.error || record.boss !== boss) continue;
    const players = record.players || [];
    if (!players.length) continue;

    const value = players.reduce((sum, p) => sum + Number(p.dps || 0), 0);
    const dow = dayOfWeek(record.date);
    if (!byDay.has(dow)) byDay.set(dow, []);
    byDay.get(dow).push({ date: record.date, value });
  }

  for (const points of byDay.values()) {
    points.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  return byDay;
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

function renderBossMetricOverTimeChart({ canvasId, points, splineMode, datasetLabel, yLabel }) {
  let seriesPoints = points;
  const minValue = points.length ? Math.min(...points.map((p) => p.value)) : 0;

  if (splineMode === 'trend') {
    const trend = computeTrendLine(points.map((p, idx) => ({ x: idx, y: p.value })));
    seriesPoints = trend
      ? points.map((p, idx) => ({ date: p.date, value: trend.slope * idx + trend.intercept, isTrend: true }))
      : [];
  }

  const existingChart = Chart.getChart(canvasId);
  if (existingChart) existingChart.destroy();

  const spline = SPLINE_MODES[splineMode] || SPLINE_MODES.smoothNoPoints;

  new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: {
      labels: seriesPoints.map((p) => formatDateLabel(p.date)),
      datasets: [
        {
          label: datasetLabel,
          data: seriesPoints.map((p) => Math.round(p.value)),
          borderColor: cssVar('--color-brand'),
          backgroundColor: cssVar('--color-brand'),
          spanGaps: true,
          tension: spline.tension,
          cubicInterpolationMode: spline.cubicInterpolationMode,
          pointRadius: spline.pointRadius,
          hitRadius: spline.hitRadius,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const point = seriesPoints[ctx.dataIndex];
              if (!point) return null;

              const suffix = point.isTrend ? ' (тренд)' : '';
              return `${yLabel}${suffix}: ${Math.round(point.value).toLocaleString('en-US')}`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Дата рейду' } },
        y: { title: { display: true, text: yLabel }, min: Math.max(0, Math.floor((minValue - 50000) / 10000) * 10000) }
      }
    }
  });
}

function renderBossSumMultiDayChart(personalStats, boss, selectedDays) {
  const byDay = computeBossSumByDay(personalStats, boss);
  const splineMode = bossSumOverTimeSplineSelect.value;
  const spline = SPLINE_MODES[splineMode] || SPLINE_MODES.smoothNoPoints;

  const allDates = [...new Set(
    selectedDays.flatMap((dow) => (byDay.get(dow) || []).map((p) => p.date))
  )].sort();

  const datasets = selectedDays.map((dow) => {
    const rawPoints = byDay.get(dow) || [];
    const dateValueMap = new Map(rawPoints.map((p) => [p.date, p.value]));
    const color = DAY_COLORS[dow];

    let values;
    if (splineMode === 'trend') {
      const trend = computeTrendLine(rawPoints.map((p, idx) => ({ x: idx, y: p.value })));
      values = allDates.map((date) => {
        const idx = rawPoints.findIndex((p) => p.date === date);
        return idx >= 0 && trend ? Math.round(trend.slope * idx + trend.intercept) : null;
      });
    } else {
      values = allDates.map((date) => {
        const val = dateValueMap.get(date);
        return val !== undefined ? Math.round(val) : null;
      });
    }

    return {
      label: DAY_LABELS[dow],
      data: values,
      borderColor: color,
      backgroundColor: color,
      spanGaps: true,
      tension: spline.tension,
      cubicInterpolationMode: spline.cubicInterpolationMode,
      pointRadius: spline.pointRadius,
      hitRadius: spline.hitRadius,
      pointHoverRadius: 6,
      fill: false
    };
  });

  const allValues = datasets.flatMap((ds) => ds.data.filter((v) => v !== null));
  const multiMinValue = allValues.length ? Math.min(...allValues) : 0;

  const existingChart = Chart.getChart('chartBossSumOverTime');
  if (existingChart) existingChart.destroy();

  new Chart(document.getElementById('chartBossSumOverTime'), {
    type: 'line',
    data: { labels: allDates.map(formatDateLabel), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.parsed.y === null) return null;
              return `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('en-US')}`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Дата рейду' } },
        y: { title: { display: true, text: 'Сумарний DPS' }, min: Math.max(0, Math.floor((multiMinValue - 50000) / 10000) * 10000) }
      }
    }
  });
}

function renderBossSumOverTimeChart(personalStats, boss) {
  const selectedDays = getSelectedDays();

  if (selectedDays.length <= 1) {
    let points;
    if (selectedDays.length === 0) {
      points = computeBossSumOverTime(personalStats, boss);
    } else {
      const byDay = computeBossSumByDay(personalStats, boss);
      points = byDay.get(selectedDays[0]) || [];
    }
    renderBossMetricOverTimeChart({
      canvasId: 'chartBossSumOverTime',
      points,
      splineMode: bossSumOverTimeSplineSelect.value,
      datasetLabel: `Сумарний DPS — ${translateBoss(boss)}`,
      yLabel: 'Сумарний DPS'
    });
  } else {
    renderBossSumMultiDayChart(personalStats, boss, selectedDays);
  }
}

async function init() {
  Chart.defaults.color = cssVar('--color-text');
  Chart.defaults.borderColor = cssVar('--color-border');
  Chart.defaults.font.family = "'Roboto', 'Open Sans', sans-serif";

  try {
    setStatus('Завантаження даних...');
    const [guildResponse, playersResponse, potionResponse, healerResponse, personalResponse] = await Promise.all([
      fetch('/data/guild-data.json?t=' + Date.now()),
      fetch('/data/players.json?t=' + Date.now()),
      fetch('/data/potion-stats.json?t=' + Date.now()),
      fetch('/data/healer-rankings.json?t=' + Date.now()),
      fetch('/data/personal-stats.json?t=' + Date.now())
    ]);

    if (!guildResponse.ok) {
      throw new Error(`HTTP ${guildResponse.status}`);
    }

    const data = await guildResponse.json();
    const players = playersResponse.ok ? await playersResponse.json() : [];
    const potionStats = potionResponse.ok ? await potionResponse.json() : [];
    const healerRankings = healerResponse.ok ? await healerResponse.json() : { specs: [] };
    const personalStats = personalResponse.ok ? await personalResponse.json() : [];
    const guildNames = new Set(players.map((p) => p.name));

    const rows = (data.rows || []).filter((row) => row.class && row.spec);
    const legionNames = new Set(rows.filter((row) => !guildNames.has(row.name)).map((row) => row.name));

    // Танк- і хіл-спеки рахуються по DPS-системі uwu-logs, яка не оцінює їхню реальну роботу
    // (танкування/хіл) — тому DPS-орієнтовані метрики (Score, Rank, середній DPS) рахуються тільки по DPS-спеках.
    const dpsRows = rows.filter((row) => roleOf(row.spec) === 'DPS');
    const guildDpsRows = dpsRows.filter((row) => guildNames.has(row.name));

    renderTopRanksChart('chartTopRanksGuild', guildDpsRows);
    renderTopRanksChart('chartTopRanksLegion', dpsRows.filter((row) => !guildNames.has(row.name)));
    renderPopularityChart('chartSpecPopularityGuild', rows.filter((row) => guildNames.has(row.name)));
    renderPopularityChart('chartSpecPopularityLegion', rows.filter((row) => !guildNames.has(row.name)));
    renderBossAveragesChart(dpsRows, data.bossOrder);

    const bossesWithHistory = (data.bossOrder || []).filter((boss) => !EXCLUDED_BOSSES.has(boss) && boss !== 'Halion');
    const populateBossSelect = (selectEl) => {
      selectEl.innerHTML = '';
      bossesWithHistory.forEach((boss) => {
        const option = document.createElement('option');
        option.value = boss;
        option.textContent = translateBoss(boss);
        selectEl.appendChild(option);
      });
    };

    populateBossSelect(bossSumOverTimeSelect);

    if (bossesWithHistory.length) {
      renderBossSumOverTimeChart(personalStats, bossesWithHistory[0]);
    }

    bossSumOverTimeSelect.addEventListener('change', () => {
      renderBossSumOverTimeChart(personalStats, bossSumOverTimeSelect.value);
    });

    bossSumOverTimeSplineSelect.addEventListener('change', () => {
      renderBossSumOverTimeChart(personalStats, bossSumOverTimeSelect.value);
    });

    bossSumDayFilter.addEventListener('change', () => {
      renderBossSumOverTimeChart(personalStats, bossSumOverTimeSelect.value);
    });

    renderAvgScoreChart('chartAvgScoreGuild', guildDpsRows);
    renderAvgScoreChart('chartAvgScoreLegion', dpsRows.filter((row) => !guildNames.has(row.name)));
    renderGuildVsServerChart(guildDpsRows);
    renderEliteChart(guildDpsRows);
    renderGuildVsLegionChart(dpsRows, legionNames, players.length);
    renderScoreHistogramChart(guildDpsRows);
    renderTopByClassChart(guildDpsRows, 'DPS', 'chartTopByClassDps');
    renderTopHealersChart(healerRankings, guildNames);
    renderRaidAttendanceChart('chartRaidAttendanceGuild', computeRaidAttendance(potionStats, (name) => guildNames.has(name)), cssVar('--color-success'));
    renderRaidAttendanceChart('chartRaidAttendanceLegion', computeRaidAttendance(potionStats, (name) => !guildNames.has(name)), '#f2994a');
    renderPotionScoreChart(potionStats, dpsRows, personalStats, guildNames);

    renderLastUpdated(data);
    setStatus(`Гравців у вибірці: ${rows.length}`);
  } catch (error) {
    console.error(error);
    setStatus('Не вдалося завантажити дані аналітики.');
  }
}

init();
