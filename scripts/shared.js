'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const RAID_LOG_MERGES_FILE = path.join(__dirname, '..', 'data', 'raid-log-merges.json');

const MIN_RAIDS_FOR_GUILD_MEMBER = 2;
const MIN_RAIDS_FOR_LEGIONNAIRE = 5;

function countBossesByRaid(personalStats) {
  const counts = new Map();

  for (const record of personalStats || []) {
    if (record.error || !record.boss) continue;
    counts.set(record.raidUrl, (counts.get(record.raidUrl) || 0) + 1);
  }

  return counts;
}

async function readRaidLogMerges() {
  try {
    const raw = await fs.readFile(RAID_LOG_MERGES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = {};
    for (const [secondary, value] of Object.entries(parsed)) {
      // Legacy entries were a plain "secondary -> primary" string, predating the
      // split/duplicate distinction; treat those as the original "split" case.
      normalized[secondary] = typeof value === 'string' ? { primary: value, type: 'split' } : value;
    }
    return normalized;
  } catch {
    return {};
  }
}

async function writeRaidLogMerges(merges) {
  const sorted = Object.fromEntries(Object.entries(merges).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(RAID_LOG_MERGES_FILE, JSON.stringify(sorted, null, 2), 'utf8');
}

const CLASSES = [
  'Death Knight',
  'Druid',
  'Hunter',
  'Mage',
  'Paladin',
  'Priest',
  'Rogue',
  'Shaman',
  'Warlock',
  'Warrior'
];

const SPECS_SELECT_OPTIONS = {
  'Death Knight': ['Blood', 'Frost', 'Unholy'],
  'Druid': ['Balance', 'Feral Combat', 'Restoration'],
  'Hunter': ['Beast Mastery', 'Marksmanship', 'Survival'],
  'Mage': ['Arcane', 'Fire', 'Frost'],
  'Paladin': ['Holy', 'Protection', 'Retribution'],
  'Priest': ['Discipline', 'Holy', 'Shadow'],
  'Rogue': ['Assassination', 'Combat', 'Subtlety'],
  'Shaman': ['Elemental', 'Enhancement', 'Restoration'],
  'Warlock': ['Affliction', 'Demonology', 'Destruction'],
  'Warrior': ['Arms', 'Fury', 'Protection']
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SLUG_TO_CLASS = new Map(CLASSES.map((cls) => [cls.toLowerCase().replace(/\s+/g, '-'), cls]));

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

// Спільний парсер таблиці "table.add-player-rank" - той самий формат рядків
// (title="Spec Class" + img-іконка спеку + a.class-slug) і на per-боса
// сторінках рангу (update-personal-stats.js), і на кореневій сторінці
// рейду, де ця ж таблиця показує зведення по всьому рейду одразу
// (update-raid-rosters.js).
function parsePlayerTable($) {
  const players = [];

  $('table.add-player-rank tbody tr').each((_, row) => {
    const cell = $(row).find('td.player-cell');
    const title = cell.attr('title');
    if (!title || title === 'Total') return;

    const anchor = cell.find('a');
    const name = normalizeText(anchor.text());
    if (!name) return;

    const slug = (anchor.attr('class') || '').trim();
    if (!slug) return; // vehicle/transform row (e.g. Putricide's "Mutated Abomination"), not a real player

    const playerClass = SLUG_TO_CLASS.get(slug) || CLASSES.find((cls) => title.endsWith(` ${cls}`)) || 'Unknown';
    const spec = title.endsWith(` ${playerClass}`)
      ? title.slice(0, title.length - playerClass.length).trim()
      : 'Unknown';

    const iconSrc = cell.find('img').attr('src') || '';
    const icon = iconSrc.split('/').pop().split('.')[0] || null;

    const dps = parseFloat(String($(row).find('td.useful.per-sec-cell').first().text()).replace(/[^\d.]/g, '')) || 0;

    players.push({ name, class: playerClass, spec, icon, dps });
  });

  return players;
}

function getClassName(classIndex) {
  return CLASSES[classIndex] ?? 'Unknown';
}

function getSpecName(className, specIndex) {
  const specs = SPECS_SELECT_OPTIONS[className] ?? [];
  return specs[specIndex - 1] ?? `Spec ${specIndex}`;
}

function normalizeScore(points) {
  if (typeof points !== 'number') return 0;
  return Number((points / 100).toFixed(2));
}

function normalizeBosses(rawBosses) {
  const result = {};
  for (const bossName of BOSS_ORDER) {
    const bossData = rawBosses?.[bossName] ?? {};
    result[bossName] = typeof bossData.dps_max === 'number'
      ? Number(bossData.dps_max.toFixed(1))
      : 0;
  }
  return result;
}

function hasAnyBossData(bosses) {
  return Object.values(bosses || {}).some((value) => Number(value) > 0);
}

function extractRaidIdentity(raidUrl) {
  const match = String(raidUrl || '').match(/reports\/(\d{2})-(\d{2})-(\d{2})--(\d{2})-(\d{2})--(.+)--FreedomUA/);
  if (!match) return null;
  const [, yy, mm, dd, , , leader] = match;
  return { date: `20${yy}-${mm}-${dd}`, leader };
}

// uwu-logs sometimes splits one raid night into two reports - e.g. a Frozen
// Throne teleport, or the logging addon restarting after a relog/disconnect
// partway through. Detect that pattern from already-scraped boss kills: a
// same-day, same-leader pair of reports whose boss kills don't overlap at all
// is folded into a single raid (the report with more bosses becomes primary).
function findRaidLogMerges(personalStats) {
  const bossesByRaid = new Map();

  for (const record of personalStats || []) {
    if (record.error || !record.boss) continue;
    if (!bossesByRaid.has(record.raidUrl)) bossesByRaid.set(record.raidUrl, new Set());
    bossesByRaid.get(record.raidUrl).add(record.boss);
  }

  const groups = new Map();
  for (const raidUrl of bossesByRaid.keys()) {
    const identity = extractRaidIdentity(raidUrl);
    if (!identity) continue;
    const key = `${identity.date}|${identity.leader}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(raidUrl);
  }

  const merges = new Map();

  for (const raidUrls of groups.values()) {
    if (raidUrls.length !== 2) continue;

    const [urlA, urlB] = raidUrls;
    const bossesA = bossesByRaid.get(urlA);
    const bossesB = bossesByRaid.get(urlB);

    const overlaps = [...bossesA].some((boss) => bossesB.has(boss));
    if (overlaps) continue;

    const [primary, secondary] = bossesA.size >= bossesB.size ? [urlA, urlB] : [urlB, urlA];
    merges.set(secondary, primary);
  }

  return merges;
}

const DUPLICATE_DPS_TOLERANCE = 0.05;

// Some raid nights get logged by two different players running their own combat-log
// addon; uwu-logs treats each upload as a separate report even though it's the same
// raid. Detected by: same calendar date + an identical boss-kill set + near-identical
// per-player DPS on every shared boss (two real duplicate pairs differed by <1.5%;
// distinct raids would differ far more, so 5% stays a safe margin against false
// positives while catching logger-to-logger rounding noise).
function findDuplicateRaidLogs(personalStats) {
  const bossDpsByRaid = new Map();

  for (const record of personalStats || []) {
    if (record.error || !record.boss) continue;
    if (!bossDpsByRaid.has(record.raidUrl)) bossDpsByRaid.set(record.raidUrl, new Map());
    const playerDps = new Map((record.players || []).map((p) => [p.name, Number(p.dps) || 0]));
    bossDpsByRaid.get(record.raidUrl).set(record.boss, playerDps);
  }

  const groups = new Map();
  for (const raidUrl of bossDpsByRaid.keys()) {
    const identity = extractRaidIdentity(raidUrl);
    if (!identity) continue;
    if (!groups.has(identity.date)) groups.set(identity.date, []);
    groups.get(identity.date).push(raidUrl);
  }

  function areDuplicates(urlA, urlB) {
    const bossesA = bossDpsByRaid.get(urlA);
    const bossesB = bossDpsByRaid.get(urlB);

    const bossNamesA = [...bossesA.keys()].sort();
    const bossNamesB = [...bossesB.keys()].sort();
    if (bossNamesA.length === 0 || bossNamesA.join('|') !== bossNamesB.join('|')) return false;

    for (const boss of bossNamesA) {
      const playersA = bossesA.get(boss);
      const playersB = bossesB.get(boss);

      const namesA = [...playersA.keys()].sort();
      const namesB = [...playersB.keys()].sort();
      if (namesA.join('|') !== namesB.join('|')) return false;

      for (const name of namesA) {
        const dpsA = playersA.get(name);
        const dpsB = playersB.get(name);
        const denom = Math.max(Math.abs(dpsA), Math.abs(dpsB), 1);
        if (Math.abs(dpsA - dpsB) / denom > DUPLICATE_DPS_TOLERANCE) return false;
      }
    }

    return true;
  }

  const duplicates = new Map();

  for (const raidUrls of groups.values()) {
    if (raidUrls.length < 2) continue;

    for (let i = 0; i < raidUrls.length; i += 1) {
      for (let j = i + 1; j < raidUrls.length; j += 1) {
        const a = raidUrls[i];
        const b = raidUrls[j];
        if (duplicates.has(a) || duplicates.has(b)) continue;

        if (areDuplicates(a, b)) {
          const [primary, secondary] = [a, b].sort();
          duplicates.set(secondary, primary);
        }
      }
    }
  }

  return duplicates;
}

module.exports = {
  CLASSES,
  SPECS_SELECT_OPTIONS,
  BOSS_ORDER,
  sleep,
  getClassName,
  getSpecName,
  parsePlayerTable,
  normalizeScore,
  normalizeBosses,
  hasAnyBossData,
  findRaidLogMerges,
  findDuplicateRaidLogs,
  readRaidLogMerges,
  writeRaidLogMerges,
  countBossesByRaid,
  MIN_RAIDS_FOR_GUILD_MEMBER,
  MIN_RAIDS_FOR_LEGIONNAIRE
};
