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
//
// Рейди (етап B):
// - створення рейду на сайті створює рейд у Raid-Helper у гілці дня тижня
//   (RH_WEEKDAY_CHANNELS, за Києвом); зміна назви/дати й видалення - теж;
// - cron імпортує нові рейди з цих гілок: інстанс/розмір/складність - з назви
//   рейду або гілки (parseRaidKind); нерозпізнані - у rh_unmatched_events
//   (офіцери створюють їх з календаря вручну);
// - зміна назви/дати в Discord переноситься на сайт; рейд, видалений у
//   Discord, на сайті лишається, але відв'язується з позначкою.
import { HttpError, generateRaidId } from './util.js';
import {
  listSignupRows,
  applySignupSync,
  setRaidSyncState,
  listRaidsToSync,
  setRaidHelperLink,
  updateRaidFromRaidHelper,
  markRaidHelperEventDeleted,
  listLinkedRhEventIds,
  replaceUnmatchedEvents,
  getUserByDiscordId,
  createRaidWithDefaults,
  getRaid
} from './db.js';
import { fromRaidHelperSignup, toRaidHelperClassSpec } from './signup-specs.js';

const RH_API = 'https://raid-helper.xyz/api/v4';
export const RH_THROTTLE_MS = 60 * 1000;
const RH_SERVER_ID = '1055547379832602788';
const RH_TEMPLATE_ID = 'wowwotlk';
const SITE_URL = 'https://wow-nostalgia.github.io';

// Гілки форуму рейдів за днем тижня (0 - неділя). Четвер - Ульдуар, сайт його
// не підтримує: рейд на четвер у Discord не публікується й не імпортується.
const RH_WEEKDAY_CHANNELS = {
  0: '1522478570625040494', // НД
  1: '1534107868545155102', // ПН
  2: '1508209176525013113', // ВТ
  3: '1515828536617734376', // СР
  5: '1517857306610634832', // ПТ
  6: '1522359803031060500' // СБ
};
const RH_CHANNEL_SET = new Set(Object.values(RH_WEEKDAY_CHANNELS));
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function channelForStart(iso) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Kyiv', weekday: 'short' }).format(new Date(iso));
  return RH_WEEKDAY_CHANNELS[WEEKDAYS.indexOf(wd)] || null;
}

const toUnix = (iso) => Math.floor(Date.parse(iso) / 1000);

export function isRaidHelperEventId(value) {
  return /^\d{17,20}$/.test(value);
}

function requireApiKey(env) {
  if (!env.RAID_HELPER_API_KEY) {
    throw new HttpError(503, 'Синхронізація з Raid-Helper не налаштована (немає API-ключа сервера)');
  }
}

async function rhRequest(env, method, path, body, extraHeaders = {}) {
  const headers = { Accept: 'application/json', ...extraHeaders };
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
    let event;
    try {
      event = await fetchRaidHelperEvent(env, raid.rh_event_id);
    } catch (err) {
      if (err.rhStatus !== 404) throw err;
      // Рейд видалили в Discord.
      await markRaidHelperEventDeleted(env.DB, raid.id);
      return { skipped: 0, deleted: true };
    }
    const skipped = await applyRaidHelperEvent(env.DB, raid.id, event);
    // Назва/дата змінились у Discord.
    const title = event.title ? String(event.title) : raid.title;
    const startUnix = Number(event.startTime);
    const startChanged = Number.isFinite(startUnix) && startUnix > 0 && startUnix !== toUnix(raid.starts_at);
    if (title !== raid.title || startChanged) {
      await updateRaidFromRaidHelper(env.DB, raid.id, {
        title,
        startsAt: startChanged ? new Date(startUnix * 1000).toISOString() : raid.starts_at
      });
    }
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

// ---- Рейди: сайт -> Discord ----

const INSTANCE_LABELS = { ICC: 'ЦЛК', RS: 'РС' };

function raidDescription(raid) {
  const kind = `${INSTANCE_LABELS[raid.instance] || raid.instance} ${raid.difficulty.slice(0, 2)} ${raid.difficulty.endsWith('H') ? 'героїк' : 'нормал'}`;
  // Markdown-посилання, як "Копіювати для Discord" на сторінці рейду: у
  // Discord показується назвою рейду. Квадратні дужки в назві екрануємо.
  const title = raid.title.replace(/[[\]]/g, '\\$&');
  // #signups - одразу вкладка "Попередній запис".
  return `${kind}\nСофти й запис: [${title}](${SITE_URL}/raid-manager/raid/?id=${encodeURIComponent(raid.id)}#signups)`;
}

// Створює рейд у Raid-Helper для рейду сайту й прив'язує його. Помилка не
// валить створення рейду на сайті - зберігається в rh_sync_error (видно у
// вкладці "Попередній запис", там же можна прив'язати вручну).
// throwOnError - кнопка "Опублікувати в Discord": помилку бачить офіцер одразу.
export async function publishRaidToRaidHelper(env, raid, { throwOnError = false } = {}) {
  const channelId = channelForStart(raid.starts_at);
  if (throwOnError) {
    requireApiKey(env);
    if (!channelId) throw new HttpError(400, 'Рейди на четвер у Discord не публікуються');
  }
  if (!channelId || !env.RAID_HELPER_API_KEY) return; // четвер / не налаштовано
  try {
    const start = toUnix(raid.starts_at);
    const data = await rhRequest(env, 'POST', `/servers/${RH_SERVER_ID}/channels/${channelId}/event`, {
      leaderId: raid.leader_discord_id,
      templateId: RH_TEMPLATE_ID,
      date: String(start),
      time: String(start),
      title: raid.title,
      description: raidDescription(raid)
    });
    const eventId = data && ((data.event && data.event.id) || data.id);
    if (!eventId) throw new HttpError(502, 'Raid-Helper не повернув ID створеного рейду');
    await setRaidHelperLink(env.DB, raid.id, String(eventId));
  } catch (err) {
    console.error('[raid-helper] publish failed', raid.id, err.message);
    await setRaidSyncState(env.DB, raid.id, { synced: false, error: `Не вдалося створити рейд у Discord: ${err.message}` });
    if (throwOnError) throw err;
  }
}

// Назва/дата змінились на сайті. Дата на інший день тижня - рейд переїжджає
// в гілку того дня (крім четверга - тоді лишається, де був).
export async function updateRaidInRaidHelper(env, before, after) {
  if (!after.rh_event_id || !env.RAID_HELPER_API_KEY) return;
  const body = {};
  // В описі посилання з назвою рейду - оновлюється разом з назвою.
  if (after.title !== before.title) {
    body.title = after.title;
    body.description = raidDescription(after);
  }
  if (after.starts_at !== before.starts_at) {
    body.startTime = toUnix(after.starts_at);
    body.endTime = body.startTime;
    const channelId = channelForStart(after.starts_at);
    if (channelId && channelId !== channelForStart(before.starts_at)) body.channelId = channelId;
  }
  if (!Object.keys(body).length) return;
  try {
    await rhRequest(env, 'PATCH', `/events/${after.rh_event_id}`, body);
  } catch (err) {
    console.error('[raid-helper] update failed', after.id, err.message);
    await setRaidSyncState(env.DB, after.id, { synced: false, error: `Не вдалося змінити рейд у Discord: ${err.message}` });
  }
}

// Видалення рейду на сайті. Помилка (крім "вже видалено") зупиняє видалення,
// щоб рейд у Discord не лишився сиротою.
export async function deleteRaidInRaidHelper(env, raid) {
  if (!raid.rh_event_id) return;
  requireApiKey(env);
  try {
    await rhRequest(env, 'DELETE', `/events/${raid.rh_event_id}`);
  } catch (err) {
    if (err.rhStatus !== 404) throw err;
  }
}

// ---- Рейди: Discord -> сайт ----

// Інстанс/розмір/складність з назви ("ЦКК 25 хм Логорейд" -> ICC 25H).
// null - якщо інстанс або розмір не зрозумілі.
const LETTERS = 'a-zа-яіїєґё';
function hasWord(text, words) {
  return new RegExp(`(^|[^${LETTERS}])(${words})(?![${LETTERS}])`, 'i').test(text);
}
export function parseRaidKind(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  const instance = /(цлк|цкк|icc|цитадел)/.test(t) ? 'ICC'
    : (hasWord(t, 'рс|rs') || /(рубін|рубин|ruby)/.test(t)) ? 'RS' : null;
  // 10/25 не частина часу ("21:10") чи іншого числа.
  const size = /(^|[^\d:])25(?![\d:])/.test(t) ? '25' : /(^|[^\d:])10(?![\d:])/.test(t) ? '10' : null;
  if (!instance || !size) return null;
  const heroic = hasWord(t, 'хм|гер|героїк|героик|hc|hm|heroic|х|г|h');
  return { instance, difficulty: `${size}${heroic ? 'H' : 'N'}` };
}

// Cron: нові рейди з гілок рейдів -> рейди на сайті.
export async function importRaidHelperEvents(env, now = new Date()) {
  if (!env.RAID_HELPER_API_KEY) return;
  const data = await rhRequest(env, 'GET', `/servers/${RH_SERVER_ID}/events`, undefined, {
    StartTimeFilter: String(Math.floor(now.getTime() / 1000)),
    IncludeSignUps: 'false'
  });
  const events = ((data && data.postedEvents) || []).filter((e) => RH_CHANNEL_SET.has(String(e.channelId)));
  const linked = await listLinkedRhEventIds(env.DB);
  const unmatched = [];
  for (const e of events) {
    const eventId = String(e.id);
    if (linked.has(eventId) || !Number(e.startTime)) continue;
    const startsAt = new Date(Number(e.startTime) * 1000).toISOString();
    const title = String(e.title || e.displayTitle || '').trim() || 'Рейд';
    const kind = parseRaidKind(title) || parseRaidKind(e.channelName);
    if (!kind) {
      unmatched.push({ eventId, title, channelName: e.channelName ? String(e.channelName) : null, startsAt });
      continue;
    }
    try {
      await createRaidFromEvent(env, { eventId, title, startsAt, leaderId: e.leaderId ? String(e.leaderId) : null, ...kind });
    } catch (err) {
      console.error('[raid-helper] import failed', eventId, err.message);
    }
  }
  await replaceUnmatchedEvents(env.DB, unmatched);
}

// Рейд сайту для рейду Raid-Helper (cron або офіцер з календаря).
// Лідер - лідер з Raid-Helper, якщо він є на сайті, інакше адмін сайту.
export async function createRaidFromEvent(env, { eventId, title, startsAt, leaderId, instance, difficulty }, overrides = {}) {
  const leader = leaderId && (await getUserByDiscordId(env.DB, leaderId)) ? leaderId : env.ADMIN_DISCORD_ID;
  const raid = await createRaidWithDefaults(env.DB, {
    id: generateRaidId(),
    title,
    instance,
    difficulty,
    softLimitTotal: 3,
    hiddenReserves: true,
    leaderDiscordId: leader,
    transferWeightLimit: null,
    allowMountSofts: false,
    lkOnly: false,
    startsAt,
    ...overrides
  }, 'Raid-Helper');
  await setRaidHelperLink(env.DB, raid.id, eventId);
  await syncRaidFromRaidHelper(env, await getRaid(env.DB, raid.id), { throwOnError: false });
  return getRaid(env.DB, raid.id);
}
