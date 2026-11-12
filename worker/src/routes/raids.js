import { HttpError, jsonResponse, readJson, generateRaidId, parseRaidStartsAt } from '../util.js';
import {
  listRaids,
  listRaidsInRange,
  countRaids,
  getRaid,
  updateRaidSettings,
  setRaidLock,
  setRaidStatus,
  insertAudit,
  listRaidOfficers,
  addRaidOfficer,
  removeRaidOfficer,
  getUserByDiscordId,
  deleteRaid,
  deleteAllTransfersForRaid,
  resetAllBonusWeightsForRaid,
  deleteReservesExceptItems,
  enforceAllBonusPools,
  pruneOldRaidsIfOverLimit,
  setCharacterCooldownsByNames,
  CHARACTER_COOLDOWN_COLUMNS,
  createRaidWithDefaults,
  setRaidHelperLink,
  findRaidByRhEventId,
  deleteUnmatchedEvent,
  listUnmatchedEvents,
  isDefaultOfficer
} from '../db.js';
import { requireGlobalOfficer } from '../auth.js';
import { requireRaidOfficer, requireLeader } from '../auth.js';
import {
  publishRaidToRaidHelper,
  updateRaidInRaidHelper,
  deleteRaidInRaidHelper,
  isRaidHelperEventId,
  fetchRaidHelperEvent,
  syncRaidFromRaidHelper
} from '../raid-helper.js';
import { SOFT_INSTANCES, isKnownInstance, isValidDifficulty } from '../instances.js';

function publicRaid(raid) {
  const { officer_token, ...rest } = raid;
  return rest;
}

export async function loadRaidOr404(env, id) {
  const raid = await getRaid(env.DB, id);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  return raid;
}

export async function handleCreateRaid(request, env, session) {
  const body = await readJson(request);
  const title = String(body.title || '').trim();
  const instance = String(body.instance || '').trim();
  const difficulty = String(body.difficulty || '').trim();

  if (!title) throw new HttpError(400, 'Потрібна назва рейду');
  if (!isKnownInstance(instance)) throw new HttpError(400, 'Невідомий рейд');
  if (!isValidDifficulty(instance, difficulty)) throw new HttpError(400, 'Ця складність недоступна для цього рейду');
  // Спрощений рейд (не ЦЛК/РС) - без софтів: софт-налаштування ігноруються.
  const withSofts = SOFT_INSTANCES.has(instance);

  const softLimitTotal = withSofts ? Number(body.softLimitTotal ?? 3) : 3;

  if (!Number.isInteger(softLimitTotal) || softLimitTotal < 1) throw new HttpError(400, 'Невалідний softLimitTotal');

  const hiddenReserves = withSofts && body.hiddenReserves !== false;
  const allowMountSofts = withSofts && body.allowMountSofts === true;
  const lkOnly = instance === 'ICC' && body.lkOnly === true;
  // Без startsAt (старий клієнт) - як раніше, рейд "зараз".
  const startsAt = body.startsAt === undefined ? undefined : parseRaidStartsAt(body.startsAt);

  const transferWeightLimit = withSofts && body.transferWeightLimit !== undefined && body.transferWeightLimit !== null
    ? Number(body.transferWeightLimit)
    : null;
  if (transferWeightLimit !== null && (!Number.isInteger(transferWeightLimit) || transferWeightLimit < 0)) {
    throw new HttpError(400, 'Невалідний transferWeightLimit');
  }
  // Передати можна не більше, ніж сам ліміт софтів рейду.
  const cappedTransferLimit = transferWeightLimit === null ? null : Math.min(transferWeightLimit, softLimitTotal);

  // rhEventId - офіцер створює рейд для нерозпізнаного рейду з Discord
  // (календар): прив'язуємо до нього замість публікації нового.
  const rhEventId = body.rhEventId ? String(body.rhEventId).trim() : null;
  if (rhEventId) {
    if (!isRaidHelperEventId(rhEventId)) throw new HttpError(400, 'Невалідний ID рейду Raid-Helper');
    if (await findRaidByRhEventId(env.DB, rhEventId)) throw new HttpError(409, "Цей рейд з Discord уже є на сайті");
    await fetchRaidHelperEvent(env, rhEventId); // існує
  }

  const id = generateRaidId();

  await createRaidWithDefaults(env.DB, {
    id,
    title,
    instance,
    difficulty,
    softLimitTotal,
    hiddenReserves,
    leaderDiscordId: session.discordId,
    transferWeightLimit: cappedTransferLimit,
    allowMountSofts,
    lkOnly,
    startsAt
  }, session.username);

  if (rhEventId) {
    await setRaidHelperLink(env.DB, id, rhEventId);
    await deleteUnmatchedEvent(env.DB, rhEventId);
    await syncRaidFromRaidHelper(env, await getRaid(env.DB, id), { throwOnError: false });
  } else if (body.publishToDiscord === true && await isDefaultOfficer(env.DB, session.discordId)) {
    // Галочка "Опублікувати в Discord" у формі - лише гільдійським офіцерам.
    await publishRaidToRaidHelper(env, await getRaid(env.DB, id));
  }

  return jsonResponse(publicRaid(await getRaid(env.DB, id)), 201);
}

const MAX_CALENDAR_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

export async function handleListRaids(request, env, session) {
  const url = new URL(request.url);

  // Календар: ?from=ISO&to=ISO - усі рейди, що починаються в цьому проміжку
  // (до ~2 місяців, щоб запит лишався дешевим).
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (from || to) {
    const fromDate = new Date(from || '');
    const toDate = new Date(to || '');
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate <= fromDate) {
      throw new HttpError(400, 'from/to мають бути датами ISO, from < to');
    }
    if (toDate - fromDate > MAX_CALENDAR_RANGE_MS) throw new HttpError(400, 'Завеликий проміжок дат');
    const raids = await listRaidsInRange(env.DB, fromDate.toISOString(), toDate.toISOString(), session.discordId);
    return jsonResponse({ raids });
  }
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  // ?status=open - вкладка "Рейди" (активні й заплановані), ?status=completed -
  // "Архів"; без параметра - усі (номер у автоназві рейду тощо).
  const statusParam = url.searchParams.get('status');
  const status = statusParam === 'open' || statusParam === 'completed' ? statusParam : undefined;

  const [raids, total] = await Promise.all([
    listRaids(env.DB, { limit, offset, status }),
    countRaids(env.DB, status)
  ]);

  return jsonResponse({ raids, total });
}

export async function handleGetRaid(request, env, id) {
  const raid = await loadRaidOr404(env, id);
  return jsonResponse(publicRaid(raid));
}

export async function handleUpdateRaid(request, env, id, session) {
  const raid = await loadRaidOr404(env, id);
  requireLeader(raid, session);

  const body = await readJson(request);
  const fields = {};

  if (body.title !== undefined) fields.title = String(body.title).trim();
  if (body.softLimitTotal !== undefined) fields.soft_limit_total = Number(body.softLimitTotal);
  if (body.transferWeightLimit !== undefined) {
    const v = body.transferWeightLimit === null ? null : Number(body.transferWeightLimit);
    if (v !== null && (!Number.isInteger(v) || v < 0)) throw new HttpError(400, 'Невалідний transferWeightLimit');
    fields.transfer_weight_limit = v;
  }
  if (body.allowMountSofts !== undefined) fields.allow_mount_softs = body.allowMountSofts ? 1 : 0;
  // Лідер може перенести рейд, але лише на сьогодні чи пізніше.
  if (body.startsAt !== undefined) fields.starts_at = parseRaidStartsAt(body.startsAt);

  // Ліміт передачі не більший за ліміт софтів — зокрема коли знизили лише
  // ліміт софтів, а збережений ліміт передачі лишився старим.
  const newSoftLimit = fields.soft_limit_total ?? raid.soft_limit_total;
  const newTransferLimit = 'transfer_weight_limit' in fields ? fields.transfer_weight_limit : raid.transfer_weight_limit;
  if (newTransferLimit !== null && newTransferLimit > newSoftLimit) fields.transfer_weight_limit = newSoftLimit;

  // "Тільки Король-ліч" (лише ЦЛК). Під час увімкнення видаляємо софти на
  // предмети не з луту Ліча — спільні з іншими босами (токени тощо) лишаються.
  let lkItemIds = null;
  if (body.lkOnly !== undefined) {
    fields.lk_only = raid.instance === 'ICC' && body.lkOnly ? 1 : 0;
    if (fields.lk_only && !raid.lk_only) {
      lkItemIds = Array.isArray(body.lkItemIds) ? body.lkItemIds.map(Number) : [];
      if (!lkItemIds.length || !lkItemIds.every(Number.isInteger)) {
        throw new HttpError(400, 'Невалідний lkItemIds');
      }
    }
  }

  const updated = await updateRaidSettings(env.DB, id, fields);
  if (Object.keys(fields).length) {
    await insertAudit(env.DB, id, session.username, 'settings_change', fields);
  }
  // Назва/дата - і в Discord (помилка - у rh_sync_error, зміна на сайті лишається).
  await updateRaidInRaidHelper(env, raid, updated);

  if (lkItemIds && await deleteReservesExceptItems(env.DB, id, lkItemIds) > 0) {
    await insertAudit(env.DB, id, session.username, 'lk_only_cleanup', {});
  }

  if (fields.transfer_weight_limit === 0) {
    await deleteAllTransfersForRaid(env.DB, id);
    await resetAllBonusWeightsForRaid(env.DB, id);
  }

  // Знизили ліміт софтів чи передачі — уже розподілені бонуси обрізаємо під
  // новий пул (раніше вони лишались більшими за ліміт до кінця рейду).
  for (const change of await enforceAllBonusPools(env.DB, updated)) {
    await insertAudit(env.DB, id, session.username, 'bonus_trim', change);
  }

  return jsonResponse(publicRaid(updated));
}

export async function handleLock(request, env, id, locked, session) {
  const raid = await loadRaidOr404(env, id);
  await requireRaidOfficer(env.DB, id, raid, session);

  const updated = await setRaidLock(env.DB, id, locked);
  await insertAudit(env.DB, id, session.username, locked ? 'lock' : 'unlock', {});

  return jsonResponse(publicRaid(updated));
}

export async function handleSetStatus(request, env, id, status, session) {
  const raid = await loadRaidOr404(env, id);
  await requireRaidOfficer(env.DB, id, raid, session);

  // Без цієї перевірки два офіцери, що не встигли побачити чужу зміну
  // статусу (сторінка полить раз на 10с), могли обидва натиснути
  // "Завершити рейд" і отримати два дублікатні записи в аудиті.
  if (raid.status === status) {
    return jsonResponse(publicRaid(raid));
  }

  const updated = await setRaidStatus(env.DB, id, status);
  await insertAudit(env.DB, id, session.username, status === 'completed' ? 'complete' : 'reactivate', {});

  return jsonResponse(publicRaid(updated));
}

// Список офіцерів (з їхніми персонажами) бачать лише лідер і офіцери рейду;
// решта отримує порожній список — їм він не потрібен.
export function canSeeOfficers(raid, officers, session) {
  return raid.leader_discord_id === session.discordId || officers.some((o) => o.discord_id === session.discordId);
}

export async function handleListOfficers(request, env, id, session) {
  const raid = await loadRaidOr404(env, id);
  const officers = await listRaidOfficers(env.DB, id);
  return jsonResponse(canSeeOfficers(raid, officers, session) ? officers : []);
}

export async function handleAddOfficer(request, env, id, session) {
  const raid = await loadRaidOr404(env, id);
  requireLeader(raid, session);

  const body = await readJson(request);
  const discordId = String(body.discordId || '').trim();
  if (!discordId) throw new HttpError(400, 'Потрібен discordId');
  if (discordId === raid.leader_discord_id) throw new HttpError(400, 'Лідер уже має повні права');

  const user = await getUserByDiscordId(env.DB, discordId);
  if (!user) throw new HttpError(404, 'Користувача не знайдено');

  await addRaidOfficer(env.DB, id, discordId);
  await insertAudit(env.DB, id, session.username, 'officer_add', { discordId, username: user.username });

  return jsonResponse(await listRaidOfficers(env.DB, id), 201);
}

export async function handleRemoveOfficer(request, env, id, discordId, session) {
  const raid = await loadRaidOr404(env, id);
  requireLeader(raid, session);
  // Лідер, що не є офіцером гільдії, не може прибрати офіцера гільдії зі
  // свого рейду - лише тих, кого додав сам.
  if (!(await isDefaultOfficer(env.DB, session.discordId)) && (await isDefaultOfficer(env.DB, discordId))) {
    throw new HttpError(403, 'Офіцера гільдії може прибрати лише інший офіцер гільдії');
  }

  await removeRaidOfficer(env.DB, id, discordId);
  await insertAudit(env.DB, id, session.username, 'officer_remove', { discordId });

  return jsonResponse({ ok: true });
}

export async function handleSetPotionLog(request, env, id, session) {
  const raid = await loadRaidOr404(env, id);
  await requireRaidOfficer(env.DB, id, raid, session);

  const body = await readJson(request);
  const raidUrl = body.raidUrl === null || body.raidUrl === undefined ? null : String(body.raidUrl).trim() || null;

  const updated = await updateRaidSettings(env.DB, id, { potion_log_url: raidUrl });
  await insertAudit(env.DB, id, session.username, 'potion_log_change', { raidUrl });

  return jsonResponse(publicRaid(updated));
}

const MAX_COOLDOWN_NAMES = 40;

// Вкладка "Лог": офіцер ставить/знімає КД цього рейду обраним гравцям.
// Колонку визначає сервер з самого рейду (ICC/RS + розмір 10/25; нормал і
// героїк мають спільний КД), тож клієнт не може зачепити інший рейд.
// body: { characters: string[], value: boolean }
export async function handleSetRaidCooldowns(request, env, id, session) {
  const raid = await loadRaidOr404(env, id);
  await requireRaidOfficer(env.DB, id, raid, session);

  const body = await readJson(request);
  if (typeof body.value !== 'boolean') throw new HttpError(400, 'value має бути true або false');
  if (!Array.isArray(body.characters) || !body.characters.length) {
    throw new HttpError(400, 'Не обрано жодного персонажа');
  }
  if (body.characters.length > MAX_COOLDOWN_NAMES) {
    throw new HttpError(400, `Не більше ${MAX_COOLDOWN_NAMES} персонажів за раз`);
  }
  const all = [...new Set(body.characters.map((n) => String(n ?? '').trim()).filter(Boolean))];
  if (!all.length) throw new HttpError(400, "Некоректні імена персонажів");
  // Ім'я гравця в софтах буває довшим за ім'я персонажа (з приміткою в
  // дужках) - персонажа з таким ім'ям бути не може, тож воно просто
  // "немає на сайті", а не помилка для всього списку.
  const names = all.filter((n) => n.length <= 24);
  const tooLong = all.filter((n) => n.length > 24);

  const size = String(raid.difficulty || '').slice(0, 2);
  const key = `${String(raid.instance || '').toLowerCase()}${size}`;
  const column = CHARACTER_COOLDOWN_COLUMNS[key];
  if (!column) throw new HttpError(400, 'Для цього рейду КД не відстежується');

  const result = names.length
    ? await setCharacterCooldownsByNames(env.DB, column, names, body.value)
    : { updated: [], missing: [] };
  result.missing.push(...tooLong);
  await insertAudit(env.DB, id, session.username, body.value ? 'cooldowns_set' : 'cooldowns_clear', {
    cooldown: key,
    characters: result.updated
  });

  return jsonResponse({ cooldown: key, ...result });
}

export async function handleToggleHiddenReserves(request, env, id, session) {
  const raid = await loadRaidOr404(env, id);
  await requireRaidOfficer(env.DB, id, raid, session);

  const newValue = raid.hidden_reserves ? 0 : 1;
  const updated = await updateRaidSettings(env.DB, id, { hidden_reserves: newValue });
  await insertAudit(env.DB, id, session.username, newValue ? 'hide_reserves' : 'show_reserves', {});

  return jsonResponse(publicRaid(updated));
}

// Адмін сайту й гільдійські офіцери (default_officers) - будь-який рейд;
// решта - лише рейди, де вони лідер (хто створив, той і лідер).
export async function handleDeleteRaid(request, env, id, session) {
  const raid = await loadRaidOr404(env, id);
  const isOwn = raid.leader_discord_id === session.discordId;
  if (!isOwn && session.discordId !== env.ADMIN_DISCORD_ID && !(await isDefaultOfficer(env.DB, session.discordId))) {
    throw new HttpError(403, "Видалити рейд може лише його лідер або офіцер гільдії");
  }
  await deleteRaidInRaidHelper(env, raid);
  await insertAudit(env.DB, id, session.username, 'raid_delete', { title: raid.title });
  await deleteRaid(env.DB, id);
  return jsonResponse({ ok: true });
}

// GET /raid-helper/unmatched - рейди з Discord, які не вдалося створити на
// сайті автоматично (гільдійські офіцери, календар).
export async function handleListUnmatchedEvents(request, env, session) {
  await requireGlobalOfficer(env.DB, session);
  return jsonResponse({ events: await listUnmatchedEvents(env.DB) });
}

export async function handlePruneOldRaids(request, env, session) {
  if (session.discordId !== env.ADMIN_DISCORD_ID) throw new HttpError(403, "Лише адміністратор сайту");
  return jsonResponse(await pruneOldRaidsIfOverLimit(env.DB));
}

export { publicRaid };
