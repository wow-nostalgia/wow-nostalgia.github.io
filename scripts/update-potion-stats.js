const fs = require('node:fs/promises');
const path = require('node:path');
const cheerio = require('cheerio');

const RAID_LOGS_FILE = path.join(__dirname, '..', 'data', 'raid-logs.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'potion-stats.json');
const DEBUG_DIR = path.join(__dirname, '..', 'data', 'debug-consumables');

const POTION_SPEED = 'Potion of Speed';
const POTION_WILD_MAGIC = 'Potion of Wild Magic';

const REQUEST_DELAY_MS = 2500;
const RETRY_DELAY_MS = 8000;
const MAX_RETRIES = 3;

function buildConsumablesUrl(raidUrl) {
  return raidUrl.endsWith('/') ? `${raidUrl}consumables/` : `${raidUrl}/consumables/`;
}

function extractRaidDateFromUrl(raidUrl) {
  const match = raidUrl.match(/reports\/(\d{2})-(\d{2})-(\d{2})--/);
  if (!match) return null;
  const [, yy, mm, dd] = match;
  return `20${yy}-${mm}-${dd}`;
}

function parseNumber(value) {
  const cleaned = String(value || '').replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeFileName(input) {
  return input.replace(/[<>:"/\\|?*]+/g, '_');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveDebugHtml(consumablesUrl, html) {
  await fs.mkdir(DEBUG_DIR, { recursive: true });
  const fileName = safeFileName(consumablesUrl.replace('https://', '')) + '.html';
  const fullPath = path.join(DEBUG_DIR, fileName);
  await fs.writeFile(fullPath, html, 'utf8');
  return fullPath;
}

function findIconText($, element) {
  const attrs = ['alt', 'title', 'aria-label', 'data-original-title'];

  for (const attr of attrs) {
    const v = $(element).attr(attr);
    if (v) return normalizeText(v);
  }

  const src = $(element).attr('src') || '';
  return normalizeText(
    src
      .split('/')
      .pop()
      .split('.')[0]
      .replace(/[-_]+/g, ' ')
  );
}

function findHeaderCells($) {
  const tables = $('table');

  for (const table of tables.toArray()) {
    const rows = $(table).find('tr').toArray();

    for (const row of rows) {
      const cells = $(row).find('th,td').toArray();
      if (cells.length < 3) continue;

      const texts = cells.map((c) => normalizeText($(c).text()));
      const icons = cells.map((c) => findIconText($, c));

      const hasPotionish =
        icons.some((t) => /potion|flask|consumable|elixir|icon/i.test(t)) ||
        texts.some((t) => /potion|consumable/i.test(t));

      if (hasPotionish || cells.length >= 10) {
        return { table, row, cells, texts, icons };
      }
    }
  }

  return null;
}

function resolveColumnIndices(headerTexts, headerIcons) {
  let nameIndex = headerTexts.findIndex((t) => /name|player|character/i.test(t));
  if (nameIndex === -1) nameIndex = 0;

  let speedIndex = headerTexts.findIndex((t) => t.includes(POTION_SPEED));
  if (speedIndex === -1) speedIndex = headerIcons.findIndex((t) => t.includes(POTION_SPEED));

  let wildIndex = headerTexts.findIndex((t) => t.includes(POTION_WILD_MAGIC));
  if (wildIndex === -1) wildIndex = headerIcons.findIndex((t) => t.includes(POTION_WILD_MAGIC));

  if (speedIndex === -1 || wildIndex === -1) {
    const style = headerTexts.map((text, i) => ({
      i,
      text,
      icon: headerIcons[i]
    }));

    throw new Error(`Could not resolve potion columns: ${JSON.stringify(style)}`);
  }

  return { nameIndex, speedIndex, wildIndex };
}

function parseConsumablesTable(html) {
  const $ = cheerio.load(html);
  const headerMatch = findHeaderCells($);

  if (!headerMatch) {
    throw new Error('Could not locate consumables matrix table');
  }

  const { table, row, texts, icons } = headerMatch;
  const { nameIndex, speedIndex, wildIndex } = resolveColumnIndices(texts, icons);

  const allRows = $(table).find('tr').toArray();
  const headerRowIndex = allRows.indexOf(row);
  const dataRows = allRows.slice(headerRowIndex + 1);

  const players = [];

  for (const r of dataRows) {
    const tds = $(r).find('td').toArray();
    if (!tds.length) continue;

    const values = tds.map((td) => normalizeText($(td).text()));
    const name = values[nameIndex];
    if (!name) continue;

    const speed = parseNumber(values[speedIndex]);
    const wild = parseNumber(values[wildIndex]);

    players.push({
      name,
      total: speed + wild,
      potionOfSpeed: speed,
      potionOfWildMagic: wild
    });
  }

  return players.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

async function fetchConsumablesPage(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'wow-nostalgia-potion-stats/1.0'
    }
  });

  if (response.status === 429) {
    if (attempt > MAX_RETRIES) {
      throw new Error(`Request failed with status 429 after ${MAX_RETRIES} retries`);
    }

    console.warn(`429 for ${url}. Retry ${attempt}/${MAX_RETRIES} after ${RETRY_DELAY_MS}ms`);
    await sleep(RETRY_DELAY_MS);
    return fetchConsumablesPage(url, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.text();
}

async function readUniqueRaidLogs() {
  const rawLogs = await fs.readFile(RAID_LOGS_FILE, 'utf8');
  const raidLogs = JSON.parse(rawLogs);

  const cleaned = raidLogs
    .map((url) => String(url).trim())
    .filter(Boolean);

  return [...new Set(cleaned)];
}

async function main() {
  const raidLogs = await readUniqueRaidLogs();
  const results = [];

  for (let i = 0; i < raidLogs.length; i += 1) {
    const raidUrl = raidLogs[i];
    const consumablesUrl = buildConsumablesUrl(raidUrl);

    console.log(`Fetching (${i + 1}/${raidLogs.length}): ${consumablesUrl}`);

    try {
      const html = await fetchConsumablesPage(consumablesUrl);
      const debugPath = await saveDebugHtml(consumablesUrl, html);
      console.log(`Saved debug HTML: ${debugPath}`);

      const players = parseConsumablesTable(html);

      results.push({
        raidUrl,
        consumablesUrl,
        date: extractRaidDateFromUrl(raidUrl),
        title: raidUrl,
        players
      });

      console.log(`OK: ${players.length} players`);
    } catch (error) {
      results.push({
        raidUrl,
        consumablesUrl,
        date: extractRaidDateFromUrl(raidUrl),
        title: raidUrl,
        players: [],
        error: error.message
      });

      console.error(`FAILED: ${error.message}`);
    }

    if (i < raidLogs.length - 1) {
      console.log(`Sleeping ${REQUEST_DELAY_MS}ms before next request...`);
      await sleep(REQUEST_DELAY_MS);
    }
  }

  results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');

  console.log('potion-stats.json updated');
  console.log(`Raids processed: ${results.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});