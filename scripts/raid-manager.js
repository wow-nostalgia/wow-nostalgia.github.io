const createForm = document.getElementById('createRaidForm');

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitBtn = createForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const officerName = document.getElementById('raidOfficerName').value.trim();
    const body = {
      officerName,
      title: document.getElementById('raidTitle').value.trim(),
      instance: document.getElementById('raidInstance').value,
      difficulty: document.getElementById('raidDifficulty').value,
      softLimitTotal: Number(document.getElementById('raidSoftLimitTotal').value),
      softLimitItems: Number(document.getElementById('raidSoftLimitItems').value),
      allowDuplicateSoft: document.getElementById('raidAllowDuplicate').checked
    };

    const raid = await apiCall('POST', '/raids', { body });
    setOfficerToken(raid.id, raid.officerToken);
    if (officerName) setOfficerName(raid.id, officerName);
    window.location.href = `raid/?id=${encodeURIComponent(raid.id)}`;
  } catch (err) {
    console.error(err);
    alert(`Не вдалося створити рейд: ${err.message}`);
    submitBtn.disabled = false;
  }
});
