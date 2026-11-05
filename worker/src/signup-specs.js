// Класи й спеки WotLK для попереднього запису. Має збігатися з
// SIGNUP_SPECS у scripts/raid-signups.js (фронт: назви, іконки, ролі).
// Друїд-ферал розділений на ведмедя (танк) і кота (мілі) - як у шаблоні
// WoW у Raid-Helper.
export const SIGNUP_CLASS_SPECS = {
  'Death Knight': ['Blood', 'Frost', 'Unholy'],
  Druid: ['Balance', 'Feral Combat (Bear)', 'Feral Combat (Cat)', 'Restoration'],
  Hunter: ['Beast Mastery', 'Marksmanship', 'Survival'],
  Mage: ['Arcane', 'Fire', 'Frost'],
  Paladin: ['Holy', 'Protection', 'Retribution'],
  Priest: ['Discipline', 'Holy', 'Shadow'],
  Rogue: ['Assassination', 'Combat', 'Subtlety'],
  Shaman: ['Elemental', 'Enhancement', 'Restoration'],
  Warlock: ['Affliction', 'Demonology', 'Destruction'],
  Warrior: ['Arms', 'Fury', 'Protection']
};

export const SIGNUP_STATUSES = ['signed', 'late', 'tentative', 'bench', 'absent'];

export function isValidClassSpec(cls, spec) {
  return Object.prototype.hasOwnProperty.call(SIGNUP_CLASS_SPECS, cls) && SIGNUP_CLASS_SPECS[cls].includes(spec);
}
