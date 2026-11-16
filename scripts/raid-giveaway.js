// Розіграш призів у рейді (сторінка рейду). Логіка й випадковість - на
// воркері (worker/src/giveaways.js): тут лише показ стану, кнопка "Кинути
// кубик", рулетка (показує вже визначеного сервером переможця) і форма
// старту для офіцерів у вкладці "Налаштування".
//
// Оновлення: snapshot сторінки (раз на 20 с) приносить id/статус останнього
// розіграшу; поки розіграш триває - окреме часте оновлення /giveaway.
//
// Залежить від: raid-manager-shared.js (apiCall), auth-shared.js
// (getSessionToken), ui-shared.js (openModal, closeModal, onModalCancel,
// setModalBusy, showMessageModal).

const GIVEAWAY_POLL_MS = 2500;
const GIVEAWAY_SPIN_MS = 5000;
// Рулетку показуємо лише для щойно зіграних раундів - хто відкрив сторінку
// пізніше, бачить одразу результат.
const GIVEAWAY_SPIN_RECENT_MS = 20000;
const GIVEAWAY_ICON_BASE = 'https://wow.zamimg.com/images/wow/icons';
// Межі поля "кількість": пачка предметів / сума золота (як MAX_GOLD воркера).
const GIVEAWAY_MAX_COUNT = 20;
const GIVEAWAY_MAX_GOLD = 10000;
const GIVEAWAY_DEFAULT_GOLD = 100;
// Категорія каталогу лише для фронту: золото не входить у каталог воркера.
const GIVEAWAY_GOLD_CATEGORY = 'gold';
const GIVEAWAY_CRITERIA = [
  { key: 'signup', label: 'Записаний у рейд до його початку' },
  { key: 'gearScore', label: 'GS указано в усіх персонажів' },
  { key: 'softs', label: 'Має софти в цьому рейді' },
  { key: 'noPenalties', label: 'Немає штрафів у цьому рейді' }
];
const GIVEAWAY_GIFT_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M2 2.75A2.75 2.75 0 0 1 4.75 0c.983 0 1.873.42 2.57 1.232.268.318.497.668.68 1.042.183-.375.411-.725.68-1.044C9.376.42 10.266 0 11.25 0a2.75 2.75 0 0 1 2.45 4h.55c.966 0 1.75.784 1.75 1.75v2c0 .698-.409 1.301-1 1.582v4.918A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V9.332C.409 9.05 0 8.448 0 7.75v-2C0 4.784.784 4 1.75 4h.55c-.192-.375-.3-.8-.3-1.25ZM7.25 9.5H2.5v4.75c0 .138.112.25.25.25h4.5Zm1.5 0v5h4.5a.25.25 0 0 0 .25-.25V9.5Zm0-4V8h5.5a.25.25 0 0 0 .25-.25v-2a.25.25 0 0 0-.25-.25Zm-7 0a.25.25 0 0 0-.25.25v2c0 .138.112.25.25.25h5.5V5.5h-5.5Zm3-4a1.25 1.25 0 0 0 0 2.5h2.309c-.233-.818-.542-1.401-.878-1.793-.43-.502-.915-.707-1.431-.707ZM8.941 4h2.309a1.25 1.25 0 0 0 0-2.5c-.516 0-1 .205-1.43.707-.337.392-.646.975-.879 1.793Z"/></svg>';
// Закрити завершений розіграш - хрестик (Octicons x-16).
const GIVEAWAY_CLOSE_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>';
// Згорнути банер - риска, як 'Згорнути' у вікнах (Octicons dash-16).
const GIVEAWAY_MINIMIZE_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M2 7.75A.75.75 0 0 1 2.75 7h10a.75.75 0 0 1 0 1.5h-10A.75.75 0 0 1 2 7.75Z"/></svg>';
// Кубик - та сама іконка, що в блоці "Правила ролу" на головній.
const GIVEAWAY_DICE_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13.25 1c.966 0 1.75.784 1.75 1.75v10.5c0 .464-.184.909-.513 1.237A1.746 1.746 0 0 1 13.25 15H2.75c-.464 0-.909-.184-1.237-.513A1.746 1.746 0 0 1 1 13.25V2.75C1 1.784 1.784 1 2.75 1h10.5ZM2.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25H2.75Z"/><path d="M5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm6-6a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>';
const GIVEAWAY_QUALITY_VARS = ['poor', 'common', 'uncommon', 'rare', 'epic', 'legendary'];

function giveawayReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function giveawayIconUrl(icon, size = 'medium') {
  return `${GIVEAWAY_ICON_BASE}/${size}/${icon}.jpg`;
}

// gold == null - золото без суми (каталог і рядок обраного призу, де
// сума - у полі кількості).
function giveawayGoldText(gold) {
  if (gold == null) return 'Золото';
  return `${Number(gold).toLocaleString('uk-UA')} золота`;
}

// { icon, name, color } для призу з відповіді воркера.
function giveawayPrizeLook(prize) {
  if (prize.type === 'hidden') return { icon: 'inv_misc_questionmark', name: 'Прихований приз', color: '' };
  if (prize.type === 'gold') return { icon: 'inv_misc_coin_01', name: giveawayGoldText(prize.gold), color: 'var(--wow-money-gold)' };
  const q = GIVEAWAY_QUALITY_VARS[prize.quality] || 'common';
  return { icon: prize.icon, name: prize.name, color: `var(--wow-quality-${q})` };
}

function giveawayPrizeNode(prize, size = 'small') {
  const look = giveawayPrizeLook(prize);
  const wrap = document.createElement('span');
  wrap.className = 'giveaway-prize';
  // Підказка Wowhead при наведенні - спільний обробник сторінки рейду
  // ([data-item-id] + data/item-icons.json). Прихований приз - без неї.
  if (prize.type === 'item' && prize.itemId) wrap.dataset.itemId = String(prize.itemId);
  // Предмет, доданий офіцерами з сайту, - опис приходить від воркера.
  if (prize.tooltip && typeof itemIconData === 'object' && itemIconData && !itemIconData[prize.itemId]) {
    itemIconData[prize.itemId] = { icon: prize.icon, quality: prize.quality, tooltip: prize.tooltip };
  }
  const img = document.createElement('img');
  img.src = giveawayIconUrl(look.icon, size);
  img.alt = '';
  img.className = `giveaway-prize-icon giveaway-prize-icon--${size}`;
  const name = document.createElement('span');
  name.className = 'giveaway-prize-name';
  name.textContent = look.name;
  if (look.color) name.style.color = look.color;
  wrap.append(img, name);
  // Пачка (напр. 5 Fish Feast) - один приз одному переможцю.
  if (prize.type !== 'hidden' && prize.quantity > 1) {
    const qty = document.createElement('span');
    qty.className = 'giveaway-prize-qty';
    qty.textContent = `×${prize.quantity}`;
    wrap.appendChild(qty);
  }
  // Офіцер бачить прихований приз - з позначкою, що гравцям його не видно.
  if (prize.hidden && prize.type !== 'hidden') {
    const tag = document.createElement('span');
    tag.className = 'raid-chip giveaway-hidden-chip';
    tag.textContent = 'наосліп';
    wrap.appendChild(tag);
  }
  return wrap;
}

// Підтвердження у стилі сайту (без нативного confirm()).
let giveawayConfirmEl = null;
function giveawayConfirm(text, confirmLabel) {
  if (!giveawayConfirmEl) {
    giveawayConfirmEl = document.createElement('dialog');
    giveawayConfirmEl.className = 'raid-modal';
    giveawayConfirmEl.setAttribute('aria-labelledby', 'giveawayConfirmTitle');
    giveawayConfirmEl.innerHTML = `
      <div class="raid-modal-backdrop"></div>
      <div class="raid-modal-box">
        <h3 class="raid-modal-title" id="giveawayConfirmTitle">Розіграш</h3>
        <p class="giveaway-confirm-text"></p>
        <div class="raid-modal-actions">
          <button type="button" class="compare-btn compare-btn--danger giveaway-confirm-ok"></button>
          <button type="button" class="link-button-std giveaway-confirm-cancel">Скасувати</button>
        </div>
      </div>`;
    document.body.appendChild(giveawayConfirmEl);
  }
  const dlg = giveawayConfirmEl;
  dlg.querySelector('.giveaway-confirm-text').textContent = text;
  dlg.querySelector('.giveaway-confirm-ok').textContent = confirmLabel;
  return new Promise((resolve) => {
    const done = (value) => {
      dlg.querySelector('.giveaway-confirm-ok').onclick = null;
      dlg.querySelector('.giveaway-confirm-cancel').onclick = null;
      dlg.querySelector('.raid-modal-backdrop').onclick = null;
      closeModal(dlg);
      resolve(value);
    };
    dlg.querySelector('.giveaway-confirm-ok').onclick = () => done(true);
    dlg.querySelector('.giveaway-confirm-cancel').onclick = () => done(false);
    dlg.querySelector('.raid-modal-backdrop').onclick = () => done(false);
    dlg.oncancel = (e) => { e.preventDefault(); done(false); };
    openModal(dlg);
  });
}

// opts: { raidId, isOfficer(): bool, isRaidCompleted(): bool, bannerEl, settingsEl }
function initRaidGiveaway(opts) {
  const { raidId, bannerEl, settingsEl } = opts;
  let state = null; // остання відповідь /giveaway
  let clockOffset = 0; // серверний час - локальний
  let pollTimer = null;
  let tickTimer = null;
  let fetching = false;
  let rolling = false;
  const spunRounds = new Set();
  let spinning = null; // { roundId, until }
  let renderedBeforeStart = null; // раунд, намальований ще до свого старту
  let catalog = null;
  const selected = []; // [{ key, itemId?, gold?, count, hidden, prize }]
  // Золото - кожне додавання окремим призом (500 і 1000 - два раунди), тож
  // ключ унікальний; сума живе в gold, кількість завжди 1.
  let goldSeq = 0;
  const goldEntry = (gold, hidden = true) => ({
    key: `g${++goldSeq}`, gold, count: 1, hidden, prize: { type: 'gold', gold: null }
  });
  // Чернетка обраних призів - щоб перезавантаження сторінки її не скидало.
  const draftKey = `giveawayDraft:${raidId}`;

  function saveDraft() {
    try {
      if (selected.length) {
        localStorage.setItem(draftKey, JSON.stringify(selected.map(({ itemId, gold, count, hidden }) => ({ itemId, gold, count, hidden }))));
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch { /* без сховища - чернетка живе до перезавантаження */ }
  }

  // Після завантаження каталогу: лише призи, що є в ньому (каталог міг змінитись).
  function loadDraft() {
    let draft = [];
    try { draft = JSON.parse(localStorage.getItem(draftKey) || '[]'); } catch { draft = []; }
    if (!Array.isArray(draft)) return;
    draft.forEach((d) => {
      const count = Math.max(1, Math.min(20, Number(d.count) || 1));
      if (d.itemId != null) {
        const p = catalog.prizes.find((x) => x.id === Number(d.itemId));
        if (!p) return;
        selected.push({ key: `i${p.id}`, itemId: p.id, count, hidden: Boolean(d.hidden), prize: { type: 'item', itemId: p.id, icon: p.icon, name: p.name, quality: p.quality } });
      } else if (Number.isInteger(d.gold) && d.gold > 0) {
        selected.push(goldEntry(Math.min(GIVEAWAY_MAX_GOLD, d.gold), Boolean(d.hidden)));
      }
    });
  }
  const dismissKey = `giveawayDismissed:${raidId}`;
  // Згорнутий банер (id розіграшу) - новий розіграш знову відкривається.
  const collapseKey = `giveawayCollapsed:${raidId}`;
  let collapsedFallback = null;

  const serverNow = () => Date.now() + clockOffset;

  // Синхронізація годинника за Крістіаном (як NTP): серверний час відповідає
  // середині запиту, похибка - до половини його тривалості. Беремо замір із
  // найкоротшим запитом (найточніший); повільні відповіді годинник не зсувають.
  // Кращий замір "старіє" (+1 мс до похибки за секунду) - щоб годинник
  // зрештою підлаштувався, якщо локальний дрейфує.
  let bestClock = null; // { offset, error, at }
  function sampleClock(serverIso, sentAt, receivedAt) {
    const error = (receivedAt - sentAt) / 2;
    const offset = Date.parse(serverIso) - (sentAt + receivedAt) / 2;
    const aged = bestClock ? bestClock.error + (receivedAt - bestClock.at) / 1000 : Infinity;
    if (error <= aged) {
      bestClock = { offset, error, at: receivedAt };
      clockOffset = offset;
    }
  }

  async function fetchState() {
    if (fetching) return;
    fetching = true;
    try {
      const sentAt = Date.now();
      const data = await apiCall('GET', `/raids/${raidId}/giveaway`, { token: getSessionToken() });
      sampleClock(data.serverNow, sentAt, Date.now());
      applyState(data);
    } catch (err) {
      console.error(err);
    } finally {
      fetching = false;
    }
  }

  // Смужка прогресу раунду: щокадру ширина = частка часу, що лишилась.
  let progressFrame = null;
  function paintProgress(fill) {
    const start = Number(fill.dataset.start);
    const end = Number(fill.dataset.end);
    const frac = Math.max(0, Math.min(1, (end - serverNow()) / (end - start)));
    fill.style.transform = `scaleX(${frac})`;
  }
  function startProgressLoop() {
    if (progressFrame) return;
    const step = () => {
      const fill = bannerEl.querySelector('.giveaway-progress-bar');
      if (!fill) { progressFrame = null; return; }
      paintProgress(fill);
      progressFrame = requestAnimationFrame(step);
    };
    progressFrame = requestAnimationFrame(step);
  }

  function applyState(data) {
    // Годинник - лише з fetchState (там відомий час запиту); тут - перший
    // раз, поки замірів ще немає.
    if (!bestClock) clockOffset = Date.parse(data.serverNow) - Date.now();
    const prevRounds = new Map((state?.giveaway?.rounds || []).map((r) => [r.id, r.status]));
    state = data;
    // Рулетка - для раунду, що щойно закрився (на очах у гравця або нещодавно).
    const g = state.giveaway;
    if (g && !spinning) {
      const justDone = g.rounds.find((r) => (r.status === 'done' || r.status === 'void')
        && !spunRounds.has(r.id)
        && r.endsAt && serverNow() - Date.parse(r.endsAt) < GIVEAWAY_SPIN_RECENT_MS
        && (prevRounds.get(r.id) === 'active' || !prevRounds.size));
      g.rounds.filter((r) => r.status !== 'active' && r.status !== 'pending').forEach((r) => {
        if (r !== justDone) spunRounds.add(r.id);
      });
      if (justDone && justDone.status === 'done' && justDone.rolls.length > 1 && !giveawayReducedMotion()) {
        spunRounds.add(justDone.id);
        spinning = { roundId: justDone.id, until: Date.now() + GIVEAWAY_SPIN_MS + 1500, started: false };
      } else if (justDone) {
        spunRounds.add(justDone.id);
      }
    }
    render();
    schedule();
  }

  function schedule() {
    clearTimeout(pollTimer);
    clearInterval(tickTimer);
    const active = state?.giveaway?.status === 'active';
    if (active && !opts.isRaidCompleted()) {
      pollTimer = setTimeout(fetchState, document.hidden ? GIVEAWAY_POLL_MS * 4 : GIVEAWAY_POLL_MS);
      tickTimer = setInterval(tick, 250);
    }
  }

  // Щосекундне оновлення таймерів без запиту; кінець раунду - одразу запит.
  function tick() {
    const round = activeRound();
    if (!round) return;
    const end = Date.parse(round.endsAt);
    const timerEl = bannerEl.querySelector('.giveaway-timer');
    const now = serverNow();
    const start = Date.parse(round.startsAt);
    if (now < start) {
      // Перший раунд - старт усього розіграшу, далі - анонс наступного.
      const first = !state.giveaway.rounds.some((r) => r.id !== round.id && r.startsAt);
      const left = Math.ceil((start - now) / 1000);
      if (timerEl) timerEl.textContent = first ? `Розіграш почнеться через ${left} с` : `Наступний раунд почнеться через ${left} с`;
      return;
    }
    // Раунд щойно почався - один раз перемальовуємо (кнопка стає активною).
    if (renderedBeforeStart === round.id) {
      renderedBeforeStart = null;
      render();
      return;
    }
    if (timerEl) timerEl.textContent = `${Math.max(0, Math.ceil((end - now) / 1000))} с`;
    if (now >= end) fetchState();
  }

  // Керує розіграшем лише офіцер, що його почав (рішення сервера).
  function canManage() {
    return Boolean(state?.canManage);
  }

  function activeRound() {
    return state?.giveaway?.rounds.find((r) => r.status === 'active') || null;
  }

  // ---------- банер ----------

  function render() {
    // Поки крутиться рулетка, банер не перемальовуємо - інакше оновлення
    // стану (кожні кілька секунд) обірвало б анімацію.
    if (!(spinning && spinning.started)) renderBanner();
    renderSettings();
  }

  // Режим фокусу: поки банер розгорнутий, решта сторінки розмита й
  // неактивна (inert - ні миша, ні Tab, ні скрінрідер). Модалки й тултіпи
  // лежать поза .container і лишаються робочими.
  function applyFocus(on) {
    document.body.classList.toggle('giveaway-focus', on);
    const targets = [
      document.querySelector('.topbar'),
      ...document.querySelectorAll('.container-inner > :not(#raidContent)'),
      ...[...bannerEl.parentElement.children].filter((el) => el !== bannerEl)
    ];
    targets.forEach((el) => { if (el) el.inert = on; });
  }

  function isCollapsed(g) {
    try { return localStorage.getItem(collapseKey) === String(g.id); } catch { return collapsedFallback === g.id; }
  }

  function setCollapsed(g, value) {
    collapsedFallback = value ? g.id : null;
    try {
      if (value) localStorage.setItem(collapseKey, String(g.id));
      else localStorage.removeItem(collapseKey);
    } catch { /* без сховища - лише до перезавантаження */ }
    // Згорнули посеред рулетки - анімацію не дочікуємо.
    if (value) spinning = null;
    renderBanner();
  }

  function renderBanner() {
    bannerEl.innerHTML = '';
    bannerEl.classList.remove('giveaway-banner--collapsed');
    const g = state?.giveaway;
    const dismissed = (() => { try { return localStorage.getItem(dismissKey) === String(g?.id); } catch { return false; } })();
    if (!g || g.status === 'cancelled' || (g.status === 'finished' && dismissed && !spinning)) {
      bannerEl.hidden = true;
      applyFocus(false);
      return;
    }
    bannerEl.hidden = false;

    // Згорнутий - вузька смужка без фокусу; клік повертає банер.
    if (isCollapsed(g)) {
      // Рулетка, що ще не почалась, у згорнутому вигляді не крутиться.
      if (spinning && !spinning.started) spinning = null;
      bannerEl.classList.add('giveaway-banner--collapsed');
      const strip = document.createElement('div');
      strip.className = 'giveaway-strip';
      const label = document.createElement('span');
      label.className = 'giveaway-title';
      label.innerHTML = GIVEAWAY_GIFT_ICON;
      const text = document.createElement('span');
      text.textContent = g.status === 'finished' ? 'Розіграш завершено' : 'Іде розіграш';
      label.appendChild(text);
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'link-button-std giveaway-strip-back';
      back.textContent = 'Повернутись';
      back.addEventListener('click', () => setCollapsed(g, false));
      strip.append(label, back);
      bannerEl.appendChild(strip);
      applyFocus(false);
      return;
    }
    applyFocus(true);

    const head = document.createElement('div');
    head.className = 'giveaway-head';
    const title = document.createElement('span');
    title.className = 'giveaway-title';
    title.innerHTML = GIVEAWAY_GIFT_ICON;
    const played = g.rounds.filter((r) => r.status !== 'rerolled');
    const round = activeRound();
    // Поки крутиться рулетка - номер того призу, що розігрувався.
    const shown = spinning ? g.rounds.find((r) => r.id === spinning.roundId) : round;
    const titleText = document.createElement('span');
    titleText.textContent = g.status === 'finished' ? 'Розіграш завершено'
      : shown ? `Розіграш · приз ${played.indexOf(shown) + 1} з ${played.length}` : 'Розіграш';
    title.appendChild(titleText);
    head.appendChild(title);
    let closeBtn = null;
    if (canManage() && g.status === 'active') {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'link-button-std link-button-std--danger';
      cancel.textContent = 'Скасувати розіграш';
      cancel.addEventListener('click', async () => {
        if (!(await giveawayConfirm('Скасувати розіграш? Незіграні призи не розіграються.', 'Скасувати розіграш'))) return;
        await officerAction('POST', `/raids/${raidId}/giveaway/cancel`);
      });
      head.appendChild(cancel);
    } else if (opts.isOfficer() && g.status === 'active') {
      const owner = document.createElement('span');
      owner.className = 'giveaway-owner'; // не .giveaway-timer - його переписує tick()
      owner.textContent = `Веде: ${g.createdBy}`;
      head.appendChild(owner);
    } else if (g.status === 'finished') {
      const close = document.createElement('button');
      close.type = 'button';
      // Закрити (хрестик) - сховати завершений розіграш остаточно.
      close.className = 'raid-icon-btn tooltipped tooltipped--sw giveaway-close-btn';
      close.setAttribute('aria-label', 'Закрити розіграш');
      close.innerHTML = GIVEAWAY_CLOSE_ICON;
      close.addEventListener('click', () => {
        // Офіцер-ведучий не ховає банер, поки є невидані призи: "видано" є лише тут.
        const undelivered = canManage() ? g.rounds.filter((r) => r.status === 'done' && !r.delivered) : [];
        if (undelivered.length) {
          const list = undelivered.map((r) => `${giveawayPrizeLook(r.prize).name} - ${r.winner.name}`).join('; ');
          showMessageModal(`Спершу познач видачу всіх призів. Ще не видано: ${list}.`, 'Розіграш');
          return;
        }
        try { localStorage.setItem(dismissKey, String(g.id)); } catch { /* без сховища - просто ховаємо зараз */ }
        bannerEl.hidden = true;
        applyFocus(false);
      });
      closeBtn = close;
    }
    // "Згорнути" (риска) - будь-коли (і гравцю, і офіцеру): сторінка повертається
    // до звичного вигляду, лишається смужка "Повернутись".
    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'raid-icon-btn tooltipped tooltipped--sw giveaway-collapse-btn';
    collapse.setAttribute('aria-label', 'Згорнути розіграш');
    collapse.innerHTML = GIVEAWAY_MINIMIZE_ICON;
    collapse.addEventListener('click', () => setCollapsed(g, true));
    head.appendChild(collapse);
    // Порядок як у вікнах: "Згорнути", потім "Закрити".
    if (closeBtn) head.appendChild(closeBtn);
    bannerEl.appendChild(head);

    if (spinning) {
      renderSpin(g.rounds.find((r) => r.id === spinning.roundId));
    } else if (round) {
      renderRound(round);
    } else if (g.waitingForOfficer) {
      renderWaiting(g);
    }
    renderResults(g);
  }

  // Між раундами: наступний стартує лише з дії офіцера - позначки "видано"
  // або кнопки "Наступний раунд" (коли видавати нічого).
  function renderWaiting(g) {
    const box = document.createElement('div');
    box.className = 'giveaway-round giveaway-waiting';
    const left = g.rounds.filter((r) => r.status === 'pending').length;
    const text = document.createElement('div');
    text.className = 'giveaway-action giveaway-action--note';
    const undelivered = g.rounds.filter((r) => r.status === 'done' && !r.delivered);
    if (!canManage()) {
      text.textContent = `Очікуємо, поки ${g.createdBy || 'офіцер'} розпочне наступний раунд (призів у черзі: ${left}).`;
      box.appendChild(text);
    } else if (undelivered.length) {
      text.textContent = `Познач «видано» у результатах, щоб розпочати наступний раунд (призів у черзі: ${left}).`;
      box.appendChild(text);
    } else {
      text.textContent = `Призів у черзі: ${left}.`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'compare-btn giveaway-next-btn';
      btn.textContent = 'Наступний раунд';
      btn.disabled = opts.isRaidCompleted();
      btn.addEventListener('click', () => {
        btn.disabled = true;
        officerAction('POST', `/raids/${raidId}/giveaway/next`);
      });
      box.append(text, btn);
    }
    bannerEl.appendChild(box);
  }

  function renderRound(round) {
    const box = document.createElement('div');
    box.className = 'giveaway-round';
    const prizeRow = document.createElement('div');
    prizeRow.className = 'giveaway-current-prize';
    prizeRow.appendChild(giveawayPrizeNode(round.prize, 'medium'));
    const timer = document.createElement('span');
    timer.className = 'giveaway-timer';
    prizeRow.appendChild(timer);
    box.appendChild(prizeRow);

    const now = serverNow();
    const started = now >= Date.parse(round.startsAt);
    renderedBeforeStart = started ? null : round.id;
    if (started) {
      const bar = document.createElement('div');
      bar.className = 'giveaway-progress';
      bar.innerHTML = '<div class="giveaway-progress-bar"></div>';
      box.appendChild(bar);
      // Ширину щокадру рахує animateProgress() як функцію часу - тож
      // перемальовування банера (нова смужка) продовжує з тієї ж точки.
      const fill = bar.firstChild;
      fill.dataset.start = String(Date.parse(round.startsAt));
      fill.dataset.end = String(Date.parse(round.endsAt));
      paintProgress(fill);
      startProgressLoop();
    }

    const me = state.me;
    const action = document.createElement('div');
    action.className = 'giveaway-action';
    if (me?.roll != null) {
      const mine = document.createElement('span');
      mine.className = 'giveaway-my-roll';
      mine.textContent = `Твій рол: ${me.roll}`;
      action.appendChild(mine);
    } else if (me?.excluded) {
      action.textContent = 'Цей приз перекидається без тебе - ти вже його вигравав.';
      action.classList.add('giveaway-action--note');
    } else if (me && !me.eligible) {
      action.classList.add('giveaway-action--note');
      const lead = document.createElement('div');
      lead.textContent = 'Щоб узяти участь, бракує:';
      const ul = document.createElement('ul');
      me.missing.forEach((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        ul.appendChild(li);
      });
      action.append(lead, ul);
    } else if (me) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'compare-btn giveaway-roll-btn';
      btn.innerHTML = `${GIVEAWAY_DICE_ICON}<span class="giveaway-roll-label">Кинути кубик</span>`;
      btn.disabled = !started || rolling;
      btn.addEventListener('click', () => roll(btn));
      action.appendChild(btn);
    }
    box.appendChild(action);

    box.appendChild(rollsList(round.rolls, null));
    bannerEl.appendChild(box);
    setTimeout(tick, 0);
  }

  function rollsList(rolls, winnerId) {
    const list = document.createElement('ol');
    list.className = 'giveaway-rolls';
    if (!rolls.length) {
      const li = document.createElement('li');
      li.className = 'giveaway-rolls-empty';
      li.textContent = 'Ще ніхто не кинув';
      list.appendChild(li);
      return list;
    }
    rolls.forEach((r) => {
      const li = document.createElement('li');
      if (r.discordId === winnerId) li.classList.add('giveaway-rolls-winner');
      if (r.discordId === state.me?.discordId) li.classList.add('giveaway-rolls-mine');
      const name = document.createElement('span');
      name.textContent = r.name;
      const value = document.createElement('span');
      value.className = 'giveaway-rolls-value';
      value.textContent = r.tieRoll != null ? `${r.roll} (${r.tieRoll})` : String(r.roll);
      li.append(name, value);
      list.appendChild(li);
    });
    return list;
  }

  async function roll(btn) {
    rolling = true;
    btn.disabled = true;
    try {
      const data = await apiCall('POST', `/raids/${raidId}/giveaway/roll`, { token: getSessionToken() });
      const value = data.me?.roll;
      if (value != null && !giveawayReducedMotion()) await animateDice(btn, value);
      applyState(data);
    } catch (err) {
      showMessageModal(err.message, 'Розіграш');
      fetchState();
    } finally {
      rolling = false;
    }
  }

  // Кубик: швидка зміна чисел і зупинка на тому, що кинув сервер.
  function animateDice(btn, value) {
    return new Promise((resolve) => {
      btn.classList.add('giveaway-roll-btn--rolling');
      const label = btn.querySelector('.giveaway-roll-label');
      const started = Date.now();
      const timer = setInterval(() => {
        if (Date.now() - started >= 900) {
          clearInterval(timer);
          label.textContent = String(value);
          setTimeout(resolve, 500);
          return;
        }
        label.textContent = String(1 + Math.floor(Math.random() * 100));
      }, 60);
    });
  }

  // Рулетка: стрічка з іменами тих, хто кинув, зупиняється на переможці,
  // якого вже визначив сервер.
  function renderSpin(round) {
    const box = document.createElement('div');
    box.className = 'giveaway-round';
    const prizeRow = document.createElement('div');
    prizeRow.className = 'giveaway-current-prize';
    // Приз наосліп гравці бачать лише разом із переможцем - коли рулетка
    // зупиниться (офіцер, що веде розіграш, - одразу; інші офіцери - як гравці).
    const revealLater = Boolean(round.prize.hidden) && !canManage();
    prizeRow.appendChild(giveawayPrizeNode(revealLater ? { type: 'hidden' } : round.prize, 'medium'));
    box.appendChild(prizeRow);

    const viewport = document.createElement('div');
    viewport.className = 'giveaway-spin';
    const strip = document.createElement('div');
    strip.className = 'giveaway-spin-strip';
    const names = round.rolls.map((r) => r.name);
    const cells = [];
    const WIN_INDEX = 30;
    for (let i = 0; i < WIN_INDEX + 4; i++) {
      cells.push(i === WIN_INDEX ? round.winner.name : names[(i * 7 + 3) % names.length]);
    }
    cells.forEach((text, i) => {
      const cell = document.createElement('span');
      cell.className = `giveaway-spin-cell${i === WIN_INDEX ? ' giveaway-spin-cell--win' : ''}`;
      cell.textContent = text;
      strip.appendChild(cell);
    });
    const marker = document.createElement('div');
    marker.className = 'giveaway-spin-marker';
    viewport.append(strip, marker);
    box.appendChild(viewport);
    const result = document.createElement('div');
    result.className = 'giveaway-spin-result';
    box.appendChild(result);
    bannerEl.appendChild(box);

    const runOnce = !spinning.started;
    spinning.started = true;
    requestAnimationFrame(() => {
      const win = strip.children[WIN_INDEX];
      const offset = win.offsetLeft + win.offsetWidth / 2 - viewport.clientWidth / 2;
      if (runOnce) {
        strip.style.transform = 'translateX(0)';
        void strip.offsetWidth;
        strip.style.transition = `transform ${GIVEAWAY_SPIN_MS}ms cubic-bezier(0.12, 0.75, 0.1, 1)`;
      } else {
        strip.style.transition = 'none';
      }
      strip.style.transform = `translateX(${-offset}px)`;
      const showWinner = () => {
        if (revealLater) prizeRow.replaceChildren(giveawayPrizeNode(round.prize, 'medium'));
        win.classList.add('giveaway-spin-cell--won');
        result.textContent = `Виграв ${round.winner.name} (${round.winner.roll})`;
      };
      if (runOnce) {
        setTimeout(() => {
          showWinner();
          setTimeout(() => { spinning = null; render(); }, 1500);
        }, GIVEAWAY_SPIN_MS);
      } else {
        showWinner();
      }
    });
  }

  function renderResults(g) {
    const finished = g.rounds.filter((r) => ['done', 'void', 'rerolled'].includes(r.status)
      && !(spinning && r.id === spinning.roundId));
    if (!finished.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'giveaway-results';
    const h = document.createElement('div');
    h.className = 'giveaway-results-title';
    h.textContent = 'Результати';
    wrap.appendChild(h);
    const officer = canManage();
    finished.forEach((r) => {
      const row = document.createElement('div');
      row.className = `giveaway-result${r.status === 'rerolled' ? ' giveaway-result--rerolled' : ''}`;
      row.appendChild(giveawayPrizeNode(r.prize));
      const who = document.createElement('span');
      who.className = 'giveaway-result-winner';
      who.textContent = r.status === 'void' ? 'ніхто не кинув'
        : r.status === 'rerolled' ? `${r.winner ? r.winner.name : 'ніхто'} - перекинуто`
          : `${r.winner.name} (${r.winner.roll})`;
      row.appendChild(who);
      if (officer && r.status === 'done') {
        const label = document.createElement('label');
        label.className = 'raid-filter-checkbox giveaway-delivered';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = r.delivered;
        box.addEventListener('change', () => officerAction('POST', `/raids/${raidId}/giveaway/rounds/${r.id}/delivered`, { delivered: box.checked }));
        label.append(box, document.createTextNode('видано'));
        row.appendChild(label);
      } else if (r.status === 'done' && r.delivered) {
        const chip = document.createElement('span');
        chip.className = 'raid-chip raid-chip--active';
        chip.textContent = 'видано';
        row.appendChild(chip);
      }
      if (officer && (r.status === 'done' || r.status === 'void') && !r.delivered && !opts.isRaidCompleted()) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'link-button-std';
        btn.textContent = 'Перекинути';
        btn.addEventListener('click', async () => {
          const text = r.winner ? `Розіграти приз ще раз без ${r.winner.name}?` : 'Розіграти приз ще раз?';
          if (!(await giveawayConfirm(text, 'Так'))) return;
          await officerAction('POST', `/raids/${raidId}/giveaway/rounds/${r.id}/reroll`);
        });
        row.appendChild(btn);
      }
      wrap.appendChild(row);
    });
    bannerEl.appendChild(wrap);
  }

  async function officerAction(method, path, body) {
    try {
      const data = await apiCall(method, path, { token: getSessionToken(), body });
      applyState(data);
    } catch (err) {
      showMessageModal(err.message, 'Розіграш');
    }
  }

  // ---------- форма старту (вкладка "Налаштування") ----------

  function renderSettings() {
    if (!settingsEl) return;
    const officer = opts.isOfficer();
    settingsEl.hidden = !officer;
    if (!officer) return;
    const active = state?.giveaway?.status === 'active';
    const note = settingsEl.querySelector('.giveaway-settings-active');
    const form = settingsEl.querySelector('.giveaway-form');
    if (note) note.hidden = !active;
    if (form) form.hidden = active || opts.isRaidCompleted();
    if (!form || active) return;
    if (!catalog) loadCatalog();
  }

  // Предмети, додані офіцерами, - не в статичному data/item-icons.json:
  // їхні іконки й описи (з Wowhead) кладемо в спільну мапу підказок сторінки.
  function registerCatalogTooltips() {
    if (typeof itemIconData !== 'object' || !itemIconData) return;
    catalog.prizes.forEach((p) => {
      if (p.tooltip && !itemIconData[p.id]) itemIconData[p.id] = { icon: p.icon, quality: p.quality, tooltip: p.tooltip };
    });
  }

  async function loadCatalog() {
    catalog = { loading: true };
    try {
      catalog = await apiCall('GET', `/raids/${raidId}/giveaway/prizes`, { token: getSessionToken() });
      buildForm();
    } catch (err) {
      catalog = null;
      console.error(err);
    }
  }

  function buildForm() {
    const form = settingsEl.querySelector('.giveaway-form');
    const categorySelect = form.querySelector('.giveaway-category');
    const search = form.querySelector('.giveaway-search');
    const list = form.querySelector('.giveaway-catalog');
    categorySelect.innerHTML = '<option value="">Усі призи</option>';
    categorySelect.add(new Option('Золото', GIVEAWAY_GOLD_CATEGORY));
    catalog.categories.forEach((c) => categorySelect.add(new Option(c.label, c.key)));

    const renderCatalog = () => {
      const q = search.value.trim().toLocaleLowerCase('en');
      const cat = categorySelect.value;
      list.innerHTML = '';
      // Золото - першим рядком каталогу; сума - у полі обраного призу.
      if ((!cat || cat === GIVEAWAY_GOLD_CATEGORY) && (!q || 'золото gold'.includes(q))) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'giveaway-catalog-item';
        btn.appendChild(giveawayPrizeNode({ type: 'gold', gold: null }));
        btn.addEventListener('click', () => addPrize(goldEntry(GIVEAWAY_DEFAULT_GOLD)));
        list.appendChild(btn);
      }
      if (cat === GIVEAWAY_GOLD_CATEGORY) return;
      catalog.prizes
        .filter((p) => (!cat || p.category === cat) && (!q || p.name.toLocaleLowerCase('en').includes(q) || String(p.id) === q))
        .forEach((p) => {
          // Рядок: кнопка-призу (додає в обрані) + "×" (прибрати з каталогу,
          // лише офіцерам гільдії) - дві кнопки поруч, не одна в одній.
          const row = document.createElement('div');
          row.className = 'giveaway-catalog-row';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'giveaway-catalog-item';
          // Підказка - на весь рядок, не лише на назву.
          btn.dataset.itemId = String(p.id);
          btn.appendChild(giveawayPrizeNode({ type: 'item', itemId: p.id, icon: p.icon, name: p.name, quality: p.quality }));
          btn.addEventListener('click', () => addPrize({ key: `i${p.id}`, itemId: p.id, prize: { type: 'item', itemId: p.id, icon: p.icon, name: p.name, quality: p.quality } }));
          row.appendChild(btn);
          if (catalog.canEditCatalog) {
            const del = document.createElement('button');
            del.type = 'button';
            // Той самий '✕', що біля софтів (.raid-remove-btn); JS-тултіп - список прокручується й обрізав би CSS-тултіп.
            del.className = 'raid-remove-btn giveaway-catalog-remove';
            del.setAttribute('aria-label', 'Прибрати з каталогу');
            del.textContent = '✕';
            bindTooltip(del);
            del.addEventListener('click', async () => {
              if (!(await giveawayConfirm(`Прибрати «${p.name}» з каталогу призів для всіх рейдів?`, 'Прибрати'))) return;
              catalogRequest('DELETE', `/raids/${raidId}/giveaway/catalog/${p.id}`, undefined, del);
            });
            row.appendChild(del);
          }
          list.appendChild(row);
        });
      if (!list.children.length) list.textContent = 'Нічого не знайдено';
    };
    categorySelect.addEventListener('change', renderCatalog);
    search.addEventListener('input', renderCatalog);
    registerCatalogTooltips();
    renderCatalog();

    // Зміна каталогу (офіцери гільдії): відповідь - оновлений каталог.
    const catalogRequest = async (method, path, body, btn) => {
      btn.disabled = true;
      try {
        catalog = await apiCall(method, path, { token: getSessionToken(), body });
        registerCatalogTooltips();
        renderCatalog();
        return true;
      } catch (err) {
        showMessageModal(err.message, 'Каталог призів');
        return false;
      } finally {
        btn.disabled = false;
      }
    };

    // Додати в каталог за WoW ID - лише офіцерам гільдії (рішення сервера).
    const editor = form.querySelector('.giveaway-catalog-editor');
    if (editor && catalog.canEditCatalog) {
      editor.hidden = false;
      const idInput = editor.querySelector('.giveaway-editor-id');
      const catSelect = editor.querySelector('.giveaway-editor-category');
      const result = editor.querySelector('.giveaway-editor-result');
      catSelect.innerHTML = '<option value="">Категорія...</option>';
      catalog.categories.forEach((c) => catSelect.add(new Option(c.label, c.key)));
      editor.querySelector('.giveaway-editor-add').addEventListener('click', async (e) => {
        const id = Number(idInput.value);
        if (!Number.isInteger(id) || id < 1) { idInput.focus(); return; }
        if (!catSelect.value) { catSelect.focus(); return; }
        if (!(await catalogRequest('POST', `/raids/${raidId}/giveaway/catalog`, { itemId: id, category: catSelect.value }, e.currentTarget))) return;
        // Доданий предмет - під кнопкою, з іконкою й підказкою.
        const p = catalog.prizes.find((x) => x.id === id);
        result.innerHTML = '';
        if (p) result.append(giveawayPrizeNode({ type: 'item', itemId: p.id, icon: p.icon, name: p.name, quality: p.quality }), document.createTextNode(' - додано'));
        idInput.value = '';
      });
    }

    const durationSelect = form.querySelector('.giveaway-duration');
    durationSelect.innerHTML = '';
    catalog.roundSeconds.forEach((s) => durationSelect.add(new Option(`${s} с`, String(s))));
    durationSelect.value = catalog.roundSeconds.includes(30) ? '30' : String(catalog.roundSeconds[0]);

    // Галочки умов теж переживають перезавантаження (і лишаються після
    // старту - це налаштування офіцера, а не чернетка). За замовчуванням - усі.
    const criteriaKey = `giveawayCriteria:${raidId}`;
    let savedCriteria = {};
    try { savedCriteria = JSON.parse(localStorage.getItem(criteriaKey) || '{}') || {}; } catch { savedCriteria = {}; }
    const saveCriteria = () => {
      const value = Object.fromEntries([...criteriaBox.querySelectorAll('input')].map((i) => [i.dataset.criterion, i.checked]));
      try { localStorage.setItem(criteriaKey, JSON.stringify(value)); } catch { /* без сховища */ }
    };
    const criteriaBox = form.querySelector('.giveaway-criteria');
    criteriaBox.innerHTML = '';
    GIVEAWAY_CRITERIA.forEach((c) => {
      const label = document.createElement('label');
      label.className = 'raid-filter-checkbox';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = typeof savedCriteria[c.key] === 'boolean' ? savedCriteria[c.key] : true;
      box.addEventListener('change', saveCriteria);
      box.dataset.criterion = c.key;
      label.append(box, document.createTextNode(c.label));
      criteriaBox.appendChild(label);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!selected.length) { showMessageModal('Обери хоча б один приз', 'Розіграш'); return; }
      const submit = form.querySelector('.giveaway-start-btn');
      submit.disabled = true;
      try {
        const criteria = Object.fromEntries([...criteriaBox.querySelectorAll('input')].map((i) => [i.dataset.criterion, i.checked]));
        const data = await apiCall('POST', `/raids/${raidId}/giveaway`, {
          token: getSessionToken(),
          body: {
            prizes: selected.map((s) => (s.itemId != null
              ? { itemId: s.itemId, count: s.count, hidden: s.hidden }
              : { gold: s.gold, count: 1, hidden: s.hidden })),
            criteria,
            roundSeconds: Number(durationSelect.value)
          }
        });
        selected.length = 0;
        renderSelected();
        try { localStorage.removeItem(dismissKey); } catch { /* немає сховища */ }
        applyState(data);
        bannerEl.scrollIntoView({ behavior: giveawayReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      } catch (err) {
        showMessageModal(err.message, 'Розіграш');
      } finally {
        submit.disabled = false;
      }
    });
    if (!selected.length) loadDraft();
    renderSelected();
  }

  function addPrize(entry) {
    // Золото приходить готовим записом (goldEntry) - щоразу новий приз.
    if (entry.gold != null) {
      selected.push(entry);
      renderSelected();
      return;
    }
    const existing = selected.find((s) => s.key === entry.key);
    if (existing) existing.count = Math.min(GIVEAWAY_MAX_COUNT, existing.count + 1);
    else selected.push({ ...entry, count: 1, hidden: true });
    renderSelected();
  }

  function renderSelected() {
    saveDraft();
    const box = settingsEl.querySelector('.giveaway-selected');
    if (!box) return;
    box.innerHTML = '';
    if (!selected.length) {
      box.textContent = 'Призи ще не обрано - додай їх зі списку вище.';
      box.classList.add('giveaway-selected--empty');
      return;
    }
    box.classList.remove('giveaway-selected--empty');
    selected.forEach((s, index) => {
      const row = document.createElement('div');
      row.className = 'giveaway-selected-row';
      row.appendChild(giveawayPrizeNode(s.prize));
      // Для предмета - кількість у пачці, для золота - сума.
      const isGold = s.gold != null;
      const max = isGold ? GIVEAWAY_MAX_GOLD : GIVEAWAY_MAX_COUNT;
      const count = document.createElement('input');
      count.type = 'number';
      count.min = '1';
      count.max = String(max);
      count.value = String(isGold ? s.gold : s.count);
      count.className = 'giveaway-count';
      count.setAttribute('aria-label', isGold ? 'Сума золота' : 'Кількість');
      count.addEventListener('change', () => {
        const value = Math.max(1, Math.min(max, Math.floor(Number(count.value)) || 1));
        if (isGold) s.gold = value; else s.count = value;
        count.value = String(value);
        saveDraft();
      });
      const hiddenLabel = document.createElement('label');
      hiddenLabel.className = 'raid-filter-checkbox';
      const hidden = document.createElement('input');
      hidden.type = 'checkbox';
      hidden.checked = s.hidden;
      hidden.addEventListener('change', () => { s.hidden = hidden.checked; saveDraft(); });
      hiddenLabel.append(hidden, document.createTextNode('наосліп'));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'raid-remove-btn';
      remove.setAttribute('aria-label', 'Прибрати приз');
      remove.textContent = '✕';
      bindTooltip(remove);
      remove.addEventListener('click', () => { selected.splice(index, 1); renderSelected(); });
      row.append(count, hiddenLabel, remove);
      box.appendChild(row);
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state?.giveaway?.status === 'active') fetchState();
  });

  return {
    // З snapshot сторінки: { id, status } останнього розіграшу або null.
    onSnapshot(summary) {
      const known = state?.giveaway;
      if (!summary && !known) { if (!state) applyState({ serverNow: new Date().toISOString(), canManage: false, giveaway: null, me: null }); return; }
      if (summary && (!known || known.id !== summary.id || known.status !== summary.status)) fetchState();
    },
    refresh: fetchState,
    render,
    // Йде розіграш або крутиться рулетка - сторінку не перезавантажуємо.
    isBusy: () => state?.giveaway?.status === 'active' || Boolean(spinning)
  };
}
