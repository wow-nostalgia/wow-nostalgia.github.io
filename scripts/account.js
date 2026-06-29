const loggedOutView = document.getElementById('loggedOutView');
const loggedInView = document.getElementById('loggedInView');
const accountLoading = document.getElementById('accountLoading');
const loginBtn = document.getElementById('loginBtn');
const profileAvatar = document.getElementById('profileAvatar');
const profileUsername = document.getElementById('profileUsername');
const charactersList = document.getElementById('charactersList');
const addCharacterForm = document.getElementById('addCharacterForm');
const characterNameInput = document.getElementById('characterNameInput');
const accountStatus = document.getElementById('accountStatus');

function setAccountStatus(text) {
  accountStatus.textContent = text || '';
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

  characters.forEach((name) => {
    const li = document.createElement('li');
    li.className = 'raid-list-item';
    li.appendChild(document.createTextNode(name));

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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        renderCharactersList(await res.json());
      } catch (err) {
        setAccountStatus(`Помилка: ${err.message}`);
      }
    });
    li.appendChild(removeBtn);

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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderCharactersList(await res.json());
    characterNameInput.value = '';
    setAccountStatus('');
  } catch (err) {
    setAccountStatus(`Помилка: ${err.message}`);
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
  if (user.avatar) {
    profileAvatar.src = user.avatar;
    profileAvatar.hidden = false;
  }

  try {
    const token = getSessionToken();
    const res = await fetch(`${AUTH_API_BASE}/auth/me/characters`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderCharactersList(await res.json());
  } catch (err) {
    setAccountStatus(`Помилка: ${err.message}`);
  }
}

init();
