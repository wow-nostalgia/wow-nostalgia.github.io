'use strict';

const fs = require('node:fs/promises');
const { SPECS_SELECT_OPTIONS, BOSS_ORDER, sleep, getClassName, getSpecName, normalizeScore, normalizeBosses } = require('./scripts/shared');

function hasAnyUsefulData(row) {
  if (row.overallScore > 0) return true;
  return Object.values(row.bosses).some((value) => value > 0);
}

async function fetchCharacterSpec(player, specIndex, attempt = 1, maxAttempts = 4) {
  const response = await fetch('https://uwu-logs.xyz/character', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      name: player.name,
      server: player.server,
      spec: specIndex
    })
  });

  if (response.status === 429 && attempt < maxAttempts) {
    const retryAfter = response.headers.get('retry-after');
    const waitMs = retryAfter
      ? Number(retryAfter) * 1000
      : 1000 * attempt * 2;

    console.log(`RATE LIMITED: ${player.name} | spec ${specIndex} | wait ${waitMs}ms | attempt ${attempt}/${maxAttempts}`);
    await sleep(waitMs);
    return fetchCharacterSpec(player, specIndex, attempt + 1, maxAttempts);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${player.name} spec ${specIndex}`);
  }

  const source = await response.json();
  const className = getClassName(source.class_i);
  const specName = getSpecName(className, specIndex);

  return {
    name: source.name ?? player.name,
    server: source.server ?? player.server,
    class: className,
    spec: specName,
    specIndex,
    overallRank: source.overall_rank ?? null,
    overallScore: normalizeScore(source.overall_points),
    bosses: normalizeBosses(source.bosses)
  };
}

async function main() {
  const rawPlayers = await fs.readFile('./data/players.json', 'utf8');
  const players = JSON.parse(rawPlayers);
  const rows = [];

  for (const player of players) {
    for (const specIndex of [1, 2, 3]) {
      try {
        const row = await fetchCharacterSpec(player, specIndex);

        if (hasAnyUsefulData(row)) {
          rows.push(row);
          console.log(`OK: ${row.name} | ${row.class} | ${row.spec} | rank ${row.overallRank} | score ${row.overallScore}`);
        } else {
          console.log(`SKIP EMPTY: ${player.name} | spec ${specIndex}`);
        }
      } catch (error) {
        console.error(`ERROR: ${player.name} | spec ${specIndex} | ${error.message}`);
      }

      await sleep(1200);
    }

    await sleep(1500);
  }

  rows.sort((a, b) => {
    const aRank = Number.isFinite(a.overallRank) ? a.overallRank : Number.MAX_SAFE_INTEGER;
    const bRank = Number.isFinite(b.overallRank) ? b.overallRank : Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });

  const output = {
    updatedAt: new Date().toISOString(),
    totalPlayersInSource: players.length,
    totalRows: rows.length,
    bossOrder: BOSS_ORDER,
    classes: [...Object.keys(SPECS_SELECT_OPTIONS)].sort((a, b) => a.localeCompare(b)),
    specsByClass: Object.fromEntries(
      Object.entries(SPECS_SELECT_OPTIONS).map(([className, specs]) => [
        className,
        [...specs].sort((a, b) => a.localeCompare(b))
      ])
    ),
    rows
  };

  await fs.writeFile('./data/guild-data.json', JSON.stringify(output, null, 2), 'utf8');

  console.log('saved: data/guild-data.json');
  console.log(`rows: ${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
