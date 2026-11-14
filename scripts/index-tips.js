// Карусель підказок "Чи знаєш ти?" на головній — коротко про можливості сайту.
// Автопрокрутка за рекомендаціями Baymard / W3C APG (Carousel Pattern):
// пауза при наведенні й фокусі, зупинка після будь-якого ручного гортання,
// без автопрокрутки на телефонах і при "зменшити анімацію". Кожен візит
// починається з наступної підказки — інакше бачили б лише першу.

// Нові/змінені підказки — підніми версію: блок з'явиться знову навіть у тих,
// хто його сховав.
const TIPS_VERSION = 3;
const TIP_INTERVAL_MS = 8000;

const TIP_ICONS = {
  personAdd: 'M7.9 8.548h-.001a5.528 5.528 0 0 1 3.1 4.659.75.75 0 1 1-1.498.086A4.01 4.01 0 0 0 5.5 9.5a4.01 4.01 0 0 0-4.001 3.793.75.75 0 1 1-1.498-.085 5.527 5.527 0 0 1 3.1-4.66 3.5 3.5 0 1 1 4.799 0ZM13.25 0a.75.75 0 0 1 .75.75V2h1.25a.75.75 0 0 1 0 1.5H14v1.25a.75.75 0 0 1-1.5 0V3.5h-1.25a.75.75 0 0 1 0-1.5h1.25V.75a.75.75 0 0 1 .75-.75ZM5.5 4a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 4Z',
  // та сама іконка, що в блоці "Правила ролу 25 гер"
  dice: 'M13.25 1c.966 0 1.75.784 1.75 1.75v10.5c0 .464-.184.909-.513 1.237A1.746 1.746 0 0 1 13.25 15H2.75c-.464 0-.909-.184-1.237-.513A1.746 1.746 0 0 1 1 13.25V2.75C1 1.784 1.784 1 2.75 1h10.5ZM2.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25H2.75ZM5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm6-6a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  listOrdered: 'M5 3.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 3.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 8.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75ZM.924 10.32a.5.5 0 0 1-.851-.525l.001-.001.001-.002.002-.004.007-.011c.097-.144.215-.273.348-.384.228-.19.588-.392 1.068-.392.468 0 .858.181 1.126.484.259.294.377.673.377 1.038 0 .987-.686 1.495-1.156 1.845l-.047.035c-.303.225-.522.4-.654.597h1.357a.5.5 0 0 1 0 1H.5a.5.5 0 0 1-.5-.5c0-1.005.692-1.52 1.167-1.875l.035-.025c.531-.396.8-.625.8-1.078a.57.57 0 0 0-.128-.376C1.806 10.068 1.695 10 1.5 10a.658.658 0 0 0-.429.163.835.835 0 0 0-.144.153ZM2.003 2.5V6h.503a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1h.503V3.308l-.28.14a.5.5 0 0 1-.446-.895l1.003-.5a.5.5 0 0 1 .723.447Z',
  graph: 'M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z',
  zap: 'M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.346 1.909 1.22 3.004l-7.34 7.142a1.249 1.249 0 0 1-.871.354h-.302a1.25 1.25 0 0 1-1.157-1.723L5.633 10.5H3.462c-1.57 0-2.346-1.909-1.22-3.004L9.503.429Zm1.047 1.074L3.286 8.571A.25.25 0 0 0 3.462 9H6.75a.75.75 0 0 1 .694 1.034l-1.713 4.188 6.982-6.793A.25.25 0 0 0 12.538 7H9.25a.75.75 0 0 1-.683-1.06l2.008-4.418.003-.006a.036.036 0 0 0-.004-.009l-.006-.006-.008-.001c-.003 0-.006.002-.009.004Z',
  image: 'M16 13.25A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25V2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75ZM1.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h.94l.03-.03 6.077-6.078a1.75 1.75 0 0 1 2.412-.06L14.5 10.31V2.75a.25.25 0 0 0-.25-.25Zm12.5 11a.25.25 0 0 0 .25-.25v-.917l-4.298-3.889a.25.25 0 0 0-.344.009L4.81 13.5ZM7 6a2 2 0 1 1-3.999.001A2 2 0 0 1 7 6ZM5.5 6a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0Z',
  paintbrush: 'M11.134 1.535c.7-.509 1.416-.942 2.076-1.155.649-.21 1.463-.267 2.069.34.603.601.568 1.411.368 2.07-.202.668-.624 1.39-1.125 2.096-1.011 1.424-2.496 2.987-3.775 4.249-1.098 1.084-2.132 1.839-3.04 2.3a3.744 3.744 0 0 1-1.055 3.217c-.431.431-1.065.691-1.657.861-.614.177-1.294.287-1.914.357A21.151 21.151 0 0 1 .797 16H.743l.007-.75H.749L.742 16a.75.75 0 0 1-.743-.742l.743-.008-.742.007v-.054a21.25 21.25 0 0 1 .13-2.284c.067-.647.187-1.287.358-1.914.17-.591.43-1.226.86-1.657a3.746 3.746 0 0 1 3.227-1.054c.466-.893 1.225-1.907 2.314-2.982 1.271-1.255 2.833-2.75 4.245-3.777ZM1.62 13.089c-.051.464-.086.929-.104 1.395.466-.018.932-.053 1.396-.104a10.511 10.511 0 0 0 1.668-.309c.526-.151.856-.325 1.011-.48a2.25 2.25 0 1 0-3.182-3.182c-.155.155-.329.485-.48 1.01a10.515 10.515 0 0 0-.309 1.67Zm10.396-10.34c-1.224.89-2.605 2.189-3.822 3.384l1.718 1.718c1.21-1.205 2.51-2.597 3.387-3.833.47-.662.78-1.227.912-1.662.134-.444.032-.551.009-.575h-.001V1.78c-.014-.014-.113-.113-.548.027-.432.14-.995.462-1.655.942Zm-4.832 7.266-.001.001a9.859 9.859 0 0 0 1.63-1.142L7.155 7.216a9.7 9.7 0 0 0-1.161 1.607c.482.302.889.71 1.19 1.192Z',
  bell: 'M8 16a2 2 0 0 0 1.985-1.75c.017-.137-.097-.25-.235-.25h-3.5c-.138 0-.252.113-.235.25A2 2 0 0 0 8 16ZM3 5a5 5 0 0 1 10 0v2.947c0 .05.015.098.042.139l1.703 2.555A1.519 1.519 0 0 1 13.482 13H2.518a1.516 1.516 0 0 1-1.263-2.36l1.703-2.554A.255.255 0 0 0 3 7.947Zm5-3.5A3.5 3.5 0 0 0 4.5 5v2.947c0 .346-.102.683-.294.97l-1.703 2.556a.017.017 0 0 0-.003.01l.001.006c0 .002.002.004.004.006l.006.004.007.001h10.964l.007-.001.006-.004.004-.006.001-.007a.017.017 0 0 0-.003-.01l-1.703-2.554a1.745 1.745 0 0 1-.294-.97V5A3.5 3.5 0 0 0 8 1.5Z',
  law: 'M8.75.75V2h.985c.304 0 .603.08.867.231l1.29.736c.038.022.08.033.124.033h2.234a.75.75 0 0 1 0 1.5h-.427l2.111 4.692a.75.75 0 0 1-.154.838l-.53-.53.529.531-.001.002-.002.002-.006.006-.006.005-.01.01-.045.04c-.21.176-.441.327-.686.45C14.556 10.78 13.88 11 13 11a4.498 4.498 0 0 1-2.023-.454 3.544 3.544 0 0 1-.686-.45l-.045-.04-.016-.015-.006-.006-.004-.004v-.001a.75.75 0 0 1-.154-.838L12.178 4.5h-.162c-.305 0-.604-.079-.868-.231l-1.29-.736a.245.245 0 0 0-.124-.033H8.75V13h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5V3.5h-.984a.245.245 0 0 0-.124.033l-1.289.737c-.265.15-.564.23-.869.23h-.162l2.112 4.692a.75.75 0 0 1-.154.838l-.53-.53.529.531-.001.002-.002.002-.006.006-.016.015-.045.04c-.21.176-.441.327-.686.45C4.556 10.78 3.88 11 3 11a4.498 4.498 0 0 1-2.023-.454 3.544 3.544 0 0 1-.686-.45l-.045-.04-.016-.015-.006-.006-.004-.004v-.001a.75.75 0 0 1-.154-.838L2.178 4.5H1.75a.75.75 0 0 1 0-1.5h2.234a.249.249 0 0 0 .125-.033l1.288-.737c.265-.15.564-.23.869-.23h.984V.75a.75.75 0 0 1 1.5 0Zm2.945 8.477c.285.135.718.273 1.305.273s1.02-.138 1.305-.273L13 6.327Zm-10 0c.285.135.718.273 1.305.273s1.02-.138 1.305-.273L3 6.327Z',
  chevronLeft: 'M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06Z',
  chevronRight: 'M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z',
  pause: 'M5 2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm5 0h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z',
  play: 'm6.427 4.427 3.396 3.396a.25.25 0 0 1 0 .354l-3.396 3.396A.25.25 0 0 1 6 11.396V4.604a.25.25 0 0 1 .427-.177Z',
  x: 'M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z'
};

const TIPS = [
  {
    icon: 'personAdd',
    title: 'Додай своїх персонажів',
    text: "Увійди через Discord, відкрий свій профіль і на вкладці «Персонажі» впиши імена точно як у грі. Лише з цими персонажами можна софтити предмети й записуватись у черги. Познач основного — його ім'я підкаже іншим, чий це твін.",
    link: { href: './account/', label: 'Відкрити профіль' }
  },
  {
    icon: 'graph',
    title: 'Вкажи GS своїх персонажів',
    text: 'У профілі на вкладці «Персонажі» натисни ⋯ біля персонажа → «Вказати GS» і заповни для кожного спеку окремо. Коли ти записуєшся на рейд, лідер і офіцери бачать GS усіх твоїх персонажів. Так вони швидше вирішать, ким тебе краще взяти.',
    link: { href: './account/', label: 'Відкрити профіль' }
  },
  {
    icon: 'dice',
    title: 'Софт-рол на сайті',
    text: 'Софтимо в меню «Рейди»: відкрий потрібний рейд, обери свого персонажа, боса й предмет. Ліміт софтів і правила ролу — у розділі «Правила ролу 25 гер».',
    link: { href: './raid-manager/archive/', label: 'Відкрити рейди' }
  },
  {
    icon: 'listOrdered',
    title: 'Черга на уламки та кров',
    text: 'Запишись своїм персонажем і стеж за місцем у черзі. Номер у черзі видно й на сторінці рейду біля твого імені.',
    link: { href: './shard-queue/', label: 'Відкрити чергу' }
  },
  {
    icon: 'zap',
    title: 'Черга на посилення',
    text: 'Обери день, боса й тип посилення. Статус змінюють офіцери під час рейду, а після виконання можна записатись знову.',
    link: { href: './buff-queue/', label: 'Відкрити чергу' }
  },
  {
    icon: 'image',
    title: 'Налаштуй фон сайту під себе',
    text: "Фон можна змінити або вимкнути у своєму профілі → «Налаштування» → «Фон сайту».",
    link: { href: './account/#settings', label: 'Налаштування' }
  },
  {
    icon: 'paintbrush',
    title: 'Темна тема',
    text: 'Тему сайту можна змінити у своєму профілі → «Налаштування» → «Тема сайту»: стандартна або темна.',
    link: { href: './account/#settings', label: 'Налаштування' }
  },
  {
    icon: 'bell',
    title: 'Звук, коли тобі передали софти',
    text: "Увімкни звукові сповіщення й налаштуй гучність у своєму профілі → «Налаштування». Звук лунає, поки сторінка рейду відкрита.",
    link: { href: './account/#settings', label: 'Налаштування' }
  },
  {
    icon: 'law',
    title: 'Політика штрафів у рейдах',
    text: 'За критичні помилки в рейдах передбачені штрафи. З переліком можна ознайомитись у меню «Рейди ▾ → Штрафбат».',
    link: { href: './raid-manager/penalty-battalion/#templates', label: 'Відкрити Штрафбат' }
  }
];

const HIDDEN_KEY = 'indexTipsHiddenVersion';
const NEXT_KEY = 'indexTipsNextIndex';

// Сховище може бути недоступне (приватне вікно, заблоковані дані сайту).
function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* без запам'ятовування */ }
}

function storageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* сховище недоступне */ }
}

// Кнопка-лампочка біля заголовка: видна лише поки карусель закрита й
// повертає її без перезавантаження сторінки.
function setRestoreButtonVisible(visible) {
  const btn = document.getElementById('indexTipsRestoreBtn');
  if (btn) btn.hidden = !visible;
  return btn;
}

function svgIcon(name, className = '') {
  return `<svg${className ? ` class="${className}"` : ''} viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="${TIP_ICONS[name]}"/></svg>`;
}

function iconButton(className, label, iconName) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `index-tips__btn tooltipped ${className}`;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = svgIcon(iconName);
  return btn;
}

function initIndexTips() {
  const root = document.getElementById('indexTips');
  if (!root || !TIPS.length) return null;
  if (storageGet(HIDDEN_KEY) === String(TIPS_VERSION)) {
    setRestoreButtonVisible(true);
    return null;
  }
  setRestoreButtonVisible(false);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPhone = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

  // Кожен візит — з наступної підказки.
  let index = Number(storageGet(NEXT_KEY)) || 0;
  if (index < 0 || index >= TIPS.length) index = 0;
  storageSet(NEXT_KEY, String((index + 1) % TIPS.length));

  let rotating = !reducedMotion && !isPhone;
  let hovered = false;
  let focused = false;
  let timer = null;

  // ---- розмітка ----
  const slidesEl = document.createElement('div');
  slidesEl.className = 'index-tips__slides';

  const slides = TIPS.map((tip, i) => {
    const slide = document.createElement('div');
    slide.className = 'index-tips__slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'підказка');
    slide.setAttribute('aria-label', `${i + 1} з ${TIPS.length}`);
    slide.innerHTML = `${svgIcon(tip.icon, 'index-tips__icon')}<div class="index-tips__body"><h2 class="index-tips__title"></h2><p class="index-tips__text"></p></div>`;
    slide.querySelector('.index-tips__title').textContent = tip.title;
    slide.querySelector('.index-tips__text').textContent = tip.text;
    if (tip.link) {
      const link = document.createElement('a');
      link.className = 'link-button-std index-tips__link';
      link.href = tip.link.href;
      link.textContent = tip.link.label;
      slide.querySelector('.index-tips__body').appendChild(link);
    }
    slidesEl.appendChild(slide);
    return slide;
  });

  // Кнопка автопрокрутки — перша в порядку фокусу (W3C APG).
  const rotationBtn = iconButton('tooltipped--s tooltipped--sw index-tips__rotation', '', 'pause');
  const hideBtn = iconButton('tooltipped--s tooltipped--sw', 'Сховати підказки', 'x');
  const topControls = document.createElement('div');
  topControls.className = 'index-tips__top';
  topControls.append(rotationBtn, hideBtn);

  const prevBtn = iconButton('', 'Попередня підказка', 'chevronLeft');
  const nextBtn = iconButton('', 'Наступна підказка', 'chevronRight');
  const dotsEl = document.createElement('div');
  dotsEl.className = 'index-tips__dots';
  const dots = TIPS.map((tip, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'index-tips__dot';
    dot.setAttribute('aria-label', `Підказка ${i + 1}: ${tip.title}`);
    dot.addEventListener('click', () => goTo(i, true));
    dotsEl.appendChild(dot);
    return dot;
  });
  const counterEl = document.createElement('span');
  counterEl.className = 'index-tips__counter';

  const nav = document.createElement('div');
  nav.className = 'index-tips__nav';
  nav.append(prevBtn, dotsEl, counterEl, nextBtn);

  root.setAttribute('aria-roledescription', 'карусель');
  root.setAttribute('aria-label', 'Підказки про сайт');
  root.append(topControls, slidesEl, nav);

  // ---- стан ----
  function render() {
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      // Посилання прихованих слайдів не мають ловити Tab.
      slide.querySelectorAll('a').forEach((a) => { a.tabIndex = active ? 0 : -1; });
    });
    dots.forEach((dot, i) => dot.setAttribute('aria-current', i === index ? 'true' : 'false'));
    counterEl.textContent = `${index + 1} / ${TIPS.length}`;

    const label = rotating ? 'Зупинити автопрокрутку' : 'Увімкнути автопрокрутку';
    rotationBtn.setAttribute('aria-label', label);
    // Трикутник "play" в Octicons (triangle-right) дрібніший за паузу —
    // збільшуємо його класом, щоб кнопка не "стрибала" при перемиканні.
    rotationBtn.innerHTML = rotating ? svgIcon('pause') : svgIcon('play', 'index-tips__icon--play');
    // Поки крутиться — без live-регіону, інакше зчитувач перебивав би читання.
    slidesEl.setAttribute('aria-live', rotating ? 'off' : 'polite');
  }

  function schedule() {
    clearTimeout(timer);
    if (!rotating) return;
    timer = setTimeout(() => {
      if (!hovered && !focused && !document.hidden) index = (index + 1) % TIPS.length;
      render();
      schedule();
    }, TIP_INTERVAL_MS);
  }

  // Будь-яке ручне гортання зупиняє автопрокрутку до кінця візиту.
  function goTo(i, byUser) {
    index = (i + TIPS.length) % TIPS.length;
    if (byUser) rotating = false;
    render();
    schedule();
  }

  prevBtn.addEventListener('click', () => goTo(index - 1, true));
  nextBtn.addEventListener('click', () => goTo(index + 1, true));

  rotationBtn.addEventListener('click', () => {
    rotating = !rotating;
    render();
    schedule();
  });

  hideBtn.addEventListener('click', (event) => {
    storageSet(HIDDEN_KEY, String(TIPS_VERSION));
    clearTimeout(timer);
    // Порожній чистий блок на місці старого: повторний initIndexTips() з
    // кнопки-лампочки збудує карусель заново, без подвійних слухачів.
    const placeholder = document.createElement('section');
    placeholder.id = root.id;
    placeholder.className = root.className;
    placeholder.hidden = true;
    root.replaceWith(placeholder);
    const restoreBtn = setRestoreButtonVisible(true);
    // З клавіатури (detail 0) фокус не має губитись разом із кнопкою ✕.
    if (event.detail === 0) restoreBtn?.focus();
  });

  root.addEventListener('mouseenter', () => { hovered = true; });
  root.addEventListener('mouseleave', () => { hovered = false; });
  // Фокус на самій кнопці автопрокрутки паузу не ставить — користувач щойно
  // явно її ввімкнув (W3C APG).
  root.addEventListener('focusin', (event) => { focused = event.target !== rotationBtn; });
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget)) focused = false;
  });

  // Гортання пальцем.
  let touchX = null;
  slidesEl.addEventListener('touchstart', (event) => { touchX = event.touches[0].clientX; }, { passive: true });
  slidesEl.addEventListener('touchend', (event) => {
    if (touchX === null) return;
    const dx = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 40) goTo(index + (dx < 0 ? 1 : -1), true);
  });

  root.hidden = false;
  render();
  schedule();
  return root;
}

document.addEventListener('DOMContentLoaded', () => {
  initIndexTips();
  document.getElementById('indexTipsRestoreBtn')?.addEventListener('click', (event) => {
    storageRemove(HIDDEN_KEY);
    const root = initIndexTips();
    // З клавіатури переводимо фокус на карусель: кнопка-лампочка зникла.
    if (root && event.detail === 0) {
      root.tabIndex = -1;
      root.focus();
    }
  });
});
