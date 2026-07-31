'use strict';

const fs = require('node:fs/promises');
const path = require('path');

const LUA_FILE = path.join(__dirname, '..', 'GuildRosterExportMini.lua');
const PLAYERS_FILE = path.join(__dirname, '..', 'data', 'players.json');

const ENTRY_RE = /\["name"\]\s*=\s*"((?:[^"\\]|\\.)*)",\s*\r?\n\s*\["server"\]\s*=\s*"((?:[^"\\]|\\.)*)"/g;

async function updatePlayers() {
  let lua;
  try {
    lua = await fs.readFile(LUA_FILE, 'utf8');
  } catch {
    throw new Error(`Файл не знайдено: ${LUA_FILE}\nЗгенеруй його командою /groster в грі та скопіюй у корінь проєкту.`);
  }

  const players = [];
  let match;
  while ((match = ENTRY_RE.exec(lua)) !== null) {
    players.push({ name: match[1], server: match[2] });
  }

  if (players.length === 0) {
    throw new Error('У файлі GuildRosterExportMini.lua не знайдено жодного гравця');
  }

  await fs.writeFile(PLAYERS_FILE, JSON.stringify(players, null, 2) + '\n', 'utf8');

  console.log(`Готово. Знайдено ${players.length} гравців.`);
  console.log(`Список записано у: ${PLAYERS_FILE}`);
}

updatePlayers().catch((error) => {
  console.error('Помилка оновлення players.json');
  console.error(error.message);
  process.exit(1);
});
