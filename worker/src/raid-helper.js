// Синхронізація попереднього запису з Raid-Helper (Discord-бот).
// Документація: docs/Raid-Helper — Documentation/raid-helper-docs.md.
//
// Модель: для рейду з rh_event_id джерело правди - Raid-Helper.
// - Discord -> сайт: без Premium вебхуків немає, тож записи підтягуються
//   опитуванням - cron раз на 10 хв + при відкритті вкладки (не частіше
//   RH_THROTTLE_MS). Що є в Raid-Helper - те й на сайті; чого немає - видаляється.
// - сайт -> Discord: запис/зміна/скасування на сайті спершу йде в Raid-Helper
//   (серверний API-ключ, секрет RAID_HELPER_API_KEY), і лише його відповідь
//   записується в D1 - розбіжностей не виникає.
// Персонажа Raid-Helper не знає: персонаж/клас/спек, обрані на сайті,
// зберігаються лише тут; запис з Discord від гравця без вибору на сайті
// показується за ніком у Discord.
import { HttpError } from './util.js';
import { listSignupRows, applySignupSync, setRaidSyncState, listRaidsToSync } from './db.js';
import { fromRaidHelperSignup, toRaidHelperClassSpec } from './signup-specs.js';

const RH_API = 'https://raid-helper.xyz/api/v4';
export const RH_THROTTLE_MS = 60 * 1000;

export function isRaidHelperEventId(value) {
  return /^\d{17,20}$/.test(value);
}

function requireApiKey(env) {
  if (!env.RAID_HELPER_API_KEY) {
    throw new HttpError(503, 'Синхронізація з Raid-Helper не налаштована (немає API-ключа сервера)');
  }
}

async function rhRequest(env, method, path, body) {
  const headers = { Accept: 'application/json' };
  if (env.RAID_HELPER_API_KEY) headers.Authorization = env.RAID_HELPER_API_KEY;
  if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
  let res;
  try {
    res = await fetch(`${RH_API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (err) {
    throw new HttpError(502, `Raid-Helper недоступний: ${err.message}`);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* не JSON */ }
  // Формат помилок у документації не описаний - беремо що є.
  const failed = !res.ok || (data && typeof data.status === 'string' && /fail|error/i.test(data.status));
  if (failed) {
    const reason = (data && (data.reason || data.message || data.error || data.status)) || text.slice(0, 200) || res.status;
    const err = new HttpError(res.status === 404 ? 404 : 502, `Raid-Helper: ${reason}`);
    err.rhStatus = res.status;
    throw err;
  }
  return data;
}

export async function fetchRaidHelperEvent(env, eventId) {
  const data = await rhRequest(env, 'GET', `/events/${eventId}`);
  if (!data || !Array.isArray(data.signUps)) throw new HttpError(502, 'Raid-Helper повернув рейд у невідомому форматі');
  return data;
}

// Відповідь на зміну запису містить event; якщо ні - дочитуємо.
async function eventFromWrite(env, eventId, data) {
  return data && data.event && Array.isArray(data.event.signUps) ? data.event : fetchRaidHelperEvent(env, eventId);
}

// Знімок рейду з Raid-Helper -> D1. Повертає кількість пропущених записів
// (невідомий клас/спек).
export async function applyRaidHelperEvent(db, raidId, event) {
  const local = await listSignupRows(db, raidId);
  const byDiscord = new Map(local.map((row) => [row.discord_id, row]));
  const seen = new Set();
  const upserts = [];
  let skipped = 0;

  for (const s of event.signUps) {
    const mapped = fromRaidHelperSignup(s);
    if (!mapped) {
      skipped += 1;
      console.warn('[raid-helper] невідомий клас/спек', s.className, s.specName);
      continue;
    }
    // Фейкові записи (isFake) бувають без userId.
    const discordId = s.userId ? String(s.userId) : `rh:${s.id}`;
    seen.add(discordId);
    const row = byDiscord.get(discordId);
    // Статус без спеку ("Відсутній") - клас/спек лишаємо ті, що були.
    const cls = mapped.cls ?? row?.class ?? null;
    const spec = mapped.cls ? mapped.spec : (row?.spec ?? null);
    // Персонаж обирався під клас - зміна класу в Discord його скидає.
    const characterName = row && row.character_name && (!row.class || row.class === cls) ? row.character_name : null;
    const next = {
      discordId,
      discordName: s.name ? String(s.name) : null,
      characterName,
      cls,
      spec,
      status: mapped.status,
      position: Number(s.position) || 0,
      externalId: String(s.id),
      source: row ? row.source : 'discord'
    };
    const changed = !row || row.discord_name !== next.discordName || row.character_name !== next.characterName
      || row.class !== next.cls || row.spec !== next.spec || row.status !== next.status
      || row.position !== next.position || row.external_id !== next.externalId;
    if (changed) upserts.push(next);
  }

  const deleteIds = local.filter((row) => !seen.has(row.discord_id)).map((row) => row.id);
  await applySignupSync(db, raidId, { upserts, deleteIds });
  return skipped;
}

// Підтягнути записи рейду з Raid-Helper. throwOnError=false - для фонових
// запусків: помилка лише зберігається в raids.rh_sync_error.
export async function syncRaidFromRaidHelper(env, raid, { throwOnError = true } = {}) {
  try {
    const event = await fetchRaidHelperEvent(env, raid.rh_event_id);
    const skipped = await applyRaidHelperEvent(env.DB, raid.id, event);
    await setRaidSyncState(env.DB, raid.id, { synced: true });
    return { skipped };
  } catch (err) {
    console.error('[raid-helper] sync failed', raid.id, err.message);
    await setRaidSyncState(env.DB, raid.id, { synced: false, error: err.message });
    if (throwOnError) throw err;
    return null;
  }
}

export function isSyncStale(raid) {
  return !raid.rh_synced_at || Date.now() - Date.parse(raid.rh_synced_at) >= RH_THROTTLE_MS;
}

// ---- Запис із сайту -> Raid-Helper ----

function rhClassSpec(cls, spec, status) {
  const payload = toRaidHelperClassSpec(cls, spec, status);
  if (!payload) throw new HttpError(400, 'Цей клас/спек не підтримується шаблоном Raid-Helper');
  return payload;
}

// Для статусів (Tentative тощо) документація не каже, чи приймається спек.
// Пробуємо зі спеком (так у Raid-Helper зберігається спек), а якщо відмова -
// без нього.
async function writeWithSpecFallback(env, method, path, base, classSpec) {
  try {
    return await rhRequest(env, method, path, { ...base, ...classSpec });
  } catch (err) {
    if (classSpec.specName === undefined || classSpec.className === undefined || !RH_STATUS_ONLY.has(classSpec.className)) throw err;
    return rhRequest(env, method, path, { ...base, className: classSpec.className });
  }
}
const RH_STATUS_ONLY = new Set(['Late', 'Bench', 'Tentative', 'Absence']);

// Створити або змінити запис гравця в Raid-Helper і застосувати відповідь.
export async function pushSignupToRaidHelper(env, raid, row, { discordId, cls, spec, status }) {
  requireApiKey(env);
  const eventId = raid.rh_event_id;
  const classSpec = rhClassSpec(cls, spec, status);
  let data;
  if (row && row.external_id) {
    try {
      data = await writeWithSpecFallback(env, 'PATCH', `/events/${eventId}/signups/${row.external_id}`, {}, classSpec);
    } catch (err) {
      // Запис видалили в Discord, поки сайт не синхронізувався - створюємо заново.
      if (err.rhStatus !== 404) throw err;
      data = await writeWithSpecFallback(env, 'POST', `/events/${eventId}/signups`, { userId: discordId }, classSpec);
    }
  } else {
    data = await writeWithSpecFallback(env, 'POST', `/events/${eventId}/signups`, { userId: discordId }, classSpec);
  }
  await applyRaidHelperEvent(env.DB, raid.id, await eventFromWrite(env, eventId, data));
}

export async function deleteSignupInRaidHelper(env, raid, row) {
  requireApiKey(env);
  const eventId = raid.rh_event_id;
  let data = null;
  if (row.external_id) {
    try {
      data = await rhRequest(env, 'DELETE', `/events/${eventId}/signups/${row.external_id}`);
    } catch (err) {
      if (err.rhStatus !== 404) throw err; // уже видалено в Discord
    }
  }
  await applyRaidHelperEvent(env.DB, raid.id, await eventFromWrite(env, eventId, data));
}

// Під час прив'язки: записи сайту, яких ще немає в Raid-Helper, відправляються
// туди (хто вже записаний у Discord - лишається як у Discord).
export async function pushLocalSignupsOnLink(env, raid, event) {
  const inRh = new Set(event.signUps.map((s) => String(s.userId)));
  const pending = (await listSignupRows(env.DB, raid.id)).filter((row) => !inRh.has(row.discord_id) && row.class && row.spec);
  if (!pending.length) return { pushed: 0, failed: [] };
  requireApiKey(env);
  const failed = [];
  let pushed = 0;
  for (const row of pending) {
    try {
      await writeWithSpecFallback(env, 'POST', `/events/${raid.rh_event_id}/signups`, { userId: row.discord_id }, rhClassSpec(row.class, row.spec, row.status));
      pushed += 1;
    } catch (err) {
      failed.push(`${row.character_name || row.discord_id}: ${err.message}`);
    }
  }
  return { pushed, failed };
}

// Cron: прив'язані рейди від доби тому до 30 днів уперед.
export async function syncUpcomingRaids(env, now = new Date()) {
  const from = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const to = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
  const raids = await listRaidsToSync(env.DB, from, to);
  for (const raid of raids) {
    await syncRaidFromRaidHelper(env, raid, { throwOnError: false });
  }
}
