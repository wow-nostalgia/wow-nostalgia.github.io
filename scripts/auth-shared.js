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
    link.innerHTML = '<svg class="nav__icon nav__icon--inline" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M2 2.75C2 1.784 2.784 1 3.75 1h2.5a.75.75 0 0 1 0 1.5h-2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h2.5a.75.75 0 0 1 0 1.5h-2.5A1.75 1.75 0 0 1 2 13.25Zm6.56 4.5H6.75a.75.75 0 0 1 0-1.5h1.81L6.22 5.28a.75.75 0 1 1 1.06-1.06l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.751.751 0 1 1-1.06-1.06Z"/></svg>Увійти';
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
  accountLink.innerHTML = '<svg class="nav__icon nav__icon--inline" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>Профіль';
  menu.appendChild(accountLink);

  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.className = 'nav__link';
  logoutBtn.addEventListener('click', async () => {
    await logoutCurrentUser();
    window.location.reload();
  });
  logoutBtn.innerHTML = '<svg class="nav__icon nav__icon--inline" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M2 2.75C2 1.784 2.784 1 3.75 1h2.5a.75.75 0 0 1 0 1.5h-2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h2.5a.75.75 0 0 1 0 1.5h-2.5A1.75 1.75 0 0 1 2 13.25Zm10.44 4.5-1.97-1.97a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l1.97-1.97H6.75a.75.75 0 0 1 0-1.5Z"/></svg>Вийти';
  menu.appendChild(logoutBtn);

  dropdown.appendChild(menu);
  slot.appendChild(dropdown);
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await fetchCurrentUser();
  renderAuthNav(user);
});
