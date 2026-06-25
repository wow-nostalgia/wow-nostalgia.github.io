'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { countBossesByRaid, MIN_RAIDS_FOR_GUILD_MEMBER, MIN_RAIDS_FOR_LEGIONNAIRE } = require('./shared');

const POTION_STATS_FILE = path.join(__dirname, '..', 'data', 'potion-stats.json');
const PERSONAL_STATS_FILE = path.join(__dirname, '..', 'data', 'personal-stats.json');
const PLAYERS_FILE = path.join(__dirname, '..', 'data', 'players.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'honor-board.json');

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function buildHonorBoard(raids, raidBossCounts, guildMemberNames) {
  const playersMap = new Map();

  raids.forEach((raid) => {
    const bossCount = raidBossCounts.get(raid.raidUrl);
    if (!bossCount) return; // no personal-stats data for this raid, can't weight it
    if (!Array.isArray(raid.players)) return;

    raid.players.forEach((player) => {
      const name = String(player.name || '').trim();
      if (!name) return;
      if (!playersMap.has(name)) playersMap.set(name, { name, totalPotions: 0, totalBosses: 0, raidsCount: 0 });
      const current = playersMap.get(name);
      current.totalPotions += Number(player.total || 0);
      current.totalBosses += bossCount;
      current.raidsCount += 1;
    });
  });

  return [...playersMap.values()]
    .filter((player) => {
      const threshold = guildMemberNames.has(player.name) ? MIN_RAIDS_FOR_GUILD_MEMBER : MIN_RAIDS_FOR_LEGIONNAIRE;
      return player.raidsCount >= threshold;
    })
    .map((player) => ({
      name: player.name,
      raidsCount: player.raidsCount,
      averagePotionsPerBoss: player.totalBosses > 0 ? player.totalPotions / player.totalBosses : 0
    }));
}

async function main() {
  const [potions, personalStats, players] = await Promise.all([
    readJson(POTION_STATS_FILE),
    readJson(PERSONAL_STATS_FILE),
    readJson(PLAYERS_FILE)
  ]);

  const guildMemberNames = new Set(players.map((p) => p.name));
  const raidBossCounts = countBossesByRaid(personalStats);
  const validRaids = potions.filter((raid) => Array.isArray(raid.players) && raid.players.length > 0 && raid.raidUrl);

  const honorBoard = buildHonorBoard(validRaids, raidBossCounts, guildMemberNames);

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(honorBoard, null, 2), 'utf8');
  console.log(`honor-board.json updated: ${honorBoard.length} players`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
