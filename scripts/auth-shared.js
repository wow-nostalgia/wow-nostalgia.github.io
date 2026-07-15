// Discord-логін, спільний для всіх сторінок (підключати тегом <script>
// разом з nav.js — рендерить стан логіну в navbar через #authNavSlot).
// Дропдаун-toggle для аватара обробляється делегуванням у nav.js, тут
// лише будуємо DOM.

const AUTH_API_BASE = 'https://raid-manager-api.wow-nostalgia.workers.dev/api/v1';
const DISCORD_CLIENT_ID = '1521132280243032064';

// Рахуємо від поточного origin (а не фіксований URL), щоб логін працював
// і на проді, і локально через http-server — обидва зареєстровані в Discord
// як дозволені redirect_uri. Бекенд звіряє це значення зі своїм allowlist.
function accountCallbackUrl() {
  return `${window.location.origin}/account/callback/`;
}

function getSessionToken() {
  return localStorage.getItem('sessionToken');
}

function setSessionToken(token) {
  localStorage.setItem('sessionToken', token);
}

function clearSessionToken() {
  localStorage.removeItem('sessionToken');
}

function discordLoginUrl(returnTo) {
  const state = encodeURIComponent(returnTo || (window.location.pathname + window.location.search));
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: accountCallbackUrl(),
    response_type: 'code',
    scope: 'identify',
    state
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function fetchCurrentUser() {
  const token = getSessionToken();
  if (!token) return null;

  try {
    const res = await fetch(`${AUTH_API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      clearSessionToken();
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

async function logoutCurrentUser() {
  const token = getSessionToken();
  if (token) {
    try {
      await fetch(`${AUTH_API_BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch { /* мовчки, токен все одно чистимо локально */ }
  }
  clearSessionToken();
}

function renderAuthNav(user) {
  const slot = document.getElementById('authNavSlot');
  if (!slot) return;
  slot.innerHTML = '';

  const lang = localStorage.getItem('nameLanguage') || 'uk';
  const langBtn = document.createElement('button');
  langBtn.type = 'button';
  langBtn.className = 'nav__link nav__lang-btn tooltipped tooltipped--s';
  langBtn.setAttribute('data-tooltip', 'Назви босів, предметів, класів і спеків');
  langBtn.setAttribute('aria-label', lang === 'uk' ? 'Мова: Українська' : 'Language: English');
  const flagImg = document.createElement('img');
  flagImg.className = 'nav__lang-flag';
  flagImg.alt = lang === 'uk' ? '🇺🇦' : '🇺🇸';
  // Twemoji SVG: 🇺🇦 = 1f1fa-1f1e6, 🇺🇸 = 1f1fa-1f1f8
  flagImg.src = lang === 'uk'
    ? 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f1fa-1f1e6.svg'
    : 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f1fa-1f1f8.svg';
  langBtn.appendChild(flagImg);
  langBtn.addEventListener('click', () => {
    localStorage.setItem('nameLanguage', lang === 'uk' ? 'en' : 'uk');
    location.reload();
  });
  slot.appendChild(langBtn);

  if (!user) {
    const link = document.createElement('a');
    link.className = 'nav__link';
    link.href = discordLoginUrl();
    link.textContent = 'Увійти';
    slot.appendChild(link);
    return;
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'nav__dropdown';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'nav__link nav__dropdown-trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  if (user.avatar) {
    const avatar = document.createElement('img');
    avatar.className = 'nav__icon nav__icon--avatar';
    avatar.src = user.avatar;
    avatar.alt = '';
    trigger.appendChild(avatar);
  } else {
    trigger.innerHTML =
      '<svg class="nav__icon nav__icon--profile" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
  }
  dropdown.appendChild(trigger);

  const menu = document.createElement('div');
  menu.className = 'nav__dropdown-menu';

  const accountLink = document.createElement('a');
  accountLink.className = 'nav__link';
  accountLink.href = '/account/';
  accountLink.textContent = 'Профіль';
  menu.appendChild(accountLink);

  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.className = 'nav__link';
  logoutBtn.addEventListener('click', async () => {
    await logoutCurrentUser();
    window.location.reload();
  });
  logoutBtn.textContent = 'Вийти';
  menu.appendChild(logoutBtn);

  dropdown.appendChild(menu);
  slot.appendChild(dropdown);
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await fetchCurrentUser();
  renderAuthNav(user);
});
