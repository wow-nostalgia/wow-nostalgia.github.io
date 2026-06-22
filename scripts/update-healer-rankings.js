'use strict';

const fs = require('node:fs/promises');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'healer-rankings.json');

const SERVER = 'FreedomUA';
const BOSS = 'Valithria Dreamwalker';
const MODE = '25H';

const HEALER_SPECS = [
  { class: 'Paladin', spec: 'Holy', classI: 4, specI: 1 },
  { class: 'Priest', spec: 'Discipline', classI: 5, specI: 1 },
  { class: 'Priest', spec: 'Holy', classI: 5, specI: 2 },
  { class: 'Druid', spec: 'Restoration', classI: 1, specI: 3 },
  { class: 'Shaman', spec: 'Restoration', classI: 7, specI: 3 }
];

async function fetchSpecTop({ classI, specI }) {
  const response = await fetch('https://uwu-logs.xyz/top', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      server: SERVER,
      boss: BOSS,
      mode: MODE,
      best_only: true,
      class_i: String(classI),
      spec_i: String(specI),
      sort_by: 'head-useful-dps',
      limit: 1000,
      externals: true
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function main() {
  const specs = [];

  for (const entry of HEALER_SPECS) {
    console.log(`Завантаження ${entry.class} — ${entry.spec}...`);
    const rows = await fetchSpecTop(entry);

    const best = new Map();
    for (const [, duration, , name, uAmount] of rows) {
      if (!duration) continue;

      const hps = Number((uAmount / duration).toFixed(1));
      const current = best.get(name);
      if (current === undefined || hps > current) best.set(name, hps);
    }

    const players = [...best.entries()]
      .map(([name, hps]) => ({ name, hps }))
      .sort((a, b) => b.hps - a.hps);

    specs.push({ class: entry.class, spec: entry.spec, players });

    console.log(`OK: ${players.length} гравців`);
  }

  await fs.writeFile(OUTPUT_FILE, JSON.stringify({
    boss: BOSS,
    mode: MODE,
    updatedAt: new Date().toISOString(),
    specs
  }, null, 2) + '\n', 'utf8');

  console.log('healer-rankings.json оновлено');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
