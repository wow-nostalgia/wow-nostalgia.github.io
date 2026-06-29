const loginGate = document.getElementById('loginGate');
const loginGateBtn = document.getElementById('loginGateBtn');
const createRaidSection = document.getElementById('createRaidSection');
const createForm = document.getElementById('createRaidForm');

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
  loginGateBtn.href = discordLoginUrl();

  const user = await fetchCurrentUser();
  if (!user) {
    loginGate.hidden = false;
    return;
  }

  createRaidSection.hidden = false;
}

init();
