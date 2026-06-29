const archiveStatus = document.getElementById('archiveStatus');
const archiveList = document.getElementById('archiveList');

function setStatus(text) {
  archiveStatus.textContent = text;
}

function renderArchiveList(raids) {
  archiveList.innerHTML = '';

  if (!raids.length) {
    setStatus('Ще немає створених рейдів.');
    return;
  }

  setStatus(`Усього рейдів: ${raids.length}`);

  raids.forEach((raid) => {
    const li = document.createElement('li');
    li.className = 'raid-list-item';

    const link = document.createElement('a');
    link.href = `../raid/?id=${encodeURIComponent(raid.id)}`;
    link.textContent = raid.title;
    li.appendChild(link);

    const statusChip = document.createElement('span');
    const isCompleted = raid.status === 'completed';
    statusChip.className = `raid-chip raid-chip--${isCompleted ? 'completed' : 'active'}`;
    statusChip.textContent = isCompleted ? 'Завершений' : 'Активний';
    statusChip.style.marginLeft = '0.5rem';
    li.appendChild(statusChip);

    const meta = document.createElement('span');
    meta.className = 'raid-list-item-meta';
    meta.textContent = ` — ${INSTANCE_LABELS[raid.instance] || raid.instance} · ${DIFFICULTY_LABELS[raid.difficulty] || raid.difficulty} · створено ${formatDateTimeKyiv(raid.created_at)}`;
    li.appendChild(meta);

    archiveList.appendChild(li);
  });
}

async function loadArchive() {
  try {
    const raids = await apiCall('GET', '/raids');
    renderArchiveList(raids);
  } catch (err) {
    console.error(err);
    setStatus('Не вдалося завантажити архів рейдів.');
  }
}

loadArchive();
