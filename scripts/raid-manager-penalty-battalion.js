const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const notOfficerGate = document.getElementById('notOfficerGate');
const battalionSection = document.getElementById('battalionSection');
const battalionStatus = document.getElementById('battalionStatus');
const battalionBody = document.getElementById('battalionBody');

const addPenaltyOpenBtn = document.getElementById('addPenaltyOpenBtn');
const addPenaltyModal = document.getElementById('addPenaltyModal');
const addPenaltyModalBackdrop = document.getElementById('addPenaltyModalBackdrop');
const addPenaltyCancelBtn = document.getElementById('addPenaltyCancelBtn');
const addPenaltyForm = document.getElementById('addPenaltyForm');
const penaltyPlayerNameInput = document.getElementById('penaltyPlayerName');
const penaltyPlayerNameList = document.getElementById('penaltyPlayerNameList');
const penaltyInstanceToggle = document.getElementById('penaltyInstanceToggle');
const penaltyInstanceInput = document.getElementById('penaltyInstance');

let guildMemberNames = new Set();
let guildMemberNamesSorted = [];
let battalionEntries = [];

function setStatus(text) {
  battalionStatus.textContent = text;
}

function setGuildMemberNamesSorted(players) {
  guildMemberNamesSorted = players.map((p) => p.name).sort((a, b) => a.localeCompare(b, 'uk'));
}

// Той самий патерн, що в raid-manager-detail.js: підказки гільдії, але
// вільний текст лишається доступним (легіонера можна вписати вручну).
function setupNameAutocomplete(inputEl, listEl) {
  function closeList() {
    listEl.classList.remove('is-open');
    listEl.innerHTML = '';
  }

  function openList() {
    const query = inputEl.value.trim().toLocaleLowerCase('uk');
    const matches = query
      ? guildMemberNamesSorted.filter((name) => name.toLocaleLowerCase('uk').includes(query))
      : guildMemberNamesSorted;

    listEl.innerHTML = '';

    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'raid-autocomplete-empty';
      empty.textContent = 'Гравця гільдії не знайдено — можна вписати легіонера вручну';
      listEl.appendChild(empty);
    } else {
      matches.forEach((name) => {
        const item = document.createElement('div');
        item.className = 'raid-autocomplete-item';
        item.appendChild(createPlayerBadge(name));
        item.appendChild(document.createTextNode(name));
        item.addEventListener('mousedown', (event) => {
          event.preventDefault();
          inputEl.value = name;
          closeList();
        });
        listEl.appendChild(item);
      });
    }

    listEl.classList.add('is-open');
  }

  inputEl.addEventListener('input', openList);
  inputEl.addEventListener('focus', openList);
  inputEl.addEventListener('blur', () => setTimeout(closeList, 100));
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeList();
  });
}

setupNameAutocomplete(penaltyPlayerNameInput, penaltyPlayerNameList);

function setupToggleGroup(toggleEl, hiddenInput, datasetKey) {
  toggleEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.raid-toggle-btn');
    if (!btn) return;
    hiddenInput.value = btn.dataset[datasetKey];
    toggleEl.querySelectorAll('.raid-toggle-btn').forEach((b) => {
      b.classList.toggle('raid-toggle-btn--active', b === btn);
    });
  });
}

setupToggleGroup(penaltyInstanceToggle, penaltyInstanceInput, 'instance');

function renderBattalionTable() {
  battalionBody.innerHTML = '';

  if (!battalionEntries.length) {
    setStatus('Штрафбат порожній.');
    return;
  }

  setStatus(`Усього записів: ${battalionEntries.length}`);

  battalionEntries.forEach((entry) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.appendChild(createPlayerBadge(entry.player_name));
    nameTd.appendChild(document.createTextNode(' ' + entry.player_name));
    tr.appendChild(nameTd);

    const rollTd = document.createElement('td');
    rollTd.textContent = entry.roll_penalty;
    tr.appendChild(rollTd);

    const softTd = document.createElement('td');
    softTd.textContent = entry.soft_penalty;
    tr.appendChild(softTd);

    const instanceTd = document.createElement('td');
    instanceTd.textContent = translateInstance(entry.instance, INSTANCE_LABELS);
    tr.appendChild(instanceTd);

    const reasonTd = document.createElement('td');
    reasonTd.textContent = entry.reason || '—';
    tr.appendChild(reasonTd);

    const actionsTd = document.createElement('td');
    actionsTd.className = 'archive-delete-td';
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'archive-delete-btn';
    deleteBtn.setAttribute('aria-label', 'Видалити');
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
    deleteBtn.addEventListener('click', () => deleteEntry(entry.id));
    actionsTd.appendChild(deleteBtn);
    tr.appendChild(actionsTd);

    battalionBody.appendChild(tr);
  });
}

async function deleteEntry(id) {
  try {
    battalionEntries = await apiCall('DELETE', `/penalty-battalion/${id}`, { token: getSessionToken() });
    renderBattalionTable();
  } catch (err) {
    console.error(err);
    alert(`Не вдалося видалити запис: ${err.message}`);
  }
}

function openAddPenaltyModal() {
  addPenaltyForm.reset();
  penaltyInstanceToggle.querySelectorAll('.raid-toggle-btn').forEach((b, i) => {
    b.classList.toggle('raid-toggle-btn--active', i === 0);
  });
  addPenaltyModal.hidden = false;
}

function closeAddPenaltyModal() {
  addPenaltyModal.hidden = true;
}

addPenaltyOpenBtn.addEventListener('click', openAddPenaltyModal);
addPenaltyCancelBtn.addEventListener('click', closeAddPenaltyModal);
addPenaltyModalBackdrop.addEventListener('click', closeAddPenaltyModal);

addPenaltyForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitBtn = addPenaltyForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const body = {
      playerName: penaltyPlayerNameInput.value.trim(),
      instance: penaltyInstanceInput.value,
      rollPenalty: Number(document.getElementById('penaltyRollPenalty').value),
      softPenalty: Number(document.getElementById('penaltySoftPenalty').value),
      reason: document.getElementById('penaltyReason').value.trim()
    };

    battalionEntries = await apiCall('POST', '/penalty-battalion', { token: getSessionToken(), body });
    renderBattalionTable();
    closeAddPenaltyModal();
  } catch (err) {
    console.error(err);
    alert(`Не вдалося додати запис: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
  }
});

function applyNameLanguageToForm() {
  penaltyInstanceToggle.querySelectorAll('.raid-toggle-btn').forEach((btn) => {
    btn.textContent = translateInstance(btn.dataset.instance, INSTANCE_LABELS);
  });
}

async function init() {
  applyNameLanguageToForm();
  loginGateBtn.href = discordLoginUrl();

  const user = await fetchCurrentUser();
  if (!user) {
    loginGate.hidden = false;
    return;
  }

  if (!user.isGuildOfficer) {
    notOfficerGate.hidden = false;
    return;
  }

  battalionSection.hidden = false;

  const playersPromise = fetch('/data/players.json?t=' + Date.now())
    .then((res) => (res.ok ? res.json() : []))
    .catch(() => []);
  const entriesPromise = apiCall('GET', '/penalty-battalion', { token: getSessionToken() }).catch((err) => {
    console.error(err);
    setStatus('Не вдалося завантажити Штрафбат.');
    return null;
  });

  const [players, entries] = await Promise.all([playersPromise, entriesPromise]);
  guildMemberNames = new Set(players.map((p) => p.name));
  setGuildMemberNamesSorted(players);

  if (entries) {
    battalionEntries = entries;
    renderBattalionTable();
  }
}

init();
