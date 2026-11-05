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
  // Фон — налаштування акаунту, а не пристрою: після виходу повертаємо
  // стандартний, щоб наступний користувач за цим браузером не успадкував чужий.
  setBackground(null);
  setSiteTheme('default');
}

// Джерело істини для фону й теми — колонки users.background / users.theme;
// localStorage лише кеш, який тут доганяє сервер (напр. користувач змінив
// фон чи тему з іншого пристрою).
function syncBackgroundFromUser(user) {
  if (!user) {
    // Токена нема — це справжній вихід, скидаємо кеш. Якщо ж токен на місці,
    // а user порожній (мережа впала / Worker недоступний) — кеш лишаємо, щоб
    // не блимати стандартним фоном на кожній офлайн-сторінці.
    if (!getSessionToken()) {
      setBackground(null);
      setSiteTheme('default');
    }
    return;
  }

  const value = user.background ?? null;
  if (value !== getStoredBackground()) setBackground(value);

  const theme = user.theme ?? 'default';
  if (theme !== getSiteTheme()) setSiteTheme(theme);
}

function renderAuthNav(user) {
  const slot = document.getElementById('authNavSlot');
  if (!slot) return;
  slot.innerHTML = '';

  const lang = localStorage.getItem('nameLanguage') || 'uk';
  const langBtn = document.createElement('button');
  langBtn.type = 'button';
  langBtn.className = 'nav__link nav__lang-btn tooltipped tooltipped--s tooltipped--sw';
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

  // Пряме посилання на профіль: аватар + ім'я. Вихід — кнопка на самій
  // сторінці профілю (account.js), окремого меню акаунта нема. Поточну
  // сторінку в навбарі візуально не підсвічуємо, лише для скрінрідерів.
  const accountLink = document.createElement('a');
  accountLink.className = 'nav__link';
  accountLink.href = '/account/';
  if (location.pathname.startsWith('/account/')) accountLink.setAttribute('aria-current', 'page');
  if (user.avatar) {
    const avatar = document.createElement('img');
    avatar.className = 'nav__icon nav__icon--avatar';
    avatar.src = user.avatar;
    avatar.alt = '';
    accountLink.appendChild(avatar);
  } else {
    accountLink.innerHTML = '<svg class="nav__icon nav__icon--inline" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>';
  }
  // Основний персонаж, а без нього — нік Discord (displayName з /auth/me).
  // Довгий нік CSS обрізає трикрапкою; тоді повне ім'я — у тултіпі.
  const fullName = user.displayName || user.username || 'Профіль';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'nav__account-name';
  nameSpan.textContent = fullName;
  accountLink.classList.add('nav__link--account');
  accountLink.appendChild(nameSpan);
  slot.appendChild(accountLink);

  // Тултіп лише коли ім'я справді обрізане. ResizeObserver спрацьовує і
  // при зміні ширини вікна, і коли меню-гамбургер робить посилання видимим.
  const syncNameTooltip = () => {
    const truncated = nameSpan.scrollWidth > nameSpan.clientWidth;
    accountLink.classList.toggle('tooltipped', truncated);
    accountLink.classList.toggle('tooltipped--s', truncated);
    accountLink.classList.toggle('tooltipped--sw', truncated);
    if (truncated) accountLink.setAttribute('aria-label', fullName);
    else accountLink.removeAttribute('aria-label');
  };
  new ResizeObserver(syncNameTooltip).observe(nameSpan);
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await fetchCurrentUser();
  syncBackgroundFromUser(user);
  renderAuthNav(user);

  // Штрафбат бачать усі залогінені (гравці — лише перегляд).
  const navPenaltyBattalion = document.getElementById('navPenaltyBattalion');
  if (navPenaltyBattalion) navPenaltyBattalion.hidden = !user;
});
