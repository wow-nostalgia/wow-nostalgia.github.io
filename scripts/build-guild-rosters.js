'use strict';

// Мердж ручного Lua-ростеру Nostalgia (data/nostalgia_players.json) із
// self-declared "Гільдія" в профілі (D1, через Worker) - див. план
// "Self-declared гільдія персонажа в профілі". Чиста регенерація вихідних
// файлів, за стилем update-guild-data.js/build-honor-board.js: сирі джерела
// не переписуються заднім числом, лише похідні файли.

const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NOSTALGIA_PLAYERS_FILE = path.join(DATA_DIR, 'nostalgia_players.json');
const PLAYERS_META_FILE = path.join(DATA_DIR, 'players-meta.json');
const CHARACTER_GUILDS_FILE = path.join(DATA_DIR, 'character-guilds.json');

const AUTH_API_BASE = 'https://raid-manager-api.wow-nostalgia.workers.dev/api/v1';
const NOSTALGIA = 'Nostalgia';

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function slugifyGuildName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}

async function fetchGuildInfo() {
  const response = await fetch(`${AUTH_API_BASE}/characters/guild-info`);
  if (!response.ok) throw new Error(`HTTP ${response.status} на /characters/guild-info`);
  return response.json();
}

// Файли попередніх прогонів для гільдій, які цього разу лишились без жодного
// учасника (останній self-declare звідти пішов) - обнуляємо, а не лишаємо
// застарілими назавжди.
async function findExistingGuildFileSlugs() {
  const entries = await fs.readdir(DATA_DIR).catch(() => []);
  return new Set(
    entries
      .filter((f) => f.endsWith('_players.json') && f !== 'nostalgia_players.json')
      .map((f) => f.slice(0, -'_players.json'.length))
  );
}

async function buildGuildRosters() {
  const [nostalgiaPlayers, playersMeta, guildInfo, existingGuildSlugs] = await Promise.all([
    readJson(NOSTALGIA_PLAYERS_FILE, []),
    readJson(PLAYERS_META_FILE, { generatedAt: '' }),
    fetchGuildInfo(),
    findExistingGuildFileSlugs()
  ]);

  const generatedAt = playersMeta.generatedAt || '';
  const nostalgiaMap = new Map(nostalgiaPlayers.map((p) => [p.name, p]));

  // Правило пріоритету, застосоване уніфіковано на кожного персонажа: якщо
  // персонаж є в поточному Lua-ростері Nostalgia - self-declare враховується,
  // лише якщо він свіжіший за останній Lua-експорт (players-meta.generatedAt).
  // Якщо персонажа в Lua-ростері нема - self-declare завжди чинний.
  const finalNostalgiaNames = new Set(nostalgiaMap.keys());
  const otherGuildByName = new Map(); // name -> guild (не Nostalgia, не "Без гільдії")

  for (const [name, info] of Object.entries(guildInfo)) {
    const inLuaRoster = nostalgiaMap.has(name);
    const selfDeclareWins = !inLuaRoster || (info.updatedAt || '') > generatedAt;
    if (!selfDeclareWins) continue;

    if (inLuaRoster) finalNostalgiaNames.delete(name);

    if (info.guild === NOSTALGIA) {
      finalNostalgiaNames.add(name);
    } else if (info.guild) {
      otherGuildByName.set(name, info.guild);
    }
    // info.guild === "" ("Без гільдії") - персонаж просто лишається поза
    // усіма файлами, нічого додатково писати не треба.
  }

  const finalNostalgiaRows = [...finalNostalgiaNames]
    .map((name) => nostalgiaMap.get(name) || { name, server: 'FreedomUA' })
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  await writeJson(NOSTALGIA_PLAYERS_FILE, finalNostalgiaRows);

  const rowsByGuild = new Map();
  for (const [name, guild] of otherGuildByName) {
    if (!rowsByGuild.has(guild)) rowsByGuild.set(guild, []);
    rowsByGuild.get(guild).push({ name, server: 'FreedomUA' });
  }

  const writtenSlugs = new Set();
  for (const [guild, rows] of rowsByGuild) {
    const slug = slugifyGuildName(guild);
    if (!slug) {
      console.warn(`Пропущено гільдію без валідного slug: "${guild}"`);
      continue;
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    await writeJson(path.join(DATA_DIR, `${slug}_players.json`), rows);
    writtenSlugs.add(slug);
  }

  for (const slug of existingGuildSlugs) {
    if (!writtenSlugs.has(slug)) await writeJson(path.join(DATA_DIR, `${slug}_players.json`), []);
  }

  const characterGuilds = Object.fromEntries([...otherGuildByName.entries()].sort(([a], [b]) => a.localeCompare(b, 'uk')));
  await writeJson(CHARACTER_GUILDS_FILE, characterGuilds);

  console.log(`nostalgia_players.json: ${finalNostalgiaRows.length} персонажів`);
  console.log(`Інших гільдій: ${writtenSlugs.size}`);
}

buildGuildRosters().catch((error) => {
  console.error(error);
  process.exit(1);
});
