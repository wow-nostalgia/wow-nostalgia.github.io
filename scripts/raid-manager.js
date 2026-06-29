const createForm = document.getElementById('createRaidForm');
const listStatus = document.getElementById('raidListStatus');
const raidListEl = document.getElementById('raidList');

function setListStatus(text) {
  listStatus.textContent = text;
}

function renderRaidList(raids) {
  raidListEl.innerHTML = '';

  if (!raids.length) {
    setListStatus('Ще немає створених рейдів.');
    return;
  }

  setListStatus(`Останні рейди: ${raids.length}`);

  raids.forEach((raid) => {
    const li = document.createElement('li');
    li.className = 'raid-list-item';

    const link = document.createElement('a');
    link.href = `raid/?id=${encodeURIComponent(raid.id)}`;
    link.textContent = raid.title;

    const meta = document.createElement('span');
    meta.className = 'raid-list-item-meta';
    meta.textContent = ` — ${INSTANCE_LABELS[raid.instance] || raid.instance} · ${DIFFICULTY_LABELS[raid.difficulty] || raid.difficulty}${raid.is_locked ? ' · 🔒' : ''}`;

    li.appendChild(link);
    li.appendChild(meta);
    raidListEl.appendChild(li);
  });
}

async function loadRaidList() {
  try {
    const raids = await apiCall('GET', '/raids');
    renderRaidList(raids);
  } catch (err) {
    console.error(err);
    setListStatus('Не вдалося завантажити список рейдів.');
  }
}

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitBtn = createForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const body = {
      title: document.getElementById('raidTitle').value.trim(),
      instance: document.getElementById('raidInstance').value,
      difficulty: document.getElementById('raidDifficulty').value,
      softLimitTotal: Number(document.getElementById('raidSoftLimitTotal').value),
      softLimitItems: Number(document.getElementById('raidSoftLimitItems').value),
      allowDuplicateSoft: document.getElementById('raidAllowDuplicate').checked
    };

    const raid = await apiCall('POST', '/raids', { body });
    setOfficerToken(raid.id, raid.officerToken);
    window.location.href = `raid/?id=${encodeURIComponent(raid.id)}`;
  } catch (err) {
    console.error(err);
    alert(`Не вдалося створити рейд: ${err.message}`);
    submitBtn.disabled = false;
  }
});

loadRaidList();
