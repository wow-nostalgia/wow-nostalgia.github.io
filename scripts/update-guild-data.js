'use strict';

const fs = require('node:fs/promises');
const path = require('path');
const { BOSS_ORDER, sleep, getClassName, getSpecName, normalizeScore, normalizeBosses, hasAnyBossData } = require('./shared');

const PLAYERS_FILE = path.join(__dirname, '..', 'data', 'players.json');
const POTION_STATS_FILE = path.join(__dirname, '..', 'data', 'potion-stats.json');
const DATA_FILE = path.join(__dirname, '..', 'data', 'guild-data.json');

const REQUEST_DELAY_MS = 1500;
const MAX_RETRIES = 3;
const MIN_RAIDS_FOR_LEGIONNAIRE = 3;

function isUnknownName(name) {
  return typeof name === 'string' && name.startsWith('Unknown-');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// "Легіонери" — гравці поза гільдією, яких знаходимо автоматично: хто
// з'являвся в логах рейдів (potion-stats.json) щонайменше
// MIN_RAIDS_FOR_LEGIONNAIRE разів і кого немає в players.json.
async function detectLegionnaires(guildNames) {
  const potionStats = await readJson(POTION_STATS_FILE).catch(() => []);
  const raidCounts = new Map();

  for (const raid of potionStats) {
    if (raid.error) continue;

    for (const player of raid.players || []) {
      const name = String(player.name || '').trim();
      if (!name || guildNames.has(name)) continue;
      raidCounts.set(name, (raidCounts.get(name) || 0) + 1);
    }
  }

  return [...raidCounts.entries()]
    .filter(([, count]) => count >= MIN_RAIDS_FOR_LEGIONNAIRE)
    .map(([name]) => ({ name, server: 'FreedomUA' }));
}

async function readPlayers() {
  const players = await readJson(PLAYERS_FILE);
  if (!Array.isArray(players)) {
    throw new Error('players.json не містить масив гравців');
  }
  const guildNames = new Set(players.map((p) => p.name));
  const legionnaires = await detectLegionnaires(guildNames);
  return [...players, ...legionnaires];
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

async function fetchCharacterWithRetry(row) {
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
      const specName = getSpecName(className, specIndex);

      return {
        name: source.name ?? row.name,
        server: source.server ?? row.server,
        class: className,
        spec: specName,
        specIndex,
        overallRank: source.overall_rank ?? null,
        overallScore: normalizeScore(source.overall_points),
        bosses: normalizeBosses(source.bosses)
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
  const existingRows = Array.isArray(guildData.rows) ? guildData.rows : [];

  const existingMap = new Map();
  for (const row of existingRows) {
    const key = `${row.name}::${row.server}::${row.specIndex}`;
    existingMap.set(key, row);
  }

  const initialRows = [];
  for (const player of players) {
    for (let specIndex = 1; specIndex <= 3; specIndex++) {
      const existingKey = `${player.name}::${player.server}::${specIndex}`;
      const existingRow = existingMap.get(existingKey) || null;

      const playerClass = existingRow?.class ?? player.class ?? 'Unknown';
      const specName = getSpecName(playerClass, specIndex);

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
      console.log(`Updating ${row.name} / ${row.spec} (specIndex: ${row.specIndex})`);

      const fresh = await fetchCharacterWithRetry(row);

      if (fresh.class === 'Unknown') {
        console.log(`Skipping ${row.name} / ${row.spec}: unknown class`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      if (isUnknownName(fresh.name)) {
        console.log(`Skipping ${row.name} / ${row.spec}: unknown name ${fresh.name}`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      if (!hasAnyBossData(fresh.bosses)) {
        console.log(`Skipping ${row.name} / ${row.spec}: no boss data`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

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
      console.error(`Failed ${row.name} / ${row.spec} (specIndex: ${row.specIndex}): ${error.message}`);
      failedPlayers.push({
        name: row.name,
        server: row.server,
        spec: row.spec,
        specIndex: row.specIndex,
        error: error.message
      });
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const uniqueRows = [];
  const seen = new Set();
  for (const row of updatedRows) {
    const key = `${row.name}::${row.server}::${row.specIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  guildData.bossOrder = BOSS_ORDER;
  guildData.rows = uniqueRows;
  guildData.lastUpdated = new Date().toISOString();
  guildData.updateSummary = {
    totalRows: uniqueRows.length,
    failedPlayers: failedPlayers.length
  };

  await writeJson(DATA_FILE, guildData);

  console.log('guild-data.json updated successfully');
  console.log(`Total rows (filtered): ${uniqueRows.length}`);
  console.log(`Failed rows: ${failedPlayers.length}`);
}

updateGuildData().catch((error) => {
  console.error(error);
  process.exit(1);
});
