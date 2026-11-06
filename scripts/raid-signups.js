// Попередній запис на рейд - спільний модуль для сторінки рейду (вкладка
// "Попередній запис") і календаря (кнопка "Записатись" у панелі дня).
//
// Вигляд і правила - за зразком Raid-Helper (docs/Raid-Helper — Documentation):
// - шапка: лідер, дата, час, відлік, "Записано N/25 (+M)" (M - лавка,
//   запізнюсь, під питанням; відсутні не рахуються);
// - лічильники ролей (Танки/Хіли/Рендж/Мілі) - лише візуальні;
// - колонки: "Танк" (усі танк-спеки) і класи, заголовок класу - лише якщо в
//   ньому хтось є; у рядку - іконка спеку, номер запису, персонаж;
// - рядки внизу: Лавка запасних, Запізнюсь, Під питанням, Відсутні;
// - ліміт 25 лише показується: записи основи понад 25 позначені "понад ліміт".
//
// Залежить від: ui-shared.js (openModal, closeModal, onModalCancel,
// setModalBusy, showMessageModal, applyAutoTooltip, kyivDateKey, kyivTimeKey,
// raidStartIso), raid-manager-shared.js (apiCall), auth-shared.js
// (getSessionToken). Опційно: name-translations.js (translateClass,
// translateSpec), wow-class-colors.js (WOW_CLASS_COLORS).

const SIGNUP_LIMIT = 25;

// Має збігатися з worker/src/signup-specs.js. role: tank | healer | ranged | melee.
const SIGNUP_CLASSES = {
  // ДК - кожен спек як танк і як ДД, у жреця є Smite: як у шаблоні wowwotlk
  // Raid-Helper (лише для попереднього запису).
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

// Порядок колонок - як у шаблоні WoW Raid-Helper (танки окремою колонкою).
const SIGNUP_COLUMN_ORDER = ['Tank', 'Death Knight', 'Warrior', 'Druid', 'Paladin', 'Rogue', 'Hunter', 'Mage', 'Warlock', 'Priest', 'Shaman'];

const SIGNUP_ROLES = [
  { key: 'tank', label: 'Танки', icon: 'ability_warrior_defensivestance' },
  { key: 'healer', label: 'Хіли', icon: 'spell_holy_holybolt' },
  { key: 'ranged', label: 'Рендж', icon: 'ability_marksmanship' },
  { key: 'melee', label: 'Мілі', icon: 'ability_meleedamage' }
];

const SIGNUP_STATUS_LABELS = {
  signed: 'Буду',
  late: 'Запізнюсь',
  tentative: 'Під питанням',
  bench: 'Лавка запасних',
  absent: 'Відсутній'
};

// Рядки під колонками (порядок як у Raid-Helper).
const SIGNUP_EXTRA_GROUPS = [
  { status: 'bench', label: 'Лавка запасних' },
  { status: 'late', label: 'Запізнюсь' },
  { status: 'tentative', label: 'Під питанням' },
  { status: 'absent', label: 'Відсутні' }
];

const FERAL_LABELS_UK = { 'Feral Combat (Bear)': 'Сила звіра (ведмідь)', 'Feral Combat (Cat)': 'Сила звіра (кіт)' };

function signupIconUrl(icon) {
  return `https://wow.zamimg.com/images/wow/icons/small/${icon}.jpg`;
}

function signupClassLabel(cls) {
  if (cls === 'Tank') return 'Танк';
  return typeof translateClass === 'function' ? translateClass(cls) : cls;
}

const DK_ROLE_LABELS_UK = { Tank: 'танк', DPS: 'ДД' };
const SMITE_LABEL_UK = 'Кара';

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

// Ім'я запису: персонаж, а для запису з Discord без обраного персонажа - нік.
function signupDisplayName(signup) {
  return signup.character_name || signup.discord_name || '—';
}

function signupSpecInfo(cls, spec) {
  const [role, icon] = SIGNUP_CLASSES[cls]?.specs?.[spec] || ['melee', SIGNUP_CLASSES[cls]?.icon || 'inv_misc_questionmark'];
  return { role, icon };
}

function signupClassColor(cls) {
  return (typeof WOW_CLASS_COLORS !== 'undefined' && WOW_CLASS_COLORS[cls]) || '';
}

function isSignupClosed(raid) {
  if (raid.status === 'completed') return true;
  return Boolean(raid.starts_at) && Date.now() >= Date.parse(raid.starts_at);
}

// "завтра" / "через 5 днів" / "через 3 години" / "2 дні тому". Дні рахуємо за
// київським календарем, а не по 24 години: рейд завтра о 20:00 - "завтра",
// навіть якщо до нього 44 години.
function signupCountdownText(raid) {
  const start = raidStartIso(raid);
  const rtf = new Intl.RelativeTimeFormat('uk', { numeric: 'auto' });
  const dayMs = (key) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const dayDiff = Math.round((dayMs(kyivDateKey(start)) - dayMs(kyivDateKey(new Date()))) / 864e5);
  if (dayDiff !== 0) return rtf.format(dayDiff, 'day');
  const diff = Date.parse(start) - Date.now();
  if (Math.abs(diff) >= 36e5) return rtf.format(Math.round(diff / 36e5), 'hour');
  return rtf.format(Math.round(diff / 6e4), 'minute');
}

function signupEntryLabel(signup) {
  const who = signup.owner_display_name || (signup.character_name ? signup.discord_name : '');
  const classSpec = signup.class ? ` - ${signupClassLabel(signup.class)}, ${signupSpecLabel(signup.spec)}` : '';
  const noChar = signup.character_name ? '' : ' · з Discord, персонаж не обраний';
  return `${signupDisplayName(signup)}${classSpec}${who ? ` (${who})` : ''}${noChar}`;
}

// Кнопка з розділеним списком (як "Рейди ▾" у навбарі): основна дія +
// стрілка з другорядними (напр. скасування). items: [{ label, danger, onClick }].
function createSplitButton({ label, onClick, items, disabled = false, toggleLabel = 'Інші дії' }) {
  const wrap = document.createElement('div');
  wrap.className = 'split-btn';
  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'compare-btn split-btn__main';
  main.textContent = label;
  main.disabled = disabled;
  main.addEventListener('click', onClick);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'compare-btn split-btn__toggle';
  toggle.setAttribute('aria-haspopup', 'menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', toggleLabel);
  toggle.disabled = disabled;
  const menu = document.createElement('div');
  menu.className = 'split-btn__menu';
  menu.setAttribute('role', 'menu');

  const setOpen = (open) => {
    wrap.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  const onOutside = (event) => {
    if (!wrap.isConnected) { document.removeEventListener('click', onOutside); return; }
    if (!wrap.contains(event.target)) setOpen(false);
  };
  document.addEventListener('click', onOutside);
  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && wrap.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
  });
  toggle.addEventListener('click', () => setOpen(!wrap.classList.contains('is-open')));

  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `split-btn__item${item.danger ? ' split-btn__item--danger' : ''}`;
    btn.setAttribute('role', 'menuitem');
    btn.textContent = item.label;
    btn.addEventListener('click', () => { setOpen(false); item.onClick(); });
    menu.appendChild(btn);
  });
  wrap.append(main, toggle, menu);
  return wrap;
}

// Рядок стану синхронізації з Raid-Helper + (офіцерам) прив'язка/оновлення.
// Лише офіцерам; унизу вкладки - другорядне для гравців.
function renderRaidHelperBar(root, { raid, officer, onChange, onRaidChange }) {
  if (!officer) return;
  const bar = document.createElement('div');
  bar.className = 'signup-rh';
  const text = document.createElement('span');
  text.className = 'signup-rh-text';
  if (raid.rh_event_id) {
    const synced = raid.rh_synced_at
      ? `оновлено ${kyivTimeKey(raid.rh_synced_at)}`
      : 'ще не оновлювалось';
    text.textContent = `Синхронізовано з Discord (Raid-Helper) · ${synced}`;
  } else {
    text.textContent = "Не прив'язано до Discord (Raid-Helper).";
  }
  bar.appendChild(text);
  if (raid.rh_sync_error) {
    const err = document.createElement('span');
    err.className = 'signup-rh-error';
    err.textContent = `Помилка синхронізації: ${raid.rh_sync_error}`;
    bar.appendChild(err);
  }

  if (officer) {
    const busy = (on) => bar.querySelectorAll('button, input').forEach((el) => { el.disabled = on; });
    const call = async (method, path, body, after) => {
      busy(true);
      try {
        const result = await apiCall(method, path, { token: getSessionToken(), body });
        if (onRaidChange) await onRaidChange();
        onChange(result.signups);
        if (after) after(result);
      } catch (err) {
        busy(false);
        showMessageModal(err.message);
      }
    };
    if (raid.rh_event_id) {
      bar.appendChild(createSplitButton({
        label: 'Оновити зараз',
        toggleLabel: 'Інші дії з синхронізацією',
        onClick: () => call('POST', `/raids/${raid.id}/raid-helper/sync`, undefined, (r) => {
          if (r.skipped) showMessageModal(`Пропущено записів з невідомим класом/спеком: ${r.skipped}`);
        }),
        items: [{ label: "Відв'язати від Discord", danger: true, onClick: () => call('PUT', `/raids/${raid.id}/raid-helper`, { eventId: '' }) }]
      }));
    } else {
      const form = document.createElement('form');
      form.className = 'signup-rh-form';
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.placeholder = 'ID рейду Raid-Helper';
      input.setAttribute('aria-label', 'ID рейду Raid-Helper (ID повідомлення в Discord)');
      const link = document.createElement('button');
      link.type = 'submit';
      link.className = 'compare-btn';
      link.textContent = "Прив'язати";
      form.append(input, link);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        call('PUT', `/raids/${raid.id}/raid-helper`, { eventId: input.value.trim() }, (r) => {
          const lines = [`Прив'язано. Відправлено в Discord записів із сайту: ${r.pushed}.`];
          if (r.failed.length) lines.push(`Не вдалося відправити (записи зникли з сайту): ${r.failed.join('; ')}`);
          showMessageModal(lines.join(' '));
        });
      });
      bar.appendChild(form);
      // Рейд без прив'язки (створений до синхронізації чи публікація не
      // вдалась) - створити його в Discord.
      if (raid.status !== 'completed') {
        const publish = document.createElement('button');
        publish.type = 'button';
        publish.className = 'compare-btn';
        publish.textContent = 'Опублікувати в Discord';
        publish.addEventListener('click', () => call('POST', `/raids/${raid.id}/raid-helper/publish`, undefined, (r) => {
          const lines = [`Опубліковано в Discord. Відправлено записів із сайту: ${r.pushed}.`];
          if (r.failed.length) lines.push(`Не вдалося відправити (записи зникли з сайту): ${r.failed.join('; ')}`);
          showMessageModal(lines.join(' '));
        }));
        bar.appendChild(publish);
      }
    }
  }
  root.appendChild(bar);
}

// --- Вигляд записаних (вкладка "Попередній запис") ---

// opts: { raid, signups, officer, myDiscordId, onChange(newSignups) }
function renderSignupRoster(root, opts) {
  const { raid, signups, officer, myDiscordId, onChange, onRaidChange } = opts;
  root.innerHTML = '';

  const main = signups.filter((s) => s.status === 'signed');
  const extraCount = signups.filter((s) => ['late', 'tentative', 'bench'].includes(s.status)).length;
  // Понад ліміт - основа після перших 25 за номером запису.
  const overLimitIds = new Set(main.slice(SIGNUP_LIMIT).map((s) => s.id));

  // Шапка.
  const head = document.createElement('div');
  head.className = 'signup-head';
  const start = raidStartIso(raid);
  const [y, m, d] = kyivDateKey(start).split('-');
  const metaItems = [
    ['Лідер', raid.leader_display_name || '—'],
    ['Дата', `${d}.${m}.${y}`],
    ['Час', kyivTimeKey(start)],
    ['Записано', `${main.length}/${SIGNUP_LIMIT}${extraCount ? ` (+${extraCount})` : ''}`],
    ['Початок', signupCountdownText(raid)]
  ];
  metaItems.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'signup-meta';
    const l = document.createElement('span');
    l.className = 'signup-meta-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'signup-meta-value';
    v.textContent = value;
    if (label === 'Записано' && main.length > SIGNUP_LIMIT) v.classList.add('signup-meta-value--over');
    item.append(l, v);
    head.appendChild(item);
  });
  // Шапка й дії - в одному рядку (дії праворуч), на вузькому екрані дії
  // переносяться під шапку.
  const top = document.createElement('div');
  top.className = 'signup-top';
  top.appendChild(head);
  root.appendChild(top);

  // Мій запис + кнопки.
  const mine = signups.find((s) => s.discord_id === myDiscordId);
  const actions = document.createElement('div');
  actions.className = 'signup-actions';
  const closed = isSignupClosed(raid);
  if (mine) {
    const my = document.createElement('span');
    my.className = 'signup-my';
    my.textContent = `Твій запис: ${mine.character_name || 'персонаж не обраний'} · ${signupSpecLabel(mine.spec)} · ${SIGNUP_STATUS_LABELS[mine.status]}`;
    actions.appendChild(my);
  }
  const openModalForMe = () => openSignupModal({ raid, signups, myDiscordId, onSaved: onChange });
  if (mine) {
    // Скасування - другорядна дія, у списку під стрілкою.
    const split = createSplitButton({
      label: 'Змінити запис',
      toggleLabel: 'Інші дії із записом',
      disabled: closed,
      onClick: openModalForMe,
      items: [{
        label: 'Скасувати запис',
        danger: true,
        onClick: async () => {
          split.querySelectorAll('button').forEach((b) => { b.disabled = true; });
          try {
            onChange(await apiCall('DELETE', `/raids/${raid.id}/signups/me`, { token: getSessionToken() }));
          } catch (err) {
            split.querySelectorAll('button').forEach((b) => { b.disabled = false; });
            showMessageModal(err.message);
          }
        }
      }]
    });
    split.querySelector('.split-btn__main').classList.add('signup-sign-btn');
    actions.appendChild(split);
  } else {
    const signBtn = document.createElement('button');
    signBtn.type = 'button';
    signBtn.className = 'compare-btn signup-sign-btn';
    signBtn.textContent = 'Записатись';
    signBtn.disabled = closed;
    signBtn.addEventListener('click', openModalForMe);
    actions.appendChild(signBtn);
  }
  if (closed) {
    const note = document.createElement('span');
    note.className = 'signup-closed-note';
    // Коротко (вміщається праворуч від шапки); пояснення - у підказці.
    note.textContent = raid.status === 'completed' ? 'Рейд завершено - запис закрито' : 'Рейд почався - запис закрито';
    if (raid.status !== 'completed') {
      note.setAttribute('aria-label', 'Зміни в записі тепер вносить лідер або офіцер рейду');
      applyAutoTooltip(note);
    }
    actions.appendChild(note);
  }
  top.appendChild(actions);

  // Лічильники ролей (лише основа).
  const roles = document.createElement('div');
  roles.className = 'signup-roles';
  SIGNUP_ROLES.forEach((role) => {
    const count = main.filter((s) => signupSpecInfo(s.class, s.spec).role === role.key).length;
    const item = document.createElement('span');
    item.className = 'signup-role';
    item.innerHTML = `<img src="${signupIconUrl(role.icon)}" alt="" width="18" height="18">`;
    item.append(`${role.label} `);
    const b = document.createElement('b');
    b.textContent = String(count);
    item.appendChild(b);
    roles.appendChild(item);
  });
  root.appendChild(roles);

  const entry = (s) => {
    const { icon } = signupSpecInfo(s.class, s.spec);
    const el = document.createElement(officer ? 'button' : 'span');
    if (officer) el.type = 'button';
    el.className = 'signup-entry';
    if (overLimitIds.has(s.id)) el.classList.add('signup-entry--over');
    if (s.discord_id === myDiscordId) el.classList.add('signup-entry--mine');
    const img = document.createElement('img');
    img.src = signupIconUrl(icon);
    img.alt = '';
    img.width = 16;
    img.height = 16;
    const pos = document.createElement('span');
    pos.className = 'signup-pos';
    pos.textContent = String(s.position);
    const name = document.createElement('span');
    name.className = 'signup-name';
    name.textContent = signupDisplayName(s);
    if (!s.character_name) name.classList.add('signup-name--discord');
    const color = signupClassColor(s.class);
    if (color) name.style.color = color;
    el.append(img, pos, name);
    el.setAttribute('aria-label', `${signupEntryLabel(s)}${overLimitIds.has(s.id) ? ' - понад ліміт' : ''}${officer ? '. Клікни, щоб змінити' : ''}`);
    applyAutoTooltip(el);
    if (officer) el.addEventListener('click', () => openOfficerSignupModal({ raid, signup: s, onSaved: onChange }));
    return el;
  };

  // Колонки основи.
  const columns = new Map(SIGNUP_COLUMN_ORDER.map((c) => [c, []]));
  main.forEach((s) => {
    const col = signupSpecInfo(s.class, s.spec).role === 'tank' ? 'Tank' : s.class;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col).push(s);
  });
  const grid = document.createElement('div');
  grid.className = 'signup-columns';
  columns.forEach((list, col) => {
    if (!list.length) return;
    const column = document.createElement('div');
    column.className = 'signup-column';
    const h = document.createElement('div');
    h.className = 'signup-column-head';
    const icon = col === 'Tank' ? 'ability_warrior_defensivestance' : SIGNUP_CLASSES[col]?.icon;
    if (icon) h.innerHTML = `<img src="${signupIconUrl(icon)}" alt="" width="18" height="18">`;
    const title = document.createElement('span');
    title.textContent = `${signupClassLabel(col)} (${list.length})`;
    if (col !== 'Tank' && signupClassColor(col)) title.style.color = signupClassColor(col);
    h.appendChild(title);
    column.appendChild(h);
    list.forEach((s) => column.appendChild(entry(s)));
    grid.appendChild(column);
  });
  if (!main.length) {
    const empty = document.createElement('p');
    empty.className = 'signup-empty';
    empty.textContent = 'Ще ніхто не записався.';
    grid.appendChild(empty);
  }
  root.appendChild(grid);

  // Лавка / Запізнюсь / Під питанням / Відсутні.
  SIGNUP_EXTRA_GROUPS.forEach(({ status, label }) => {
    const list = signups.filter((s) => s.status === status);
    if (!list.length) return;
    const row = document.createElement('div');
    row.className = 'signup-extra';
    const l = document.createElement('span');
    l.className = 'signup-extra-label';
    l.textContent = `${label} (${list.length}):`;
    row.appendChild(l);
    list.forEach((s) => row.appendChild(entry(s)));
    root.appendChild(row);
  });

  renderRaidHelperBar(root, { raid, officer, onChange, onRaidChange });
}

// --- Вікна ---

function buildSignupDialog(titleText) {
  const dialog = document.createElement('dialog');
  dialog.className = 'raid-modal signup-modal';
  dialog.innerHTML = `
    <div class="raid-modal-backdrop"></div>
    <div class="raid-modal-box">
      <button type="button" class="raid-modal-close" aria-label="Закрити">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>
      </button>
      <h3 class="raid-modal-title"></h3>
      <div class="signup-modal-body"></div>
    </div>`;
  dialog.querySelector('.raid-modal-title').textContent = titleText;
  document.body.appendChild(dialog);
  const close = () => { closeModal(dialog); dialog.remove(); };
  dialog.querySelector('.raid-modal-close').addEventListener('click', close);
  dialog.querySelector('.raid-modal-backdrop').addEventListener('click', () => {
    if (dialog.getAttribute('aria-busy') !== 'true') close();
  });
  onModalCancel(dialog, close);
  return { dialog, body: dialog.querySelector('.signup-modal-body'), close };
}

function selectField(labelText, id) {
  const wrap = document.createElement('div');
  wrap.className = 'signup-field';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = labelText;
  const select = document.createElement('select');
  select.id = id;
  wrap.append(label, select);
  return { wrap, select };
}

let signupGuildClassMap = null;
// Клас/спек персонажа з data/guild-data.json - щоб підставити в форму.
async function guessCharacterClassSpec(name) {
  if (!signupGuildClassMap) {
    signupGuildClassMap = new Map();
    try {
      const res = await fetchSiteData('/data/guild-data.json');
      const data = await res.json();
      (data.rows || []).forEach((row) => {
        if (!signupGuildClassMap.has(row.name)) signupGuildClassMap.set(row.name, { cls: row.class, spec: row.spec });
      });
    } catch (err) {
      console.error(err);
    }
  }
  return signupGuildClassMap.get(name) || null;
}

// opts: { raid, signups?, myDiscordId?, onSaved(newSignups) }
async function openSignupModal(opts) {
  const { raid, onSaved } = opts;
  let signups = opts.signups;
  const [characters, list] = await Promise.all([
    apiCall('GET', '/auth/me/characters', { token: getSessionToken() }).catch(() => []),
    signups ? Promise.resolve(signups) : apiCall('GET', `/raids/${raid.id}/signups`, { token: getSessionToken() })
  ]);
  signups = list;
  const myDiscordId = opts.myDiscordId ?? (typeof currentUser !== 'undefined' && currentUser ? currentUser.discordId : null);
  const mine = myDiscordId ? signups.find((s) => s.discord_id === myDiscordId) : null;

  const { dialog, body, close } = buildSignupDialog(mine ? 'Змінити запис' : 'Записатись на рейд');
  const raidLine = document.createElement('p');
  raidLine.className = 'raid-modal-text';
  const start = raidStartIso(raid);
  const [, m, d] = kyivDateKey(start).split('-');
  raidLine.textContent = `${raid.title} · ${d}.${m} о ${kyivTimeKey(start)}`;
  body.appendChild(raidLine);

  if (!characters.length) {
    const p = document.createElement('p');
    p.className = 'raid-modal-text';
    p.innerHTML = 'У твоєму профілі ще немає персонажів. <a href="/account/">Додай персонажа</a>, щоб записатись.';
    body.appendChild(p);
    openModal(dialog);
    return;
  }

  const form = document.createElement('form');
  form.className = 'signup-form';
  const charF = selectField('Персонаж', 'signupCharacter');
  const classF = selectField('Клас', 'signupClass');
  const specF = selectField('Спек', 'signupSpec');
  const statusF = selectField('Статус', 'signupStatus');
  // Кольори класів - як у списку "Мій персонаж" на сторінці рейду: відомий
  // клас - його колір, невідомий - приглушений.
  await guessCharacterClassSpec('');
  const charColor = (name) => signupClassColor(signupGuildClassMap.get(name)?.cls) || 'var(--color-text-faint)';
  characters.forEach((c) => {
    const opt = new Option(c.characterName, c.characterName);
    opt.style.color = charColor(c.characterName);
    charF.select.add(opt);
  });
  Object.keys(SIGNUP_CLASSES).forEach((cls) => {
    const opt = new Option(signupClassLabel(cls), cls);
    opt.style.color = signupClassColor(cls);
    classF.select.add(opt);
  });
  // Поле персонажа - кольору обраного класу (для персонажа поза даними
  // гільдії клас обирає сам гравець).
  const paintSelects = () => {
    const color = signupClassColor(classF.select.value);
    charF.select.style.color = color;
    classF.select.style.color = color;
  };
  Object.entries(SIGNUP_STATUS_LABELS).forEach(([key, label]) => statusF.select.add(new Option(label, key)));

  const fillSpecs = (preferred) => {
    specF.select.innerHTML = '';
    Object.keys(SIGNUP_CLASSES[classF.select.value].specs).forEach((spec) => specF.select.add(new Option(signupSpecLabel(spec), spec)));
    if (preferred && SIGNUP_CLASSES[classF.select.value].specs[preferred]) specF.select.value = preferred;
  };
  // Клас відомого (з даних гільдії) персонажа фіксований - змінюється лише
  // спек. Вибір класу лишається тільки для персонажа поза даними гільдії.
  const applyGuess = async () => {
    const guess = await guessCharacterClassSpec(charF.select.value);
    const known = Boolean(guess && SIGNUP_CLASSES[guess.cls]);
    classF.select.disabled = known;
    if (known) {
      classF.select.value = guess.cls;
      // Ферал у даних гільдії один - за замовчуванням ведмідь не вгадуємо, кіт.
      // ДК у даних гільдії без ролі: Blood - танк, Frost/Unholy - ДД.
      const dkSpec = { Blood: 'Blood (Tank)', Frost: 'Frost (DPS)', Unholy: 'Unholy (DPS)' };
      fillSpecs(guess.spec === 'Feral Combat' ? 'Feral Combat (Cat)'
        : guess.cls === 'Death Knight' ? dkSpec[guess.spec] : guess.spec);
    } else {
      fillSpecs();
    }
  };

  if (mine) {
    // Запис з Discord: персонаж ще не обраний - лишаємо першого зі списку;
    // клас/спек - з Discord, якщо вони є ("Відсутній" їх не має).
    if (mine.character_name) charF.select.value = mine.character_name;
    const known = await guessCharacterClassSpec(charF.select.value);
    const knownCls = known && SIGNUP_CLASSES[known.cls] ? known.cls : null;
    // Клас із запису - лише якщо він збігається з класом персонажа (або клас
    // персонажа невідомий); інакше - клас і спек персонажа.
    if (mine.class && SIGNUP_CLASSES[mine.class] && (!knownCls || knownCls === mine.class)) {
      classF.select.value = mine.class;
      classF.select.disabled = Boolean(knownCls);
      fillSpecs(mine.spec);
    } else {
      await applyGuess();
    }
    statusF.select.value = mine.status;
  } else {
    statusF.select.value = 'signed';
    await applyGuess();
  }
  paintSelects();
  charF.select.addEventListener('change', async () => { await applyGuess(); paintSelects(); });
  classF.select.addEventListener('change', () => { fillSpecs(); paintSelects(); });

  const actionsRow = document.createElement('div');
  actionsRow.className = 'raid-modal-actions';
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'compare-btn';
  save.textContent = mine ? 'Зберегти' : 'Записатись';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'link-button-std';
  cancel.textContent = 'Скасувати';
  cancel.addEventListener('click', close);
  actionsRow.append(save, cancel);
  form.append(charF.wrap, classF.wrap, specF.wrap, statusF.wrap, actionsRow);
  body.appendChild(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    save.disabled = true;
    setModalBusy(dialog, true);
    try {
      const result = await apiCall('PUT', `/raids/${raid.id}/signups/me`, {
        token: getSessionToken(),
        body: { characterName: charF.select.value, class: classF.select.value, spec: specF.select.value, status: statusF.select.value }
      });
      setModalBusy(dialog, false);
      close();
      onSaved(result);
    } catch (err) {
      setModalBusy(dialog, false);
      save.disabled = false;
      showMessageModal(err.message);
    }
  });

  openModal(dialog);
}

// Лідер/офіцер: змінити статус запису або видалити його.
function openOfficerSignupModal({ raid, signup, onSaved }) {
  const { dialog, body, close } = buildSignupDialog(signupDisplayName(signup));
  const info = document.createElement('p');
  info.className = 'raid-modal-text';
  const classSpec = signup.class ? `${signupClassLabel(signup.class)}, ${signupSpecLabel(signup.spec)} · ` : '';
  const who = signup.owner_display_name || (signup.character_name ? signup.discord_name : '');
  info.textContent = `${classSpec}№${signup.position} · ${SIGNUP_STATUS_LABELS[signup.status]}${who ? ` · ${who}` : ''}`;
  body.appendChild(info);

  const run = async (method, payload) => {
    setModalBusy(dialog, true);
    body.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      const result = await apiCall(method, `/raids/${raid.id}/signups/${signup.id}`, { token: getSessionToken(), body: payload });
      setModalBusy(dialog, false);
      close();
      onSaved(result);
    } catch (err) {
      setModalBusy(dialog, false);
      body.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      showMessageModal(err.message);
    }
  };

  const group = document.createElement('div');
  group.className = 'signup-status-buttons';
  Object.entries(SIGNUP_STATUS_LABELS).forEach(([status, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'raid-toggle-btn';
    if (status === signup.status) btn.classList.add('raid-toggle-btn--active');
    btn.textContent = status === 'signed' ? 'В основу' : label;
    btn.disabled = status === signup.status;
    btn.addEventListener('click', () => run('PATCH', { status }));
    group.appendChild(btn);
  });
  body.appendChild(group);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'raid-modal-actions';
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'link-button-std link-button-std--danger';
  del.textContent = 'Видалити запис';
  del.addEventListener('click', () => run('DELETE'));
  actionsRow.appendChild(del);
  body.appendChild(actionsRow);

  openModal(dialog);
}
