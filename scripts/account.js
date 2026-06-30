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
const adminCharacterTools = document.getElementById('adminCharacterTools');
const adminRemoveCharacterForm = document.getElementById('adminRemoveCharacterForm');
const adminCharacterNameInput = document.getElementById('adminCharacterNameInput');
const adminCharacterStatus = document.getElementById('adminCharacterStatus');

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
// guild-ranking.js/potion-stats.js. Без бекенд-змін, чисто фронтенд.
let guildMemberNames = new Set();
let guildDataRows = [];
let honorBoardByName = new Map();

async function loadCharacterStatsSources() {
  try {
    const [players, guildData, honorBoard] = await Promise.all([
      fetch('/data/players.json').then((r) => r.json()),
      fetch('/data/guild-data.json').then((r) => r.json()),
      fetch('/data/honor-board.json').then((r) => r.json())
    ]);
    guildMemberNames = new Set(players.map((p) => p.name));
    guildDataRows = guildData.rows || [];
    honorBoardByName = new Map(honorBoard.map((entry) => [entry.name, entry]));
  } catch (err) {
    console.error(err);
  }
}

function createPlayerBadge(name) {
  const isGuild = guildMemberNames.has(name);
  const badge = document.createElement('span');
  badge.className = `player-badge ${isGuild ? 'player-badge--guild' : 'player-badge--legion'}`;
  badge.title = isGuild ? 'Ностальгія' : 'Легіонер';
  badge.textContent = isGuild ? 'Н' : 'Л';
  return badge;
}

function renderCharacterStats(name) {
  const wrap = document.createElement('div');
  wrap.className = 'account-stats-row';
  wrap.appendChild(createPlayerBadge(name));

  const rankRows = guildDataRows.filter((row) => row.name === name);
  if (rankRows.length) {
    const best = rankRows.reduce((a, b) => (a.overallRank <= b.overallRank ? a : b));
    const chip = document.createElement('span');
    chip.className = 'account-stat-chip';
    chip.textContent = `#${best.overallRank} · ${best.overallScore}`;
    wrap.appendChild(chip);
  }

  const honor = honorBoardByName.get(name);
  if (honor) {
    const chip = document.createElement('span');
    chip.className = 'account-stat-chip';
    chip.textContent = `${honor.averagePotionsPerBoss} потів/бос`;
    wrap.appendChild(chip);
  }

  if (!rankRows.length && !honor) {
    const hint = document.createElement('span');
    hint.className = 'account-stat-hint';
    hint.textContent = 'Ще немає даних у логах';
    wrap.appendChild(hint);
  }

  return wrap;
}

function renderCharactersList(characters) {
  charactersList.innerHTML = '';

  if (!characters.length) {
    const li = document.createElement('li');
    li.className = 'raid-list-item';
    li.textContent = 'Ще не додано жодного персонажа.';
    charactersList.appendChild(li);
    return;
  }

  characters.forEach(({ characterName: name, isPrimary }) => {
    const li = document.createElement('li');
    li.className = 'raid-list-item';

    const top = document.createElement('div');
    top.className = 'raid-list-item-top';

    const nameWrap = document.createElement('span');
    nameWrap.className = 'raid-list-item-name';
    nameWrap.appendChild(document.createTextNode(name));
    top.appendChild(nameWrap);

    const actions = document.createElement('span');
    actions.className = 'account-character-actions';

    if (isPrimary) {
      const badge = document.createElement('span');
      badge.className = 'account-primary-badge';
      badge.textContent = 'Основний';
      actions.appendChild(badge);
    } else {
      const primaryBtn = document.createElement('button');
      primaryBtn.type = 'button';
      primaryBtn.className = 'link-button-std';
      primaryBtn.textContent = 'Зробити основним';
      primaryBtn.addEventListener('click', async () => {
        try {
          const token = getSessionToken();
          const res = await fetch(`${AUTH_API_BASE}/auth/me/characters/${encodeURIComponent(name)}/primary`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) throw new Error(await readErrorMessage(res));
          renderCharactersList(await res.json());
        } catch (err) {
          setAccountStatus(`Помилка: ${err.message}`);
        }
      });
      actions.appendChild(primaryBtn);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'link-button-std';
    removeBtn.textContent = 'Видалити';
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
    actions.appendChild(removeBtn);

    top.appendChild(actions);
    li.appendChild(top);
    li.appendChild(renderCharacterStats(name));
    charactersList.appendChild(li);
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
  adminCharacterTools.hidden = !user.isAdmin;

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
