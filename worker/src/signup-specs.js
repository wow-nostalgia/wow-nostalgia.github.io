// Класи й спеки WotLK для попереднього запису. Має збігатися з
// SIGNUP_SPECS у scripts/raid-signups.js (фронт: назви, іконки, ролі).
// Друїд-ферал розділений на ведмедя (танк) і кота (мілі) - як у шаблоні
// WoW у Raid-Helper. ДК - кожен спек як танк і як ДД, у жреця є Smite (як у
// шаблоні wowwotlk Raid-Helper). Стосується лише попереднього запису.
export const SIGNUP_CLASS_SPECS = {
  'Death Knight': ['Blood (Tank)', 'Blood (DPS)', 'Frost (Tank)', 'Frost (DPS)', 'Unholy (Tank)', 'Unholy (DPS)'],
  Druid: ['Balance', 'Feral Combat (Bear)', 'Feral Combat (Cat)', 'Restoration'],
  Hunter: ['Beast Mastery', 'Marksmanship', 'Survival'],
  Mage: ['Arcane', 'Fire', 'Frost'],
  Paladin: ['Holy', 'Protection', 'Retribution'],
  Priest: ['Discipline', 'Holy', 'Shadow', 'Smite'],
  Rogue: ['Assassination', 'Combat', 'Subtlety'],
  Shaman: ['Elemental', 'Enhancement', 'Restoration'],
  Warlock: ['Affliction', 'Demonology', 'Destruction'],
  Warrior: ['Arms', 'Fury', 'Protection']
};

export const SIGNUP_STATUSES = ['signed', 'late', 'tentative', 'bench', 'absent'];

export function isValidClassSpec(cls, spec) {
  return Object.prototype.hasOwnProperty.call(SIGNUP_CLASS_SPECS, cls) && SIGNUP_CLASS_SPECS[cls].includes(spec);
}

// ---- Відповідність шаблону wowwotlk Raid-Helper ----
// Назви спеків у Raid-Helper унікальні між класами (Holy - жрець, Holy1 -
// паладин тощо), тож клас сайту визначається за самим спеком. Це важливо:
// для статусів "Під питанням"/"Лава"/"Запізнюсь" Raid-Helper пише статус на
// місце класу (className "Tentative"), а від класу лишається лише спек;
// записи танків бувають у псевдо-класі "Tank".
// [клас Raid-Helper, спек Raid-Helper, клас сайту, спек сайту]
const RH_SPEC_TABLE = [
  ['DK', 'Blood_Tank', 'Death Knight', 'Blood (Tank)'],
  ['DK', 'Blood_DPS', 'Death Knight', 'Blood (DPS)'],
  ['DK', 'Frost_Tank', 'Death Knight', 'Frost (Tank)'],
  ['DK', 'Frost_DPS', 'Death Knight', 'Frost (DPS)'],
  ['DK', 'Unholy_Tank', 'Death Knight', 'Unholy (Tank)'],
  ['DK', 'Unholy_DPS', 'Death Knight', 'Unholy (DPS)'],
  ['Druid', 'Balance', 'Druid', 'Balance'],
  ['Druid', 'Guardian', 'Druid', 'Feral Combat (Bear)'],
  ['Druid', 'Feral', 'Druid', 'Feral Combat (Cat)'],
  ['Druid', 'Restoration', 'Druid', 'Restoration'],
  ['Hunter', 'Beastmastery', 'Hunter', 'Beast Mastery'],
  ['Hunter', 'Marksmanship', 'Hunter', 'Marksmanship'],
  ['Hunter', 'Survival', 'Hunter', 'Survival'],
  ['Mage', 'Arcane', 'Mage', 'Arcane'],
  ['Mage', 'Fire', 'Mage', 'Fire'],
  ['Mage', 'Frost', 'Mage', 'Frost'],
  ['Paladin', 'Holy1', 'Paladin', 'Holy'],
  ['Paladin', 'Protection1', 'Paladin', 'Protection'],
  ['Paladin', 'Retribution', 'Paladin', 'Retribution'],
  ['Priest', 'Discipline', 'Priest', 'Discipline'],
  ['Priest', 'Holy', 'Priest', 'Holy'],
  ['Priest', 'Shadow', 'Priest', 'Shadow'],
  ['Priest', 'Smite', 'Priest', 'Smite'],
  ['Rogue', 'Assassination', 'Rogue', 'Assassination'],
  ['Rogue', 'Combat', 'Rogue', 'Combat'],
  ['Rogue', 'Subtlety', 'Rogue', 'Subtlety'],
  ['Shaman', 'Elemental', 'Shaman', 'Elemental'],
  ['Shaman', 'Enhancement', 'Shaman', 'Enhancement'],
  ['Shaman', 'Restoration1', 'Shaman', 'Restoration'],
  ['Warlock', 'Affliction', 'Warlock', 'Affliction'],
  ['Warlock', 'Demonology', 'Warlock', 'Demonology'],
  ['Warlock', 'Destruction', 'Warlock', 'Destruction'],
  ['Warrior', 'Arms', 'Warrior', 'Arms'],
  ['Warrior', 'Fury', 'Warrior', 'Fury'],
  ['Warrior', 'Protection', 'Warrior', 'Protection']
];

const RH_BY_SPEC = new Map(RH_SPEC_TABLE.map(([rc, rs, c, s]) => [rs, { cls: c, spec: s, rhClass: rc }]));
const RH_BY_SITE = new Map(RH_SPEC_TABLE.map(([rc, rs, c, s]) => [`${c}|${s}`, { rhClass: rc, rhSpec: rs }]));

// Статуси сайту <-> псевдо-класи Raid-Helper.
export const RH_STATUS_CLASSES = { late: 'Late', bench: 'Bench', tentative: 'Tentative', absent: 'Absence' };
const RH_CLASS_STATUS = Object.fromEntries(Object.entries(RH_STATUS_CLASSES).map(([k, v]) => [v, k]));

// Запис Raid-Helper -> { status, cls, spec } сайту (cls/spec можуть бути null).
// null - невідомий клас/спек (запис пропускається з попередженням).
export function fromRaidHelperSignup(signup) {
  const status = RH_CLASS_STATUS[signup.className] || 'signed';
  const known = signup.specName ? RH_BY_SPEC.get(signup.specName) : null;
  if (status === 'signed' && !known) return null;
  return { status, cls: known ? known.cls : null, spec: known ? known.spec : null };
}

// Клас/спек/статус сайту -> { className, specName } для API Raid-Helper.
export function toRaidHelperClassSpec(cls, spec, status) {
  const m = RH_BY_SITE.get(`${cls}|${spec}`);
  if (status !== 'signed') return { className: RH_STATUS_CLASSES[status], specName: m ? m.rhSpec : undefined };
  if (!m) return null;
  return { className: m.rhClass, specName: m.rhSpec };
}
