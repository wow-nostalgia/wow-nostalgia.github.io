// Фон сайту, обраний користувачем у профілі (розділ "Вигляд").
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

// value: null - стандартний фон, 'none' - без фону, інакше ім'я файлу.
// encodeURIComponent обов'язковий: імена фонів бувають кирилицею з пробілами,
// і саме він гарантує, що в CSS url() потрапить лише percent-encoded ASCII.
function applyBackground(value) {
  const root = document.documentElement;

  if (value === BACKGROUND_NONE) {
    root.style.setProperty('--page-background', 'none');
  } else if (value) {
    root.style.setProperty('--page-background', `url("${BACKGROUNDS_BASE}${encodeURIComponent(value)}")`);
  } else {
    root.style.removeProperty('--page-background');
  }
}

function setBackground(value) {
  storeBackground(value);
  applyBackground(value);
}

applyBackground(getStoredBackground());
