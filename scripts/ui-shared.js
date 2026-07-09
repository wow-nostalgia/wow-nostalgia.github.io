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
