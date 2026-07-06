const fs = require('node:fs/promises');
const path = require('node:path');
const cheerio = require('cheerio');
const { readRaidLogMerges } = require('./shared');

const RAID_LOGS_FILE = path.join(__dirname, '..', 'data', 'raid-logs.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'potion-stats.json');

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
  const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'uk-UA,uk;q=0.9,en;q=0.8',
    'referer': 'https://uwu-logs.xyz/'
  };

  const response = await fetch(url, { headers });

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

async function readExistingStats() {
  try {
    const raw = await fs.readFile(OUTPUT_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function normalizeUrl(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function mergePotionPlayers(playersA, playersB) {
  const merged = new Map();

  for (const player of [...(playersA || []), ...(playersB || [])]) {
    if (!merged.has(player.name)) {
      merged.set(player.name, { name: player.name, total: 0, potionOfSpeed: 0, potionOfWildMagic: 0 });
    }

    const current = merged.get(player.name);
    current.total += Number(player.total || 0);
    current.potionOfSpeed += Number(player.potionOfSpeed || 0);
    current.potionOfWildMagic += Number(player.potionOfWildMagic || 0);
  }

  return [...merged.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

async function main() {
  const raidLogs = await readUniqueRaidLogs();
  const existing = await readExistingStats();
  const knownMerges = await readRaidLogMerges();

  const existingUrls = new Set([
    ...existing.filter((r) => !r.error).map((r) => normalizeUrl(r.raidUrl)),
    ...Object.keys(knownMerges).map(normalizeUrl)
  ]);
  const toFetch = raidLogs.filter((url) => !existingUrls.has(normalizeUrl(url)));

  console.log(`Total raids: ${raidLogs.length}, already cached: ${existing.length}, to fetch: ${toFetch.length}`);

  const newResults = [];

  if (toFetch.length === 0) {
    console.log('Nothing new to fetch.');
  } else {
    for (let i = 0; i < toFetch.length; i += 1) {
      const raidUrl = toFetch[i];
      const consumablesUrl = buildConsumablesUrl(raidUrl);

      console.log(`Fetching (${i + 1}/${toFetch.length}): ${consumablesUrl}`);

      try {
        const html = await fetchConsumablesPage(consumablesUrl);
        const players = parseConsumablesTable(html);

        newResults.push({
          raidUrl,
          consumablesUrl,
          date: extractRaidDateFromUrl(raidUrl),
          title: raidUrl,
          players
        });

        console.log(`OK: ${players.length} players`);
      } catch (error) {
        newResults.push({
          raidUrl,
          consumablesUrl,
          date: extractRaidDateFromUrl(raidUrl),
          title: raidUrl,
          players: [],
          error: error.message
        });

        console.error(`FAILED: ${error.message}`);
      }

      if (i < toFetch.length - 1) {
        console.log(`Sleeping ${REQUEST_DELAY_MS}ms before next request...`);
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  const refetchedUrls = new Set(toFetch.map(normalizeUrl));
  const keptExisting = existing.filter((r) => !refetchedUrls.has(normalizeUrl(r.raidUrl)));
  let combined = [...keptExisting, ...newResults];

  const mergeEntries = Object.entries(knownMerges);

  if (mergeEntries.length) {
    const secondaryUrls = new Set();
    let splitCount = 0;
    let duplicateCount = 0;

    for (const [secondaryUrl, { primary: primaryUrl, type }] of mergeEntries) {
      const secondary = combined.find((r) => normalizeUrl(r.raidUrl) === normalizeUrl(secondaryUrl));
      const primary = combined.find((r) => normalizeUrl(r.raidUrl) === normalizeUrl(primaryUrl));
      if (!secondary || !primary) continue;

      if (type === 'duplicate') {
        // Same raid recorded by a second player's logger - totals already cover the
        // full raid, so the secondary report is dropped instead of summed.
        primary.alternateLogs = [...new Set([...(primary.alternateLogs || []), secondary.raidUrl])];
        duplicateCount += 1;
      } else {
        primary.players = mergePotionPlayers(primary.players, secondary.players);
        primary.mergedFrom = [...new Set([...(primary.mergedFrom || []), secondary.raidUrl])];
        splitCount += 1;
      }

      secondaryUrls.add(normalizeUrl(secondaryUrl));
    }

    if (secondaryUrls.size) {
      combined = combined.filter((r) => !secondaryUrls.has(normalizeUrl(r.raidUrl)));
      console.log(`Merged ${splitCount} split raid report(s) and dropped ${duplicateCount} duplicate raid report(s).`);
    }
  }

  combined.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(combined, null, 2), 'utf8');

  console.log('potion-stats.json updated');
  console.log(`Newly fetched: ${newResults.length}, total: ${combined.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});