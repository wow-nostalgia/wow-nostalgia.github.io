const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const notOfficerGate = document.getElementById('notOfficerGate');
const mainSection = document.getElementById('mainSection');
const guildRequestsSection = document.getElementById('guildRequestsSection');
const guildRequestsList = document.getElementById('guildRequestsList');
const guildRequestsStatus = document.getElementById('guildRequestsStatus');
const guildTabs = document.getElementById('guildTabs');
const classFilter = document.getElementById('classFilter');
const specFilter = document.getElementById('specFilter');
const guildCharactersStatus = document.getElementById('guildCharactersStatus');
const guildCharactersBody = document.getElementById('guildCharactersBody');
const guildCharactersPagination = document.getElementById('guildCharactersPagination');
const guildCharactersPrevBtn = document.getElementById('guildCharactersPrevBtn');
const guildCharactersNextBtn = document.getElementById('guildCharactersNextBtn');
const guildCharactersPageInfo = document.getElementById('guildCharactersPageInfo');

const NOSTALGIA = 'Nostalgia';
const PAGE_SIZE = 50;

let rostersByGuild = new Map();
let classSpecByName = new Map();
let characterOwnerNames = new Map();
// Очікується createPlayerBadge/guildBadgeLabel з ui-shared.js.
let guildMemberNames = new Set();
let characterGuildLabels = new Map();
let classData = { classes: [], specsByClass: {} };
let tabNames = [NOSTALGIA];
let activeTab = NOSTALGIA;
let currentPage = 1;

async function readErrorMessage(res) {
  try {
    const data = await res.json();
    if (data?.error) return data.error;
  } catch { /* без JSON-тіла */ }
  return `HTTP ${res.status}`;
}

function setStatus(text) {
  guildCharactersStatus.textContent = text || '';
}

// Один запис на персонажа - перший збіг у rows перемагає (той самий
// патерн, що вже в buildClassColorMap з wow-class-colors.js). Файл не
// гарантовано хронологічний, тож це наближення для фільтра-довідника.
function buildClassSpecMap(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.name)) map.set(row.name, { class: row.class, spec: row.spec });
  }
  return map;
}

function buildRostersByGuild(nostalgiaPlayers, characterGuilds) {
  const map = new Map();
  map.set(NOSTALGIA, nostalgiaPlayers.map((p) => p.name));
  for (const [name, guild] of Object.entries(characterGuilds)) {
    if (!map.has(guild)) map.set(guild, []);
    map.get(guild).push(name);
  }
  return map;
}

function renderGuildRequests(requests) {
  guildRequestsList.innerHTML = '';
  if (!requests.length) {
    const li = document.createElement('li');
    li.className = 'account-default-officers-empty';
    li.textContent = 'Заявок немає.';
    guildRequestsList.appendChild(li);
    return;
  }

  requests.forEach(({ character_name: characterName, requested_by: requestedBy }) => {
    const li = document.createElement('li');
    li.className = 'account-default-officer-item';

    const label = document.createElement('span');
    label.textContent = `${characterName} — заявив(ла) ${requestedBy}`;
    li.appendChild(label);

    const actions = document.createElement('span');
    actions.className = 'account-character-actions';

    const approveBtn = document.createElement('button');
    approveBtn.type = 'button';
    approveBtn.className = 'link-button-std';
    approveBtn.textContent = 'Підтвердити';
    approveBtn.addEventListener('click', () => respondToGuildRequest(characterName, 'approve'));
    actions.appendChild(approveBtn);

    const rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = 'link-button-std link-button-std--danger';
    rejectBtn.textContent = 'Відхилити';
    rejectBtn.addEventListener('click', () => respondToGuildRequest(characterName, 'reject'));
    actions.appendChild(rejectBtn);

    li.appendChild(actions);
    guildRequestsList.appendChild(li);
  });
}

async function respondToGuildRequest(characterName, action) {
  try {
    const res = await fetch(`${AUTH_API_BASE}/guild-requests/${encodeURIComponent(characterName)}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getSessionToken()}` }
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    guildRequestsStatus.textContent = '';
    renderGuildRequests(await res.json());
  } catch (err) {
    guildRequestsStatus.textContent = `Помилка: ${err.message}`;
  }
}

async function loadGuildRequests() {
  try {
    const res = await fetch(`${AUTH_API_BASE}/guild-requests`, { headers: { Authorization: `Bearer ${getSessionToken()}` } });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    renderGuildRequests(await res.json());
  } catch (err) {
    guildRequestsStatus.textContent = `Помилка завантаження: ${err.message}`;
  }
}

function renderTabs() {
  guildTabs.innerHTML = '';
  tabNames.forEach((name) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `raid-tab${name === activeTab ? ' raid-tab--active' : ''}`;
    btn.dataset.tab = name;
    btn.textContent = name;
    guildTabs.appendChild(btn);
  });
}

guildTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (!btn || btn.dataset.tab === activeTab) return;
  switchTab(btn.dataset.tab);
});

function switchTab(guildName) {
  activeTab = guildName;
  currentPage = 1;
  classFilter.value = '';
  populateSpecFilter('');
  guildRequestsSection.hidden = activeTab !== NOSTALGIA;
  renderTabs();
  renderTable();
}

function populateClassFilter() {
  classFilter.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'Усі класи';
  classFilter.appendChild(allOption);

  (classData.classes || []).forEach((cls) => {
    const option = document.createElement('option');
    option.value = cls;
    option.textContent = translateClass(cls);
    if (WOW_CLASS_COLORS[cls]) option.style.color = WOW_CLASS_COLORS[cls];
    classFilter.appendChild(option);
  });
}

function populateSpecFilter(className) {
  specFilter.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'Усі спеки';
  specFilter.appendChild(allOption);

  const specs = classData.specsByClass?.[className] || [];
  specs.forEach((spec) => {
    const option = document.createElement('option');
    option.value = spec;
    option.textContent = translateSpec(spec);
    specFilter.appendChild(option);
  });
}

classFilter.addEventListener('change', () => {
  populateSpecFilter(classFilter.value);
  currentPage = 1;
  renderTable();
});

specFilter.addEventListener('change', () => {
  currentPage = 1;
  renderTable();
});

function renderPagination(total) {
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  guildCharactersPagination.hidden = totalPages <= 1;
  guildCharactersPageInfo.textContent = `Сторінка ${currentPage} з ${totalPages}`;
  guildCharactersPrevBtn.disabled = currentPage <= 1;
  guildCharactersNextBtn.disabled = currentPage >= totalPages;
}

guildCharactersPrevBtn.addEventListener('click', () => {
  if (currentPage <= 1) return;
  currentPage -= 1;
  renderTable();
});

guildCharactersNextBtn.addEventListener('click', () => {
  currentPage += 1;
  renderTable();
});

function renderTable() {
  const names = rostersByGuild.get(activeTab) || [];
  let rows = names.map((name) => {
    const classSpec = classSpecByName.get(name);
    return {
      name,
      class: classSpec?.class || '',
      spec: classSpec?.spec || '',
      owner: characterOwnerNames.get(name) || ''
    };
  });

  if (classFilter.value) rows = rows.filter((r) => r.class === classFilter.value);
  if (specFilter.value) rows = rows.filter((r) => r.spec === specFilter.value);

  rows.sort((a, b) => a.name.localeCompare(b.name, 'uk'));

  guildCharactersBody.innerHTML = '';

  if (!rows.length) {
    setStatus('Персонажів не знайдено.');
    guildCharactersPagination.hidden = true;
    return;
  }

  setStatus(`Усього персонажів: ${rows.length}`);

  const totalPages = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);
  if (currentPage > totalPages) currentPage = totalPages;
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  pageRows.forEach((row) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.appendChild(createPlayerBadge(row.name));
    nameTd.appendChild(document.createTextNode(' ' + row.name));
    tr.appendChild(nameTd);

    const classTd = document.createElement('td');
    if (row.class) {
      classTd.textContent = translateClass(row.class);
      if (WOW_CLASS_COLORS[row.class]) classTd.style.color = WOW_CLASS_COLORS[row.class];
    } else {
      classTd.textContent = 'Невідомо';
    }
    tr.appendChild(classTd);

    const specTd = document.createElement('td');
    specTd.textContent = row.spec ? translateSpec(row.spec) : 'Невідомо';
    tr.appendChild(specTd);

    const ownerTd = document.createElement('td');
    ownerTd.textContent = row.owner || '—';
    tr.appendChild(ownerTd);

    guildCharactersBody.appendChild(tr);
  });

  renderPagination(rows.length);
}

async function loadData() {
  const [nostalgiaPlayers, characterGuilds, guildData, ownersRes] = await Promise.all([
    fetch('/data/nostalgia_players.json?t=' + Date.now()).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch('/data/character-guilds.json?t=' + Date.now()).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch('/data/guild-data.json?t=' + Date.now()).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`${AUTH_API_BASE}/characters/owners`).catch(() => null)
  ]);

  guildMemberNames = new Set(nostalgiaPlayers.map((p) => p.name));
  characterGuildLabels = new Map(Object.entries(characterGuilds));
  rostersByGuild = buildRostersByGuild(nostalgiaPlayers, characterGuilds);
  classSpecByName = buildClassSpecMap(guildData?.rows || []);
  classData = { classes: guildData?.classes || [], specsByClass: guildData?.specsByClass || {} };

  if (ownersRes?.ok) {
    characterOwnerNames = new Map(Object.entries(await ownersRes.json()));
  }

  const otherGuilds = [...new Set(Object.values(characterGuilds))].sort((a, b) => a.localeCompare(b, 'uk'));
  tabNames = [NOSTALGIA, ...otherGuilds];

  populateClassFilter();
  populateSpecFilter('');
  renderTabs();
  renderTable();
}

async function init() {
  loginGateBtn.href = discordLoginUrl();

  const user = await fetchCurrentUser();
  if (!user) {
    loginGate.hidden = false;
    return;
  }

  if (!user.isGuildOfficer) {
    notOfficerGate.hidden = false;
    return;
  }

  mainSection.hidden = false;
  guildRequestsSection.hidden = false;
  loadGuildRequests();

  await loadData();
}

init();
