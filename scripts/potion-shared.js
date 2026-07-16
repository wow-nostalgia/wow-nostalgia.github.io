// Спільна логіка для "Статистика Potion" (potion-stats.js) і табу "Лог"
// на сторінці рейду (raid-manager-detail.js) - обидва рендерять ту саму
// таблицю потів по логу з data/potion-stats.json + data/raid-rosters.json.
// Підключати тегом <script> ПІСЛЯ wow-class-colors.js (використовує
// WOW_CLASS_COLORS), ДО файлу, що використовує ці функції.

function isSafeUrl(url) {
  try {
    return ['https:', 'http:'].includes(new URL(String(url)).protocol);
  } catch {
    return false;
  }
}

function extractLogUploaderName(raidUrl) {
  const match = String(raidUrl || '').match(/--([^-/]+)--FreedomUA\/?.*$/);
  return match ? match[1] : 'Невідомо';
}

function formatPotionLogLabel(statsRaid) {
  const date = statsRaid.date || 'Невідома дата';
  const uploader = extractLogUploaderName(statsRaid.raidUrl || '');
  return `Лог від ${date}. Завантажив ${uploader}`;
}

function filterAndSortPotionRaids(raids) {
  return (Array.isArray(raids) ? raids : [])
    .filter((r) => Array.isArray(r.players) && r.players.length > 0 && r.raidUrl)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function buildBossCountMap(personalStatsRecords) {
  const map = new Map();
  for (const record of personalStatsRecords) {
    if (!record.raidUrl || !record.boss) continue;
    if (!map.has(record.raidUrl)) map.set(record.raidUrl, new Set());
    map.get(record.raidUrl).add(record.boss);
  }
  return map;
}

// Кількість босів логу (+ mergedFrom, якщо лог було розділено на кілька
// звітів). Gunship Battle не потрапляє у personal-stats.json (не тягне
// DPS-даних), але якщо вбито Deathbringer Saurfang - Gunship Battle точно
// був пройдений.
function countRaidBosses(bossCountMap, statsRaid) {
  const urls = [statsRaid.raidUrl, ...(statsRaid.mergedFrom || [])];
  const bosses = new Set();
  for (const url of urls) {
    const set = bossCountMap.get(url);
    if (set) for (const boss of set) bosses.add(boss);
  }

  if (bosses.has('Deathbringer Saurfang') && !bosses.has('Gunship Battle')) {
    bosses.add('Gunship Battle');
  }

  return bosses.size;
}

function getPotionRowClass(player, bossCount) {
  if (!bossCount) return '';
  const avgPerBoss = Number(player.total || 0) / bossCount;
  return avgPerBoss >= 1 ? 'potion-good' : 'potion-bad';
}

function buildRosterMap(rosters) {
  return new Map((Array.isArray(rosters) ? rosters : []).map((r) => [r.raidUrl, r]));
}

function findRosterPlayer(rosterEntry, name) {
  return rosterEntry?.players.find((p) => p.name === name) || null;
}

function getPlayerSpecIcon(rosterEntry, name) {
  return findRosterPlayer(rosterEntry, name)?.icon || null;
}

// fallbackColorMap (напр. classColorMap з data/guild-data.json) - опційний,
// на випадок якщо гравця нема в ростері конкретно цього логу (легіонер/
// разовий учасник поза гільдійським знімком).
function getPlayerClassColor(rosterEntry, name, fallbackColorMap) {
  const playerClass = findRosterPlayer(rosterEntry, name)?.class;
  return (playerClass && WOW_CLASS_COLORS[playerClass]) || fallbackColorMap?.get(name) || '';
}

function specIconUrl(icon) {
  return `https://wow.zamimg.com/images/wow/icons/small/${icon}.jpg`;
}
