'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const cheerio = require('cheerio');
const { sleep } = require('./shared');

const PERSONAL_STATS_FILE = path.join(__dirname, '..', 'data', 'personal-stats.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'raid-summaries.json');

const REQUEST_DELAY_MS = 4000;
const RETRY_DELAY_MS = 8000;
const MAX_RETRIES = 3;

function normalizeUrl(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function extractRaidDateFromUrl(raidUrl) {
  const match = raidUrl.match(/reports\/(\d{2})-(\d{2})-(\d{2})--/);
  if (!match) return null;
  const [, yy, mm, dd] = match;
  return `20${yy}-${mm}-${dd}`;
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
    if (attempt > MAX_RETRIES) throw new Error(`429 after ${MAX_RETRIES} retries`);
    console.warn(`429 for ${url}. Retry ${attempt}/${MAX_RETRIES} after ${RETRY_DELAY_MS}ms...`);
    await sleep(RETRY_DELAY_MS);
    return fetchWithRetry(url, attempt + 1);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

// Matches H:MM:SS or H:MM:SS.mmm - format unique to total raid duration.
// Per-boss kill links use M:SS (2 parts), so this 3-part pattern is unambiguous.
function parseDurationMs(bodyText) {
  const match = bodyText.match(/(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
  if (!match) return null;
  const [, h, m, s, frac = '000'] = match;
  return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000
    + Number(frac.padEnd(3, '0').slice(0, 3));
}

function parseTotalDamage($) {
  let maxDamage = null;
  $('table.add-player-rank tbody tr').each((_, row) => {
    const cell = $(row).find('td.player-cell');
    if (cell.attr('title') !== 'Total') return;
    $(row).find('td').each((_, td) => {
      // Strip all non-digit characters (spaces, commas, non-breaking spaces)
      const raw = $(td).text().replace(/[^\d]/g, '');
      if (!raw) return;
      const val = Number(raw);
      // Total raid damage is typically 100M+ (per-raid DPS is 100k-500k)
      if (Number.isFinite(val) && val > 50_000_000) {
        if (maxDamage === null || val > maxDamage) maxDamage = val;
      }
    });
  });
  return maxDamage;
}

// Use personal-stats.json as the source of valid ЦЛК raid URLs —
// same population that powers "Сумарний DPS рейду"/"Час бою" charts.
// Returns Map<normalizedUrl, bossCount>.
async function readValidRaidUrls() {
  const raw = await fs.readFile(PERSONAL_STATS_FILE, 'utf8');
  const records = JSON.parse(raw);
  const bossesByUrl = new Map();
  for (const r of records) {
    if (!r.error && r.boss) {
      const url = normalizeUrl(r.raidUrl);
      if (!bossesByUrl.has(url)) bossesByUrl.set(url, new Set());
      bossesByUrl.get(url).add(r.boss);
    }
  }
  return new Map([...bossesByUrl.entries()].map(([url, set]) => [url, set.size]));
}

async function readExisting() {
  try {
    const raw = await fs.readFile(OUTPUT_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function main() {
  const bossCountByUrl = await readValidRaidUrls();
  const existing = await readExisting();

  const allUrls = [...bossCountByUrl.keys()];
  const existingUrls = new Set(existing.filter((r) => !r.error).map((r) => normalizeUrl(r.raidUrl)));
  const toFetch = allUrls.filter((url) => !existingUrls.has(url));

  console.log(`Valid ЦЛК raids: ${allUrls.length}, cached: ${existing.length}, to fetch: ${toFetch.length}`);

  const newResults = [];

  if (toFetch.length > 0) {
    for (let i = 0; i < toFetch.length; i++) {
      const raidUrl = toFetch[i];
      console.log(`Fetching (${i + 1}/${toFetch.length}): ${raidUrl}`);

      try {
        const html = await fetchWithRetry(raidUrl);
        const $ = cheerio.load(html);
        const bodyText = $('body').text();

        const durationMs = parseDurationMs(bodyText);
        const totalDamage = parseTotalDamage($);

        newResults.push({
          raidUrl,
          date: extractRaidDateFromUrl(raidUrl),
          bossCount: bossCountByUrl.get(raidUrl) ?? null,
          durationMs,
          totalDamage
        });

        console.log(`  OK: bosses=${bossCountByUrl.get(raidUrl)}, duration=${durationMs != null ? `${durationMs}ms` : 'NOT FOUND'}, totalDamage=${totalDamage ?? 'NOT FOUND'}`);
      } catch (error) {
        newResults.push({
          raidUrl,
          date: extractRaidDateFromUrl(raidUrl),
          bossCount: bossCountByUrl.get(raidUrl) ?? null,
          durationMs: null,
          totalDamage: null,
          error: error.message
        });
        console.error(`  FAILED: ${error.message}`);
      }

      if (i < toFetch.length - 1) await sleep(REQUEST_DELAY_MS);
    }
  }

  // Patch bossCount into existing cached entries (no HTTP needed)
  const fetchedUrls = new Set(toFetch);
  const kept = existing
    .filter((r) => !fetchedUrls.has(normalizeUrl(r.raidUrl)))
    .map((r) => {
      const url = normalizeUrl(r.raidUrl);
      const bc = bossCountByUrl.get(url);
      return bc !== undefined && r.bossCount !== bc ? { ...r, bossCount: bc } : r;
    });

  const combined = [...kept, ...newResults].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(combined, null, 2), 'utf8');
  console.log(`raid-summaries.json updated. Total: ${combined.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
