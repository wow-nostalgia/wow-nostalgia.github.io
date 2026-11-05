// Фон сайту, обраний користувачем у профілі (Налаштування -> Фон сайту).
//
// Підключати СИНХРОННО в <head> кожної сторінки (без defer) і раніше за інші
// скрипти: інакше браузер устигає намалювати стандартний фон із style.css, і
// на кожному переході видно спалах чужої картинки.
//
// Джерело істини — колонка users.background у D1 (синхронізує auth-shared.js
// після /auth/me). localStorage тут лише кеш, щоб малювати фон одразу, не
// чекаючи відповіді Worker'а.

const BACKGROUND_STORAGE_KEY = 'background';
const BACKGROUND_NONE = 'none';
const BACKGROUNDS_BASE = '/images/backgrounds/';
const BACKGROUNDS_MANIFEST_URL = '/images/backgrounds/backgrounds.json';

function getStoredBackground() {
  try {
    return localStorage.getItem(BACKGROUND_STORAGE_KEY);
  } catch {
    // Приватний режим / заблоковані куки — просто лишаємо стандартний фон.
    return null;
  }
}

function storeBackground(value) {
  try {
    if (value) localStorage.setItem(BACKGROUND_STORAGE_KEY, value);
    else localStorage.removeItem(BACKGROUND_STORAGE_KEY);
  } catch { /* мовчки: без кешу фон просто підтягнеться з /auth/me */ }
}

// AVIF/WebP-копії генерує scripts/build-backgrounds.js в optimized/ під тим
// самим іменем без розширення; браузер бере перший формат, який підтримує,
// а оригінал лишається останнім варіантом. Той самий порядок - у style.css.
// encodeURIComponent обов'язковий: імена фонів бувають кирилицею з пробілами,
// і саме він гарантує, що в CSS url() потрапить лише percent-encoded ASCII.
function backgroundImageValue(fileName) {
  const base = encodeURIComponent(fileName.replace(/\.[^.]+$/, ''));
  const optimized = `${BACKGROUNDS_BASE}optimized/${base}`;
  return `image-set(url("${optimized}.avif") type("image/avif"), `
    + `url("${optimized}.webp") type("image/webp"), `
    + `url("${BACKGROUNDS_BASE}${encodeURIComponent(fileName)}"))`;
}

// value: null - стандартний фон, 'none' - без фону, інакше ім'я файлу.
function applyBackground(value) {
  const root = document.documentElement;

  if (value === BACKGROUND_NONE) {
    root.style.setProperty('--page-background', 'none');
  } else if (value) {
    root.style.setProperty('--page-background', backgroundImageValue(value));
  } else {
    root.style.removeProperty('--page-background');
  }
}

function setBackground(value) {
  storeBackground(value);
  applyBackground(value);
}

applyBackground(getStoredBackground());

// Тема сайту (профіль -> Налаштування -> Тема сайту). Атрибут
// data-theme на <html> перемикає блок токенів у style.css
// (:root[data-theme="atom"]); без атрибута - стандартна тема.
// Як і з фоном: джерело істини - колонка users.theme у D1 (синхронізує
// auth-shared.js після /auth/me), localStorage - лише кеш для першого рендеру.
// Список має збігатися з SITE_THEMES у worker/src/routes/auth.js.
const THEME_STORAGE_KEY = 'siteTheme';
const SITE_THEMES = ['default', 'atom'];

function getSiteTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return SITE_THEMES.includes(value) ? value : 'default';
  } catch {
    return 'default';
  }
}

function applySiteTheme(value) {
  if (value && value !== 'default') document.documentElement.dataset.theme = value;
  else delete document.documentElement.dataset.theme;
}

function setSiteTheme(value) {
  try {
    if (value && value !== 'default') localStorage.setItem(THEME_STORAGE_KEY, value);
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch { /* без localStorage тема діє лише до перезавантаження */ }
  applySiteTheme(value);
}

applySiteTheme(getSiteTheme());
