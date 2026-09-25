import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import { requireGlobalOfficer } from '../auth.js';
import {
  listBuffQueueDays,
  getBuffQueueDay,
  createBuffQueueDay,
  updateBuffQueueDay,
  listBuffQueueTypes,
  getBuffQueueType,
  createBuffQueueType,
  updateBuffQueueType,
  listBuffQueueBosses,
  getBuffQueueBoss,
  setBuffQueueBossActive,
  listBuffQueueEntries,
  getBuffQueueEntry,
  findActiveBuffQueueEntry,
  buffQueueDayHasActiveEntries,
  buffQueueTypeHasActiveEntries,
  buffQueueBossHasActiveEntries,
  createBuffQueueEntry,
  setBuffQueueEntryStatus,
  moveBuffQueueEntryDay,
  reorderBuffQueueEntries,
  deleteBuffQueueEntry,
  insertBuffQueueAudit,
  listBuffQueueAudit,
  listBuffQueueAuditActors,
  isDefaultOfficer,
  listUserCharacters
} from '../db.js';

// Статуси йдуть лише вперед, з одним винятком: "Посилений" можна
// повернути в "Очікує" (вайп, натиснули не того). "Виконано" остаточне.
const STATUS_TRANSITIONS = {
  waiting: ['buffed'],
  buffed: ['waiting', 'done'],
  done: []
};

const MAX_TYPE_LABEL_LENGTH = 40;

async function isOwnCharacter(db, discordId, playerName) {
  const characters = await listUserCharacters(db, discordId);
  return characters.some((c) => c.characterName.toLocaleLowerCase('uk') === playerName.toLocaleLowerCase('uk'));
}

// Офіцер гільдії (призначається адміном) АБО власник персонажа — той самий
// патерн, що в черзі на уламки. Повертає true, якщо це офіцер: від цього
// залежить, від чийого імені пишеться аудит.
async function requireOwnerOrOfficer(db, session, playerName, message) {
  if (await isDefaultOfficer(db, session.discordId)) return true;
  if (!(await isOwnCharacter(db, session.discordId, playerName))) throw new HttpError(403, message);
  return false;
}

// Власник може прибрати чи перенести свій запис лише поки той "Очікує":
// "Посилений" означає, що рейд іде просто зараз, і ним керує офіцер.
function requireOwnerCanTouch(entry, officer) {
  if (!officer && entry.status !== 'waiting') {
    throw new HttpError(409, 'Запис уже в роботі — змінити його може лише офіцер');
  }
}

async function loadEntryOr404(env, entryId) {
  const entry = await getBuffQueueEntry(env.DB, entryId);
  if (!entry) throw new HttpError(404, 'Запис не знайдено');
  return entry;
}

// ---- Дні ----

export async function handleListBuffQueueDays(request, env) {
  return jsonResponse(await listBuffQueueDays(env.DB));
}

export async function handleCreateBuffQueueDay(request, env, session) {
  await requireGlobalOfficer(env.DB, session);

  const body = await readJson(request);
  const label = String(body.label || '').trim();
  if (!label) throw new HttpError(400, 'Потрібна назва дня');

  const day = await createBuffQueueDay(env.DB, label);
  await insertBuffQueueAudit(env.DB, session.username, 'day_create', { dayId: day.id, label });
  return jsonResponse(day, 201);
}

export async function handleUpdateBuffQueueDay(request, env, dayId, session) {
  await requireGlobalOfficer(env.DB, session);

  const day = await getBuffQueueDay(env.DB, dayId);
  if (!day) throw new HttpError(404, 'День не знайдено');

  const body = await readJson(request);
  const fields = {};
  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) throw new HttpError(400, 'Потрібна назва дня');
    fields.label = label;
  }
  if (body.isActive !== undefined) fields.isActive = Boolean(body.isActive);

  if (fields.isActive === false && day.is_active && (await buffQueueDayHasActiveEntries(env.DB, dayId))) {
    throw new HttpError(409, 'У черзі цього дня ще є гравці — спершу перенеси їх на інший день');
  }

  const updated = await updateBuffQueueDay(env.DB, dayId, fields);
  await insertBuffQueueAudit(env.DB, session.username, 'day_update', { dayId, ...fields });
  return jsonResponse(updated);
}

// ---- Типи посилень ----

function validateTypeLabel(value) {
  const label = String(value || '').trim();
  if (!label) throw new HttpError(400, 'Потрібна назва посилення');
  if (label.length > MAX_TYPE_LABEL_LENGTH) {
    throw new HttpError(400, `Назва посилення — до ${MAX_TYPE_LABEL_LENGTH} символів`);
  }
  return label;
}

// Два посилення з однаковою назвою гравці не розрізнили б у формі запису.
async function requireUniqueTypeLabel(db, label, exceptId) {
  const types = await listBuffQueueTypes(db);
  const lower = label.toLocaleLowerCase('uk');
  if (types.some((t) => t.id !== exceptId && t.label.toLocaleLowerCase('uk') === lower)) {
    throw new HttpError(409, `Посилення "${label}" уже є`);
  }
}

export async function handleListBuffQueueTypes(request, env) {
  return jsonResponse(await listBuffQueueTypes(env.DB));
}

export async function handleCreateBuffQueueType(request, env, session) {
  await requireGlobalOfficer(env.DB, session);

  const body = await readJson(request);
  const label = validateTypeLabel(body.label);
  await requireUniqueTypeLabel(env.DB, label, null);

  const type = await createBuffQueueType(env.DB, label);
  await insertBuffQueueAudit(env.DB, session.username, 'type_create', { buffTypeId: type.id, label });
  return jsonResponse(type, 201);
}

export async function handleUpdateBuffQueueType(request, env, typeId, session) {
  await requireGlobalOfficer(env.DB, session);

  const type = await getBuffQueueType(env.DB, typeId);
  if (!type) throw new HttpError(404, 'Посилення не знайдено');

  const body = await readJson(request);
  const fields = {};
  if (body.label !== undefined) {
    fields.label = validateTypeLabel(body.label);
    await requireUniqueTypeLabel(env.DB, fields.label, typeId);
  }
  if (body.isActive !== undefined) fields.isActive = Boolean(body.isActive);

  if (fields.isActive === false && type.is_active && (await buffQueueTypeHasActiveEntries(env.DB, typeId))) {
    throw new HttpError(409, 'На це посилення ще є черга — спершу її треба завершити або прибрати');
  }

  const updated = await updateBuffQueueType(env.DB, typeId, fields);
  await insertBuffQueueAudit(env.DB, session.username, 'type_update', {
    buffTypeId: typeId,
    previousLabel: type.label,
    ...fields
  });
  return jsonResponse(updated);
}

// ---- Боси ----

export async function handleListBuffQueueBosses(request, env) {
  return jsonResponse(await listBuffQueueBosses(env.DB));
}

export async function handleUpdateBuffQueueBoss(request, env, bossName, session) {
  await requireGlobalOfficer(env.DB, session);

  const boss = await getBuffQueueBoss(env.DB, bossName);
  if (!boss) throw new HttpError(404, 'Боса не знайдено');

  const body = await readJson(request);
  if (body.isActive === undefined) throw new HttpError(400, 'Немає що змінювати');
  const isActive = Boolean(body.isActive);

  if (!isActive && boss.is_active && (await buffQueueBossHasActiveEntries(env.DB, bossName))) {
    throw new HttpError(409, 'На цього боса ще є черга — спершу її треба завершити або прибрати');
  }

  const updated = await setBuffQueueBossActive(env.DB, bossName, isActive);
  await insertBuffQueueAudit(env.DB, session.username, 'boss_update', { boss: bossName, isActive });
  return jsonResponse(updated);
}

// ---- Записи ----

export async function handleListBuffQueue(request, env) {
  return jsonResponse(await listBuffQueueEntries(env.DB));
}

export async function handleCreateBuffQueueEntry(request, env, session) {
  const body = await readJson(request);
  const dayId = Number(body.dayId);
  const buffTypeId = Number(body.buffTypeId);
  const bossName = String(body.boss || '').trim();
  const playerName = capitalizeName(String(body.playerName || '').trim());

  if (!Number.isInteger(dayId)) throw new HttpError(400, 'Невалідний dayId');
  if (!Number.isInteger(buffTypeId)) throw new HttpError(400, 'Невалідний buffTypeId');
  if (!bossName) throw new HttpError(400, 'Потрібен бос');
  if (!playerName) throw new HttpError(400, "Потрібне ім'я персонажа");

  const [day, type, boss] = await Promise.all([
    getBuffQueueDay(env.DB, dayId),
    getBuffQueueType(env.DB, buffTypeId),
    getBuffQueueBoss(env.DB, bossName)
  ]);
  if (!day || !day.is_active) throw new HttpError(400, 'Цей день недоступний');
  if (!type || !type.is_active) throw new HttpError(400, 'Це посилення недоступне');
  if (!boss || !boss.is_active) throw new HttpError(400, 'Цей бос недоступний');

  const officer = await requireOwnerOrOfficer(
    env.DB,
    session,
    playerName,
    `Персонажа "${playerName}" немає у твоєму профілі — додай його на сторінці "Акаунт"`
  );

  // Точне повідомлення до того, як спрацює частковий UNIQUE-індекс. Боса
  // не називаємо: Worker знає лише англійську назву, а переклад живе на фронті.
  const existing = await findActiveBuffQueueEntry(env.DB, playerName, bossName, buffTypeId);
  if (existing) {
    const existingDay = await getBuffQueueDay(env.DB, existing.day_id);
    throw new HttpError(
      409,
      `${playerName} уже в черзі на "${type.label}" на цього боса, день "${existingDay?.label || '?'}"`
    );
  }

  let entry;
  try {
    entry = await createBuffQueueEntry(env.DB, { dayId, boss: bossName, buffTypeId, playerName });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      throw new HttpError(409, `${playerName} уже в черзі на "${type.label}" на цього боса`);
    }
    throw err;
  }

  await insertBuffQueueAudit(env.DB, officer ? session.username : playerName, 'entry_create', {
    entryId: entry.id,
    dayId,
    boss: bossName,
    buffTypeId,
    playerName
  });

  return jsonResponse(entry, 201);
}

export async function handleUpdateBuffQueueStatus(request, env, entryId, session) {
  await requireGlobalOfficer(env.DB, session);

  const entry = await loadEntryOr404(env, entryId);
  const body = await readJson(request);
  const status = String(body.status || '');

  if (!STATUS_TRANSITIONS[entry.status]?.includes(status)) {
    throw new HttpError(409, 'Такий перехід статусу неможливий — перезавантаж сторінку');
  }

  const updated = await setBuffQueueEntryStatus(env.DB, entryId, status);
  await insertBuffQueueAudit(env.DB, session.username, 'status_update', {
    entryId,
    playerName: entry.player_name,
    boss: entry.boss,
    buffTypeId: entry.buff_type_id,
    dayId: entry.day_id,
    from: entry.status,
    to: status
  });

  return jsonResponse(updated);
}

export async function handleReorderBuffQueue(request, env, session) {
  await requireGlobalOfficer(env.DB, session);

  const body = await readJson(request);
  const dayId = Number(body.dayId);
  const buffTypeId = Number(body.buffTypeId);
  const bossName = String(body.boss || '').trim();
  const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(Number) : [];

  if (!Number.isInteger(dayId) || !Number.isInteger(buffTypeId) || !bossName) {
    throw new HttpError(400, 'Потрібні dayId, boss і buffTypeId');
  }
  if (!orderedIds.length) throw new HttpError(400, 'orderedIds не може бути порожнім');

  const queueIds = (await listBuffQueueEntries(env.DB))
    .filter((e) => e.day_id === dayId && e.boss === bossName && e.buff_type_id === buffTypeId && e.status !== 'done')
    .map((e) => e.id);

  const sameSet = queueIds.length === orderedIds.length && queueIds.every((id) => orderedIds.includes(id));
  if (!sameSet) {
    throw new HttpError(400, 'Набір рядків не збігається з поточною чергою — перезавантаж сторінку');
  }

  await reorderBuffQueueEntries(env.DB, orderedIds);
  await insertBuffQueueAudit(env.DB, session.username, 'entries_reorder', { dayId, boss: bossName, buffTypeId });

  return jsonResponse({ ok: true });
}

export async function handleMoveBuffQueueEntryDay(request, env, entryId, session) {
  const entry = await loadEntryOr404(env, entryId);
  const officer = await requireOwnerOrOfficer(env.DB, session, entry.player_name, 'Немає прав переносити цей запис');

  if (entry.status === 'done') throw new HttpError(400, 'Виконані записи не переносяться');
  requireOwnerCanTouch(entry, officer);

  const body = await readJson(request);
  const newDayId = Number(body.dayId);
  if (!Number.isInteger(newDayId)) throw new HttpError(400, 'Невалідний dayId');
  if (newDayId === entry.day_id) throw new HttpError(400, 'Запис уже на цьому дні');

  const newDay = await getBuffQueueDay(env.DB, newDayId);
  if (!newDay || !newDay.is_active) throw new HttpError(400, 'День-призначення недоступний');

  const updated = await moveBuffQueueEntryDay(env.DB, entryId, newDayId);
  await insertBuffQueueAudit(env.DB, officer ? session.username : entry.player_name, 'entry_move_day', {
    entryId,
    playerName: entry.player_name,
    boss: entry.boss,
    buffTypeId: entry.buff_type_id,
    fromDayId: entry.day_id,
    toDayId: newDayId
  });

  return jsonResponse(updated);
}

export async function handleDeleteBuffQueueEntry(request, env, entryId, session) {
  const entry = await loadEntryOr404(env, entryId);
  const officer = await requireOwnerOrOfficer(env.DB, session, entry.player_name, 'Немає прав прибирати цей запис');

  if (entry.status === 'done') throw new HttpError(400, 'Виконані записи не прибираються');
  requireOwnerCanTouch(entry, officer);

  await deleteBuffQueueEntry(env.DB, entryId);
  await insertBuffQueueAudit(env.DB, officer ? session.username : entry.player_name, 'entry_delete', {
    entryId,
    playerName: entry.player_name,
    boss: entry.boss,
    buffTypeId: entry.buff_type_id,
    dayId: entry.day_id
  });

  return jsonResponse({ ok: true });
}

// ---- Аудит ----

// Категорії фільтра "Подія" на фронті → які action (і перехід статусу) під ними.
const AUDIT_CATEGORIES = {
  entry_create: { actions: ['entry_create'] },
  buffed: { actions: ['status_update'], statusTo: 'buffed' },
  done: { actions: ['status_update'], statusTo: 'done' },
  unbuffed: { actions: ['status_update'], statusTo: 'waiting' },
  entry_delete: { actions: ['entry_delete'] },
  entry_move_day: { actions: ['entry_move_day'] },
  entries_reorder: { actions: ['entries_reorder'] },
  settings: { actions: ['day_create', 'day_update', 'type_create', 'type_update', 'boss_update'] }
};

const ISO_MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

export async function handleListBuffQueueAudit(request, env) {
  const params = new URL(request.url).searchParams;
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const actor = (params.get('actor') || '').trim();
  const category = params.get('category') || '';

  if ((from && !ISO_MOMENT.test(from)) || (to && !ISO_MOMENT.test(to))) {
    throw new HttpError(400, 'Невалідна дата фільтра');
  }
  if (category && !AUDIT_CATEGORIES[category]) throw new HttpError(400, 'Невідомий тип події');

  const [entries, actors] = await Promise.all([
    listBuffQueueAudit(env.DB, { from, to, actor, ...(AUDIT_CATEGORIES[category] || {}) }),
    listBuffQueueAuditActors(env.DB)
  ]);
  return jsonResponse({
    entries: entries.map((e) => ({ ...e, detail: JSON.parse(e.detail_json) })),
    actors
  });
}
