// Рейди WotLK, які можна створити на сайті. Має збігатися з
// scripts/raid-manager-shared.js (INSTANCE_LABELS, INSTANCE_DIFFICULTIES).
//
// ICC і RS - повні рейди з софт-резервами. Решта - спрощені: без софтів,
// передачі й бонусів; лише попередній запис, офіцери, налаштування, історія.

export const SOFT_INSTANCES = new Set(['ICC', 'RS']);

// Складності, можливі в кожному рейді (героїк є лише в ЦЛК, РС і ВХ).
const ALL = ['10N', '10H', '25N', '25H'];
const NORMAL_ONLY = ['10N', '25N'];
export const INSTANCE_DIFFICULTIES = {
  ICC: ALL,
  RS: ALL,
  TOC: ALL,
  NAXX: NORMAL_ONLY,
  OS: NORMAL_ONLY,
  EOE: NORMAL_ONLY,
  VOA: NORMAL_ONLY,
  ULD: NORMAL_ONLY,
  ONY: NORMAL_ONLY
};

export const INSTANCE_LABELS = {
  ICC: 'ЦЛК',
  RS: 'РС',
  NAXX: 'Наксрамас',
  OS: 'Обсидіанове святилище',
  EOE: 'Око Вічності',
  VOA: 'Склеп Аркавона',
  ULD: 'Ульдуар',
  TOC: 'Випробування хрестоносця',
  ONY: 'Лігво Оніксії'
};

export function isKnownInstance(instance) {
  return Object.prototype.hasOwnProperty.call(INSTANCE_DIFFICULTIES, instance);
}

export function isValidDifficulty(instance, difficulty) {
  return isKnownInstance(instance) && INSTANCE_DIFFICULTIES[instance].includes(difficulty);
}

export function hasSoftReserves(raid) {
  return SOFT_INSTANCES.has(raid.instance);
}
