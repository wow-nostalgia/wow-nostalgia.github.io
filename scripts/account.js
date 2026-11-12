const loggedOutView = document.getElementById('loggedOutView');
const loggedInView = document.getElementById('loggedInView');
const accountLoading = document.getElementById('accountLoading');
const loginBtn = document.getElementById('loginBtn');
const profileAvatar = document.getElementById('profileAvatar');
const profileUsername = document.getElementById('profileUsername');
const profileDiscordId = document.getElementById('profileDiscordId');
const logoutBtn = document.getElementById('logoutBtn');
const charactersList = document.getElementById('charactersList');
const addCharacterForm = document.getElementById('addCharacterForm');
const characterNameInput = document.getElementById('characterNameInput');
const accountStatus = document.getElementById('accountStatus');
const accountTabs = document.getElementById('accountTabs');
const accountTabPane = document.getElementById('accountTabPane');
const settingsTabPane = document.getElementById('settingsTabPane');
const settingsStatus = document.getElementById('settingsStatus');
const adminTabPane = document.getElementById('adminTabPane');
const adminTabBtn = document.getElementById('adminTabBtn');
const adminRemoveCharacterForm = document.getElementById('adminRemoveCharacterForm');
const adminCharacterNameInput = document.getElementById('adminCharacterNameInput');
const adminCharacterStatus = document.getElementById('adminCharacterStatus');
const defaultOfficerInput = document.getElementById('defaultOfficerInput');
const defaultOfficerList = document.getElementById('defaultOfficerList');
const defaultOfficerAddBtn = document.getElementById('defaultOfficerAddBtn');
const defaultOfficersList = document.getElementById('defaultOfficersList');
const defaultOfficersStatus = document.getElementById('defaultOfficersStatus');
const deleteCharacterModal = document.getElementById('deleteCharacterModal');
const deleteCharacterModalBackdrop = document.getElementById('deleteCharacterModalBackdrop');
const deleteCharacterModalText = document.getElementById('deleteCharacterModalText');
const deleteCharacterConfirmBtn = document.getElementById('deleteCharacterConfirmBtn');
const deleteCharacterCancelBtn = document.getElementById('deleteCharacterCancelBtn');
const firstCharacterModal = document.getElementById('firstCharacterModal');
const firstCharacterModalBackdrop = document.getElementById('firstCharacterModalBackdrop');
const firstCharacterCloseBtn = document.getElementById('firstCharacterCloseBtn');
const soundNotificationsInput = document.getElementById('soundNotificationsInput');
const soundVolumeInput = document.getElementById('soundVolumeInput');
const soundVolumeValue = document.getElementById('soundVolumeValue');
const soundVolumeTestBtn = document.getElementById('soundVolumeTestBtn');
const backgroundGrid = document.getElementById('backgroundGrid');
const backgroundStatus = document.getElementById('backgroundStatus');
const backgroundStatsList = document.getElementById('backgroundStatsList');
const backgroundStatsStatus = document.getElementById('backgroundStatsStatus');

// Останнє успішно збережене значення - щоб відкотити повзунок, якщо PATCH
// не пройшов.
let lastSavedVolume = 70;

function setAccountStatus(text) {
  accountStatus.textContent = text || '';
}

// Окремий статус для вкладки "Налаштування": #accountStatus лишився на
// вкладці "Персонажі" і в момент помилки звуку був би прихований.
function setSettingsStatus(text) {
  settingsStatus.textContent = text || '';
}

async function readErrorMessage(res) {
  try {
    const data = await res.json();
    if (data?.error) return data.error;
  } catch { /* без JSON-тіла */ }
  return `HTTP ${res.status}`;
}

// Зв'язок персонажів профілю зі статичною аналітикою (data/*.json) —
// той самий патерн фетчингу/зіставлення по точному імені, що вже є в
// guild-ranking.js/personal-analytics.js. Без бекенд-змін, чисто фронтенд.
let guildMemberNames = new Set();
let personalAnalyticsNames = new Set();
let classColorMap = new Map();

async function loadCharacterStatsSources() {
  try {
    const [players, personalStats, guildDataRes] = await Promise.all([
      fetchSiteData('/data/players.json').then((r) => r.json()),
      fetchSiteData('/data/personal-stats.json').then((r) => r.json()),
      fetchSiteData('/data/guild-data.json').catch(() => null)
    ]);
    guildMemberNames = new Set(players.map((p) => p.name));
    personalAnalyticsNames = new Set();
    for (const record of personalStats) {
      for (const player of record.players || []) {
        personalAnalyticsNames.add(player.name);
      }
    }
    if (guildDataRes?.ok) {
      const guildData = await guildDataRes.json();
      classColorMap = buildClassColorMap(guildData.rows || []);
    }
  } catch (err) {
    console.error(err);
  }
}

// Ім'я персонажа — лінк на "Персональну аналітику" з префілом цього
// персонажа (?player=...), лише якщо для нього взагалі є дані в логах.
// Інакше — звичайний текст, лінк в нікуди був би плутаниною.
// manualClass - клас, обраний у профілі; діє лише без класу з логів.
function characterNameNode(name, manualClass) {
  const color = classColorMap.get(name) || WOW_CLASS_COLORS[manualClass];
  if (!personalAnalyticsNames.has(name)) {
    if (!color) return document.createTextNode(name);
    const span = document.createElement('span');
    span.textContent = name;
    span.style.color = color;
    return span;
  }
  const link = document.createElement('a');
  link.href = `../personal-analytics/?player=${encodeURIComponent(name)}`;
  link.textContent = name;
  if (color) link.style.color = color;
  return link;
}

// КД рейдів, 10 і 25 (нормал і героїк мають спільний КД; гравець відмічає вручну, щоп'ятниці о 04:00 за Києвом
// воркер їх скидає) і GearScore. Заголовки - за перемикачем мови назв
// (nameLanguage, той самий, що для боссів/предметів).
const COOLDOWN_KEYS = ['icc10', 'icc25', 'rs10', 'rs25'];
const COOLDOWN_LABELS = {
  uk: { icc10: 'КД ЦЛК 10', icc25: 'КД ЦЛК 25', rs10: 'КД РС 10', rs25: 'КД РС 25' },
  en: { icc10: 'Cooldown ICC 10', icc25: 'Cooldown ICC 25', rs10: 'Cooldown RS 10', rs25: 'Cooldown RS 25' }
};

function cooldownLabels() {
  let lang = 'uk';
  try { lang = localStorage.getItem('nameLanguage') === 'en' ? 'en' : 'uk'; } catch { /* дефолт uk */ }
  return COOLDOWN_LABELS[lang];
}

document.querySelectorAll('[data-cd-label]').forEach((th) => {
  th.textContent = cooldownLabels()[th.dataset.cdLabel];
});

async function patchCharacter(name, patch) {
  const res = await fetch(`${AUTH_API_BASE}/auth/me/characters/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSessionToken()}` },
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

function createCooldownCell(name, key, checked) {
  const td = document.createElement('td');
  td.className = 'account-cd-td';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = Boolean(checked);
  checkbox.setAttribute('aria-label', `${cooldownLabels()[key]}: ${name}`);
  checkbox.addEventListener('change', async () => {
    checkbox.disabled = true;
    try {
      await patchCharacter(name, { cooldowns: { [key]: checkbox.checked } });
      setAccountStatus('');
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      setAccountStatus(`Помилка: ${err.message}`);
    } finally {
      checkbox.disabled = false;
    }
  });
  td.appendChild(checkbox);
  return td;
}

// Маска GS "X.X": лише цифри, крапку ставимо самі ("65" -> "6.5").
function formatGearScoreInput(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 2);
  return digits.length === 2 ? `${digits[0]}.${digits[1]}` : digits;
}

function gearScoreText(value) {
  return value == null ? '' : value.toFixed(1);
}

// GS у таблиці лише показується (чіп); змінюється через меню ⋯ -> "Вказати GS".
function createGearScoreCell(gearScore) {
  const td = document.createElement('td');
  td.className = 'account-gs-td';
  if (gearScore == null) {
    td.textContent = '—';
    td.classList.add('account-gs-td--empty');
  } else {
    const chip = document.createElement('span');
    chip.className = 'raid-chip';
    chip.textContent = gearScoreText(gearScore);
    td.appendChild(chip);
  }
  return td;
}

// Меню ⋯ біля імені персонажа: "Обрати клас" -> список класів. Клас із
// логів важливіший, тож для персонажа з логів пункт неактивний. Меню одне
// на сторінку й позиціонується fixed від кнопки - таблиця має overflow-x
// і обрізала б абсолютне меню.
const KEBAB_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/></svg>';
const CHEVRON_LEFT_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06Z"/></svg>';

const characterMenu = document.createElement('div');
characterMenu.className = 'account-char-menu';
characterMenu.setAttribute('role', 'menu');
characterMenu.hidden = true;
document.body.appendChild(characterMenu);
let characterMenuAnchor = null;

function closeCharacterMenu() {
  if (characterMenu.hidden) return;
  characterMenu.hidden = true;
  characterMenuAnchor?.setAttribute('aria-expanded', 'false');
  characterMenuAnchor = null;
}

function positionCharacterMenu() {
  if (!characterMenuAnchor) return;
  const rect = characterMenuAnchor.getBoundingClientRect();
  const width = characterMenu.offsetWidth;
  const height = characterMenu.offsetHeight;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  // Не влазить знизу - відкриваємо над кнопкою.
  const below = rect.bottom + 4;
  const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 4) : below;
  characterMenu.style.left = `${left}px`;
  characterMenu.style.top = `${top}px`;
}

function addCharacterMenuItem({ label, html, color, disabled, hint, onClick, extraClass }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `split-btn__item${extraClass ? ` ${extraClass}` : ''}`;
  btn.setAttribute('role', 'menuitem');
  if (html) btn.innerHTML = html;
  else btn.textContent = label;
  if (color) btn.style.color = color;
  btn.disabled = Boolean(disabled);
  if (hint) {
    const note = document.createElement('span');
    note.className = 'account-char-menu-hint';
    note.textContent = hint;
    btn.appendChild(note);
  }
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  characterMenu.appendChild(btn);
  return btn;
}

async function saveCharacterField(name, patch) {
  closeCharacterMenu();
  try {
    renderCharactersList(await patchCharacter(name, patch));
    setAccountStatus('');
  } catch (err) {
    setAccountStatus(`Помилка: ${err.message}`);
  }
}

async function setCharacterPrimary(name, primary) {
  closeCharacterMenu();
  try {
    const res = await fetch(`${AUTH_API_BASE}/auth/me/characters/${encodeURIComponent(name)}/primary`, {
      method: primary ? 'POST' : 'DELETE',
      headers: { Authorization: `Bearer ${getSessionToken()}` }
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    renderCharactersList(await res.json());
    setAccountStatus('');
  } catch (err) {
    setAccountStatus(`Помилка: ${err.message}`);
  }
}

function showCharacterMenuRoot(character) {
  characterMenu.innerHTML = '';
  const fromLogs = classColorMap.has(character.characterName);
  addCharacterMenuItem({
    label: 'Обрати клас',
    disabled: fromLogs,
    hint: fromLogs ? 'визначено з логів' : '',
    onClick: () => showCharacterMenuClasses(character)
  });
  addCharacterMenuItem({ label: 'Вказати GS', onClick: () => showCharacterMenuGearScore(character) });
  // Основний може бути лише один - сервер сам знімає прапорець з інших.
  addCharacterMenuItem(character.isPrimary
    ? { label: 'Зняти «Основний»', onClick: () => setCharacterPrimary(character.characterName, false) }
    : { label: 'Зробити основним', onClick: () => setCharacterPrimary(character.characterName, true) });
  addCharacterMenuItem({
    label: 'Видалити персонажа',
    extraClass: 'split-btn__item--danger account-char-menu-delete',
    onClick: () => {
      closeCharacterMenu();
      openDeleteCharacterModal(character.characterName);
    }
  });
  positionCharacterMenu();
  characterMenu.querySelector('button:not(:disabled)')?.focus();
}

function addCharacterMenuBack(title, character) {
  addCharacterMenuItem({
    html: `${CHEVRON_LEFT_ICON}<span>${title}</span>`,
    extraClass: 'account-char-menu-back',
    onClick: () => showCharacterMenuRoot(character)
  });
}

// "Вказати GS": поле з маскою X.X + Зберегти (і Очистити, якщо GS уже є).
function showCharacterMenuGearScore(character) {
  const { characterName: name, gearScore } = character;
  characterMenu.innerHTML = '';
  addCharacterMenuBack('Вказати GS', character);

  const form = document.createElement('form');
  form.className = 'account-char-menu-gs';
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.className = 'account-gs-input';
  input.placeholder = '0.0';
  input.maxLength = 3;
  input.setAttribute('aria-label', `GS: ${name}`);
  input.value = gearScoreText(gearScore);
  input.addEventListener('input', () => {
    input.value = formatGearScoreInput(input.value);
  });
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'compare-btn account-char-menu-gs-save';
  saveBtn.textContent = 'Зберегти';
  form.append(input, saveBtn);
  form.addEventListener('click', (event) => event.stopPropagation());
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    let text = input.value;
    // Одна цифра без крапки - це цілі: "7" -> "7.0".
    if (/^\d$/.test(text)) text = `${text}.0`;
    if (!/^\d\.\d$/.test(text)) {
      input.value = formatGearScoreInput(text);
      input.focus();
      return;
    }
    await saveCharacterField(name, { gearScore: Number(text) });
  });
  characterMenu.appendChild(form);

  if (gearScore != null) {
    addCharacterMenuItem({ label: 'Очистити GS', extraClass: 'split-btn__item--danger', onClick: () => saveCharacterField(name, { gearScore: null }) });
  }
  positionCharacterMenu();
  input.focus();
  input.select();
}

function showCharacterMenuClasses(character) {
  const { characterName: name, className } = character;
  characterMenu.innerHTML = '';
  addCharacterMenuBack('Обрати клас', character);
  Object.keys(WOW_CLASS_COLORS).forEach((cls) => {
    const item = addCharacterMenuItem({
      label: translateClass(cls),
      color: WOW_CLASS_COLORS[cls],
      onClick: () => saveCharacterField(name, { className: cls })
    });
    if (cls === className) item.setAttribute('aria-current', 'true');
  });
  if (className) {
    addCharacterMenuItem({ label: 'Скинути клас', extraClass: 'split-btn__item--danger', onClick: () => saveCharacterField(name, { className: null }) });
  }
  positionCharacterMenu();
}

function createCharacterMenuCell(character) {
  const name = character.characterName;
  const td = document.createElement('td');
  td.className = 'account-char-menu-td';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'account-char-menu-btn';
  btn.setAttribute('aria-label', `Дії: ${name}`);
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = KEBAB_ICON;
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    const wasOpenHere = characterMenuAnchor === btn;
    closeCharacterMenu();
    if (wasOpenHere) return;
    characterMenuAnchor = btn;
    btn.setAttribute('aria-expanded', 'true');
    characterMenu.hidden = false;
    showCharacterMenuRoot(character);
  });
  td.appendChild(btn);
  return td;
}

document.addEventListener('click', (event) => {
  if (!characterMenu.contains(event.target)) closeCharacterMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !characterMenu.hidden) {
    const anchor = characterMenuAnchor;
    closeCharacterMenu();
    anchor?.focus();
  }
});
// Поки фокус у полі GS у меню, клавіатура телефона сама скролить/ресайзить
// сторінку - тоді меню не закриваємо, а переставляємо.
const onCharacterMenuViewportChange = () => {
  if (characterMenu.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') positionCharacterMenu();
  else closeCharacterMenu();
};
window.addEventListener('resize', onCharacterMenuViewportChange);
window.addEventListener('scroll', onCharacterMenuViewportChange, true);

// Скільки персонажів у списку зараз - щоб зрозуміти, чи щойно доданий був
// першим (див. обробник addCharacterForm).
let charactersCount = 0;

function renderCharactersList(characters) {
  charactersCount = characters.length;
  charactersList.innerHTML = '';

  if (!characters.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.textContent = 'Ще не додано жодного персонажа.';
    tr.appendChild(td);
    charactersList.appendChild(tr);
    return;
  }

  characters.forEach((character) => {
    const { characterName: name, isPrimary, cooldowns, gearScore, className } = character;
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    const nameWrap = document.createElement('span');
    nameWrap.className = 'account-character-name-cell';
    nameWrap.appendChild(createPlayerBadge(name));
    nameWrap.appendChild(characterNameNode(name, className));
    if (isPrimary) {
      const primaryBadge = document.createElement('span');
      primaryBadge.className = 'primary-character-badge';
      primaryBadge.textContent = 'Основний';
      nameWrap.appendChild(primaryBadge);
    }
    nameTd.appendChild(nameWrap);
    tr.appendChild(nameTd);
    tr.appendChild(createCharacterMenuCell(character));
    tr.appendChild(createGearScoreCell(gearScore));


    COOLDOWN_KEYS.forEach((key) => tr.appendChild(createCooldownCell(name, key, cooldowns?.[key])));

    charactersList.appendChild(tr);
  });
}

function openDeleteCharacterModal(name) {
  deleteCharacterModalText.textContent = `Видалити персонажа "${name}"?`;
  deleteCharacterModal._characterName = name;
  openModal(deleteCharacterModal);
}

deleteCharacterConfirmBtn.addEventListener('click', async () => {
  const name = deleteCharacterModal._characterName;
  deleteCharacterConfirmBtn.disabled = true;
  setModalBusy(deleteCharacterModal, true);
  try {
    const token = getSessionToken();
    const res = await fetch(`${AUTH_API_BASE}/auth/me/characters/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    renderCharactersList(await res.json());
    closeModal(deleteCharacterModal);
  } catch (err) {
    setAccountStatus(`Помилка: ${err.message}`);
  } finally {
    deleteCharacterConfirmBtn.disabled = false;
    setModalBusy(deleteCharacterModal, false);
  }
});

deleteCharacterCancelBtn.addEventListener('click', () => { closeModal(deleteCharacterModal); });
deleteCharacterModalBackdrop.addEventListener('click', () => { closeModal(deleteCharacterModal); });
onModalCancel(deleteCharacterModal, () => closeModal(deleteCharacterModal));

addCharacterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const characterName = characterNameInput.value.trim();
  if (!characterName) return;

  const wasEmpty = charactersCount === 0;

  try {
    const token = getSessionToken();
    const res = await fetch(`${AUTH_API_BASE}/auth/me/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ characterName })
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    renderCharactersList(await res.json());
    characterNameInput.value = '';
    setAccountStatus('');
    // Перший персонаж - підказуємо, що далі йти в рейди.
    if (wasEmpty && charactersCount > 0) openModal(firstCharacterModal);
  } catch (err) {
    setAccountStatus(`Помилка: ${err.message}`);
  }
});

async function savePreferences(patch) {
  const res = await fetch(`${AUTH_API_BASE}/auth/me/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSessionToken()}` },
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

// Повзунок гучності має сенс лише коли звук увімкнено.
function applySoundPrefsState() {
  const enabled = soundNotificationsInput.checked;
  soundVolumeInput.disabled = !enabled;
  soundVolumeTestBtn.disabled = !enabled;
}

function renderVolumeValue() {
  soundVolumeValue.textContent = `${soundVolumeInput.value}%`;
}

soundNotificationsInput.addEventListener('change', async () => {
  const enabled = soundNotificationsInput.checked;
  soundNotificationsInput.disabled = true;
  applySoundPrefsState();

  try {
    await savePreferences({ soundNotifications: enabled });
    setSettingsStatus('');
  } catch (err) {
    // Повертаємо чекбокс у попередній стан, щоб він не показував те, чого
    // насправді не збережено.
    soundNotificationsInput.checked = !enabled;
    applySoundPrefsState();
    setSettingsStatus(`Помилка: ${err.message}`);
  } finally {
    soundNotificationsInput.disabled = false;
  }
});

// input - лише оновлення підпису (тягнеться безперервно під час руху),
// збереження на change, тобто коли повзунок відпустили.
soundVolumeInput.addEventListener('input', renderVolumeValue);

soundVolumeInput.addEventListener('change', async () => {
  const volume = Number(soundVolumeInput.value);

  try {
    await savePreferences({ soundVolume: volume });
    lastSavedVolume = volume;
    setSettingsStatus('');
  } catch (err) {
    soundVolumeInput.value = lastSavedVolume;
    renderVolumeValue();
    setSettingsStatus(`Помилка: ${err.message}`);
  }
});

// Клік по кнопці сам розблоковує аудіо для сторінки, тож перевірка працює
// навіть якщо гравець досі нічого не натискав.
soundVolumeTestBtn.addEventListener('click', () => {
  const audio = new Audio('/sounds/transfer-received.mp3');
  audio.volume = Number(soundVolumeInput.value) / 100;
  audio.play().catch(() => setSettingsStatus('Не вдалося відтворити звук.'));
});

// --- Фон сайту ---------------------------------------------------------
// Значення: null - стандартний фон, 'none' - без фону, інакше ім'я файлу з
// images/backgrounds/. Застосування й кеш - у scripts/background.js.

let backgroundChoices = [];
let currentBackground = null;

async function loadBackgroundChoices() {
  // no-store, як у галереї: маніфест переписується скриптом при додаванні
  // фонів, і CDN GitHub Pages інакше віддає старий список.
  const res = await fetch(BACKGROUNDS_MANIFEST_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function createBackgroundCard({ value, title, thumb }) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'account-bg-card';
  card.dataset.background = value ?? '';
  card.setAttribute('aria-pressed', String(value === currentBackground));
  if (value === currentBackground) card.classList.add('account-bg-card--active');

  if (thumb) {
    const img = document.createElement('img');
    img.className = 'account-bg-card__img';
    img.src = thumb;
    img.alt = '';
    img.loading = 'lazy';
    card.appendChild(img);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'account-bg-card__img account-bg-card__img--empty';
    card.appendChild(placeholder);
  }

  const caption = document.createElement('span');
  caption.className = 'account-bg-card__title';
  caption.textContent = title;
  card.appendChild(caption);

  return card;
}

function renderBackgroundGrid() {
  backgroundGrid.innerHTML = '';

  // Стандартний фон зберігаємо як null, а не як 'default.jpg': тоді сайт
  // завжди показує те, що зараз лежить у CSS, навіть якщо файл колись
  // заміниться на інший.
  for (const item of backgroundChoices) {
    backgroundGrid.appendChild(createBackgroundCard({
      value: item.isDefault ? null : item.file,
      title: item.title,
      thumb: item.thumb
    }));
  }

  backgroundGrid.appendChild(createBackgroundCard({ value: BACKGROUND_NONE, title: 'Без фону', thumb: null }));
}

async function selectBackground(value) {
  if (value === currentBackground) return;

  const previous = currentBackground;
  currentBackground = value;
  // Показуємо результат одразу — фон видно прямо за сторінкою профілю.
  setBackground(value);
  renderBackgroundGrid();
  backgroundStatus.textContent = '';

  try {
    await savePreferences({ background: value });
  } catch (err) {
    currentBackground = previous;
    setBackground(previous);
    renderBackgroundGrid();
    backgroundStatus.textContent = `Не вдалося зберегти: ${err.message}`;
  }
}

backgroundGrid.addEventListener('click', (event) => {
  const card = event.target.closest('.account-bg-card');
  if (!card) return;
  selectBackground(card.dataset.background || null);
});

// Тема сайту — як фон: застосовуємо одразу, зберігаємо в акаунті, при
// помилці відкочуємо. setSiteTheme/getSiteTheme — з scripts/background.js
// (підключений у <head>).
function initThemeToggle(user) {
  const toggle = document.getElementById('themeToggle');
  const status = document.getElementById('themeStatus');
  const serverTheme = user.theme ?? 'default';
  if (serverTheme !== getSiteTheme()) setSiteTheme(serverTheme);
  const render = () => {
    const current = getSiteTheme();
    toggle.querySelectorAll('[data-theme-value]').forEach((btn) => {
      const active = btn.dataset.themeValue === current;
      btn.classList.toggle('account-lang-toggle-btn--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  };
  toggle.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-theme-value]');
    if (!btn) return;
    const value = btn.dataset.themeValue;
    const previous = getSiteTheme();
    if (value === previous) return;
    setSiteTheme(value);
    render();
    status.textContent = '';
    try {
      await savePreferences({ theme: value === 'default' ? null : value });
    } catch (err) {
      setSiteTheme(previous);
      render();
      status.textContent = `Не вдалося зберегти: ${err.message}`;
    }
  });
  render();
}

async function initBackgrounds(user) {
  currentBackground = user.background ?? null;

  try {
    backgroundChoices = await loadBackgroundChoices();
  } catch (err) {
    backgroundStatus.textContent = `Не вдалося завантажити список фонів: ${err.message}`;
    return;
  }

  // Фон могли прибрати з репозиторію після того, як його хтось обрав —
  // тоді в акаунті лишається мертве ім'я файлу. Мовчки повертаємо на
  // стандартний, щоб профіль не показував активною неіснуючу картку.
  const known = currentBackground === null
    || currentBackground === BACKGROUND_NONE
    || backgroundChoices.some((item) => item.file === currentBackground);

  if (!known) {
    currentBackground = null;
    setBackground(null);
    savePreferences({ background: null }).catch(() => { /* не критично, полагодиться при наступному виборі */ });
  }

  renderBackgroundGrid();
}

firstCharacterCloseBtn.addEventListener('click', () => { closeModal(firstCharacterModal); });
firstCharacterModalBackdrop.addEventListener('click', () => { closeModal(firstCharacterModal); });

adminRemoveCharacterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const characterName = adminCharacterNameInput.value.trim();
  if (!characterName) return;

  try {
    const token = getSessionToken();
    const res = await fetch(`${AUTH_API_BASE}/admin/characters/${encodeURIComponent(characterName)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    const { removedFromDiscordId } = await res.json();
    adminCharacterStatus.textContent = removedFromDiscordId
      ? `Звільнено. Тримав акаунт Discord ID ${removedFromDiscordId}.`
      : 'Цього персонажа ніхто не тримав.';
    adminCharacterNameInput.value = '';
  } catch (err) {
    adminCharacterStatus.textContent = `Помилка: ${err.message}`;
  }
});

function renderDefaultOfficers(officers) {
  defaultOfficersList.innerHTML = '';
  if (!officers.length) {
    const li = document.createElement('li');
    li.className = 'account-default-officers-empty';
    li.textContent = 'Список порожній.';
    defaultOfficersList.appendChild(li);
    return;
  }
  officers.forEach(({ discord_id, display_name }) => {
    const li = document.createElement('li');
    li.className = 'account-default-officer-item';
    const name = document.createElement('span');
    name.textContent = display_name;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'account-delete-btn';
    removeBtn.setAttribute('aria-label', "Видалити");
    removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
    removeBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`${AUTH_API_BASE}/admin/default-officers/${encodeURIComponent(discord_id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${getSessionToken()}` }
        });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        renderDefaultOfficers(await res.json());
      } catch (err) {
        defaultOfficersStatus.textContent = `Помилка: ${err.message}`;
      }
    });
    li.appendChild(name);
    li.appendChild(removeBtn);
    defaultOfficersList.appendChild(li);
  });
}

function initDefaultOfficersAutocomplete() {
  let selectedDiscordId = null;
  let debounceTimer = null;

  function closeList() {
    defaultOfficerList.innerHTML = '';
    defaultOfficerList.classList.remove('is-open');
  }

  function selectUser(discordId, username) {
    selectedDiscordId = discordId;
    defaultOfficerInput.value = username;
    defaultOfficerAddBtn.disabled = false;
    closeList();
  }

  defaultOfficerInput.addEventListener('input', () => {
    selectedDiscordId = null;
    defaultOfficerAddBtn.disabled = true;
    clearTimeout(debounceTimer);
    const q = defaultOfficerInput.value.trim();
    if (!q) { closeList(); return; }
    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`${AUTH_API_BASE}/auth/users?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${getSessionToken()}` }
        });
        const users = await res.json();
        defaultOfficerList.innerHTML = '';
        if (!users.length) { closeList(); return; }
        users.slice(0, 8).forEach((u) => {
          const item = document.createElement('div');
          item.className = 'raid-autocomplete-item';
          item.textContent = u.username;
          item.addEventListener('mousedown', (e) => { e.preventDefault(); selectUser(u.discordId, u.username); });
          defaultOfficerList.appendChild(item);
        });
        defaultOfficerList.classList.add('is-open');
      } catch { closeList(); }
    }, 200);
  });

  defaultOfficerInput.addEventListener('blur', () => setTimeout(closeList, 150));

  defaultOfficerAddBtn.addEventListener('click', async () => {
    if (!selectedDiscordId) return;
    defaultOfficerAddBtn.disabled = true;
    try {
      const res = await fetch(`${AUTH_API_BASE}/admin/default-officers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSessionToken()}` },
        body: JSON.stringify({ discordId: selectedDiscordId })
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      renderDefaultOfficers(await res.json());
      defaultOfficerInput.value = '';
      selectedDiscordId = null;
      defaultOfficersStatus.textContent = '';
    } catch (err) {
      defaultOfficersStatus.textContent = `Помилка: ${err.message}`;
      defaultOfficerAddBtn.disabled = false;
    }
  });
}

async function loadDefaultOfficers() {
  try {
    const res = await fetch(`${AUTH_API_BASE}/admin/default-officers`, {
      headers: { Authorization: `Bearer ${getSessionToken()}` }
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    renderDefaultOfficers(await res.json());
  } catch (err) {
    defaultOfficersStatus.textContent = `Помилка завантаження: ${err.message}`;
  }
}

// Статистика фонів для адмін-панелі. Worker віддає { background, count, names }
// (names — лише для нестандартних фонів); назви фонів беремо з того самого
// маніфесту, що й сітка вибору у "Налаштуваннях".
function renderBackgroundStats(stats, choices) {
  const byBackground = new Map(stats.map((row) => [row.background ?? null, row]));
  const take = (key) => {
    const row = byBackground.get(key);
    byBackground.delete(key);
    return { count: row?.count || 0, names: row?.names || [] };
  };

  const rows = choices.map((item) => {
    // Стандартний фон зберігається як NULL; явне 'default.jpg' можна
    // записати лише в обхід UI, але рахуємо й його сюди ж.
    if (item.isDefault) {
      return { title: item.title, count: take(null).count + take(item.file).count, names: [] };
    }
    return { title: item.title, ...take(item.file) };
  });
  rows.push({ title: 'Без фону', ...take(BACKGROUND_NONE) });

  // Решта — фони, які прибрали з репозиторію, а в акаунтах вони ще лишились
  // (гравець не заходив у профіль, де вибір сам скидається). Показуємо, щоб
  // ці гравці не зникали зі статистики мовчки.
  for (const [file, row] of byBackground) {
    rows.push({ title: `${file} (файл видалено)`, count: row.count, names: row.names || [] });
  }

  rows.sort((a, b) => b.count - a.count);

  backgroundStatsList.innerHTML = '';
  for (const { title, count, names } of rows) {
    const tr = document.createElement('tr');
    const titleTd = document.createElement('td');
    titleTd.textContent = title;
    const countTd = document.createElement('td');
    countTd.className = 'account-bg-stats-count';
    countTd.textContent = String(count);
    const namesTd = document.createElement('td');
    namesTd.className = 'account-bg-stats-names';
    namesTd.textContent = names.length ? names.join(', ') : '—';
    tr.append(titleTd, countTd, namesTd);
    backgroundStatsList.appendChild(tr);
  }
}

async function loadBackgroundStats() {
  try {
    const [res, choices] = await Promise.all([
      fetch(`${AUTH_API_BASE}/admin/background-stats`, {
        headers: { Authorization: `Bearer ${getSessionToken()}` }
      }),
      backgroundChoices.length ? backgroundChoices : loadBackgroundChoices()
    ]);
    if (!res.ok) throw new Error(await readErrorMessage(res));
    renderBackgroundStats(await res.json(), choices);
    backgroundStatsStatus.textContent = '';
  } catch (err) {
    backgroundStatsStatus.textContent = `Помилка завантаження: ${err.message}`;
  }
}

// Статистика тем (users.theme; NULL - стандартна) - поруч зі статистикою
// фонів. Назви тем - з кнопок перемикача у "Налаштуваннях", щоб не дублювати.
async function loadThemeStats() {
  const list = document.getElementById('themeStatsList');
  const status = document.getElementById('themeStatsStatus');
  try {
    const res = await fetch(`${AUTH_API_BASE}/admin/theme-stats`, {
      headers: { Authorization: `Bearer ${getSessionToken()}` }
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    const stats = await res.json();
    const byTheme = new Map(stats.map((row) => [row.theme ?? 'default', row]));
    const rows = [...document.querySelectorAll('#themeToggle [data-theme-value]')].map((btn) => {
      const row = byTheme.get(btn.dataset.themeValue);
      byTheme.delete(btn.dataset.themeValue);
      return { title: btn.textContent.trim(), count: row?.count || 0, names: row?.names || [] };
    });
    // Тема, якої вже немає в перемикачі, але лишилась в акаунтах.
    for (const [theme, row] of byTheme) rows.push({ title: `${theme} (прибрана)`, count: row.count, names: row.names || [] });
    rows.sort((a, b) => b.count - a.count);

    list.innerHTML = '';
    for (const { title, count, names } of rows) {
      const tr = document.createElement('tr');
      const titleTd = document.createElement('td');
      titleTd.textContent = title;
      const countTd = document.createElement('td');
      countTd.className = 'account-bg-stats-count';
      countTd.textContent = String(count);
      const namesTd = document.createElement('td');
      namesTd.className = 'account-bg-stats-names';
      namesTd.textContent = names.length ? names.join(', ') : '—';
      tr.append(titleTd, countTd, namesTd);
      list.appendChild(tr);
    }
    status.textContent = '';
  } catch (err) {
    status.textContent = `Помилка завантаження: ${err.message}`;
  }
}

// Вихід живе тут, у профілі (раніше — у меню акаунта в навбарі). Після
// перезавантаження сторінка покаже "Увійти через Discord".
logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  await logoutCurrentUser();
  window.location.reload();
});

async function init() {
  loginBtn.href = discordLoginUrl('/account/');

  const user = await fetchCurrentUser();
  accountLoading.hidden = true;

  if (!user) {
    loggedOutView.hidden = false;
    return;
  }

  loggedInView.hidden = false;
  soundNotificationsInput.checked = user.soundNotifications !== false;
  lastSavedVolume = user.soundVolume ?? 50;
  soundVolumeInput.value = lastSavedVolume;
  renderVolumeValue();
  applySoundPrefsState();
  initBackgrounds(user);
  initThemeToggle(user);
  profileUsername.textContent = user.username;
  profileDiscordId.textContent = `Discord ID: ${user.discordId}`;
  if (user.avatar) {
    profileAvatar.src = user.avatar;
    profileAvatar.hidden = false;
  }
  // "Персонажі" й "Налаштування" — у всіх; "Адмін-панель" — лише адміну сайту
  // (Worker однаково пускає в /admin/* тільки ADMIN_DISCORD_ID).
  if (user.isAdmin) {
    adminTabBtn.hidden = false;
    initDefaultOfficersAutocomplete();
  }

  // Дані адмін-панелі тягнемо лише при першому відкритті вкладки.
  let adminDataLoaded = false;
  syncTabs(accountTabs);
  accountTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    accountTabs.querySelectorAll('.raid-tab').forEach((t) => t.classList.remove('raid-tab--active'));
    btn.classList.add('raid-tab--active');
    syncTabs(accountTabs);
    const tab = btn.dataset.tab;
    accountTabPane.hidden = tab !== 'account';
    settingsTabPane.hidden = tab !== 'settings';
    adminTabPane.hidden = tab !== 'admin';
    if (tab === 'admin' && !adminDataLoaded) {
      adminDataLoaded = true;
      loadDefaultOfficers();
      loadBackgroundStats();
      loadThemeStats();
    }
  });

  // Посилання з підказок головної: /account/#settings — одразу "Налаштування".
  if (window.location.hash === '#settings') {
    accountTabs.querySelector('[data-tab="settings"]')?.click();
  }

  await loadCharacterStatsSources();

  try {
    const token = getSessionToken();
    const res = await fetch(`${AUTH_API_BASE}/auth/me/characters`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    renderCharactersList(await res.json());
  } catch (err) {
    setAccountStatus(`Помилка: ${err.message}`);
  }
}

init();
