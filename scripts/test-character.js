'use strict';

const fs = require('node:fs/promises');
const { getClassName, getSpecName, normalizeScore, normalizeBosses } = require('./shared');

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
