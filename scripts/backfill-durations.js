'use strict';

// One-off script: fetches only the main raid-report page (no per-boss player
// pages) for every raid already cached in personal-stats.json, and merges in
// the durationSeconds that update-personal-stats.js now captures for new raids.

const fs = require('node:fs/promises');
const path = require('node:path');
const cheerio = require('cheerio');
const { BOSS_ORDER, sleep } = require('./shared');

const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'personal-stats.json');
const MODE = '25H';
const REQUEST_DELAY_MS = 12000;
const RETRY_DELAY_MS = 30000;
const MAX_RETRIES = 5;

function normalizeUrl(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseDurationToSeconds(text) {
  const match = String(text || '').trim().match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const [, minutes, seconds] = match;
  return Number(minutes) * 60 + Number(seconds);
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

function extractDurations(html) {
  const $ = cheerio.load(html);
  const durations = [];

  $('aside.fights-container').eq(0).find('a.kill-link').each((_, element) => {
    const text = normalizeText($(element).text());
    const parts = text.split('|').map((part) => part.trim());
    if (parts.length < 3) return;

    const [durationText, mode, boss] = parts;
    if (mode !== MODE) return;
    if (!BOSS_ORDER.includes(boss)) return;

    durations.push({ boss, durationSeconds: parseDurationToSeconds(durationText) });
  });

  return durations;
}

async function main() {
  const raw = await fs.readFile(OUTPUT_FILE, 'utf8');
  const stats = JSON.parse(raw);

  const byRaidUrl = new Map();
  for (const record of stats) {
    if (record.error || !record.boss) continue;
    const key = normalizeUrl(record.raidUrl);
    if (!byRaidUrl.has(key)) byRaidUrl.set(key, []);
    byRaidUrl.get(key).push(record);
  }

  const raidUrls = [...byRaidUrl.keys()].filter((url) =>
    byRaidUrl.get(url).some((record) => record.durationSeconds == null)
  );
  console.log(`Raids to backfill: ${raidUrls.length}`);

  let updated = 0;
  let missing = 0;

  for (let i = 0; i < raidUrls.length; i += 1) {
    const raidUrl = raidUrls[i];
    console.log(`(${i + 1}/${raidUrls.length}) ${raidUrl}`);

    try {
      const html = await fetchWithRetry(raidUrl);
      const durations = extractDurations(html);

      // Match records to durations in order per boss, so repeated boss kills
      // within one raid line up the same way they were originally scraped.
      const remainingByBoss = new Map();
      for (const d of durations) {
        if (!remainingByBoss.has(d.boss)) remainingByBoss.set(d.boss, []);
        remainingByBoss.get(d.boss).push(d.durationSeconds);
      }

      const records = byRaidUrl.get(raidUrl);
      for (const record of records) {
        const queue = remainingByBoss.get(record.boss);
        if (queue && queue.length) {
          record.durationSeconds = queue.shift();
          updated += 1;
        } else {
          missing += 1;
          console.warn(`  No duration match for boss "${record.boss}"`);
        }
      }
    } catch (error) {
      missing += byRaidUrl.get(raidUrl).length;
      console.error(`  FAILED: ${error.message}`);
    }

    if (i < raidUrls.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(stats, null, 2), 'utf8');
  console.log(`Done. Updated: ${updated}, missing: ${missing}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
