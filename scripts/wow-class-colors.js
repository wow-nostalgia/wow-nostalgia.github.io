// Спільна палітра кольорів класів WoW + побудова мапи "ім'я персонажа ->
// колір класу" з рядків data/guild-data.json. Підключати тегом <script>
// ДО будь-якого файлу, що використовує WOW_CLASS_COLORS/buildClassColorMap
// (без бандлера, як і інші клієнтські скрипти).

const WOW_CLASS_COLORS = {
  'Death Knight': '#C41F3B',
  'Druid': '#FF7D0A',
  'Hunter': '#ABD473',
  'Mage': '#69CCF0',
  'Paladin': '#F58CBA',
  'Priest': '#F0EDE0',
  'Rogue': '#FFF569',
  'Shaman': '#0070DE',
  'Warlock': '#9482C9',
  'Warrior': '#C79C6E'
};

// Класи, обрані гравцями в профілі (GET /characters/classes): { ім'я: клас }.
// Потребує apiUrl з auth-shared.js. Помилка мережі - просто без них.
async function fetchManualCharacterClasses() {
  try {
    const res = await fetch(apiUrl('/characters/classes'));
    return res.ok ? await res.json() : {};
  } catch (err) {
    console.error(err);
    return {};
  }
}

// Доповнює мапу "ім'я -> колір" класами з профілю - лише для імен, яких
// немає в логах: клас із логів завжди важливіший.
function addManualClassColors(map, manualClasses) {
  for (const [name, cls] of Object.entries(manualClasses || {})) {
    if (!map.has(name) && WOW_CLASS_COLORS[cls]) map.set(name, WOW_CLASS_COLORS[cls]);
  }
  return map;
}

function buildClassColorMap(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.name) && WOW_CLASS_COLORS[row.class]) {
      map.set(row.name, WOW_CLASS_COLORS[row.class]);
    }
  }
  return map;
}
