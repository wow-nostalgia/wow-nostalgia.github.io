const statusEl = document.getElementById('potionStatus');
const raidsEl = document.getElementById('potionRaids');
const honorStatusEl = document.getElementById('honorStatus');
const honorTableBodyEl = document.getElementById('honorTableBody');
const hideZeroPlayersEl = document.getElementById('hideZeroPlayers');
const honorTableEl = document.getElementById('honorTable');
const logsViewEl = document.getElementById('logsView');
const honorViewEl = document.getElementById('honorView');
const viewButtons = document.querySelectorAll('.potion-view-btn');

let honorBoardCache = [];
let sortState = { column: 'averagePotions', direction: 'desc' };

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

function getRowClass(player) {
  return Number(player.total || 0) >= 12 ? 'potion-good' : 'potion-bad';
}

function createPlayerRow(player) {
  return `<tr class="${getRowClass(player)}"><td>${escapeHtml(player.name)}</td><td>${Number(player.total || 0)}</td><td>${Number(player.potionOfSpeed || 0)}</td><td>${Number(player.potionOfWildMagic || 0)}</td></tr>`;
}

function createRaidSection(raid, index) {
  if (!Array.isArray(raid.players) || raid.players.length === 0) return `<div class="potion-raid-block empty"><p>Немає даних гравців</p></div>`;
  const rowsHtml = raid.players.map(createPlayerRow).join('');
  return `<div class="potion-raid-block"><button class="potion-raid-toggle" type="button" data-target="potion-raid-${index}" aria-expanded="false" aria-controls="potion-raid-${index}"><span class="potion-raid-title">${escapeHtml(formatRaidTitle(raid))}</span><span class="potion-raid-meta">${raid.players.length} гравці(в)</span></button><div class="potion-raid-content" id="potion-raid-${index}" hidden><div class="ranking-table-wrap"><table class="potion-table"><thead><tr><th>Ім'я</th><th>Всього</th><th>Potion of Speed</th><th>Potion of Wild Magic</th></tr></thead><tbody>${rowsHtml}</tbody></table></div><p class="potion-raid-link"><a href="${escapeHtml(raid.raidUrl || '#')}" target="_blank" rel="noopener noreferrer">Відкрити оригінальний лог UwU-Logs</a></p></div></div>`;
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

function buildHonorBoard(raids) {
  const playersMap = new Map();
  raids.forEach((raid) => {
    if (!Array.isArray(raid.players)) return;
    raid.players.forEach((player) => {
      const name = String(player.name || '').trim();
      if (!name) return;
      if (!playersMap.has(name)) playersMap.set(name, { name, totalPotions: 0, raidsCount: 0 });
      const current = playersMap.get(name);
      current.totalPotions += Number(player.total || 0);
      current.raidsCount += 1;
    });
  });
  return Array.from(playersMap.values()).map((player) => ({
    name: player.name,
    raidsCount: player.raidsCount,
    averagePotions: player.raidsCount > 0 ? player.totalPotions / player.raidsCount : 0
  }));
}

function sortPlayers(players) {
  const { column, direction } = sortState;
  return [...players].sort((a, b) => {
    if (column === 'name') {
      const cmp = a.name.localeCompare(b.name, 'uk');
      return direction === 'asc' ? cmp : -cmp;
    }

    const av = column === 'raidsCount' ? Number(a.raidsCount || 0) : Number(a.averagePotions || 0);
    const bv = column === 'raidsCount' ? Number(b.raidsCount || 0) : Number(b.averagePotions || 0);

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
  const filtered = hideZeroPlayers ? players.filter((player) => Number(player.averagePotions) > 0) : players;
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
    .map((player, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(player.name)}</td><td>${player.raidsCount}</td><td>${player.averagePotions.toFixed(2)}</td></tr>`)
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
    button.setAttribute('aria-pressed', isActive.toString());
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
    const response = await fetch('/data/potion-stats.json?t=' + Date.now());
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const raids = await response.json();
    if (!Array.isArray(raids)) throw new Error('Невалідний формат даних');

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
    raidsEl.innerHTML = sortedRaids.map((raid, index) => createRaidSection(raid, index)).join('');
    attachRaidToggles();

    honorBoardCache = buildHonorBoard(sortedRaids);
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

document.addEventListener('DOMContentLoaded', () => {
  attachViewSwitch();
  attachHonorFilter();
  switchView('logs');
  loadPotionStats();
});