'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const cheerio = require('cheerio');
const { sleep, parsePlayerTable, readRaidLogMerges } = require('./shared');

const RAID_LOGS_FILE = path.join(__dirname, '..', 'data', 'raid-logs.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'raid-rosters.json');

const REQUEST_DELAY_MS = 1800;
const RETRY_DELAY_MS = 8000;
const MAX_RETRIES = 3;

function normalizeUrl(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

async function fetchWithRetry(url, attempt = 1) {
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
    return fetchWithRetry(url, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.text();
}

// Кореневий URL рейду (без /consumables/) - table.add-player-rank там показує
// зведення по ВСЬОМУ рейду одразу (title="Spec Class" + іконка спеку на
// гравця), на відміну від per-боса slice-сторінок в update-personal-stats.js.
async function fetchRoster(raidUrl) {
  const html = await fetchWithRetry(normalizeUrl(raidUrl));
  const $ = cheerio.load(html);
  return parsePlayerTable($).map(({ name, class: playerClass, spec, icon }) => ({ name, class: playerClass, spec, icon }));
}

async function readUniqueRaidLogs() {
  const rawLogs = await fs.readFile(RAID_LOGS_FILE, 'utf8');
  const raidLogs = JSON.parse(rawLogs);
  const cleaned = raidLogs.map((url) => String(url).trim()).filter(Boolean);
  return [...new Set(cleaned)];
}

async function readExistingRosters() {
  try {
    const raw = await fs.readFile(OUTPUT_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function mergeRosterPlayers(playersA, playersB) {
  const merged = new Map();
  for (const player of [...(playersA || []), ...(playersB || [])]) {
    if (!merged.has(player.name)) merged.set(player.name, player);
  }
  return [...merged.values()];
}

async function main() {
  const raidLogs = await readUniqueRaidLogs();
  const existing = await readExistingRosters();
  const knownMerges = await readRaidLogMerges();

  const existingUrls = new Set([
    ...existing.filter((r) => !r.error).map((r) => normalizeUrl(r.raidUrl)),
    ...Object.keys(knownMerges).map(normalizeUrl)
  ]);
  const toFetch = raidLogs.filter((url) => !existingUrls.has(normalizeUrl(url)));

  console.log(`Total raids: ${raidLogs.length}, already cached: ${raidLogs.length - toFetch.length}, to fetch: ${toFetch.length}`);

  const newResults = [];

  if (toFetch.length === 0) {
    console.log('Nothing new to fetch.');
  } else {
    for (let i = 0; i < toFetch.length; i += 1) {
      const raidUrl = toFetch[i];
      console.log(`Fetching (${i + 1}/${toFetch.length}): ${raidUrl}`);

      try {
        const players = await fetchRoster(raidUrl);
        newResults.push({ raidUrl, players });
        console.log(`OK: ${players.length} players`);
      } catch (error) {
        newResults.push({ raidUrl, players: [], error: error.message });
        console.error(`FAILED: ${error.message}`);
      }

      if (i < toFetch.length - 1) {
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  const refetchedUrls = new Set(toFetch.map(normalizeUrl));
  const keptExisting = existing.filter((r) => !refetchedUrls.has(normalizeUrl(r.raidUrl)));
  let combined = [...keptExisting, ...newResults];

  // Мерджі (split/duplicate) уже виявлені й записані update-personal-stats.js -
  // тут лише застосовуємо готовий result, без повторного виявлення.
  const mergeEntries = Object.entries(knownMerges);

  if (mergeEntries.length) {
    const secondaryUrls = new Set();

    for (const [secondaryUrl, { primary: primaryUrl }] of mergeEntries) {
      const secondary = combined.find((r) => normalizeUrl(r.raidUrl) === normalizeUrl(secondaryUrl));
      const primary = combined.find((r) => normalizeUrl(r.raidUrl) === normalizeUrl(primaryUrl));
      if (!secondary || !primary) continue;

      primary.players = mergeRosterPlayers(primary.players, secondary.players);
      secondaryUrls.add(normalizeUrl(secondaryUrl));
    }

    if (secondaryUrls.size) {
      combined = combined.filter((r) => !secondaryUrls.has(normalizeUrl(r.raidUrl)));
      console.log(`Merged rosters for ${secondaryUrls.size} split/duplicate raid report(s).`);
    }
  }

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(combined, null, 2), 'utf8');

  console.log('raid-rosters.json updated');
  console.log(`Newly fetched: ${newResults.length}, total: ${combined.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
