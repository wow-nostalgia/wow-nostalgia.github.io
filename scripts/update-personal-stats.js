'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const cheerio = require('cheerio');
const { BOSS_ORDER, CLASSES, sleep, findRaidLogMerges, findDuplicateRaidLogs, readRaidLogMerges, writeRaidLogMerges } = require('./shared');

const RAID_LOGS_FILE = path.join(__dirname, '..', 'data', 'raid-logs.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'personal-stats.json');

const SLUG_TO_CLASS = new Map(CLASSES.map((cls) => [cls.toLowerCase().replace(/\s+/g, '-'), cls]));

const MODE = '25H';
const REQUEST_DELAY_MS = 1800;
const RETRY_DELAY_MS = 8000;
const MAX_RETRIES = 3;

function sleepBetweenRequests() {
  return sleep(REQUEST_DELAY_MS);
}

function normalizeUrl(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function extractRaidDateFromUrl(raidUrl) {
  const match = raidUrl.match(/reports\/(\d{2})-(\d{2})-(\d{2})--/);
  if (!match) return null;
  const [, yy, mm, dd] = match;
  return `20${yy}-${mm}-${dd}`;
}

function parseDecimalNumber(value) {
  const cleaned = String(value || '').replace(/[^\d.]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function fetchWithRetry(url, attempt = 1) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'wow-nostalgia-personal-stats/1.0' }
  });

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

function isCorruptedReport(html) {
  return !html.includes('fights-container');
}

function extractKills($) {
  const kills = [];

  $('aside.fights-container').eq(0).find('a.kill-link').each((_, element) => {
    const href = $(element).attr('href');
    const text = normalizeText($(element).text());
    const parts = text.split('|').map((part) => part.trim());

    if (parts.length < 3) return;

    const [, mode, boss] = parts;
    if (mode !== MODE) return;
    if (!BOSS_ORDER.includes(boss)) return;

    kills.push({ boss, href });
  });

  return kills;
}

function buildSliceUrl(raidUrl, href) {
  return `${normalizeUrl(raidUrl)}${href}`;
}

function parsePlayerTable($) {
  const players = [];

  $('table.add-player-rank tbody tr').each((_, row) => {
    const cell = $(row).find('td.player-cell');
    const title = cell.attr('title');
    if (!title || title === 'Total') return;

    const anchor = cell.find('a');
    const name = normalizeText(anchor.text());
    if (!name) return;

    const slug = (anchor.attr('class') || '').trim();
    if (!slug) return; // vehicle/transform row (e.g. Putricide's "Mutated Abomination"), not a real player

    const playerClass = SLUG_TO_CLASS.get(slug) || CLASSES.find((cls) => title.endsWith(` ${cls}`)) || 'Unknown';
    const spec = title.endsWith(` ${playerClass}`)
      ? title.slice(0, title.length - playerClass.length).trim()
      : 'Unknown';

    const dps = parseDecimalNumber($(row).find('td.useful.per-sec-cell').first().text());

    players.push({ name, class: playerClass, spec, dps });
  });

  return players;
}

async function fetchRaidKills(raidUrl) {
  const html = await fetchWithRetry(normalizeUrl(raidUrl));
  if (isCorruptedReport(html)) {
    throw new Error('No fights-container found (corrupted or empty report)');
  }

  const $ = cheerio.load(html);
  return extractKills($);
}

async function fetchBossPlayers(raidUrl, href) {
  const sliceUrl = buildSliceUrl(raidUrl, href);
  const html = await fetchWithRetry(sliceUrl);
  const $ = cheerio.load(html);
  return parsePlayerTable($);
}

async function readUniqueRaidLogs() {
  const rawLogs = await fs.readFile(RAID_LOGS_FILE, 'utf8');
  const raidLogs = JSON.parse(rawLogs);

  const cleaned = raidLogs.map((url) => String(url).trim()).filter(Boolean);
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

async function main() {
  const raidLogs = await readUniqueRaidLogs();
  const existing = await readExistingStats();
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
      const date = extractRaidDateFromUrl(raidUrl);

      console.log(`Processing raid (${i + 1}/${toFetch.length}): ${raidUrl}`);

      try {
        const kills = await fetchRaidKills(raidUrl);
        console.log(`Found ${kills.length} boss kills`);
        await sleepBetweenRequests();

        const raidRecords = [];

        for (let k = 0; k < kills.length; k += 1) {
          const { boss, href } = kills[k];
          console.log(`  Fetching boss (${k + 1}/${kills.length}): ${boss}`);

          const players = await fetchBossPlayers(raidUrl, href);
          raidRecords.push({ raidUrl, date, boss, players });

          if (k < kills.length - 1) {
            await sleepBetweenRequests();
          }
        }

        if (raidRecords.length === 0) {
          newResults.push({ raidUrl, date, boss: null, players: [] });
        } else {
          newResults.push(...raidRecords);
        }
        console.log(`OK: ${raidRecords.length} boss records`);
      } catch (error) {
        newResults.push({ raidUrl, date, boss: null, players: [], error: error.message });
        console.error(`FAILED: ${error.message}`);
      }

      if (i < toFetch.length - 1) {
        await sleepBetweenRequests();
      }
    }
  }

  const refetchedUrls = new Set(toFetch.map(normalizeUrl));
  const keptExisting = existing.filter((r) => !refetchedUrls.has(normalizeUrl(r.raidUrl)));
  let combined = [...keptExisting, ...newResults];

  const freshSplitMerges = findRaidLogMerges(combined);
  const freshDuplicateMerges = findDuplicateRaidLogs(combined);

  for (const record of combined) {
    if (freshSplitMerges.has(record.raidUrl)) {
      record.raidUrl = freshSplitMerges.get(record.raidUrl);
    }
  }

  if (freshDuplicateMerges.size) {
    // Same raid logged by a second player - the secondary's per-boss records are
    // full duplicates of the primary's, so they're dropped rather than relabeled.
    const duplicateSecondaryUrls = new Set([...freshDuplicateMerges.keys()].map(normalizeUrl));
    combined = combined.filter((r) => !duplicateSecondaryUrls.has(normalizeUrl(r.raidUrl)));
  }

  if (freshSplitMerges.size || freshDuplicateMerges.size) {
    console.log(`Merged ${freshSplitMerges.size} split raid report(s) and dropped ${freshDuplicateMerges.size} duplicate raid report(s).`);
    const newMergeEntries = {
      ...Object.fromEntries([...freshSplitMerges].map(([secondary, primary]) => [secondary, { primary, type: 'split' }])),
      ...Object.fromEntries([...freshDuplicateMerges].map(([secondary, primary]) => [secondary, { primary, type: 'duplicate' }]))
    };
    await writeRaidLogMerges({ ...knownMerges, ...newMergeEntries });
  }

  combined.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(combined, null, 2), 'utf8');

  console.log('personal-stats.json updated');
  console.log(`Newly fetched records: ${newResults.length}, total: ${combined.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
