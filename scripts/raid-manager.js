const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const createRaidSection = document.getElementById('createRaidSection');
const createForm = document.getElementById('createRaidForm');
const raidInstanceToggle = document.getElementById('raidInstanceToggle');
const raidInstanceInput = document.getElementById('raidInstance');
const raidSoftLimitToggle = document.getElementById('raidSoftLimitToggle');
const raidSoftLimitInput = document.getElementById('raidSoftLimitTotal');

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

setupToggleGroup(raidInstanceToggle, raidInstanceInput, 'instance');
setupToggleGroup(raidSoftLimitToggle, raidSoftLimitInput, 'value');

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
      softLimitTotal: Number(document.getElementById('raidSoftLimitTotal').value)
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

  createRaidSection.hidden = false;
}

init();
