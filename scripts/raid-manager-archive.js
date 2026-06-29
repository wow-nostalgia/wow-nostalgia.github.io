const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const archiveSection = document.getElementById('archiveSection');
const archiveStatus = document.getElementById('archiveStatus');
const archiveBody = document.getElementById('archiveBody');

function setStatus(text) {
  archiveStatus.textContent = text;
}

function renderArchiveList(raids) {
  archiveBody.innerHTML = '';

  if (!raids.length) {
    setStatus('Ще немає створених рейдів.');
    return;
  }

  setStatus(`Усього рейдів: ${raids.length}`);

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
    instanceTd.textContent = INSTANCE_LABELS[raid.instance] || raid.instance;
    tr.appendChild(instanceTd);

    const difficultyTd = document.createElement('td');
    difficultyTd.textContent = DIFFICULTY_LABELS[raid.difficulty] || raid.difficulty;
    tr.appendChild(difficultyTd);

    const createdTd = document.createElement('td');
    createdTd.textContent = formatDateTimeKyiv(raid.created_at);
    tr.appendChild(createdTd);

    archiveBody.appendChild(tr);
  });
}

async function loadArchive() {
  try {
    const raids = await apiCall('GET', '/raids', { token: getSessionToken() });
    renderArchiveList(raids);
  } catch (err) {
    console.error(err);
    setStatus('Не вдалося завантажити архів рейдів.');
  }
}

async function init() {
  loginGateBtn.href = discordLoginUrl();

  const user = await fetchCurrentUser();
  if (!user) {
    loginGate.hidden = false;
    return;
  }

  archiveSection.hidden = false;
  await loadArchive();
}

init();
