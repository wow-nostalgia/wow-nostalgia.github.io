import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import { requireGlobalOfficer } from '../auth.js';
import {
  listShardQueueDays,
  getShardQueueDay,
  createShardQueueDay,
  updateShardQueueDay,
  listShardQueueEntries,
  listShardQueueEntriesByDay,
  getShardQueueEntry,
  getShardQueueEntryByResource,
  createShardQueueEntry,
  updateShardQueueProgress,
  appendShardQueueEntryToEnd,
  moveShardQueueEntryDay,
  reorderShardQueueEntries,
  deleteShardQueueEntry,
  insertShardQueueAudit,
  listShardQueueAudit,
  isDefaultOfficer,
  listUserCharacters
} from '../db.js';

export const RESOURCE_CAPS = { shard: 50, blood: 2 };
const RESOURCE_LABELS = { shard: 'уламки', blood: 'кров' };

function validateResourceType(value) {
  const resourceType = String(value || '').trim();
  if (!RESOURCE_CAPS[resourceType]) throw new HttpError(400, 'resourceType має бути "blood" або "shard"');
  return resourceType;
}

async function isOwnCharacter(db, discordId, playerName) {
  const characters = await listUserCharacters(db, discordId);
  return characters.some((c) => c.characterName.toLocaleLowerCase('uk') === playerName.toLocaleLowerCase('uk'));
}

// Дозволено, якщо офіцер гільдії АБО власник персонажа (той самий
// self-service-АБО-офіцер патерн, що вже є в checkPlayerAccess для рейдів).
async function requireOwnerOrOfficer(db, session, playerName, message) {
  const officer = await isDefaultOfficer(db, session.discordId);
  if (officer) return true;
  const owns = await isOwnCharacter(db, session.discordId, playerName);
  if (!owns) throw new HttpError(403, message);
  return false;
}

// ---- Дні ----

export async function handleListShardQueueDays(request, env) {
  return jsonResponse(await listShardQueueDays(env.DB));
}

export async function handleCreateShardQueueDay(request, env, session) {
  await requireGlobalOfficer(env.DB, session);

  const body = await readJson(request);
  const label = String(body.label || '').trim();
  if (!label) throw new HttpError(400, 'Потрібна назва дня');

  const day = await createShardQueueDay(env.DB, label);
  await insertShardQueueAudit(env.DB, session.username, 'day_create', { dayId: day.id, label });
  return jsonResponse(day, 201);
}

export async function handleUpdateShardQueueDay(request, env, dayId, session) {
  await requireGlobalOfficer(env.DB, session);

  const day = await getShardQueueDay(env.DB, dayId);
  if (!day) throw new HttpError(404, 'День не знайдено');

  const body = await readJson(request);
  const fields = {};
  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) throw new HttpError(400, 'Потрібна назва дня');
    fields.label = label;
  }
  if (body.isActive !== undefined) fields.isActive = Boolean(body.isActive);

  // Анулювати не можна, доки в дні лишається хоч один активний рядок
  // (беклог-записи цього дня в підрахунок не йдуть — вони анулюванню не
  // заважають, лишаються видимими на вкладці "Вже зібрано" й далі).
  if (fields.isActive === false && day.is_active) {
    const entries = await listShardQueueEntriesByDay(env.DB, dayId);
    const hasActive = entries.some((e) => e.progress < RESOURCE_CAPS[e.resource_type]);
    if (hasActive) {
      throw new HttpError(409, 'У черзі цього дня ще є гравці — спершу перенеси або дочекайся, поки вони завершать');
    }
  }

  const updated = await updateShardQueueDay(env.DB, dayId, fields);
  await insertShardQueueAudit(env.DB, session.username, 'day_update', { dayId, ...fields });
  return jsonResponse(updated);
}

// ---- Записи ----

export async function handleListShardQueue(request, env) {
  return jsonResponse(await listShardQueueEntries(env.DB));
}

export async function handleCreateShardQueueEntry(request, env, session) {
  const body = await readJson(request);
  const dayId = Number(body.dayId);
  const resourceType = validateResourceType(body.resourceType);
  const playerName = capitalizeName(String(body.playerName || '').trim());

  if (!Number.isInteger(dayId)) throw new HttpError(400, 'Невалідний dayId');
  if (!playerName) throw new HttpError(400, "Потрібне ім'я персонажа");

  const day = await getShardQueueDay(env.DB, dayId);
  if (!day) throw new HttpError(404, 'День не знайдено');
  if (!day.is_active) throw new HttpError(400, 'Цей день анульовано');

  const officer = await requireOwnerOrOfficer(
    env.DB,
    session,
    playerName,
    `Персонажа "${playerName}" немає у твоєму профілі — додай його на сторінці "Акаунт"`
  );

  // Точне 409-повідомлення залежно від стану наявного рядка (перед тим, як
  // покластись на сам UNIQUE-виняток нижче — та лишається останньою
  // страховкою на випадок гонки запитів).
  const existing = await getShardQueueEntryByResource(env.DB, resourceType, playerName);
  if (existing) {
    const cap = RESOURCE_CAPS[resourceType];
    if (existing.progress >= cap) {
      throw new HttpError(409, `Цей персонаж уже зібрав ${RESOURCE_LABELS[resourceType]} (${existing.progress}/${cap})`);
    }
    const existingDay = await getShardQueueDay(env.DB, existing.day_id);
    throw new HttpError(409, `Цей персонаж уже в черзі на ${RESOURCE_LABELS[resourceType]}, день "${existingDay?.label || '?'}"`);
  }

  let entry;
  try {
    entry = await createShardQueueEntry(env.DB, dayId, resourceType, playerName);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      throw new HttpError(409, `Цей персонаж уже в черзі на ${RESOURCE_LABELS[resourceType]}`);
    }
    throw err;
  }

  await insertShardQueueAudit(env.DB, officer ? session.username : playerName, 'entry_create', {
    entryId: entry.id,
    dayId,
    resourceType,
    playerName
  });

  return jsonResponse(entry, 201);
}

export async function handleUpdateProgress(request, env, entryId, session) {
  const entry = await getShardQueueEntry(env.DB, entryId);
  if (!entry) throw new HttpError(404, 'Запис не знайдено');

  const officer = await requireOwnerOrOfficer(env.DB, session, entry.player_name, 'Немає прав редагувати цей рядок');

  const body = await readJson(request);
  const progress = Number(body.progress);
  const cap = RESOURCE_CAPS[entry.resource_type];
  if (!Number.isInteger(progress) || progress < 0 || progress > cap) {
    throw new HttpError(400, `progress має бути від 0 до ${cap}`);
  }

  const wasBacklog = entry.progress >= cap;
  let updated = await updateShardQueueProgress(env.DB, entryId, progress);

  // Перехід беклог → активна черга: стара позиція вже нерелевантна (інші
  // рядки посунулись, доки цей був у беклозі) — скидаємо в кінець.
  if (wasBacklog && updated.progress < cap) {
    updated = await appendShardQueueEntryToEnd(env.DB, entryId);
  }

  await insertShardQueueAudit(env.DB, officer ? session.username : entry.player_name, 'progress_update', {
    entryId,
    playerName: entry.player_name,
    resourceType: entry.resource_type,
    from: entry.progress,
    to: progress
  });

  return jsonResponse(updated);
}

export async function handleReorderShardQueue(request, env, session) {
  await requireGlobalOfficer(env.DB, session);

  const body = await readJson(request);
  const dayId = Number(body.dayId);
  const resourceType = validateResourceType(body.resourceType);
  const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(Number) : [];

  if (!Number.isInteger(dayId)) throw new HttpError(400, 'Невалідний dayId');
  if (!orderedIds.length) throw new HttpError(400, 'orderedIds не може бути порожнім');

  const entries = await listShardQueueEntriesByDay(env.DB, dayId);
  const activeIds = entries
    .filter((e) => e.resource_type === resourceType && e.progress < RESOURCE_CAPS[resourceType])
    .map((e) => e.id);

  const sameSet = activeIds.length === orderedIds.length && activeIds.every((id) => orderedIds.includes(id));
  if (!sameSet) {
    throw new HttpError(400, 'Набір рядків не збігається з поточною активною чергою — перезавантаж сторінку');
  }

  await reorderShardQueueEntries(env.DB, orderedIds);
  await insertShardQueueAudit(env.DB, session.username, 'entries_reorder', { dayId, resourceType, orderedIds });

  return jsonResponse({ ok: true });
}

export async function handleMoveShardQueueEntryDay(request, env, entryId, session) {
  const entry = await getShardQueueEntry(env.DB, entryId);
  if (!entry) throw new HttpError(404, 'Запис не знайдено');

  const officer = await requireOwnerOrOfficer(env.DB, session, entry.player_name, 'Немає прав переносити цей рядок');

  const cap = RESOURCE_CAPS[entry.resource_type];
  if (entry.progress >= cap) throw new HttpError(400, 'Завершені записи не переносяться');

  const body = await readJson(request);
  const newDayId = Number(body.dayId);
  if (!Number.isInteger(newDayId)) throw new HttpError(400, 'Невалідний dayId');

  const newDay = await getShardQueueDay(env.DB, newDayId);
  if (!newDay || !newDay.is_active) throw new HttpError(400, 'День-призначення недоступний');

  const updated = await moveShardQueueEntryDay(env.DB, entryId, newDayId);
  await insertShardQueueAudit(env.DB, officer ? session.username : entry.player_name, 'entry_move_day', {
    entryId,
    playerName: entry.player_name,
    fromDayId: entry.day_id,
    toDayId: newDayId
  });

  return jsonResponse(updated);
}

export async function handleDeleteShardQueueEntry(request, env, entryId, session) {
  const entry = await getShardQueueEntry(env.DB, entryId);
  if (!entry) throw new HttpError(404, 'Запис не знайдено');

  const officer = await requireOwnerOrOfficer(env.DB, session, entry.player_name, 'Немає прав видаляти цей рядок');

  const cap = RESOURCE_CAPS[entry.resource_type];
  if (entry.progress >= cap) throw new HttpError(400, 'Записи в "Вже зібрано" не видаляються');

  await deleteShardQueueEntry(env.DB, entryId);
  await insertShardQueueAudit(env.DB, officer ? session.username : entry.player_name, 'entry_delete', {
    entryId,
    dayId: entry.day_id,
    resourceType: entry.resource_type,
    playerName: entry.player_name
  });

  return jsonResponse({ ok: true });
}

// ---- Аудит ----

export async function handleListShardQueueAudit(request, env) {
  const entries = await listShardQueueAudit(env.DB);
  return jsonResponse(entries.map((e) => ({ ...e, detail: JSON.parse(e.detail_json) })));
}
