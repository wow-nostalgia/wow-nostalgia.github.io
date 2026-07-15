const SORT_ICON_ASC = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M3.47 7.78a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018L9 4.81v7.44a.75.75 0 0 1-1.5 0V4.81L4.53 7.78a.75.75 0 0 1-1.06 0Z"/></svg>';
const SORT_ICON_DESC = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M13.03 8.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.47 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018l2.97 2.97V3.75a.75.75 0 0 1 1.5 0v7.44l2.97-2.97a.75.75 0 0 1 1.06 0Z"/></svg>';

const statusEl = document.getElementById('potionStatus');
const honorStatusEl = document.getElementById('honorStatus');
const honorTableBodyEl = document.getElementById('honorTableBody');
const hideZeroPlayersEl = document.getElementById('hideZeroPlayers');
const honorTableEl = document.getElementById('honorTable');
const logsViewEl = document.getElementById('logsView');
const honorViewEl = document.getElementById('honorView');
const viewButtons = document.querySelectorAll('.potion-view-btn');

const potionSidebarEl = document.getElementById('potionSidebar');
const potionContentEl = document.getElementById('potionContent');

let honorBoardCache = [];
let sortState = { column: 'averagePotionsPerBoss', direction: 'desc' };
let guildMemberNames = new Set();
let characterOwnerNames = new Map();
let bossesByRaidUrl = new Map();

// Кількість босів логу — рахуємо по унікальних босах з personal-stats.json
// для цього raidUrl (+ mergedFrom, якщо лог було розділено на кілька звітів).
// potion-stats.json сам по собі кількість босів не містить.
function getBossCountForRaid(raid) {
  const urls = [raid.raidUrl, ...(raid.mergedFrom || [])];
  const bosses = new Set();
  for (const url of urls) {
    const set = bossesByRaidUrl.get(url);
    if (set) for (const boss of set) bosses.add(boss);
  }

  // Gunship Battle не потрапляє у personal-stats.json (не тягне DPS-даних),
  // але якщо вбито Deathbringer Saurfang - Gunship Battle точно був пройдений.
  if (bosses.has('Deathbringer Saurfang') && !bosses.has('Gunship Battle')) {
    bosses.add('Gunship Battle');
  }

  return bosses.size;
}

function ownerTooltipAttr(name) {
  const ownerName = characterOwnerNames.get(name);
  return ownerName ? ` class="tooltipped" aria-label="${escapeHtml(ownerName)}"` : '';
}

function buildPlayerViewUrl(name) {
  return `../guild-ranking/?${new URLSearchParams({ view: 'player', player: name }).toString()}`;
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

function createRaidLogInfoHtml(raid) {
  const splitUrls = [raid.raidUrl, ...(raid.mergedFrom || [])];
  if (splitUrls.length > 1) {
    return `<span class="potion-raid-split-note">Рейд розділений на кілька звітів UwU-Logs: ${createLogLinksList(splitUrls)}</span>`;
  }
  return `<a href="${escapeHtml(isSafeUrl(raid.raidUrl) ? raid.raidUrl : '#')}" target="_blank" rel="noopener noreferrer">Оригінальний лог UwU-Logs</a>`;
}

function createRaidLinksHtml(raid) {
  const alternateUrls = raid.alternateLogs || [];
  if (!alternateUrls.length) return '';
  return `<p class="potion-raid-link">Цей рейд також записаний іншим гравцем: ${createLogLinksList(alternateUrls)}</p>`;
}

function getRowClass(player, bossCount) {
  if (!bossCount) return '';
  const avgPerBoss = Number(player.total || 0) / bossCount;
  return avgPerBoss >= 1 ? 'potion-good' : 'potion-bad';
}

function createPlayerRow(player, bossCount) {
  return `<tr class="${getRowClass(player, bossCount)}"><td>${createPlayerBadgeHtml(player.name)}<span${ownerTooltipAttr(player.name)}>${escapeHtml(player.name)}</span></td><td>${Number(player.total || 0)}</td><td>${Number(player.potionOfSpeed || 0)}</td><td>${Number(player.potionOfWildMagic || 0)}</td></tr>`;
}

function createRaidContent(raid) {
  if (!Array.isArray(raid.players) || raid.players.length === 0) return `<p>Немає даних гравців</p>`;
  const bossCount = getBossCountForRaid(raid);
  const rowsHtml = raid.players.map((player) => createPlayerRow(player, bossCount)).join('');
  const bossCountHtml = bossCount ? `<span class="potion-boss-count">Босів: ${bossCount}</span>` : '';
  const raidLogInfoHtml = createRaidLogInfoHtml(raid);
  const metaRowHtml = bossCountHtml || raidLogInfoHtml
    ? `<div class="potion-raid-meta-row">${bossCountHtml}${raidLogInfoHtml}</div>`
    : '';
  return `${metaRowHtml}<div class="ranking-table-wrap"><table class="potion-table"><thead><tr><th>Ім'я</th><th>Всього</th><th>Potion of Speed</th><th>Potion of Wild Magic</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>${createRaidLinksHtml(raid)}`;
}

function isMobileLayout() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function showRaid(raids, index) {
  potionSidebarEl.querySelectorAll('.potion-log-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });

  if (isMobileLayout()) {
    potionSidebarEl.querySelectorAll('.potion-inline-content').forEach((el) => el.remove());
    const activeBtn = potionSidebarEl.querySelectorAll('.potion-log-btn')[index];
    if (activeBtn) {
      const inlineEl = document.createElement('div');
      inlineEl.className = 'potion-inline-content';
      inlineEl.innerHTML = createRaidContent(raids[index]);
      activeBtn.after(inlineEl);
      inlineEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    potionContentEl.innerHTML = createRaidContent(raids[index]);
  }
}

function renderSidebar(raids) {
  potionSidebarEl.innerHTML = raids.map((raid, i) => {
    const date = raid.date || 'Невідома дата';
    const uploader = extractUploaderName(raid.raidUrl || '');
    return `<button type="button" class="potion-log-btn${i === 0 ? ' active' : ''}" data-index="${i}">` +
      `<span class="potion-log-date">Лог від ${escapeHtml(date)}</span>` +
      `<span class="potion-log-uploader">Завантажив ${escapeHtml(uploader)}</span>` +
      `</button>`;
  }).join('');

  potionSidebarEl.querySelectorAll('.potion-log-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => showRaid(raids, i));
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
    if (indicator) indicator.innerHTML = sortState.direction === 'asc' ? SORT_ICON_ASC : SORT_ICON_DESC;
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
    .map((player, index) => `<tr><td>${index + 1}</td><td>${createPlayerBadgeHtml(player.name)}<a href="${escapeHtml(buildPlayerViewUrl(player.name))}"${ownerTooltipAttr(player.name)}>${escapeHtml(player.name)}</a></td><td>${player.raidsCount}</td><td>${player.averagePotionsPerBoss.toFixed(2)}</td></tr>`)
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
    const [response, honorBoardResponse, playersResponse, ownersResponse, personalStatsResponse] = await Promise.all([
      fetch('/data/potion-stats.json?t=' + Date.now()),
      fetch('/data/honor-board.json?t=' + Date.now()),
      fetch('/data/players.json?t=' + Date.now()),
      fetch(`${AUTH_API_BASE}/characters/owners`).catch(() => null),
      fetch('/data/personal-stats.json?t=' + Date.now()).catch(() => null)
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

    if (personalStatsResponse?.ok) {
      const personalStats = await personalStatsResponse.json();
      bossesByRaidUrl = new Map();
      for (const record of personalStats) {
        if (!record.raidUrl || !record.boss) continue;
        if (!bossesByRaidUrl.has(record.raidUrl)) bossesByRaidUrl.set(record.raidUrl, new Set());
        bossesByRaidUrl.get(record.raidUrl).add(record.boss);
      }
    }

    const validRaids = raids.filter((raid) => Array.isArray(raid.players) && raid.players.length > 0 && raid.raidUrl);

    if (!validRaids.length) {
      statusEl.textContent = 'Немає валідних рейдів з даними гравців.';
      potionContentEl.innerHTML = '<p class="no-data">Немає даних для відображення.</p>';
      honorStatusEl.textContent = 'Немає даних.';
      honorTableBodyEl.innerHTML = '<tr><td colspan="4">Немає даних</td></tr>';
      return;
    }

    const sortedRaids = [...validRaids].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    statusEl.textContent = `Знайдено рейдів: ${sortedRaids.length}`;
    renderSidebar(sortedRaids);
    showRaid(sortedRaids, 0);

    honorBoardCache = honorBoardResponse.ok ? await honorBoardResponse.json() : [];
    renderHonorBoard(honorBoardCache);
    attachTableSorting();
    updateSortIndicators();
  } catch (error) {
    console.error('Помилка завантаження:', error);
    statusEl.textContent = `Помилка: ${error.message}`;
    potionContentEl.innerHTML = '<p class="error">Не вдалося завантажити дані. Перевірте data/potion-stats.json</p>';
    honorStatusEl.textContent = 'Помилка завантаження.';
    honorTableBodyEl.innerHTML = '<tr><td colspan="4">Помилка завантаження</td></tr>';
  }
}


document.addEventListener('DOMContentLoaded', () => {
  attachViewSwitch();
  attachHonorFilter();
  switchView('logs');
  loadPotionStats();
});