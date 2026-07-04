const statusEl = document.getElementById('potionStatus');
const raidsEl = document.getElementById('potionRaids');
const honorStatusEl = document.getElementById('honorStatus');
const honorTableBodyEl = document.getElementById('honorTableBody');
const hideZeroPlayersEl = document.getElementById('hideZeroPlayers');
const honorTableEl = document.getElementById('honorTable');
const logsViewEl = document.getElementById('logsView');
const honorViewEl = document.getElementById('honorView');
const viewButtons = document.querySelectorAll('.potion-view-btn');

const addLogBtnWrap = document.getElementById('addLogBtnWrap');
const addLogOpenBtn = document.getElementById('addLogOpenBtn');
const addLogOverlay = document.getElementById('addLogOverlay');
const addLogUrl1 = document.getElementById('addLogUrl1');
const addLogUrl2 = document.getElementById('addLogUrl2');
const addLogStatusEl = document.getElementById('addLogStatus');
const addLogSubmitBtn = document.getElementById('addLogSubmitBtn');
const addLogCancelBtn = document.getElementById('addLogCancelBtn');
const raidsPaginationEl = document.getElementById('raidsPagination');

const PAGE_SIZE = 10;
let sortedRaidsCache = [];
let currentPage = 1;

let honorBoardCache = [];
let sortState = { column: 'averagePotionsPerBoss', direction: 'desc' };
let guildMemberNames = new Set();
let characterOwnerNames = new Map();

function createPlayerBadgeHtml(name) {
  const isGuild = guildMemberNames.has(name);
  return `<span class="player-badge ${isGuild ? 'player-badge--guild' : 'player-badge--legion'}" title="${escapeHtml(isGuild ? 'Ностальгія' : 'Легіонер')}">${isGuild ? 'Н' : 'Л'}</span>`;
}

function ownerTooltipAttr(name) {
  const ownerName = characterOwnerNames.get(name);
  return ownerName ? ` title="${escapeHtml(ownerName)}"` : '';
}

function buildPersonalAnalyticsUrl(name) {
  return `../personal-analytics/?${new URLSearchParams({ player: name }).toString()}`;
}

function isSafeUrl(url) {
  try {
    return ['https:', 'http:'].includes(new URL(String(url)).protocol);
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function extractUploaderName(raidUrl) {
  const match = String(raidUrl || '').match(/--([^-/]+)--FreedomUA\/?.*$/);
  return match ? match[1] : 'Невідомо';
}

function formatRaidTitle(raid) {
  const date = raid.date || 'Невідома дата';
  const uploader = extractUploaderName(raid.raidUrl || '');
  return `Лог від ${date}. Завантажив ${uploader}`;
}

function createLogLinksList(urls) {
  return urls
    .map((url, index) => `<a href="${escapeHtml(isSafeUrl(url) ? url : '#')}" target="_blank" rel="noopener noreferrer">Лог ${index + 1}</a>`)
    .join(' · ');
}

function createRaidLinksHtml(raid) {
  const splitUrls = [raid.raidUrl, ...(raid.mergedFrom || [])];
  const alternateUrls = raid.alternateLogs || [];

  const parts = [];

  if (splitUrls.length > 1) {
    parts.push(`<p class="potion-raid-link">Цей рейд був розділений на кілька звітів UwU-Logs: ${createLogLinksList(splitUrls)}</p>`);
  } else {
    parts.push(`<p class="potion-raid-link"><a href="${escapeHtml(isSafeUrl(raid.raidUrl) ? raid.raidUrl : '#')}" target="_blank" rel="noopener noreferrer">Відкрити оригінальний лог UwU-Logs</a></p>`);
  }

  if (alternateUrls.length > 0) {
    parts.push(`<p class="potion-raid-link">Цей рейд також записаний іншим гравцем: ${createLogLinksList(alternateUrls)}</p>`);
  }

  return parts.join('');
}

function getRowClass(player) {
  return Number(player.total || 0) >= 12 ? 'potion-good' : 'potion-bad';
}

function createPlayerRow(player) {
  return `<tr class="${getRowClass(player)}"><td>${createPlayerBadgeHtml(player.name)}<span${ownerTooltipAttr(player.name)}>${escapeHtml(player.name)}</span></td><td>${Number(player.total || 0)}</td><td>${Number(player.potionOfSpeed || 0)}</td><td>${Number(player.potionOfWildMagic || 0)}</td></tr>`;
}

function createRaidSection(raid, index) {
  if (!Array.isArray(raid.players) || raid.players.length === 0) return `<div class="potion-raid-block empty"><p>Немає даних гравців</p></div>`;
  const rowsHtml = raid.players.map(createPlayerRow).join('');
  return `<div class="potion-raid-block"><button class="potion-raid-toggle" type="button" data-target="potion-raid-${index}" aria-expanded="false" aria-controls="potion-raid-${index}"><span class="potion-raid-title">${escapeHtml(formatRaidTitle(raid))}</span></button><div class="potion-raid-content" id="potion-raid-${index}" hidden><div class="ranking-table-wrap"><table class="potion-table"><thead><tr><th>Ім'я</th><th>Всього</th><th>Potion of Speed</th><th>Potion of Wild Magic</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>${createRaidLinksHtml(raid)}</div></div>`;
}

function attachRaidToggles() {
  document.querySelectorAll('.potion-raid-toggle').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const content = document.getElementById(button.getAttribute('data-target'));
      if (!content) return;
      const isHidden = content.hasAttribute('hidden');
      if (isHidden) {
        content.removeAttribute('hidden');
        button.classList.add('open');
        button.setAttribute('aria-expanded', 'true');
      } else {
        content.setAttribute('hidden', '');
        button.classList.remove('open');
        button.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

function sortPlayers(players) {
  const { column, direction } = sortState;
  return [...players].sort((a, b) => {
    if (column === 'name') {
      const cmp = a.name.localeCompare(b.name, 'uk');
      return direction === 'asc' ? cmp : -cmp;
    }

    const av = column === 'raidsCount' ? Number(a.raidsCount || 0) : Number(a.averagePotionsPerBoss || 0);
    const bv = column === 'raidsCount' ? Number(b.raidsCount || 0) : Number(b.averagePotionsPerBoss || 0);

    if (av < bv) return direction === 'asc' ? -1 : 1;
    if (av > bv) return direction === 'asc' ? 1 : -1;
    return a.name.localeCompare(b.name, 'uk');
  });
}

function updateSortIndicators() {
  document.querySelectorAll('.sortable').forEach((th) => {
    th.classList.remove('active');
    const indicator = th.querySelector('.sort-indicator');
    if (indicator) indicator.textContent = '';
  });

  const active = document.querySelector(`.sortable[data-sort="${sortState.column}"]`);
  if (active) {
    active.classList.add('active');
    const indicator = active.querySelector('.sort-indicator');
    if (indicator) indicator.textContent = sortState.direction === 'asc' ? '↑' : '↓';
  }
}

function renderHonorBoard(players) {
  const hideZeroPlayers = hideZeroPlayersEl?.checked ?? true;
  const filtered = hideZeroPlayers ? players.filter((player) => Number(player.averagePotionsPerBoss) > 0) : players;
  const visiblePlayers = sortPlayers(filtered);

  if (!players.length) {
    honorStatusEl.textContent = 'Немає даних для відображення.';
    honorTableBodyEl.innerHTML = '<tr><td colspan="4">Немає даних</td></tr>';
    updateSortIndicators();
    return;
  }

  honorStatusEl.textContent = `Гравців у зведеній таблиці: ${visiblePlayers.length}`;

  if (!visiblePlayers.length) {
    honorTableBodyEl.innerHTML = '<tr><td colspan="4">Немає гравців з потами</td></tr>';
    updateSortIndicators();
    return;
  }

  honorTableBodyEl.innerHTML = visiblePlayers
    .map((player, index) => `<tr><td>${index + 1}</td><td>${createPlayerBadgeHtml(player.name)}<a href="${escapeHtml(buildPersonalAnalyticsUrl(player.name))}"${ownerTooltipAttr(player.name)}>${escapeHtml(player.name)}</a></td><td>${player.raidsCount}</td><td>${player.averagePotionsPerBoss.toFixed(2)}</td></tr>`)
    .join('');

  updateSortIndicators();
}

function attachTableSorting() {
  document.querySelectorAll('.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort;
      if (!column) return;

      if (sortState.column === column) {
        sortState.direction = sortState.direction === 'desc' ? 'asc' : 'desc';
      } else {
        sortState.column = column;
        sortState.direction = th.dataset.direction || 'desc';
      }

      renderHonorBoard(honorBoardCache);
    });
  });
}

function switchView(viewName) {
  logsViewEl.hidden = viewName !== 'logs';
  honorViewEl.hidden = viewName !== 'honor';

  viewButtons.forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive.toString());
  });
}

function attachViewSwitch() {
  viewButtons.forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(button.dataset.view);
    });
  });
}

function attachHonorFilter() {
  hideZeroPlayersEl?.addEventListener('change', () => renderHonorBoard(honorBoardCache));
}

async function loadPotionStats() {
  try {
    statusEl.textContent = 'Завантаження даних...';
    const [response, honorBoardResponse, playersResponse, ownersResponse] = await Promise.all([
      fetch('/data/potion-stats.json?t=' + Date.now()),
      fetch('/data/honor-board.json?t=' + Date.now()),
      fetch('/data/players.json?t=' + Date.now()),
      fetch(`${AUTH_API_BASE}/characters/owners`).catch(() => null)
    ]);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const raids = await response.json();
    if (!Array.isArray(raids)) throw new Error('Невалідний формат даних');

    if (playersResponse.ok) {
      const players = await playersResponse.json();
      guildMemberNames = new Set(players.map((p) => p.name));
    }

    if (ownersResponse?.ok) {
      characterOwnerNames = new Map(Object.entries(await ownersResponse.json()));
    }

    const validRaids = raids.filter((raid) => Array.isArray(raid.players) && raid.players.length > 0 && raid.raidUrl);

    if (!validRaids.length) {
      statusEl.textContent = 'Немає валідних рейдів з даними гравців.';
      raidsEl.innerHTML = '<p class="no-data">Немає даних для відображення.</p>';
      honorStatusEl.textContent = 'Немає даних.';
      honorTableBodyEl.innerHTML = '<tr><td colspan="4">Немає даних</td></tr>';
      return;
    }

    const sortedRaids = [...validRaids].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    statusEl.textContent = `Знайдено рейдів: ${sortedRaids.length}`;
    sortedRaidsCache = sortedRaids;
    currentPage = 1;
    renderRaidsPage(1);

    honorBoardCache = honorBoardResponse.ok ? await honorBoardResponse.json() : [];
    renderHonorBoard(honorBoardCache);
    attachTableSorting();
    updateSortIndicators();
  } catch (error) {
    console.error('Помилка завантаження:', error);
    statusEl.textContent = `Помилка: ${error.message}`;
    raidsEl.innerHTML = '<p class="error">Не вдалося завантажити дані. Перевірте data/potion-stats.json</p>';
    honorStatusEl.textContent = 'Помилка завантаження.';
    honorTableBodyEl.innerHTML = '<tr><td colspan="4">Помилка завантаження</td></tr>';
  }
}

function renderRaidsPage(page) {
  const totalPages = Math.ceil(sortedRaidsCache.length / PAGE_SIZE);
  currentPage = Math.max(1, Math.min(page, totalPages || 1));

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRaids = sortedRaidsCache.slice(start, start + PAGE_SIZE);

  raidsEl.innerHTML = pageRaids.map((raid, i) => createRaidSection(raid, start + i)).join('');
  attachRaidToggles();

  if (totalPages <= 1) {
    raidsPaginationEl.hidden = true;
    return;
  }

  raidsPaginationEl.hidden = false;
  raidsPaginationEl.innerHTML = `
    <button class="link-button-std raids-page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">← Попередня</button>
    <span>Сторінка ${currentPage} з ${totalPages}</span>
    <button class="link-button-std raids-page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Наступна →</button>
  `;

  raidsPaginationEl.querySelectorAll('.raids-page-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      renderRaidsPage(Number(btn.dataset.page));
      raidsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function openAddLogDialog() {
  addLogUrl1.value = '';
  addLogUrl2.value = '';
  addLogStatusEl.textContent = '';
  addLogStatusEl.className = 'add-log-status';
  addLogSubmitBtn.disabled = false;
  addLogOverlay.hidden = false;
  addLogUrl1.focus();
}

function closeAddLogDialog() {
  addLogOverlay.hidden = true;
}

function attachAddLogPopup() {
  addLogOpenBtn.addEventListener('click', openAddLogDialog);
  addLogCancelBtn.addEventListener('click', closeAddLogDialog);

  addLogOverlay.addEventListener('click', (e) => {
    if (e.target === addLogOverlay) closeAddLogDialog();
  });

  addLogSubmitBtn.addEventListener('click', async () => {
    const url1 = addLogUrl1.value.trim();
    const url2 = addLogUrl2.value.trim();

    if (!url1) {
      addLogStatusEl.textContent = "Введіть посилання на лог.";
      addLogStatusEl.className = 'add-log-status error';
      return;
    }

    addLogSubmitBtn.disabled = true;
    addLogStatusEl.textContent = 'Збереження...';
    addLogStatusEl.className = 'add-log-status';

    try {
      const res = await fetch(`${AUTH_API_BASE}/admin/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getSessionToken()}`
        },
        body: JSON.stringify({ url1, ...(url2 ? { url2 } : {}) })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      addLogStatusEl.textContent = "Лог додано. Статистика оновиться за кілька хвилин.";
      addLogStatusEl.className = 'add-log-status success';
      addLogSubmitBtn.disabled = false;
    } catch (err) {
      addLogStatusEl.textContent = `Помилка: ${err.message}`;
      addLogStatusEl.className = 'add-log-status error';
      addLogSubmitBtn.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  attachViewSwitch();
  attachHonorFilter();
  switchView('logs');
  loadPotionStats();

  const user = await fetchCurrentUser();
  if (user?.isAdmin) {
    addLogBtnWrap.hidden = false;
    attachAddLogPopup();
  }
});