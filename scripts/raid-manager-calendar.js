// Вкладка "Календар" на сторінці рейдів (/raid-manager/archive/#calendar).
//
// Сітка місяця з понеділка за київським часом. У клітинці дня - плашки
// рейдів (час + назва без дати в кінці); на телефоні замість плашок лише
// кількість, а самі рейди показує панель дня під сіткою (як мобільні
// календарі). Клік по дню обирає його: панель показує рейди дня і кнопку
// "Створити рейд на ДД.ММ" (форма з raid-manager-archive.js з підставленою
// датою; для минулих днів кнопка вимкнена - сервер теж не дасть).
//
// Залежить від: ui-shared.js (kyivDateKey, kyivTimeKey, kyivLocalToIso,
// raidStartIso, syncTabs), raid-manager-shared.js (apiCall),
// raid-manager-archive.js (openCreateRaidModal, addDaysToKey), raid-signups.js
// (openSignupModal, isSignupClosed, SIGNUP_LIMIT, SIGNUP_STATUS_LABELS).

const raidsTabs = document.getElementById('raidsTabs');
const listPane = document.getElementById('listPane');
const calendarPane = document.getElementById('calendarPane');
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const calendarDayTitle = document.getElementById('calendarDayTitle');
const calendarDayList = document.getElementById('calendarDayList');
const calendarCreateBtn = document.getElementById('calendarCreateBtn');
const calendarCreateLabel = document.getElementById('calendarCreateLabel');
const calendarStatus = document.getElementById('calendarStatus');

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTH_FMT = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const DAY_TITLE_FMT = new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

let calendarMonth = null; // 'YYYY-MM'
let selectedDay = null; // 'YYYY-MM-DD'
let raidsByDay = new Map(); // 'YYYY-MM-DD' -> [raid]
let calendarRequestId = 0;
let calendarUser = null;

function keyToUtcDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function shortRaidTitle(raid) {
  return raid.title.replace(/\s*-\s*\d{2}\.\d{2}\.\d{4}$/, '');
}

// Перший і останній день сітки: від понеділка тижня з 1-м числом до неділі
// тижня з останнім числом місяця.
function gridRange(month) {
  const firstKey = `${month}-01`;
  const first = keyToUtcDate(firstKey);
  const lead = (first.getUTCDay() + 6) % 7; // пн=0 ... нд=6
  const startKey = addDaysToKey(firstKey, -lead);
  const [y, m] = month.split('-').map(Number);
  const lastKey = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const trail = 6 - ((keyToUtcDate(lastKey).getUTCDay() + 6) % 7);
  return { startKey, endKey: addDaysToKey(lastKey, trail) };
}

async function loadCalendarMonth() {
  const requestId = ++calendarRequestId;
  const { startKey, endKey } = gridRange(calendarMonth);
  renderCalendar();
  calendarStatus.textContent = '';
  try {
    const params = new URLSearchParams({
      from: kyivLocalToIso(startKey, '00:00'),
      to: kyivLocalToIso(addDaysToKey(endKey, 1), '00:00')
    });
    const { raids } = await apiCall('GET', `/raids?${params}`, { token: getSessionToken() });
    if (requestId !== calendarRequestId) return;
    raidsByDay = new Map();
    raids.forEach((raid) => {
      const key = kyivDateKey(raidStartIso(raid));
      if (!raidsByDay.has(key)) raidsByDay.set(key, []);
      raidsByDay.get(key).push(raid);
    });
    renderCalendar();
  } catch (err) {
    console.error(err);
    if (requestId === calendarRequestId) calendarStatus.textContent = `Не вдалося завантажити рейди: ${err.message}`;
  }
}

function raidChip(raid) {
  const a = document.createElement('a');
  a.className = `raid-calendar-chip${raid.status === 'completed' ? ' raid-calendar-chip--completed' : ''}`;
  a.href = `../raid/?id=${encodeURIComponent(raid.id)}#signups`;
  const time = document.createElement('span');
  time.className = 'raid-calendar-chip-time';
  time.textContent = kyivTimeKey(raidStartIso(raid));
  const title = document.createElement('span');
  title.className = 'raid-calendar-chip-title';
  title.textContent = shortRaidTitle(raid);
  a.append(time, title);
  return a;
}

function renderCalendar() {
  const today = kyivDateKey(new Date());
  const { startKey, endKey } = gridRange(calendarMonth);
  const label = MONTH_FMT.format(keyToUtcDate(`${calendarMonth}-01`));
  calendarMonthLabel.textContent = (label.charAt(0).toUpperCase() + label.slice(1)).replace(/\s*р\.$/, '');

  calendarGrid.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'raid-calendar-row raid-calendar-row--head';
  head.setAttribute('role', 'row');
  WEEKDAY_LABELS.forEach((w) => {
    const cell = document.createElement('div');
    cell.className = 'raid-calendar-weekday';
    cell.setAttribute('role', 'columnheader');
    cell.textContent = w;
    head.appendChild(cell);
  });
  calendarGrid.appendChild(head);

  let row = null;
  for (let key = startKey, i = 0; key <= endKey; key = addDaysToKey(key, 1), i++) {
    if (i % 7 === 0) {
      row = document.createElement('div');
      row.className = 'raid-calendar-row';
      row.setAttribute('role', 'row');
      calendarGrid.appendChild(row);
    }
    const raids = raidsByDay.get(key) || [];
    const cell = document.createElement('div');
    cell.className = 'raid-calendar-cell';
    cell.setAttribute('role', 'gridcell');
    cell.dataset.day = key;
    cell.tabIndex = key === selectedDay ? 0 : -1;
    if (!key.startsWith(calendarMonth)) cell.classList.add('raid-calendar-cell--other');
    if (key < today) cell.classList.add('raid-calendar-cell--past');
    if (key === today) cell.classList.add('raid-calendar-cell--today');
    if (key === selectedDay) {
      cell.classList.add('raid-calendar-cell--selected');
      cell.setAttribute('aria-selected', 'true');
    }

    const num = document.createElement('span');
    num.className = 'raid-calendar-daynum';
    num.textContent = String(Number(key.slice(8)));
    cell.appendChild(num);

    if (raids.length) {
      const count = document.createElement('span');
      count.className = 'raid-calendar-count';
      count.textContent = String(raids.length);
      count.setAttribute('aria-label', `Рейдів: ${raids.length}`);
      cell.appendChild(count);
      const chips = document.createElement('div');
      chips.className = 'raid-calendar-chips';
      raids.forEach((raid) => chips.appendChild(raidChip(raid)));
      cell.appendChild(chips);
    }
    row.appendChild(cell);
  }

  renderDayPanel();
}

function renderDayPanel() {
  const today = kyivDateKey(new Date());
  const title = DAY_TITLE_FMT.format(keyToUtcDate(selectedDay));
  calendarDayTitle.textContent = title.charAt(0).toUpperCase() + title.slice(1);

  const [, m, d] = selectedDay.split('-');
  calendarCreateLabel.textContent = `Створити рейд на ${d}.${m}`;
  const isPast = selectedDay < today;
  calendarCreateBtn.disabled = isPast;
  if (isPast) {
    calendarCreateBtn.setAttribute('aria-label', 'Не можна створити рейд на минулий день');
    calendarCreateBtn.classList.add('tooltipped', 'tooltipped--n');
  } else {
    calendarCreateBtn.removeAttribute('aria-label');
    calendarCreateBtn.classList.remove('tooltipped', 'tooltipped--n');
  }

  calendarDayList.innerHTML = '';
  const raids = raidsByDay.get(selectedDay) || [];
  if (!raids.length) {
    const li = document.createElement('li');
    li.className = 'raid-calendar-day-empty';
    li.textContent = 'Рейдів на цей день немає.';
    calendarDayList.appendChild(li);
    return;
  }
  raids.forEach((raid) => {
    const li = document.createElement('li');
    const chip = raidChip(raid);
    chip.classList.add('raid-calendar-chip--wide');
    const status = document.createElement('span');
    status.className = `raid-chip raid-chip--${raid.status === 'completed' ? 'completed' : 'active'}`;
    status.textContent = raid.status === 'completed' ? 'Завершений' : 'Активний';
    const leader = document.createElement('span');
    leader.className = 'raid-calendar-chip-leader';
    leader.textContent = raid.leader_display_name || '';
    // "Записано N/25 (+M)" - як у шапці Raid-Helper.
    const count = document.createElement('span');
    count.className = 'raid-calendar-chip-signups';
    const extra = Number(raid.extra_count || 0);
    count.textContent = `${Number(raid.signed_count || 0)}/${SIGNUP_LIMIT}${extra ? ` (+${extra})` : ''}`;
    count.setAttribute('aria-label', 'Записано');
    count.classList.add('tooltipped', 'tooltipped--n');
    chip.append(count, leader, status);
    li.appendChild(chip);

    // Записатись прямо з календаря - те саме вікно, що на сторінці рейду.
    const signBtn = document.createElement('button');
    signBtn.type = 'button';
    signBtn.className = 'link-button-std raid-calendar-sign-btn';
    signBtn.textContent = raid.my_status ? `Мій запис: ${SIGNUP_STATUS_LABELS[raid.my_status]}` : 'Записатись';
    signBtn.disabled = isSignupClosed(raid);
    signBtn.addEventListener('click', () => openSignupModal({
      raid,
      myDiscordId: calendarUser?.discordId,
      onSaved: () => loadCalendarMonth()
    }));
    li.appendChild(signBtn);
    calendarDayList.appendChild(li);
  });
}

function selectDay(key, { focus = false } = {}) {
  selectedDay = key;
  const month = key.slice(0, 7);
  if (month !== calendarMonth) {
    calendarMonth = month;
    loadCalendarMonth();
  } else {
    renderCalendar();
  }
  if (focus) calendarGrid.querySelector(`[data-day="${key}"]`)?.focus();
}

calendarGrid.addEventListener('click', (event) => {
  if (event.target.closest('a')) return; // плашка рейду - звичайне посилання
  const cell = event.target.closest('.raid-calendar-cell');
  if (cell) selectDay(cell.dataset.day);
});

// Клавіатура: стрілки - на день/тиждень, Enter/Space - обрати (APG Grid).
calendarGrid.addEventListener('keydown', (event) => {
  const cell = event.target.closest('.raid-calendar-cell');
  if (!cell) return;
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
  if (step) {
    event.preventDefault();
    selectDay(addDaysToKey(cell.dataset.day, step), { focus: true });
  }
});

document.getElementById('calendarPrevBtn').addEventListener('click', () => {
  selectDay(`${addMonths(calendarMonth, -1)}-01`);
});
document.getElementById('calendarNextBtn').addEventListener('click', () => {
  selectDay(`${addMonths(calendarMonth, 1)}-01`);
});
document.getElementById('calendarTodayBtn').addEventListener('click', () => {
  selectDay(kyivDateKey(new Date()), { focus: true });
});
calendarCreateBtn.addEventListener('click', () => {
  if (!calendarCreateBtn.disabled) openCreateRaidModal(selectedDay);
});

function addMonths(month, delta) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

// --- Вкладки "Рейди | Календар" (#calendar у URL відкриває календар) ---

function showRaidsTab(tab) {
  raidsTabs.querySelectorAll('.raid-tab').forEach((t) => {
    t.classList.toggle('raid-tab--active', t.dataset.tab === tab);
  });
  syncTabs(raidsTabs);
  listPane.hidden = tab !== 'list';
  calendarPane.hidden = tab !== 'calendar';
  if (tab === 'calendar' && !calendarMonth) {
    selectedDay = kyivDateKey(new Date());
    calendarMonth = selectedDay.slice(0, 7);
    loadCalendarMonth();
  }
}

function initRaidsTabs(user) {
  calendarUser = user;
  raidsTabs.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn) return;
    showRaidsTab(btn.dataset.tab);
    history.replaceState(null, '', btn.dataset.tab === 'calendar' ? '#calendar' : location.pathname + location.search);
  });
  showRaidsTab(location.hash === '#calendar' ? 'calendar' : 'list');
}
