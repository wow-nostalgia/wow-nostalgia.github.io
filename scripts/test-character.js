const fs = require('node:fs/promises');

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

function getClassName(classIndex) {
  return CLASSES[classIndex] ?? 'Unknown';
}

function getSpecName(className, specIndex) {
  const specs = SPECS_SELECT_OPTIONS[className] ?? [];
  return specs[specIndex - 1] ?? `Spec ${specIndex}`;
}

async function main() {
  const rawPlayers = await fs.readFile('./data/players.json', 'utf8');
  const players = JSON.parse(rawPlayers);

  const targetPlayer = players[0];
  const targetSpec = 2;

  const response = await fetch('https://uwu-logs.xyz/character', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      name: targetPlayer.name,
      server: targetPlayer.server,
      spec: targetSpec
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const source = await response.json();

  const className = getClassName(source.class_i);
  const specName = getSpecName(className, targetSpec);

  const normalized = {
    name: source.name ?? targetPlayer.name,
    server: source.server ?? targetPlayer.server,
    class: className,
    spec: specName,
    specIndex: targetSpec,
    overallRank: source.overall_rank ?? null,
    overallScore: normalizeScore(source.overall_points),
    bosses: normalizeBosses(source.bosses)
  };

  await fs.writeFile(
    './data/test-character-output.json',
    JSON.stringify(normalized, null, 2),
    'utf8'
  );

  console.log('saved: data/test-character-output.json');
  console.log(normalized);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});