'use strict';

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

module.exports = {
  CLASSES,
  SPECS_SELECT_OPTIONS,
  BOSS_ORDER,
  sleep,
  getClassName,
  getSpecName,
  normalizeScore,
  normalizeBosses,
  hasAnyBossData
};
