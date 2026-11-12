// Спеки WotLK у тому вигляді, що й у попередньому записі (шаблон wowwotlk
// Raid-Helper): ДК - кожен спек як танк і як ДД, друїд-ферал - ведмідь і
// кіт, у жреця є Smite. Спільне для попереднього запису (raid-signups.js),
// GS по спеках у профілі (account.js) і Рейтингу DPS (guild-ranking.js).
// Має збігатися з worker/src/signup-specs.js.
//
// Опційно: name-translations.js (translateClass, translateSpec, getNameLanguage),
// ui-shared.js (applyAutoTooltip).

// role: tank | healer | ranged | melee.
const SIGNUP_CLASSES = {
  'Death Knight': { icon: 'class_deathknight', specs: { 'Blood (Tank)': ['tank', 'spell_deathknight_bloodpresence'], 'Blood (DPS)': ['melee', 'spell_deathknight_bloodpresence'], 'Frost (Tank)': ['tank', 'spell_deathknight_frostpresence'], 'Frost (DPS)': ['melee', 'spell_deathknight_frostpresence'], 'Unholy (Tank)': ['tank', 'spell_deathknight_unholypresence'], 'Unholy (DPS)': ['melee', 'spell_deathknight_unholypresence'] } },
  Druid: { icon: 'class_druid', specs: { Balance: ['ranged', 'spell_nature_starfall'], 'Feral Combat (Bear)': ['tank', 'ability_racial_bearform'], 'Feral Combat (Cat)': ['melee', 'ability_druid_catform'], Restoration: ['healer', 'spell_nature_healingtouch'] } },
  Hunter: { icon: 'class_hunter', specs: { 'Beast Mastery': ['ranged', 'ability_hunter_beasttaming'], Marksmanship: ['ranged', 'ability_marksmanship'], Survival: ['ranged', 'ability_hunter_swiftstrike'] } },
  Mage: { icon: 'class_mage', specs: { Arcane: ['ranged', 'spell_holy_magicalsentry'], Fire: ['ranged', 'spell_fire_firebolt02'], Frost: ['ranged', 'spell_frost_frostbolt02'] } },
  Paladin: { icon: 'class_paladin', specs: { Holy: ['healer', 'spell_holy_holybolt'], Protection: ['tank', 'spell_holy_devotionaura'], Retribution: ['melee', 'spell_holy_auraoflight'] } },
  Priest: { icon: 'class_priest', specs: { Discipline: ['healer', 'spell_holy_wordfortitude'], Holy: ['healer', 'spell_holy_guardianspirit'], Shadow: ['ranged', 'spell_shadow_shadowwordpain'], Smite: ['ranged', 'spell_holy_holysmite'] } },
  Rogue: { icon: 'class_rogue', specs: { Assassination: ['melee', 'ability_rogue_eviscerate'], Combat: ['melee', 'ability_backstab'], Subtlety: ['melee', 'ability_stealth'] } },
  Shaman: { icon: 'class_shaman', specs: { Elemental: ['ranged', 'spell_nature_lightning'], Enhancement: ['melee', 'spell_nature_lightningshield'], Restoration: ['healer', 'spell_nature_magicimmunity'] } },
  Warlock: { icon: 'class_warlock', specs: { Affliction: ['ranged', 'spell_shadow_deathcoil'], Demonology: ['ranged', 'spell_shadow_metamorphosis'], Destruction: ['ranged', 'spell_shadow_rainoffire'] } },
  Warrior: { icon: 'class_warrior', specs: { Arms: ['melee', 'ability_warrior_savageblow'], Fury: ['melee', 'ability_warrior_innerrage'], Protection: ['tank', 'ability_warrior_defensivestance'] } }
};

const FERAL_LABELS_UK = { 'Feral Combat (Bear)': 'Сила звіра (ведмідь)', 'Feral Combat (Cat)': 'Сила звіра (кіт)' };
const DK_ROLE_LABELS_UK = { Tank: 'танк', DPS: 'ДД' };
const SMITE_LABEL_UK = 'Кара';

function signupIconUrl(icon) {
  return `https://wow.zamimg.com/images/wow/icons/small/${icon}.jpg`;
}

function signupSpecLabel(spec) {
  if (!spec) return '—';
  const uk = typeof getNameLanguage !== 'function' || getNameLanguage() === 'uk';
  if (FERAL_LABELS_UK[spec]) return uk ? FERAL_LABELS_UK[spec] : spec;
  if (spec === 'Smite') return uk ? SMITE_LABEL_UK : spec;
  const dk = /^(Blood|Frost|Unholy) \((Tank|DPS)\)$/.exec(spec);
  if (dk) {
    const base = typeof translateSpec === 'function' ? translateSpec(dk[1]) : dk[1];
    return uk ? `${base} (${DK_ROLE_LABELS_UK[dk[2]]})` : spec;
  }
  return typeof translateSpec === 'function' ? translateSpec(spec) : spec;
}

function signupSpecInfo(cls, spec) {
  const [role, icon] = SIGNUP_CLASSES[cls]?.specs?.[spec] || ['melee', SIGNUP_CLASSES[cls]?.icon || 'inv_misc_questionmark'];
  return { role, icon };
}

// Спек із логів гільдії (data/guild-data.json, без ролі) -> спек запису.
// Рейтинг DPS - про ДД, тож ДК - "(DPS)", ферал - кіт.
function logSpecToSignupSpec(cls, spec) {
  if (cls === 'Death Knight' && /^(Blood|Frost|Unholy)$/.test(spec)) return `${spec} (DPS)`;
  if (spec === 'Feral Combat') return 'Feral Combat (Cat)';
  return spec;
}

// Чіпи "іконка спеку + GS" у порядку спеків класу. gearScores: { спек: 6.5 }.
// highlightSpec - підсвітити чіп цього спеку (напр. спек запису на рейд).
// tooltips: false - без підказок (якщо чіпи вже всередині підказки).
// Повертає null, якщо GS немає жодного.
function createGearScoreChips(gearScores, { cls, highlightSpec, tooltips = true } = {}) {
  const entries = Object.entries(gearScores || {});
  if (!entries.length) return null;
  const order = Object.keys(SIGNUP_CLASSES[cls]?.specs || {});
  const rank = (spec) => { const i = order.indexOf(spec); return i < 0 ? order.length : i; };
  entries.sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));

  const wrap = document.createElement('span');
  wrap.className = 'gs-chips';
  for (const [spec, gs] of entries) {
    const chip = document.createElement('span');
    chip.className = `gs-chip${spec === highlightSpec ? ' gs-chip--active' : ''}`;
    const img = document.createElement('img');
    img.src = signupIconUrl(signupSpecInfo(cls, spec).icon);
    img.alt = '';
    img.width = 14;
    img.height = 14;
    img.loading = 'lazy';
    const value = document.createElement('span');
    value.textContent = Number(gs).toFixed(1);
    chip.append(img, value);
    if (tooltips) {
      chip.setAttribute('aria-label', `${signupSpecLabel(spec)}: ${Number(gs).toFixed(1)}`);
      if (typeof applyAutoTooltip === 'function') applyAutoTooltip(chip);
    }
    wrap.appendChild(chip);
  }
  return wrap;
}
