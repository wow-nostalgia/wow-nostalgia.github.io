'use strict';

// Одноразовий збір іконок/рідкості предметів із Wowhead для всіх item id,
// що зустрічаються в data/raid-items.json. Результат — data/item-icons.json,
// статичний файл, що фетчиться браузером напряму (як і raid-items.json).
//
// Запуск: node scripts/fetch-item-icons.js
// Перезапускати лише якщо змінився каталог предметів (новий extract-raid-items.js).

const fs = require('node:fs');
const path = require('node:path');

const RAID_ITEMS_PATH = path.join(__dirname, '..', 'data', 'raid-items.json');
const OUT_PATH = path.join(__dirname, '..', 'data', 'item-icons.json');
const REQUEST_DELAY_MS = 120;

function collectItemIds() {
  const raidItems = JSON.parse(fs.readFileSync(RAID_ITEMS_PATH, 'utf8'));
  const ids = new Set();
  for (const modes of Object.values(raidItems)) {
    for (const items of Object.values(modes)) {
      for (const item of items) ids.add(item.id);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchIcon(itemId) {
  const url = `https://nether.wowhead.com/tooltip/item/${itemId}?dataEnv=8&locale=enUS`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.icon) throw new Error('у відповіді немає поля icon');
  return { icon: data.icon, quality: data.quality };
}

async function main() {
  const ids = collectItemIds();
  console.log(`Унікальних item id: ${ids.length}`);

  const result = {};
  let failed = 0;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      result[id] = await fetchIcon(id);
    } catch (err) {
      failed++;
      console.warn(`  [!] item ${id}: ${err.message}`);
    }

    if ((i + 1) % 50 === 0 || i === ids.length - 1) {
      console.log(`  ...${i + 1}/${ids.length}`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`Записано: ${OUT_PATH} (успішно: ${ids.length - failed}, помилок: ${failed})`);
}

main();
