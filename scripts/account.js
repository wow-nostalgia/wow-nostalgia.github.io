const loggedOutView = document.getElementById('loggedOutView');
const loggedInView = document.getElementById('loggedInView');
const accountLoading = document.getElementById('accountLoading');
const loginBtn = document.getElementById('loginBtn');
const profileAvatar = document.getElementById('profileAvatar');
const profileUsername = document.getElementById('profileUsername');
const profileDiscordId = document.getElementById('profileDiscordId');
const charactersList = document.getElementById('charactersList');
const addCharacterForm = document.getElementById('addCharacterForm');
const characterNameInput = document.getElementById('characterNameInput');
const accountStatus = document.getElementById('accountStatus');
const accountTabs = document.getElementById('accountTabs');
const accountTabPane = document.getElementById('accountTabPane');
const adminTabPane = document.getElementById('adminTabPane');
const adminRemoveCharacterForm = document.getElementById('adminRemoveCharacterForm');
const adminCharacterNameInput = document.getElementById('adminCharacterNameInput');
const adminCharacterStatus = document.getElementById('adminCharacterStatus');
const defaultOfficerInput = document.getElementById('defaultOfficerInput');
const defaultOfficerList = document.getElementById('defaultOfficerList');
const defaultOfficerAddBtn = document.getElementById('defaultOfficerAddBtn');
const defaultOfficersList = document.getElementById('defaultOfficersList');
const defaultOfficersStatus = document.getElementById('defaultOfficersStatus');

function setAccountStatus(text) {
  accountStatus.textContent = text || '';
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
let raidAttendanceByName = new Map();

async function loadCharacterStatsSources() {
  try {
    const [players, personalStats, guildDataRes, potionStats] = await Promise.all([
      fetch('/data/players.json?t=' + Date.now()).then((r) => r.json()),
      fetch('/data/personal-stats.json?t=' + Date.now()).then((r) => r.json()),
      fetch('/data/guild-data.json?t=' + Date.now()).catch(() => null),
      fetch('/data/potion-stats.json?t=' + Date.now()).then((r) => r.json())
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
    raidAttendanceByName = new Map();
    for (const raid of potionStats || []) {
      for (const player of raid.players || []) {
        raidAttendanceByName.set(player.name, (raidAttendanceByName.get(player.name) || 0) + 1);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// Ім'я персонажа — лінк на "Персональну аналітику" з префілом цього
// персонажа (?player=...), лише якщо для нього взагалі є дані в логах.
// Інакше — звичайний текст, лінк в нікуди був би плутаниною.
function characterNameNode(name) {
  const color = classColorMap.get(name);
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

function renderCharactersList(characters) {
  charactersList.innerHTML = '';

  if (!characters.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = 'Ще не додано жодного персонажа.';
    tr.appendChild(td);
    charactersList.appendChild(tr);
    return;
  }

  const hasPrimary = characters.some((c) => c.isPrimary);

  characters.forEach(({ characterName: name, isPrimary }) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    const nameWrap = document.createElement('span');
    nameWrap.className = 'account-character-name-cell';
    nameWrap.appendChild(createPlayerBadge(name));
    nameWrap.appendChild(characterNameNode(name));
    if (isPrimary) {
      const primaryBadge = document.createElement('span');
      primaryBadge.className = 'primary-character-badge';
      primaryBadge.textContent = 'Основний';
      nameWrap.appendChild(primaryBadge);
    }
    nameTd.appendChild(nameWrap);
    tr.appendChild(nameTd);

    const attendanceTd = document.createElement('td');
    attendanceTd.className = 'account-attendance-col';
    attendanceTd.textContent = String(raidAttendanceByName.get(name) || 0);
    tr.appendChild(attendanceTd);

    const checkboxTd = document.createElement('td');
    checkboxTd.className = 'account-primary-checkbox-td';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isPrimary;
    checkbox.disabled = !isPrimary && hasPrimary;
    checkbox.addEventListener('change', async () => {
      checkbox.disabled = true;
      const method = checkbox.checked ? 'POST' : 'DELETE';
      try {
        const token = getSessionToken();
        const res = await fetch(`${AUTH_API_BASE}/auth/me/characters/${encodeURIComponent(name)}/primary`, {
          method,
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        renderCharactersList(await res.json());
      } catch (err) {
        checkbox.checked = !checkbox.checked;
        checkbox.disabled = false;
        setAccountStatus(`Помилка: ${err.message}`);
      }
    });
    checkboxTd.appendChild(checkbox);
    tr.appendChild(checkboxTd);

    const actionsTd = document.createElement('td');
    actionsTd.className = 'account-delete-td';
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'account-delete-btn';
    removeBtn.setAttribute('aria-label', "Видалити персонажа");
    removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
    removeBtn.addEventListener('click', async () => {
      try {
        const token = getSessionToken();
        const res = await fetch(`${AUTH_API_BASE}/auth/me/characters/${encodeURIComponent(name)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        renderCharactersList(await res.json());
      } catch (err) {
        setAccountStatus(`Помилка: ${err.message}`);
      }
    });
    actionsTd.appendChild(removeBtn);
    tr.appendChild(actionsTd);

    charactersList.appendChild(tr);
  });
}

addCharacterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const characterName = characterNameInput.value.trim();
  if (!characterName) return;

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
  } catch (err) {
    setAccountStatus(`Помилка: ${err.message}`);
  }
});

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

async function init() {
  loginBtn.href = discordLoginUrl('/account/');

  const user = await fetchCurrentUser();
  accountLoading.hidden = true;

  if (!user) {
    loggedOutView.hidden = false;
    return;
  }

  loggedInView.hidden = false;
  profileUsername.textContent = user.username;
  profileDiscordId.textContent = `Discord ID: ${user.discordId}`;
  if (user.avatar) {
    profileAvatar.src = user.avatar;
    profileAvatar.hidden = false;
  }
  if (user.isAdmin) {
    accountTabs.hidden = false;
    initDefaultOfficersAutocomplete();
    let defaultOfficersLoaded = false;
    accountTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      accountTabs.querySelectorAll('.raid-tab').forEach((t) => t.classList.remove('raid-tab--active'));
      btn.classList.add('raid-tab--active');
      const tab = btn.dataset.tab;
      accountTabPane.hidden = tab !== 'account';
      adminTabPane.hidden = tab !== 'admin';
      if (tab === 'admin' && !defaultOfficersLoaded) {
        defaultOfficersLoaded = true;
        loadDefaultOfficers();
      }
    });
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
