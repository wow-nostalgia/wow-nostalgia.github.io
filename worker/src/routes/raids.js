import { HttpError, jsonResponse, readJson, generateRaidId } from '../util.js';
import {
  createRaid,
  listRaids,
  getRaid,
  updateRaidSettings,
  setRaidLock,
  setRaidStatus,
  insertAudit,
  listRaidOfficers,
  addRaidOfficer,
  removeRaidOfficer,
  getUserByDiscordId
} from '../db.js';
import { requireRaidOfficer, requireLeader } from '../auth.js';

const INSTANCES = new Set(['ICC', 'RS']);
const DIFFICULTIES = new Set(['10N', '10H', '25N', '25H']);

function publicRaid(raid) {
  const { officer_token, ...rest } = raid;
  return rest;
}

async function loadRaidOr404(env, id) {
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
  if (!INSTANCES.has(instance)) throw new HttpError(400, 'instance має бути ICC або RS');
  if (!DIFFICULTIES.has(difficulty)) throw new HttpError(400, 'difficulty має бути 10N/10H/25N/25H');

  const softLimitTotal = Number(body.softLimitTotal ?? 3);

  if (!Number.isInteger(softLimitTotal) || softLimitTotal < 1) throw new HttpError(400, 'Невалідний softLimitTotal');

  const id = generateRaidId();

  const raid = await createRaid(env.DB, {
    id,
    title,
    instance,
    difficulty,
    softLimitTotal,
    leaderDiscordId: session.discordId
  });

  await insertAudit(env.DB, id, session.username, 'raid_create', { title, instance, difficulty });

  return jsonResponse(publicRaid(raid), 201);
}

export async function handleListRaids(request, env) {
  const raids = await listRaids(env.DB);
  return jsonResponse(raids);
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

  const updated = await updateRaidSettings(env.DB, id, fields);
  if (Object.keys(fields).length) {
    await insertAudit(env.DB, id, session.username, 'settings_change', fields);
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

  const updated = await setRaidStatus(env.DB, id, status);
  await insertAudit(env.DB, id, session.username, status === 'completed' ? 'complete' : 'reactivate', {});

  return jsonResponse(publicRaid(updated));
}

export async function handleListOfficers(request, env, id) {
  await loadRaidOr404(env, id);
  return jsonResponse(await listRaidOfficers(env.DB, id));
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

  await removeRaidOfficer(env.DB, id, discordId);
  await insertAudit(env.DB, id, session.username, 'officer_remove', { discordId });

  return jsonResponse({ ok: true });
}

export { publicRaid };
