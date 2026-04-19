const statusEl = document.getElementById('potionStatus');
const raidsEl = document.getElementById('potionRaids');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function extractUploaderName(raidUrl) {
  const match = raidUrl.match(/--([^-/]+)--FreedomUA\/?$/);
  return match ? match[1] : 'Невідомо';
}

function formatRaidTitle(raid) {
  const date = raid.date || 'Невідома дата';
  const uploader = extractUploaderName(raid.raidUrl || '');
  return `Лог від ${date}. Завантажив ${uploader}`;
}

function getRowClass(player) {
  return player.total >= 13 ? 'potion-good' : 'potion-bad';
}

function createPlayerRow(player) {
  return `
    <tr class="${getRowClass(player)}">
      <td>${escapeHtml(player.name)}</td>
      <td>${player.total}</td>
      <td>${player.potionOfSpeed}</td>
      <td>${player.potionOfWildMagic}</td>
    </tr>
  `;
}

function createRaidSection(raid, index) {
  const rowsHtml = raid.players.map(createPlayerRow).join('');

  return `
    <div class="potion-raid-block">
      <button class="potion-raid-toggle" type="button" data-target="potion-raid-${index}">
        <span class="potion-raid-title">${escapeHtml(formatRaidTitle(raid))}</span>
        <span class="potion-raid-meta">${raid.players.length} гравців</span>
      </button>

      <div class="potion-raid-content" id="potion-raid-${index}" hidden>
        <div class="ranking-table-wrap">
          <table class="potion-table">
            <thead>
              <tr>
                <th>Ім'я</th>
                <th>Всього</th>
                <th>Potion of Speed</th>
                <th>Potion of Wild Magic</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4">Немає даних</td></tr>'}
            </tbody>
          </table>
        </div>

        <p class="potion-raid-link">
          <a href="${raid.raidUrl}" target="_blank" rel="noopener noreferrer">Відкрити оригінальний лог UwU-Logs</a>
        </p>
      </div>
    </div>
  `;
}

function attachToggles() {
  const buttons = document.querySelectorAll('.potion-raid-toggle');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const content = document.getElementById(targetId);
      if (!content) return;

      const isHidden = content.hasAttribute('hidden');
      if (isHidden) {
        content.removeAttribute('hidden');
        button.classList.add('open');
      } else {
        content.setAttribute('hidden', '');
        button.classList.remove('open');
      }
    });
  });
}

async function loadPotionStats() {
  try {
    const response = await fetch('./data/potion-stats.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const raids = await response.json();
    if (!Array.isArray(raids) || raids.length === 0) {
      statusEl.textContent = 'Немає даних для відображення.';
      raidsEl.innerHTML = '';
      return;
    }

    const sortedRaids = [...raids].sort((a, b) => {
      const aDate = a.date || '';
      const bDate = b.date || '';
      return bDate.localeCompare(aDate);
    });

    statusEl.textContent = `Знайдено рейдів: ${sortedRaids.length}`;
    raidsEl.innerHTML = sortedRaids.map((raid, index) => createRaidSection(raid, index)).join('');
    attachToggles();
  } catch (error) {
    console.error(error);
    statusEl.textContent = 'Не вдалося завантажити дані potion.';
    raidsEl.innerHTML = '';
  }
}

loadPotionStats();