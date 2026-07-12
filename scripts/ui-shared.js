// Спільні дрібні хелпери для кількох сторінок сайту. Підключати тегом
// <script> ДО файлів, що їх використовують (без бандлера, як і інші
// клієнтські скрипти).

// Бейдж гільдієць/легіонер. Очікує глобальну змінну guildMemberNames
// (Set з іменами гільдії), яку кожна сторінка заповнює сама зі свого
// data/players.json.
function createPlayerBadge(name) {
  const isGuild = guildMemberNames.has(name);
  const badge = document.createElement('span');
  badge.className = `player-badge ${isGuild ? 'player-badge--guild' : 'player-badge--legion'}`;
  badge.title = isGuild ? 'Ностальгія' : 'Легіонер';
  badge.textContent = isGuild ? 'N' : 'L';
  return badge;
}

// Той самий бейдж, але як HTML-рядок — для сторінок, що рендерять таблиці
// через template strings (потрібен escapeHtml з відповідного файлу).
function createPlayerBadgeHtml(name) {
  const isGuild = guildMemberNames.has(name);
  const cls = isGuild ? 'player-badge--guild' : 'player-badge--legion';
  const title = isGuild ? 'Ностальгія' : 'Легіонер';
  const letter = isGuild ? 'N' : 'L';
  return `<span class="player-badge ${cls}" title="${title}">${letter}</span>`;
}

const SCORE_TIERS = [
  { min: 90, medal: '🥇' },
  { min: 80, medal: '🥈' },
  { min: 70, medal: '🥉' }
];

function getScoreTier(score) {
  const num = Number(score);
  if (!Number.isFinite(num)) return null;
  return SCORE_TIERS.find((tier) => num > tier.min) || null;
}

function formatDateTimeKyiv(isoString) {
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

const SPLINE_MODES = {
  smooth: { tension: 0.3, cubicInterpolationMode: 'default', pointRadius: 4, hitRadius: 1 },
  smoothNoPoints: { tension: 0.3, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 },
  linear: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 4, hitRadius: 1 },
  linearNoPoints: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 },
  trend: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 }
};

function specKey(entity) {
  return `${entity.class} — ${entity.spec}`;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// "Найкращий результат" — золота іконка кубка (Primer octicon-trophy) біля
// найкращої точки лінійного Chart.js-графіка + підпис у правому нижньому
// куті. Використовується на сторінках "Гільдійська аналітика" та
// "Персональна аналітика". Малюється напряму на canvas (а не HTML-оверлеєм),
// щоб позиція завжди відповідала реальній chartArea незалежно від висоти
// підписів осі X.
const TROPHY_ICON_PATH = 'M3.217 6.962A3.75 3.75 0 0 1 0 3.25v-.5C0 1.784.784 1 1.75 1h1.356c.228-.585.796-1 1.462-1h6.864c.647 0 1.227.397 1.462 1h1.356c.966 0 1.75.784 1.75 1.75v.5a3.75 3.75 0 0 1-3.217 3.712 5.014 5.014 0 0 1-2.771 3.117l.144 1.446c.005.05.03.12.114.204.086.087.217.17.373.227.283.103.618.274.89.568.285.31.467.723.467 1.226v.75h1.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H4v-.75c0-.503.182-.916.468-1.226.27-.294.606-.465.889-.568.139-.048.266-.126.373-.227.084-.085.109-.153.114-.204l.144-1.446a5.015 5.015 0 0 1-2.77-3.117ZM4.5 1.568V5.5a3.5 3.5 0 1 0 7 0V1.568a.068.068 0 0 0-.068-.068H4.568a.068.068 0 0 0-.068.068Zm2.957 8.902-.12 1.204c-.093.925-.858 1.47-1.467 1.691a.766.766 0 0 0-.3.176c-.037.04-.07.093-.07.21v.75h5v-.75c0-.117-.033-.17-.07-.21a.766.766 0 0 0-.3-.176c-.609-.221-1.374-.766-1.466-1.69l-.12-1.204a5.064 5.064 0 0 1-1.087 0ZM13 2.5v2.872a2.25 2.25 0 0 0 1.5-2.122v-.5a.25.25 0 0 0-.25-.25H13Zm-10 0H1.75a.25.25 0 0 0-.25.25v.5c0 .98.626 1.813 1.5 2.122Z';
const TROPHY_ICON_PATH2D = new Path2D(TROPHY_ICON_PATH);

// Кольори медалей за місцем (0 = 1-е місце, 1 = 2-е тощо).
function getMedalColor(rank) {
  return rank === 0 ? cssVar('--color-accent-gold') : '#c0c0c0';
}

const bestResultLabelPlugin = {
  id: 'bestResultLabel',
  afterDraw(chart) {
    const medals = chart.options.plugins?.bestResultLabel?.medals;
    if (!medals || !medals.length) return;

    const { ctx, chartArea } = chart;
    const lineHeight = Chart.defaults.font.size + 4;

    ctx.save();
    ctx.font = `italic ${Chart.defaults.font.size}px ${cssVar('--font-sans')}`;
    ctx.fillStyle = cssVar('--color-text-faint');
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    medals.forEach((medal, i) => {
      ctx.fillText(medal.text, chartArea.right - 4, chartArea.bottom - 4 - i * lineHeight);
    });
    ctx.restore();

    medals.forEach((medal) => {
      if (medal.datasetIndex == null || medal.pointIndex == null) return;

      const point = chart.getDatasetMeta(medal.datasetIndex)?.data?.[medal.pointIndex];
      if (!point) return;

      const iconSize = 14;
      const gap = 6;
      const iconY = medal.iconPosition === 'below' ? point.y + gap : point.y - gap - iconSize;

      ctx.save();
      ctx.translate(point.x - iconSize / 2, iconY);
      ctx.scale(iconSize / 16, iconSize / 16);
      ctx.fillStyle = medal.color || cssVar('--color-accent-gold');
      ctx.fill(TROPHY_ICON_PATH2D);
      ctx.restore();
    });
  }
};
Chart.register(bestResultLabelPlugin);

const BEST_ICON_CLEARANCE = 24;
const BEST_ICON_HALF_WIDTH = 10;

// layout.padding для Chart.js-опцій графіка, що резервує місце під іконку
// кубка з потрібного боку (і завжди трохи зліва/справа, бо найкраща точка
// може виявитись крайньою в ряду дат).
function bestIconLayoutPadding(showBestResult, bestIconPosition) {
  if (!showBestResult) return {};

  const vertical = bestIconPosition === 'below' ? { bottom: BEST_ICON_CLEARANCE } : { top: BEST_ICON_CLEARANCE };
  return { ...vertical, left: BEST_ICON_HALF_WIDTH, right: BEST_ICON_HALF_WIDTH };
}

// points: масив { value, date, ... }. isBetter(a, b) — чи значення a краще за b.
function findBestPoint(points, isBetter) {
  if (!points.length) return null;

  let bestIndex = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (isBetter(points[i].value, points[bestIndex].value)) bestIndex = i;
  }
  return { point: points[bestIndex], index: bestIndex };
}

// formatDateLabel — очікується вже визначеною на сторінці, що підключає цей файл.
function formatBestResultText(point, formatValue) {
  return `Найкращий результат: ${formatValue(point.value)} (${formatDateLabel(point.date)})`;
}
