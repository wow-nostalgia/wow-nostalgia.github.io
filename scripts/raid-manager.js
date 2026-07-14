const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const createRaidSection = document.getElementById('createRaidSection');
const createForm = document.getElementById('createRaidForm');
const raidInstanceToggle = document.getElementById('raidInstanceToggle');
const raidInstanceInput = document.getElementById('raidInstance');
const raidSoftLimitToggle = document.getElementById('raidSoftLimitToggle');
const raidSoftLimitInput = document.getElementById('raidSoftLimitTotal');
const raidTitleInput = document.getElementById('raidTitle');

const TITLE_INSTANCE_ABBR_UK = { ICC: "ЦЛК", RS: "РС" };
const TITLE_DIFFICULTY_ABBR_UK = { "25H": "25ХМ", "25N": "25Н", "10H": "10ХМ", "10N": "10Н" };

let titleAutoFilled = true;
let todayRaids = [];

function toLocalDateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

async function loadTodayRaids() {
  try {
    const { raids } = await apiCall('GET', '/raids?limit=50&offset=0', { token: getSessionToken() });
    const todayKey = toLocalDateKey(new Date());
    todayRaids = raids.filter((r) => toLocalDateKey(new Date(r.created_at)) === todayKey);
  } catch (err) {
    console.error(err);
    todayRaids = [];
  }
}

function generateTitle() {
  const instance = raidInstanceInput.value;
  const difficulty = document.getElementById('raidDifficulty').value;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const inst = TITLE_INSTANCE_ABBR_UK[instance] || instance;
  const diff = TITLE_DIFFICULTY_ABBR_UK[difficulty] || difficulty;
  const seq = todayRaids.filter((r) => r.instance === instance && r.difficulty === difficulty).length + 1;
  return `${inst} ${diff} #${seq} - ${dd}.${mm}.${yyyy}`;
}

function updateTitleIfAuto() {
  if (titleAutoFilled) raidTitleInput.value = generateTitle();
}

function setupToggleGroup(toggleEl, hiddenInput, datasetKey, onChange) {
  toggleEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.raid-toggle-btn');
    if (!btn) return;
    hiddenInput.value = btn.dataset[datasetKey];
    toggleEl.querySelectorAll('.raid-toggle-btn').forEach((b) => {
      b.classList.toggle('raid-toggle-btn--active', b === btn);
    });
    if (onChange) onChange();
  });
}

setupToggleGroup(raidInstanceToggle, raidInstanceInput, 'instance', updateTitleIfAuto);
setupToggleGroup(raidSoftLimitToggle, raidSoftLimitInput, 'value');

document.getElementById('raidDifficulty').addEventListener('change', updateTitleIfAuto);
raidTitleInput.addEventListener('input', () => { titleAutoFilled = false; });

function applyNameLanguageToCreateForm() {
  raidInstanceToggle.querySelectorAll('.raid-toggle-btn').forEach((btn) => {
    btn.textContent = translateInstance(btn.dataset.instance, INSTANCE_LABELS);
  });
  document.getElementById('raidDifficulty').querySelectorAll('option').forEach((opt) => {
    opt.textContent = translateDifficulty(opt.value, DIFFICULTY_LABELS);
  });
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
      hiddenReserves: document.getElementById('raidHiddenReserves').checked,
      transferWeightLimit: Number(document.getElementById('raidTransferWeightLimit').value)
    };

    const raid = await apiCall('POST', '/raids', { token: getSessionToken(), body });
    window.location.href = `raid/?id=${encodeURIComponent(raid.id)}`;
  } catch (err) {
    console.error(err);
    alert(`Не вдалося створити рейд: ${err.message}`);
    submitBtn.disabled = false;
  }
});

async function init() {
  applyNameLanguageToCreateForm();
  loginGateBtn.href = discordLoginUrl();

  const user = await fetchCurrentUser();
  if (!user) {
    loginGate.hidden = false;
    return;
  }

  await loadTodayRaids();
  updateTitleIfAuto();
  createRaidSection.hidden = false;
}

init();
