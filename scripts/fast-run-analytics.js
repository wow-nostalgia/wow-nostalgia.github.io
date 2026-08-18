const fastRunSection = document.getElementById('fastRunSection');
const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const notOfficerGate = document.getElementById('notOfficerGate');
const fastRunStatus = document.getElementById('fastRunStatus');
const raidDurationSplineSelect = document.getElementById('raidDurationSplineSelect');
const raidDurationDayFilter = document.getElementById('raidDurationDayFilter');
const fastRunTableBody = document.getElementById('fastRunTableBody');

const DAY_LABELS = ['НД', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const DAY_COLORS = ['#f48cba', '#7baaf5', '#63d471', '#ffd700', '#ff7c0a', '#c41e3a', '#9382c9'];

function setStatus(text) {
  if (fastRunStatus) fastRunStatus.textContent = text;
}

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year.slice(2)}`;
}

function dayOfWeek(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function formatRaidDuration(ms) {
  if (ms == null) return '—';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDamage(n) {
  if (n == null) return '—';
  return n.toLocaleString('uk-UA');
}

function openRaidLog(url) {
  if (url) window.open(url, '_blank', 'noopener');
}

function pointerCursorOnHover(event, elements) {
  if (event.native) event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
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

function getSelectedDays() {
  return [...raidDurationDayFilter.querySelectorAll('input:checked')].map((cb) => Number(cb.value));
}

const FULL_CLEAR_BOSS_COUNT = 11;

function isFullClear(r) {
  return !r.error && r.durationMs != null && r.bossCount === FULL_CLEAR_BOSS_COUNT;
}

function buildPoints(summaries) {
  return summaries
    .filter(isFullClear)
    .map((r) => ({
      date: r.date,
      value: r.durationMs / 1000,
      durationMs: r.durationMs,
      totalDamage: r.totalDamage,
      raidUrl: r.raidUrl
    }))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function buildPointsByDay(summaries) {
  const byDay = new Map();
  for (const r of summaries) {
    if (!isFullClear(r) || !r.date) continue;
    const dow = dayOfWeek(r.date);
    if (!byDay.has(dow)) byDay.set(dow, []);
    byDay.get(dow).push({
      date: r.date,
      value: r.durationMs / 1000,
      durationMs: r.durationMs,
      totalDamage: r.totalDamage,
      raidUrl: r.raidUrl
    });
  }
  for (const pts of byDay.values()) {
    pts.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }
  return byDay;
}

function renderRaidDurationChart(summaries) {
  const selectedDays = getSelectedDays();
  const splineMode = raidDurationSplineSelect.value;
  const spline = SPLINE_MODES[splineMode] || SPLINE_MODES.smoothNoPoints;
  const yLabel = "Тривалість рейду";

  const existingChart = Chart.getChart('chartRaidDuration');
  if (existingChart) existingChart.destroy();

  if (selectedDays.length <= 1) {
    let points;
    if (selectedDays.length === 0) {
      points = buildPoints(summaries);
    } else {
      const byDay = buildPointsByDay(summaries);
      points = (byDay.get(selectedDays[0]) || []);
    }

    const best = findBestPoint(points, (a, b) => a < b);
    const bestResultText = best
      ? `Найкращий результат: ${formatRaidDuration(best.point.durationMs)} (${formatDateLabel(best.point.date)})`
      : '';

    let seriesPoints = points;
    if (splineMode === 'trend') {
      const trend = computeTrendLine(points.map((p, idx) => ({ x: idx, y: p.value })));
      seriesPoints = trend
        ? points.map((p, idx) => ({ ...p, value: trend.slope * idx + trend.intercept, isTrend: true }))
        : [];
    }

    new Chart(document.getElementById('chartRaidDuration'), {
      type: 'line',
      data: {
        labels: seriesPoints.map((p) => formatDateLabel(p.date)),
        datasets: [{
          label: yLabel,
          data: seriesPoints.map((p) => p.value),
          borderColor: cssVar('--color-brand'),
          backgroundColor: cssVar('--color-brand'),
          spanGaps: true,
          tension: spline.tension,
          cubicInterpolationMode: spline.cubicInterpolationMode,
          pointRadius: spline.pointRadius,
          hitRadius: spline.hitRadius,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: bestIconLayoutPadding(!!best, 'below') },
        onClick: (event, elements) => {
          if (!elements.length) return;
          const p = seriesPoints[elements[0].index];
          if (p && !p.isTrend) openRaidLog(p.raidUrl);
        },
        onHover: pointerCursorOnHover,
        plugins: {
          legend: { display: false },
          bestResultLabel: {
            medals: best
              ? [{ text: bestResultText, datasetIndex: 0, pointIndex: best.index, iconPosition: 'below', color: getMedalColor(0) }]
              : []
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const p = seriesPoints[ctx.dataIndex];
                if (!p) return null;
                const suffix = p.isTrend ? ' (тренд)' : '';
                return `${yLabel}${suffix}: ${formatRaidDuration(p.isTrend ? p.value * 1000 : p.durationMs)}`;
              },
              afterLabel: (ctx) => {
                const p = seriesPoints[ctx.dataIndex];
                if (!p || p.isTrend || p.totalDamage == null) return undefined;
                return `Total Damage: ${formatDamage(p.totalDamage)}`;
              },
              footer: (items) => {
                const p = seriesPoints[items[0]?.dataIndex];
                return p && !p.isTrend && p.raidUrl ? 'Клік — відкрити лог' : undefined;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Дата рейду' }, ticks: { minRotation: 45, maxRotation: 45 } },
          y: {
            title: { display: true, text: yLabel },
            min: 0,
            ticks: { callback: (v) => formatRaidDuration(v * 1000) }
          }
        }
      }
    });
  } else {
    const byDay = buildPointsByDay(summaries);
    const allDates = [...new Set(
      selectedDays.flatMap((dow) => (byDay.get(dow) || []).map((p) => p.date))
    )].sort();

    let best = null;
    let bestDsIdx = null;
    selectedDays.forEach((dow, dsIdx) => {
      const found = findBestPoint(byDay.get(dow) || [], (a, b) => a < b);
      if (found && (!best || found.point.value < best.point.value)) {
        best = found;
        bestDsIdx = dsIdx;
      }
    });

    const bestResultText = best
      ? `Найкращий результат: ${formatRaidDuration(best.point.durationMs)} (${formatDateLabel(best.point.date)})`
      : '';
    const bestPointIndex = best ? allDates.indexOf(best.point.date) : null;

    const datasets = selectedDays.map((dow) => {
      const rawPts = byDay.get(dow) || [];
      const dateValueMap = new Map(rawPts.map((p) => [p.date, p]));
      const color = DAY_COLORS[dow];
      const isTrend = splineMode === 'trend';

      let values;
      if (isTrend) {
        const trend = computeTrendLine(rawPts.map((p, idx) => ({ x: idx, y: p.value })));
        values = allDates.map((date) => {
          const idx = rawPts.findIndex((p) => p.date === date);
          return idx >= 0 && trend ? trend.slope * idx + trend.intercept : null;
        });
      } else {
        values = allDates.map((date) => {
          const p = dateValueMap.get(date);
          return p !== undefined ? p.value : null;
        });
      }

      return {
        label: DAY_LABELS[dow],
        data: values,
        rawPoints: isTrend ? [] : allDates.map((date) => dateValueMap.get(date) || null),
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

    new Chart(document.getElementById('chartRaidDuration'), {
      type: 'line',
      data: { labels: allDates.map(formatDateLabel), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: bestIconLayoutPadding(!!best, 'below') },
        onClick: (event, elements) => {
          if (!elements.length) return;
          const { datasetIndex, index } = elements[0];
          const p = datasets[datasetIndex].rawPoints[index];
          if (p) openRaidLog(p.raidUrl);
        },
        onHover: pointerCursorOnHover,
        plugins: {
          legend: { display: true },
          bestResultLabel: {
            medals: bestDsIdx != null
              ? [{ text: bestResultText, datasetIndex: bestDsIdx, pointIndex: bestPointIndex, iconPosition: 'below', color: getMedalColor(0) }]
              : []
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.parsed.y === null) return null;
                const p = datasets[ctx.datasetIndex].rawPoints[ctx.dataIndex];
                if (!p) return `${ctx.dataset.label}: ${formatRaidDuration(ctx.parsed.y * 1000)}`;
                return `${ctx.dataset.label}: ${formatRaidDuration(p.durationMs)}`;
              },
              afterLabel: (ctx) => {
                const p = datasets[ctx.datasetIndex].rawPoints?.[ctx.dataIndex];
                if (!p || p.totalDamage == null) return undefined;
                return `Total Damage: ${formatDamage(p.totalDamage)}`;
              },
              footer: (items) => {
                const ds = datasets[items[0]?.datasetIndex];
                const p = ds?.rawPoints?.[items[0]?.dataIndex];
                return p?.raidUrl ? 'Клік — відкрити лог' : undefined;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Дата рейду' }, ticks: { minRotation: 45, maxRotation: 45 } },
          y: {
            title: { display: true, text: yLabel },
            min: 0,
            ticks: { callback: (v) => formatRaidDuration(v * 1000) }
          }
        }
      }
    });
  }
}

// --- Sortable table ---

let sortCol = 'date';
let sortDir = 'desc';

function renderTable(summaries) {
  const rows = summaries.filter(isFullClear);
  const sorted = [...rows].sort((a, b) => {
    let valA, valB;
    if (sortCol === 'date') { valA = a.date || ''; valB = b.date || ''; }
    else if (sortCol === 'duration') { valA = a.durationMs; valB = b.durationMs; }
    else { valA = a.totalDamage ?? -1; valB = b.totalDamage ?? -1; }

    const cmp = typeof valA === 'string'
      ? valA.localeCompare(valB)
      : (valA - valB);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  fastRunTableBody.innerHTML = '';
  for (const r of sorted) {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.title = "Відкрити лог";
    tr.addEventListener('click', () => openRaidLog(r.raidUrl));

    const tdDate = document.createElement('td');
    tdDate.textContent = formatDateLabel(r.date);
    tr.appendChild(tdDate);

    const tdDur = document.createElement('td');
    tdDur.textContent = formatRaidDuration(r.durationMs);
    tr.appendChild(tdDur);

    const tdDmg = document.createElement('td');
    tdDmg.textContent = formatDamage(r.totalDamage);
    tr.appendChild(tdDmg);

    fastRunTableBody.appendChild(tr);
  }
}

function updateSortIndicators() {
  document.querySelectorAll('#fastRunTable th[data-sort]').forEach((th) => {
    const col = th.dataset.sort;
    const indicator = th.querySelector('.sort-indicator');
    if (indicator) {
      indicator.textContent = col === sortCol ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⬍';
    }
  });
}

function setupTableSort(summaries) {
  document.querySelectorAll('#fastRunTable th[data-sort]').forEach((th) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = col === 'date' ? 'desc' : 'asc';
      }
      updateSortIndicators();
      renderTable(summaries);
    });
  });
  updateSortIndicators();
}

async function init() {
  loginGateBtn.href = discordLoginUrl();

  const user = await fetchCurrentUser();

  if (!user) {
    loginGate.hidden = false;
    return;
  }

  if (!user.isGuildOfficer) {
    notOfficerGate.hidden = false;
    return;
  }

  fastRunSection.hidden = false;

  Chart.defaults.color = cssVar('--color-text');
  Chart.defaults.borderColor = cssVar('--color-border');
  Chart.defaults.font.family = cssVar('--font-sans');

  try {
    setStatus('Завантаження даних...');
    const response = await fetch(`/data/raid-summaries.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const summaries = await response.json();

    const valid = summaries.filter(isFullClear);
    if (!valid.length) {
      setStatus('Немає даних про повні кліри (11 босів).');
      return;
    }

    setStatus(`Повних клірів: ${valid.length}`);

    renderRaidDurationChart(summaries);
    renderTable(summaries);
    setupTableSort(summaries);

    raidDurationSplineSelect.addEventListener('change', () => renderRaidDurationChart(summaries));
    raidDurationDayFilter.addEventListener('change', () => renderRaidDurationChart(summaries));
  } catch (err) {
    setStatus(`Помилка завантаження: ${err.message}`);
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
