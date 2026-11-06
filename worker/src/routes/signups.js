// Попередній запис на рейд (вкладка "Попередній запис" + календар).
// Правила (узгоджено, за зразком Raid-Helper):
// - один запис на гравця (Discord-акаунт) у рейді, персонаж - лише зі свого
//   профілю; клас + спек + статус (signed/late/tentative/bench/absent);
// - номер запису присвоюється при першому записі й не змінюється;
// - гравець записується/змінює/скасовує до часу початку рейду (deadline 0);
//   після - лише лідер/офіцер рейду (статус, видалення);
// - ліміт 25 лише показується (фронт позначає "понад ліміт").
// Рейд, прив'язаний до Raid-Helper (raids.rh_event_id), - див. raid-helper.js:
// кожна зміна спершу йде в Raid-Helper.
import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import {
  listRaidSignups,
  upsertOwnSignup,
  deleteOwnSignup,
  getRaidSignup,
  setSignupStatus,
  deleteSignupById,
  setSignupSiteFields,
  listSignupRows,
  setRaidHelperLink,
  findRaidByRhEventId,
  insertAudit
} from '../db.js';
import { requireOwnCharacter, requireRaidOfficer } from '../auth.js';
import { loadRaidOr404 } from './raids.js';
import { isValidClassSpec, SIGNUP_STATUSES } from '../signup-specs.js';
import {
  isRaidHelperEventId,
  fetchRaidHelperEvent,
  syncRaidFromRaidHelper,
  isSyncStale,
  pushSignupToRaidHelper,
  deleteSignupInRaidHelper,
  pushLocalSignupsOnLink
} from '../raid-helper.js';

function requireSignupsOpen(raid) {
  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено');
  const start = raid.starts_at ? Date.parse(raid.starts_at) : null;
  if (start !== null && Date.now() >= start) {
    throw new HttpError(423, 'Запис закрито: рейд уже почався. Зміни може внести лідер або офіцер.');
  }
}

function parseStatus(value) {
  if (!SIGNUP_STATUSES.includes(value)) throw new HttpError(400, 'Невідомий статус запису');
  return value;
}

// Відкриття вкладки підтягує свіже з Raid-Helper (не частіше раз на хвилину);
// помилка не ламає список - лишаються останні записи, помилка видна в рейді.
export async function handleListSignups(request, env, raidId) {
  const raid = await loadRaidOr404(env, raidId);
  if (raid.rh_event_id && raid.status !== 'completed' && isSyncStale(raid)) {
    await syncRaidFromRaidHelper(env, raid, { throwOnError: false });
  }
  return jsonResponse(await listRaidSignups(env.DB, raidId));
}

async function findOwnRow(env, raidId, discordId) {
  return (await listSignupRows(env.DB, raidId)).find((row) => row.discord_id === discordId) || null;
}

// PUT /raids/:id/signups/me { characterName, class, spec, status }
export async function handleUpsertOwnSignup(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  requireSignupsOpen(raid);

  const body = await readJson(request);
  const characterName = capitalizeName(String(body.characterName || '').trim());
  const cls = String(body.class || '');
  const spec = String(body.spec || '');
  if (!characterName) throw new HttpError(400, 'Обери персонажа');
  if (!isValidClassSpec(cls, spec)) throw new HttpError(400, 'Невідомий клас або спек');
  const status = parseStatus(body.status);
  await requireOwnCharacter(env.DB, session.discordId, characterName);

  if (raid.rh_event_id) {
    const row = await findOwnRow(env, raidId, session.discordId);
    await pushSignupToRaidHelper(env, raid, row, { discordId: session.discordId, cls, spec, status });
    await setSignupSiteFields(env.DB, raidId, session.discordId, { characterName, cls, spec });
  } else {
    await upsertOwnSignup(env.DB, raidId, session.discordId, { characterName, cls, spec, status });
  }
  return jsonResponse(await listRaidSignups(env.DB, raidId));
}

export async function handleDeleteOwnSignup(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  requireSignupsOpen(raid);
  if (raid.rh_event_id) {
    const row = await findOwnRow(env, raidId, session.discordId);
    if (row) await deleteSignupInRaidHelper(env, raid, row);
  } else {
    await deleteOwnSignup(env.DB, raidId, session.discordId);
  }
  return jsonResponse(await listRaidSignups(env.DB, raidId));
}

function signupLabel(signup) {
  return signup.character_name || signup.discord_name || signup.discord_id;
}

// PATCH /raids/:id/signups/:signupId { status } - лідер/офіцер, будь-коли.
export async function handleOfficerSetSignupStatus(request, env, raidId, signupId, session) {
  const raid = await loadRaidOr404(env, raidId);
  await requireRaidOfficer(env.DB, raidId, raid, session);
  const body = await readJson(request);
  const status = parseStatus(body.status);
  const signup = await getRaidSignup(env.DB, raidId, signupId);
  if (!signup) throw new HttpError(404, 'Запис не знайдено');
  if (raid.rh_event_id) {
    if (status === 'signed' && !signup.class) throw new HttpError(400, 'У запису немає класу - гравець має обрати його сам');
    await pushSignupToRaidHelper(env, raid, signup, { discordId: signup.discord_id, cls: signup.class, spec: signup.spec, status });
  } else {
    await setSignupStatus(env.DB, raidId, signupId, status);
  }
  await insertAudit(env.DB, raidId, session.username, 'signup_status', {
    characterName: signupLabel(signup), from: signup.status, to: status
  });
  return jsonResponse(await listRaidSignups(env.DB, raidId));
}

export async function handleOfficerDeleteSignup(request, env, raidId, signupId, session) {
  const raid = await loadRaidOr404(env, raidId);
  await requireRaidOfficer(env.DB, raidId, raid, session);
  const signup = await getRaidSignup(env.DB, raidId, signupId);
  if (!signup) throw new HttpError(404, 'Запис не знайдено');
  if (raid.rh_event_id) {
    await deleteSignupInRaidHelper(env, raid, signup);
  } else {
    await deleteSignupById(env.DB, raidId, signupId);
  }
  await insertAudit(env.DB, raidId, session.username, 'signup_remove', { characterName: signupLabel(signup) });
  return jsonResponse(await listRaidSignups(env.DB, raidId));
}

// PUT /raids/:id/raid-helper { eventId } - прив'язати (eventId) або
// відв'язати (eventId порожній) рейд від Raid-Helper. Лідер/офіцер рейду.
// Записи сайту, яких ще немає в Raid-Helper, відправляються туди; що не
// вдалося відправити - повертається в failed (і зникає з сайту, бо джерело
// правди тепер Raid-Helper).
export async function handleSetRaidHelperLink(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  await requireRaidOfficer(env.DB, raidId, raid, session);
  const body = await readJson(request);
  const eventId = String(body.eventId ?? '').trim();

  if (!eventId) {
    await setRaidHelperLink(env.DB, raidId, null);
    await insertAudit(env.DB, raidId, session.username, 'rh_unlink', { eventId: raid.rh_event_id });
    return jsonResponse({ signups: await listRaidSignups(env.DB, raidId), pushed: 0, failed: [] });
  }
  if (!isRaidHelperEventId(eventId)) throw new HttpError(400, 'ID рейду Raid-Helper - це число з 17-20 цифр (ID повідомлення в Discord)');
  const other = await findRaidByRhEventId(env.DB, eventId);
  if (other && other.id !== raidId) throw new HttpError(409, `Цей рейд Raid-Helper уже прив'язаний до "${other.title}"`);

  const event = await fetchRaidHelperEvent(env, eventId);
  const linked = { ...raid, rh_event_id: eventId };
  const { pushed, failed } = await pushLocalSignupsOnLink(env, linked, event);
  await setRaidHelperLink(env.DB, raidId, eventId);
  await syncRaidFromRaidHelper(env, linked);
  await insertAudit(env.DB, raidId, session.username, 'rh_link', { eventId, pushed, failed: failed.length });
  return jsonResponse({ signups: await listRaidSignups(env.DB, raidId), pushed, failed });
}

// POST /raids/:id/raid-helper/sync - "Оновити зараз". Лідер/офіцер рейду.
export async function handleRaidHelperSyncNow(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  await requireRaidOfficer(env.DB, raidId, raid, session);
  if (!raid.rh_event_id) throw new HttpError(400, "Рейд не прив'язаний до Raid-Helper");
  const { skipped } = await syncRaidFromRaidHelper(env, raid);
  return jsonResponse({ signups: await listRaidSignups(env.DB, raidId), skipped });
}
