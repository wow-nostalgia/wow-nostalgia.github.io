'use strict';

// Одноразовий конвертер статичної Lua-таблиці бос->предмети з аддону SoftRollLK
// у data/raid-items.json. Не загальний Lua-парсер — таргетований сканер під
// відому фіксовану структуру файлу ICCItems.lua (приклад шляху на цій машині:
// "C:\Work\WoW Addons\SoftRollLK\ICCItems.lua").
//
// Запуск: node scripts/extract-raid-items.js <шлях-до-ICCItems.lua>

const fs = require('node:fs');
const path = require('node:path');

const MODE_KEY_MAP = {
  '10-Player Normal': '10N',
  '10-Player Heroic': '10H',
  '25-Player Normal': '25N',
  '25-Player Heroic': '25H'
};

const ITEM_RE = /\{\s*slot\s*=\s*"([^"]*)"\s*,\s*id\s*=\s*(\d+)\s*,\s*name\s*=\s*"([^"]*)"\s*,\s*type\s*=\s*"([^"]*)"\s*\}/g;

function findMatchingBrace(text, openBraceIndex) {
  let depth = 0;
  let inString = false;

  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (ch === '"' && text[i - 1] !== '\\') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }

  throw new Error(`Не знайдено відповідну закриваючу дужку від позиції ${openBraceIndex}`);
}

function parseBossBlock(blockText, bossName) {
  const modes = {};

  for (const [luaKey, shortKey] of Object.entries(MODE_KEY_MAP)) {
    const keyPattern = `["${luaKey}"]`;
    const keyIndex = blockText.indexOf(keyPattern);

    if (keyIndex === -1) {
      console.warn(`  [!] ${bossName}: режим "${luaKey}" не знайдено, пропускаю`);
      modes[shortKey] = [];
      continue;
    }

    const openBraceIndex = blockText.indexOf('{', keyIndex + keyPattern.length);
    const closeBraceIndex = findMatchingBrace(blockText, openBraceIndex);
    const arrayText = blockText.slice(openBraceIndex + 1, closeBraceIndex);

    const items = [];
    let match;
    ITEM_RE.lastIndex = 0;
    while ((match = ITEM_RE.exec(arrayText)) !== null) {
      const [, slot, id, name, type] = match;
      items.push({ id: Number(id), name, slot, type });
    }

    modes[shortKey] = items;
  }

  return modes;
}

function main() {
  const sourcePath = process.argv[2];

  if (!sourcePath) {
    console.error('Використання: node scripts/extract-raid-items.js <шлях-до-ICCItems.lua>');
    process.exit(1);
  }

  const text = fs.readFileSync(sourcePath, 'utf8');
  const result = {};

  const bossRe = /boss\s*=\s*"([^"]+)"/g;
  const bossMatches = [...text.matchAll(bossRe)];

  if (!bossMatches.length) {
    console.error('Жодного боса не знайдено — перевірте формат файлу.');
    process.exit(1);
  }

  for (let i = 0; i < bossMatches.length; i++) {
    const bossName = bossMatches[i][1];
    const blockStart = bossMatches[i].index;
    const blockEnd = i + 1 < bossMatches.length ? bossMatches[i + 1].index : text.length;
    const blockText = text.slice(blockStart, blockEnd);

    result[bossName] = parseBossBlock(blockText, bossName);
  }

  const outPath = path.join(__dirname, '..', 'data', 'raid-items.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');

  console.log(`Босів знайдено: ${Object.keys(result).length}`);
  for (const [bossName, modes] of Object.entries(result)) {
    const counts = Object.entries(modes).map(([k, v]) => `${k}=${v.length}`).join(', ');
    console.log(`  ${bossName}: ${counts}`);
  }
  console.log(`Записано: ${outPath}`);
}

main();
