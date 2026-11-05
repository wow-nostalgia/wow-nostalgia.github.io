// Спільні дрібні хелпери для кількох сторінок сайту. Підключати тегом
// <script> ДО файлів, що їх використовують (без бандлера, як і інші
// клієнтські скрипти).

// CSS .tooltipped (::after) обрізається всередині
// body.raid-manager-detail-page .raid-tables-grid .ranking-table-wrap
// (overflow-x:auto змушує браузер обчислити overflow-y як auto теж —
// тултіп над елементом йде за межі скрол-боксу і ховається). На сторінках,
// де є #raidBtnTooltip (зараз: рейд-менеджер, черга на ШМ), треба саме цей
// JS-позиційований тултіп замість класу .tooltipped. aria-label лишається
// джерелом тексту в обох випадках.
const btnTooltipEl = document.getElementById('raidBtnTooltip');

// Модалка-<dialog> малюється в top layer поверх усього документа, тож тултіп,
// що лежить у <body>, під нею не видно. На час показу переносимо його в
// модалку, де стоїть елемент (position: fixed лишається відносно вікна).
function moveTooltipNear(tooltipEl, anchorEl) {
  const host = anchorEl.closest('dialog[open]') || document.body;
  if (tooltipEl.parentElement !== host) host.appendChild(tooltipEl);
}

function showBtnTooltip(el) {
  if (!btnTooltipEl) return;
  moveTooltipNear(btnTooltipEl, el);
  btnTooltipEl.textContent = el.getAttribute('aria-label') || '';
  btnTooltipEl.hidden = false;
  const rect = el.getBoundingClientRect();
  const tipRect = btnTooltipEl.getBoundingClientRect();
  let x = rect.left + rect.width / 2 - tipRect.width / 2;
  let y = rect.top - tipRect.height - 8;
  if (y < 0) y = rect.bottom + 8;
  x = Math.max(4, Math.min(x, window.innerWidth - tipRect.width - 4));
  btnTooltipEl.style.left = `${x}px`;
  btnTooltipEl.style.top = `${y}px`;
}

function hideBtnTooltip() {
  if (!btnTooltipEl) return;
  btnTooltipEl.hidden = true;
}

// Прив'язує JS-позиційований тултіп. Викликай на сторінках з #raidBtnTooltip
// (bindTooltip тихо не робить нічого, якщо його нема в DOM) — інакше просто
// клади клас .tooltipped, CSS-варіант спрацює сам.
function bindTooltip(el) {
  el.addEventListener('mouseenter', () => showBtnTooltip(el));
  el.addEventListener('mouseleave', hideBtnTooltip);
  el.addEventListener('focus', () => showBtnTooltip(el));
  el.addEventListener('blur', hideBtnTooltip);
}

// Автовибір механізму тултіпа для спільних хелперів нижче (createPlayerBadge,
// createResourceIcon): якщо на сторінці є #raidBtnTooltip - JS bindTooltip
// (коректно працює під overflow-x:auto клипаючих таблиць), інакше - звичайний
// CSS .tooltipped. Це прибирає крок "не забудь викликати bindTooltip руками",
// через який один і той самий баг (нативний title / обрізаний CSS-тултіп)
// повторювався кілька разів - див. ui-consistency SKILL.md, розділ "Тултіпи".
function applyAutoTooltip(el) {
  if (btnTooltipEl) {
    bindTooltip(el);
  } else {
    el.classList.add('tooltipped');
  }
}

// Бейдж гільдієць/легіонер. Очікує глобальну змінну guildMemberNames
// (Set з іменами гільдії), яку кожна сторінка заповнює сама зі свого
// data/players.json.
function createPlayerBadge(name) {
  const isGuild = guildMemberNames.has(name);
  const badge = document.createElement('span');
  badge.className = `player-badge ${isGuild ? 'player-badge--guild' : 'player-badge--legion'}`;
  badge.setAttribute('aria-label', isGuild ? 'Ностальгія' : 'Легіонер');
  badge.textContent = isGuild ? 'N' : 'L';
  applyAutoTooltip(badge);
  return badge;
}

// Той самий бейдж, але як HTML-рядок — для сторінок, що рендерять таблиці
// через template strings (потрібен escapeHtml з відповідного файлу).
function createPlayerBadgeHtml(name) {
  const isGuild = guildMemberNames.has(name);
  const cls = isGuild ? 'player-badge--guild' : 'player-badge--legion';
  const title = isGuild ? 'Ностальгія' : 'Легіонер';
  const letter = isGuild ? 'N' : 'L';
  return `<span class="player-badge tooltipped ${cls}" aria-label="${title}">${letter}</span>`;
}

// Іконки ресурсів "Черга на уламки та кров" — кристал (уламки) і крапля
// (кров). Спільні для самої сторінки shard-queue/ (заголовки розділів) і
// сторінки рейду (біля імені гравця, який записаний у чергу відповідного
// дня, — raid-manager-detail.js).
const RESOURCE_ICON_LABELS = { blood: 'Кров', shard: 'Уламки' };
const RESOURCE_ICON_PATHS = {
  shard: 'M8 1 13 6 8 15 3 6Z',
  blood: 'M8 1.3C8 1.3 3 8 3 10.8a5 5 0 0 0 10 0C13 8 8 1.3 8 1.3Z'
};

function createResourceIcon(resourceType, title) {
  const wrap = document.createElement('span');
  wrap.className = `resource-icon-wrap resource-icon-wrap--${resourceType}`;
  if (title) {
    wrap.setAttribute('aria-label', title);
    applyAutoTooltip(wrap);
  }
  wrap.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="${RESOURCE_ICON_PATHS[resourceType]}"/></svg>`;
  return wrap;
}

// Іконки заклинань "Черги на посилення" — з того ж CDN Wowhead, що й іконки
// предметів на сторінці рейду. Спільні для сторінки черги (buff-queue.js) і
// вкладки "Предмети" рейду (raid-manager-detail.js). Тип посилення — довільна
// назва з налаштувань черги, тож іконку шукаємо за назвою; у типу без
// відповідності іконки немає.
const BUFF_TYPE_ICONS = {
  'істерія': 'spell_deathknight_bladedarmor',
  'надання сил': 'spell_holy_powerinfusion'
};

function buffTypeIconUrl(label) {
  const icon = BUFF_TYPE_ICONS[String(label).trim().toLocaleLowerCase('uk')];
  return icon ? `https://wow.zamimg.com/images/wow/icons/small/${icon}.jpg` : null;
}

// Іконка посилення з номером у черзі в правому нижньому куті — як лічильник
// стаку в WoW. buffed — гравець уже посилений (зелена рамка). Посилення без
// відомої іконки — порожній квадратик, щоб номер усе одно було видно.
function createBuffQueueIcon(label, position, tooltip, buffed) {
  const wrap = document.createElement('span');
  wrap.className = 'buff-queue-icon' + (buffed ? ' buff-queue-icon--buffed' : '');
  const url = buffTypeIconUrl(label);
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    wrap.appendChild(img);
  } else {
    wrap.classList.add('buff-queue-icon--no-image');
  }
  const num = document.createElement('span');
  num.className = 'buff-queue-icon-num';
  num.textContent = String(position);
  wrap.appendChild(num);
  wrap.setAttribute('aria-label', tooltip);
  applyAutoTooltip(wrap);
  return wrap;
}

// Фільтр "Період" для графіків по датах рейдів ("Гільдійська аналітика",
// "Фаст-ран аналітика"). Пункти — роки, що є в даних, плюс поточний
// календарний рік (за Києвом, він же за замовчуванням, навіть якщо рейдів
// у ньому ще немає), від новішого до старішого, і "Всі роки" (value "").
// Дати — ISO "YYYY-MM-DD".
function currentKyivYear() {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Kyiv', year: 'numeric' }).format(new Date());
}

function populateYearSelect(selectEl, dates) {
  const currentYear = currentKyivYear();
  const years = new Set([currentYear]);
  dates.forEach((date) => {
    const year = String(date || '').slice(0, 4);
    if (/^\d{4}$/.test(year)) years.add(year);
  });
  selectEl.innerHTML = '';
  [...years].sort((a, b) => b.localeCompare(a)).forEach((year) => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    selectEl.appendChild(option);
  });
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'Всі роки';
  selectEl.appendChild(allOption);
  selectEl.value = currentYear;
}

// year — значення з populateYearSelect ("" — усі роки).
function filterByYear(items, year) {
  if (!year) return items;
  return items.filter((item) => String(item.date || '').startsWith(`${year}-`));
}

const SCORE_TIERS = [
  { min: 90, medal: '🥇' },
  { min: 80, medal: '🥈' },
  { min: 70, medal: '🥉' }
];

function getScoreTier(score) {
  const num = Number(score);
  if (!Number.isFinite(num)) return null;
  return SCORE_TIERS.find((tier) => num > tier.min) || null;
}

// Іконка-глобус для компактного заголовка "Рейтинг сервера" (замість
// повного тексту в шапці таблиці) - спільна для "Рейтинг DPS" і табу "Лог".
const RANK_HEADER_ICON_SVG = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.78 8.75a9.64 9.64 0 0 0 1.363 4.177c.255.426.542.832.857 1.215.245-.296.551-.705.857-1.215A9.64 9.64 0 0 0 10.22 8.75Zm4.44-1.5a9.64 9.64 0 0 0-1.363-4.177c-.307-.51-.612-.919-.857-1.215a9.927 9.927 0 0 0-.857 1.215A9.64 9.64 0 0 0 5.78 7.25Zm-5.944 1.5H1.543a6.507 6.507 0 0 0 4.666 5.5c-.123-.181-.24-.365-.352-.552-.715-1.192-1.437-2.874-1.581-4.948Zm-2.733-1.5h2.733c.144-2.074.866-3.756 1.58-4.948.12-.197.237-.381.353-.552a6.507 6.507 0 0 0-4.666 5.5Zm10.181 1.5c-.144 2.074-.866 3.756-1.58 4.948-.12.197-.237.381-.353.552a6.507 6.507 0 0 0 4.666-5.5Zm2.733-1.5a6.507 6.507 0 0 0-4.666-5.5c.123.181.24.365.353.552.714 1.192 1.436 2.874 1.58 4.948Z"/></svg>';

// Степінь зміни рейтингу сервера з попереднього оновлення guild-data.json
// (стиль тенісних рейтингів: +N зелене - піднявся, -N червоне - опустився,
// нічого - без змін). row - об'єкт з полями overallRank/rankDelta (рядок
// guild-data.json або еквівалент). Використовується на "Рейтинг DPS"
// (guild-ranking.js) і в табі "Лог" рейд-менеджера (raid-manager-detail.js).
function renderRankCell(td, row) {
  td.textContent = row?.overallRank ?? '';
  const delta = Number(row?.rankDelta);
  if (!Number.isFinite(delta) || delta === 0) return;

  const badge = document.createElement('span');
  badge.className = `rank-delta ${delta > 0 ? 'rank-delta--up' : 'rank-delta--down'}`;
  badge.textContent = delta > 0 ? `+${delta}` : `${delta}`;
  td.appendChild(badge);
}

function formatDateTimeKyiv(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(date);
}

function formatDateKyiv(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

// --- Дата й час початку рейду (raids.starts_at, UTC ISO) ---
// Рейди плануються за київським часом, незалежно від часового поясу
// браузера. Старі рейди без starts_at - за часом створення.
function raidStartIso(raid) {
  return raid.starts_at || raid.created_at;
}

// Статус для відображення: до часу початку незавершений рейд - "Запланований",
// з часу початку (коли відкриваються софти) - "Активний". У БД статус лише
// active/completed; "запланований" рахується з starts_at.
function raidDisplayStatus(raid) {
  if (raid.status === 'completed') return { key: 'completed', label: 'Завершений' };
  if (raid.starts_at && Date.now() < Date.parse(raid.starts_at)) return { key: 'planned', label: 'Запланований' };
  return { key: 'active', label: 'Активний' };
}

function raidStatusChip(raid) {
  const { key, label } = raidDisplayStatus(raid);
  const chip = document.createElement('span');
  chip.className = `raid-chip raid-chip--${key}`;
  chip.textContent = label;
  return chip;
}

// 'YYYY-MM-DD' за Києвом.
function kyivDateKey(dateOrIso) {
  const date = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// 'HH:MM' за Києвом.
function kyivTimeKey(dateOrIso) {
  const date = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

// Зсув Києва від UTC у хвилинах на момент date (+120 узимку, +180 улітку).
function kyivOffsetMinutes(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Kyiv', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

// Київські дата ('YYYY-MM-DD') і час ('HH:MM') -> UTC ISO. Зсув рахуємо двічі:
// поруч із переходом на літній/зимовий час перша оцінка може бути хибною.
function kyivLocalToIso(dateKey, timeKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = timeKey.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let ts = naive - kyivOffsetMinutes(new Date(naive)) * 60000;
  ts = naive - kyivOffsetMinutes(new Date(ts)) * 60000;
  return new Date(ts).toISOString();
}

const SPLINE_MODES = {
  smooth: { tension: 0.3, cubicInterpolationMode: 'default', pointRadius: 4, hitRadius: 1 },
  smoothNoPoints: { tension: 0.3, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 },
  linear: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 4, hitRadius: 1 },
  linearNoPoints: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 },
  trend: { tension: 0, cubicInterpolationMode: 'default', pointRadius: 0, hitRadius: 6 }
};

function specKey(entity) {
  return `${entity.class} — ${entity.spec}`;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// "Найкращий результат" — золота іконка кубка (Primer octicon-trophy) біля
// найкращої точки лінійного Chart.js-графіка + підпис у правому нижньому
// куті. Використовується на сторінках "Гільдійська аналітика" та
// "Персональна аналітика". Малюється напряму на canvas (а не HTML-оверлеєм),
// щоб позиція завжди відповідала реальній chartArea незалежно від висоти
// підписів осі X.
const TROPHY_ICON_PATH = 'M3.217 6.962A3.75 3.75 0 0 1 0 3.25v-.5C0 1.784.784 1 1.75 1h1.356c.228-.585.796-1 1.462-1h6.864c.647 0 1.227.397 1.462 1h1.356c.966 0 1.75.784 1.75 1.75v.5a3.75 3.75 0 0 1-3.217 3.712 5.014 5.014 0 0 1-2.771 3.117l.144 1.446c.005.05.03.12.114.204.086.087.217.17.373.227.283.103.618.274.89.568.285.31.467.723.467 1.226v.75h1.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H4v-.75c0-.503.182-.916.468-1.226.27-.294.606-.465.889-.568.139-.048.266-.126.373-.227.084-.085.109-.153.114-.204l.144-1.446a5.015 5.015 0 0 1-2.77-3.117ZM4.5 1.568V5.5a3.5 3.5 0 1 0 7 0V1.568a.068.068 0 0 0-.068-.068H4.568a.068.068 0 0 0-.068.068Zm2.957 8.902-.12 1.204c-.093.925-.858 1.47-1.467 1.691a.766.766 0 0 0-.3.176c-.037.04-.07.093-.07.21v.75h5v-.75c0-.117-.033-.17-.07-.21a.766.766 0 0 0-.3-.176c-.609-.221-1.374-.766-1.466-1.69l-.12-1.204a5.064 5.064 0 0 1-1.087 0ZM13 2.5v2.872a2.25 2.25 0 0 0 1.5-2.122v-.5a.25.25 0 0 0-.25-.25H13Zm-10 0H1.75a.25.25 0 0 0-.25.25v.5c0 .98.626 1.813 1.5 2.122Z';
const TROPHY_ICON_PATH2D = new Path2D(TROPHY_ICON_PATH);

// Кольори медалей за місцем (0 = 1-е місце, 1 = 2-е тощо).
function getMedalColor(rank) {
  return rank === 0 ? cssVar('--color-accent-gold') : '#c0c0c0';
}

const bestResultLabelPlugin = {
  id: 'bestResultLabel',
  afterDraw(chart) {
    const medals = chart.options.plugins?.bestResultLabel?.medals;
    if (!medals || !medals.length) return;

    const { ctx, chartArea } = chart;
    const lineHeight = Chart.defaults.font.size + 4;

    ctx.save();
    ctx.font = `italic ${Chart.defaults.font.size}px ${cssVar('--font-sans')}`;
    ctx.fillStyle = cssVar('--color-text-faint');
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    medals.forEach((medal, i) => {
      ctx.fillText(medal.text, chartArea.right - 4, chartArea.bottom - 4 - i * lineHeight);
    });
    ctx.restore();

    medals.forEach((medal) => {
      if (medal.datasetIndex == null || medal.pointIndex == null) return;

      const point = chart.getDatasetMeta(medal.datasetIndex)?.data?.[medal.pointIndex];
      if (!point) return;

      const iconSize = 14;
      const gap = 6;
      const iconY = medal.iconPosition === 'below' ? point.y + gap : point.y - gap - iconSize;

      ctx.save();
      ctx.translate(point.x - iconSize / 2, iconY);
      ctx.scale(iconSize / 16, iconSize / 16);
      ctx.fillStyle = medal.color || cssVar('--color-accent-gold');
      ctx.fill(TROPHY_ICON_PATH2D);
      ctx.restore();
    });
  }
};
if (typeof Chart !== 'undefined') Chart.register(bestResultLabelPlugin);

const BEST_ICON_CLEARANCE = 24;
const BEST_ICON_HALF_WIDTH = 10;

// layout.padding для Chart.js-опцій графіка, що резервує місце під іконку
// кубка з потрібного боку (і завжди трохи зліва/справа, бо найкраща точка
// може виявитись крайньою в ряду дат).
function bestIconLayoutPadding(showBestResult, bestIconPosition) {
  if (!showBestResult) return {};

  const vertical = bestIconPosition === 'below' ? { bottom: BEST_ICON_CLEARANCE } : { top: BEST_ICON_CLEARANCE };
  return { ...vertical, left: BEST_ICON_HALF_WIDTH, right: BEST_ICON_HALF_WIDTH };
}

// points: масив { value, date, ... }. isBetter(a, b) — чи значення a краще за b.
function findBestPoint(points, isBetter) {
  if (!points.length) return null;

  let bestIndex = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (isBetter(points[i].value, points[bestIndex].value)) bestIndex = i;
  }
  return { point: points[bestIndex], index: bestIndex };
}

// formatDateLabel — очікується вже визначеною на сторінці, що підключає цей файл.
function formatBestResultText(point, formatValue) {
  return `Найкращий результат: ${formatValue(point.value)} (${formatDateLabel(point.date)})`;
}

// Персонаж міг перейменуватись кілька разів поспіль (A -> B -> C) - йдемо
// ланцюжком до останньої ланки. Той самий алгоритм, що resolveCharacterAlias
// у scripts/shared.js (Node), продубльований тут для браузера (немає
// спільного модуля між Node-скриптами й <script>-тегами на цьому сайті).
function resolveCharacterAliasChain(name, aliasMap) {
  const visited = new Set();
  let current = name;
  while (aliasMap.has(current) && !visited.has(current)) {
    visited.add(current);
    current = aliasMap.get(current).canonical;
  }
  return current;
}

// Резолвить перейменування персонажів у сирих рейд-записах ([{..., players:
// [{name, ...}]}] — формат potion-stats.json/personal-stats.json/raid-rosters.json)
// одразу після fetch, до того як сторінка почне власну агрегацію по імені.
// aliasMap: Map<стареІм'я, {canonical}> з /data/character-aliases.json.
// Мутує records на місці й повертає той самий масив (для чейнінгу).
function applyCharacterAliases(records, aliasMap) {
  if (!aliasMap || aliasMap.size === 0) return records;

  for (const record of records || []) {
    if (!Array.isArray(record.players)) continue;
    for (const player of record.players) {
      player.name = resolveCharacterAliasChain(player.name, aliasMap);
    }
  }

  return records;
}

// Вкладки .raid-tab усередині [role="tablist"] за патерном WAI-ARIA Tabs:
// role="tab" і aria-selected для скрінрідерів, одна зупинка Tab на весь
// ряд (активна вкладка), стрілки ←/→ і Home/End - між видимими вкладками.
// Перемикає вкладку Enter/пробіл (ручна активація): вкладки рейду й черг
// підвантажують дані, і перегортання стрілками слало б зайві запити.
// Викликати після кожної зміни активної вкладки або перемальовування ряду.
function syncTabs(tablist) {
  const tabs = [...tablist.querySelectorAll('.raid-tab')];
  const active = tabs.find((t) => t.classList.contains('raid-tab--active'));
  tabs.forEach((tab) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(tab === active));
    tab.tabIndex = tab === active ? 0 : -1;
  });
  if (!tablist.dataset.tabsKeyboard) {
    tablist.dataset.tabsKeyboard = 'true';
    tablist.addEventListener('keydown', moveTabFocus);
  }
}

function moveTabFocus(event) {
  const tabs = [...event.currentTarget.querySelectorAll('.raid-tab')].filter((t) => !t.hidden);
  const index = tabs.indexOf(document.activeElement);
  if (index === -1) return;
  const target = {
    ArrowRight: tabs[(index + 1) % tabs.length],
    ArrowLeft: tabs[(index - 1 + tabs.length) % tabs.length],
    Home: tabs[0],
    End: tabs[tabs.length - 1]
  }[event.key];
  if (!target) return;
  event.preventDefault();
  target.focus();
}

// Дані сайту з /data/*.json. cache: 'no-cache' - браузер щоразу питає
// сервер, чи файл змінився (ETag), і отримує 304 без тіла, якщо ні: великі
// файли (personal-stats.json) не завантажуються заново на кожному відкритті.
// Раніше тут був ?t=Date.now(), що обходив і кеш CDN GitHub Pages; без нього
// CDN може віддавати попередню версію до ~10 хв після оновлення даних
// (Cache-Control: max-age=600) - для нічного оновлення це некритично.
function fetchSiteData(path) {
  return fetch(path, { cache: 'no-cache' });
}

// Модалки сайту - <dialog> + showModal(): браузер сам робить сторінку
// позаду недоступною, тримає фокус усередині, закриває по Escape і повертає
// фокус на кнопку, що відкрила.
function openModal(modal) {
  if (!modal.open) modal.showModal();
}

function closeModal(modal) {
  modal.close();
}

function isModalOpen(modal) {
  return modal.open;
}

// Escape на <dialog> веде через ту саму функцію, що й "Скасувати"/хрестик,
// щоб стан форми чи підтвердження скидався однаково. Поки триває запит
// (setModalBusy), Escape ігноруємо — модалка не зникає посеред дії.
function onModalCancel(modal, handler) {
  modal.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (modal.getAttribute('aria-busy') === 'true') return;
    handler();
  });
}

function setModalBusy(modal, busy) {
  if (busy) modal.setAttribute('aria-busy', 'true');
  else modal.removeAttribute('aria-busy');
}

// Попап "Інфо" біля заголовка сторінки (черги на уламки й на посилення):
// короткий опис інструмента живе тут, а не під заголовком, щоб не займати
// місце на сторінці. Відкривається кнопкою, закривається хрестиком, кліком
// по фону чи Escape. На сторінках без #infoBtn нічого не робить.
function bindInfoModal() {
  const btn = document.getElementById('infoBtn');
  const modal = document.getElementById('infoModal');
  if (!btn || !modal) return;

  const close = () => {
    closeModal(modal);
    btn.focus();
  };
  btn.addEventListener('click', () => openModal(modal));
  document.getElementById('infoModalCloseBtn').addEventListener('click', close);
  document.getElementById('infoModalBackdrop').addEventListener('click', close);
  onModalCancel(modal, close);
}

bindInfoModal();

// Повідомлення у стилі сайту замість нативного alert(): той самий .raid-modal,
// що й інші попапи. Розмітку створюємо один раз на першому виклику, тож
// сторінкам не треба нічого додавати в HTML.
let messageModalEl = null;

function showMessageModal(text, title = 'Повідомлення') {
  if (!messageModalEl) {
    // role="alertdialog" на самому <dialog> дозволений і точніший за
    // вбудований role="dialog": це повідомлення, що вимагає реакції.
    messageModalEl = document.createElement('dialog');
    messageModalEl.className = 'raid-modal';
    messageModalEl.setAttribute('role', 'alertdialog');
    messageModalEl.setAttribute('aria-labelledby', 'messageModalTitle');
    messageModalEl.setAttribute('aria-describedby', 'messageModalText');
    messageModalEl.innerHTML = `
      <div class="raid-modal-backdrop"></div>
      <div class="raid-modal-box">
        <button type="button" class="raid-modal-close" aria-label="Закрити">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>
        </button>
        <h3 class="raid-modal-title" id="messageModalTitle"></h3>
        <p class="raid-modal-text" id="messageModalText"></p>
        <div class="raid-modal-actions">
          <button type="button" class="compare-btn">OK</button>
        </div>
      </div>`;
    const close = () => closeModal(messageModalEl);
    messageModalEl.querySelector('.raid-modal-backdrop').addEventListener('click', close);
    messageModalEl.querySelector('.raid-modal-close').addEventListener('click', close);
    messageModalEl.querySelector('.compare-btn').addEventListener('click', close);
    document.body.appendChild(messageModalEl);
  }
  messageModalEl.querySelector('.raid-modal-title').textContent = title;
  messageModalEl.querySelector('.raid-modal-text').textContent = text;
  openModal(messageModalEl);
  messageModalEl.querySelector('.compare-btn').focus();
}
