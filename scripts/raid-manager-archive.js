const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const archiveSection = document.getElementById('archiveSection');
const archiveStatus = document.getElementById('archiveStatus');
const archiveBody = document.getElementById('archiveBody');
const archivePagination = document.getElementById('archivePagination');
const archivePrevBtn = document.getElementById('archivePrevBtn');
const archiveNextBtn = document.getElementById('archiveNextBtn');
const archivePageInfo = document.getElementById('archivePageInfo');
const deleteRaidOverlay = document.getElementById('deleteRaidOverlay');
const deleteRaidTitle = document.getElementById('deleteRaidTitle');
const deleteRaidConfirmBtn = document.getElementById('deleteRaidConfirmBtn');
const deleteRaidCancelBtn = document.getElementById('deleteRaidCancelBtn');

const PAGE_SIZE = 20;
let currentPage = 0;
let isAdmin = false;

function setStatus(text) {
  archiveStatus.textContent = text;
}

function renderPagination(total) {
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  archivePagination.hidden = totalPages <= 1;
  archivePageInfo.textContent = `Сторінка ${currentPage + 1} з ${totalPages}`;
  archivePrevBtn.disabled = currentPage === 0;
  archiveNextBtn.disabled = currentPage >= totalPages - 1;
}

function renderArchiveList(raids, total) {
  archiveBody.innerHTML = '';

  const archiveTable = document.getElementById('archiveTable');
  const thead = archiveTable.querySelector('thead tr');

  const existingDeleteTh = thead.querySelector('.archive-delete-th');
  if (isAdmin && !existingDeleteTh) {
    const th = document.createElement('th');
    th.className = 'archive-delete-th';
    thead.appendChild(th);
  } else if (!isAdmin && existingDeleteTh) {
    existingDeleteTh.remove();
  }

  if (!raids.length) {
    setStatus(currentPage === 0 ? 'Ще немає створених рейдів.' : '');
    archivePagination.hidden = true;
    return;
  }

  setStatus(`Усього рейдів: ${total}`);
  renderPagination(total);

  raids.forEach((raid) => {
    const tr = document.createElement('tr');

    const titleTd = document.createElement('td');
    const link = document.createElement('a');
    link.href = `../raid/?id=${encodeURIComponent(raid.id)}`;
    link.textContent = raid.title;
    titleTd.appendChild(link);
    tr.appendChild(titleTd);

    const statusTd = document.createElement('td');
    const isCompleted = raid.status === 'completed';
    const statusChip = document.createElement('span');
    statusChip.className = `raid-chip raid-chip--${isCompleted ? 'completed' : 'active'}`;
    statusChip.textContent = isCompleted ? 'Завершений' : 'Активний';
    statusTd.appendChild(statusChip);
    tr.appendChild(statusTd);

    const instanceTd = document.createElement('td');
    instanceTd.textContent = translateInstance(raid.instance, INSTANCE_LABELS);
    tr.appendChild(instanceTd);

    const difficultyTd = document.createElement('td');
    difficultyTd.textContent = translateDifficulty(raid.difficulty, DIFFICULTY_LABELS);
    tr.appendChild(difficultyTd);

    const leaderTd = document.createElement('td');
    leaderTd.textContent = raid.leader_display_name || '—';
    tr.appendChild(leaderTd);

    const createdTd = document.createElement('td');
    createdTd.textContent = formatDateTimeKyiv(raid.created_at);
    tr.appendChild(createdTd);

    if (isAdmin) {
      const actionsTd = document.createElement('td');
      actionsTd.className = 'archive-delete-td';
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'archive-delete-btn';
      deleteBtn.setAttribute('aria-label', "Видалити рейд");
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
      deleteBtn.addEventListener('click', () => openConfirm(raid.id, raid.title));
      actionsTd.appendChild(deleteBtn);
      tr.appendChild(actionsTd);
    }

    archiveBody.appendChild(tr);
  });
}

let pendingDeleteId = null;

function openConfirm(raidId, raidTitle) {
  pendingDeleteId = raidId;
  deleteRaidTitle.textContent = `«${raidTitle}»`;
  deleteRaidOverlay.hidden = false;
}

function closeConfirm() {
  pendingDeleteId = null;
  deleteRaidOverlay.hidden = true;
  deleteRaidConfirmBtn.disabled = false;
}

deleteRaidCancelBtn.addEventListener('click', closeConfirm);

deleteRaidOverlay.addEventListener('click', (e) => {
  if (e.target === deleteRaidOverlay) closeConfirm();
});

deleteRaidConfirmBtn.addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  deleteRaidConfirmBtn.disabled = true;
  try {
    await apiCall('DELETE', `/admin/raids/${encodeURIComponent(pendingDeleteId)}`, { token: getSessionToken() });
    closeConfirm();
    await loadArchive();
  } catch (err) {
    closeConfirm();
    setStatus(`Помилка видалення: ${err.message}`);
  }
});

async function loadArchive() {
  try {
    const offset = currentPage * PAGE_SIZE;
    const { raids, total } = await apiCall('GET', `/raids?limit=${PAGE_SIZE}&offset=${offset}`, { token: getSessionToken() });
    renderArchiveList(raids, total);
  } catch (err) {
    console.error(err);
    setStatus('Не вдалося завантажити архів рейдів.');
  }
}

archivePrevBtn.addEventListener('click', () => {
  if (currentPage === 0) return;
  currentPage -= 1;
  loadArchive();
});

archiveNextBtn.addEventListener('click', () => {
  currentPage += 1;
  loadArchive();
});

async function init() {
  loginGateBtn.href = discordLoginUrl();

  const user = await fetchCurrentUser();
  if (!user) {
    loginGate.hidden = false;
    return;
  }

  isAdmin = !!user.isAdmin;

  archiveSection.hidden = false;
  await loadArchive();
}

init();
