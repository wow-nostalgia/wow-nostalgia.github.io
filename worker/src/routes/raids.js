import { HttpError, jsonResponse, readJson, generateRaidId, generateToken } from '../util.js';
import { createRaid, listRaids, getRaid, updateRaidSettings, setRaidLock, insertAudit } from '../db.js';
import { requireOfficer } from '../auth.js';

const INSTANCES = new Set(['ICC', 'RS']);
const DIFFICULTIES = new Set(['10N', '10H', '25N', '25H']);

function publicRaid(raid) {
  const { officer_token, ...rest } = raid;
  return rest;
}

export async function handleCreateRaid(request, env) {
  const body = await readJson(request);
  const title = String(body.title || '').trim();
  const instance = String(body.instance || '').trim();
  const difficulty = String(body.difficulty || '').trim();

  if (!title) throw new HttpError(400, 'Потрібна назва рейду');
  if (!INSTANCES.has(instance)) throw new HttpError(400, 'instance має бути ICC або RS');
  if (!DIFFICULTIES.has(difficulty)) throw new HttpError(400, 'difficulty має бути 10N/10H/25N/25H');

  const softLimitTotal = Number(body.softLimitTotal ?? 3);
  const softLimitItems = Number(body.softLimitItems ?? 3);
  const allowDuplicateSoft = Boolean(body.allowDuplicateSoft ?? true);

  if (!Number.isInteger(softLimitTotal) || softLimitTotal < 1) throw new HttpError(400, 'Невалідний softLimitTotal');
  if (!Number.isInteger(softLimitItems) || softLimitItems < 1) throw new HttpError(400, 'Невалідний softLimitItems');

  const id = generateRaidId();
  const officerToken = generateToken();

  const raid = await createRaid(env.DB, {
    id,
    title,
    instance,
    difficulty,
    softLimitTotal,
    softLimitItems,
    allowDuplicateSoft,
    officerToken
  });

  await insertAudit(env.DB, id, 'officer', 'raid_create', { title, instance, difficulty });

  return jsonResponse({ ...publicRaid(raid), officerToken }, 201);
}

export async function handleListRaids(request, env) {
  const raids = await listRaids(env.DB);
  return jsonResponse(raids);
}

export async function handleGetRaid(request, env, id) {
  const raid = await getRaid(env.DB, id);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  return jsonResponse(publicRaid(raid));
}

export async function handleUpdateRaid(request, env, id) {
  const raid = await getRaid(env.DB, id);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  requireOfficer(request, raid);

  const body = await readJson(request);
  const fields = {};

  if (body.title !== undefined) fields.title = String(body.title).trim();
  if (body.softLimitTotal !== undefined) fields.soft_limit_total = Number(body.softLimitTotal);
  if (body.softLimitItems !== undefined) fields.soft_limit_items = Number(body.softLimitItems);
  if (body.allowDuplicateSoft !== undefined) fields.allow_duplicate_soft = body.allowDuplicateSoft ? 1 : 0;

  const updated = await updateRaidSettings(env.DB, id, fields);
  if (Object.keys(fields).length) {
    await insertAudit(env.DB, id, 'officer', 'settings_change', fields);
  }

  return jsonResponse(publicRaid(updated));
}

export async function handleLock(request, env, id, locked) {
  const raid = await getRaid(env.DB, id);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  requireOfficer(request, raid);

  const updated = await setRaidLock(env.DB, id, locked);
  await insertAudit(env.DB, id, 'officer', locked ? 'lock' : 'unlock', {});

  return jsonResponse(publicRaid(updated));
}

export { publicRaid };
