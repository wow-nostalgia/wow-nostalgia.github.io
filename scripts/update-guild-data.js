const fs = require('node:fs/promises');
const path = require('path');


const PLAYERS_FILE = path.join(__dirname, '..', 'data', 'players.json');
const DATA_FILE = path.join(__dirname, '..', 'data', 'guild-data.json');


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


const REQUEST_DELAY_MS = 1500;
const MAX_RETRIES = 3;


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function normalizeScore(points) {
  if (typeof points !== 'number') return 0;
  return Number((points / 100).toFixed(2));
}


function getClassName(classIndex) {
  return CLASSES[classIndex] ?? 'Unknown';
}


function getSpecName(className, specIndex) {
  const specs = SPECS_SELECT_OPTIONS[className] ?? [];
  return specs[specIndex - 1] ?? `Spec ${specIndex}`;
}


function getSpecIndexByName(className, specName) {
  const specs = SPECS_SELECT_OPTIONS[className] ?? [];
  const index = specs.findIndex(spec => spec === specName);
  return index >= 0 ? index + 1 : null;
}


function normalizeBosses(rawBosses, bossOrder) {
  const result = {};

  for (const bossName of bossOrder) {
    const bossData = rawBosses?.[bossName] ?? {};
    result[bossName] =
      typeof bossData.dps_max === 'number'
        ? Number(bossData.dps_max.toFixed(1))
        : 0;
  }

  return result;
}


async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}


async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}


async function readPlayers() {
  const players = await readJson(PLAYERS_FILE);
  if (!Array.isArray(players)) {
    throw new Error('players.json не містить масив гравців');
  }
  return players;
}


async function readGuildData() {
  try {
    return await readJson(DATA_FILE);
  } catch {
    return {};
  }
}


async function fetchCharacterOnce(row) {
  const response = await fetch('https://uwu-logs.xyz/character', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      name: row.name,
      server: row.server,
      spec: row.specIndex
    })
  });

  return { response, specIndex: row.specIndex };
}


async function fetchCharacterWithRetry(row, bossOrder) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { response, specIndex } = await fetchCharacterOnce(row);

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const waitMs = retryAfter ? Number(retryAfter) * 1000 : REQUEST_DELAY_MS * attempt;
          console.log(`Rate limited for ${row.name}. Waiting ${waitMs}ms and retrying...`);
          await sleep(waitMs);
          lastError = new Error('HTTP 429');
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const source = await response.json();
      const className = getClassName(source.class_i);
      const finalSpecIndex = specIndex;
      const specName = getSpecName(className, finalSpecIndex);

      return {
        name: source.name ?? row.name,
        server: source.server ?? row.server,
        class: className,
        spec: specName,
        specIndex: finalSpecIndex,
        overallRank: source.overall_rank ?? null,
        overallScore: normalizeScore(source.overall_points),
        bosses: normalizeBosses(source.bosses, bossOrder)
      };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const waitMs = REQUEST_DELAY_MS * attempt;
        console.log(`Retry ${attempt}/${MAX_RETRIES} for ${row.name} in ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${row.name}`);
}


async function updateGuildData() {
  const players = await readPlayers();
  const guildData = await readGuildData();
  const bossOrder = guildData.bossOrder || [];
  const existingRows = Array.isArray(guildData.rows) ? guildData.rows : [];

  // Генеруємо 3 spec-рядки на кожного гравця
  const initialRows = [];
  const existingMap = new Map();
  for (const row of existingRows) {
    const key = `${row.name}::${row.server}::${row.specIndex}`;
    existingMap.set(key, row);
  }

  for (const player of players) {
    for (let specIndex = 1; specIndex <= 3; specIndex++) {
      const existingKey = `${player.name}::${player.server}::${specIndex}`;
      const existingRow = existingMap.get(existingKey) || null;

      const playerClass = existingRow?.class ?? player.class ?? 'Unknown';
      const specName = getSpecName(playerClass, specIndex) ?? `Spec ${specIndex}`;

      initialRows.push({
        name: player.name,
        server: player.server,
        class: playerClass,
        spec: specName,
        specIndex,
        overallRank: existingRow?.overallRank ?? null,
        overallScore: existingRow?.overallScore ?? 0,
        bosses: existingRow?.bosses ?? {}
      });
    }
  }

  const updatedRows = [];
  const failedPlayers = [];

  for (const row of initialRows) {
    try {
      console.log(`Updating ${row.name} / ${row.class} / ${row.spec} (specIndex: ${row.specIndex})`);
      const fresh = await fetchCharacterWithRetry(row, bossOrder);
      updatedRows.push({
        name: fresh.name,
        server: fresh.server,
        class: fresh.class,
        spec: fresh.spec,
        specIndex: fresh.specIndex,
        overallRank: fresh.overallRank,
        overallScore: fresh.overallScore,
        bosses: fresh.bosses
      });
      await sleep(REQUEST_DELAY_MS);
    } catch (error) {
      console.error(`Failed ${row.name} / ${row.class} / ${row.spec}: ${error.message}`);
      failedPlayers.push({
        name: row.name,
        class: row.class,
        spec: row.spec,
        specIndex: row.specIndex,
        error: error.message
      });
      updatedRows.push(row);
      await sleep(REQUEST_DELAY_MS);
    }
  }

  guildData.rows = updatedRows;
  guildData.lastUpdated = new Date().toISOString();
  guildData.updateSummary = {
    totalPlayers: updatedRows.length,
    failedPlayers: failedPlayers.length
  };

  await writeJson(DATA_FILE, guildData);

  console.log('guild-data.json updated successfully');
  console.log(`Total rows (players × specs): ${updatedRows.length}`);
  console.log(`Failed rows: ${failedPlayers.length}`);
}


updateGuildData().catch((error) => {
  console.error(error);
  process.exit(1);
});