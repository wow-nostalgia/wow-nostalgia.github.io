import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import { getRaid, listBonusGrants, createBonusGrant, deleteBonusGrant, insertAudit } from '../db.js';
import { requireRaidOfficer } from '../auth.js';

async function loadRaidOr404(env, raidId) {
  const raid = await getRaid(env.DB, raidId);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  return raid;
}

export async function handleListBonusGrants(request, env, raidId) {
  await loadRaidOr404(env, raidId);
  return jsonResponse(await listBonusGrants(env.DB, raidId));
}

export async function handleCreateBonusGrant(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено');

  await requireRaidOfficer(env.DB, raidId, raid, session);

  const body = await readJson(request);
  const playerName = capitalizeName(String(body.playerName || '').trim());
  if (!playerName) throw new HttpError(400, "Потрібне ім'я гравця");

  await createBonusGrant(env.DB, raidId, playerName, session.username);
  await insertAudit(env.DB, raidId, session.username, 'bonus_grant', { playerName });

  return jsonResponse({ playerName }, 201);
}

export async function handleDeleteBonusGrant(request, env, raidId, playerName, session) {
  const raid = await loadRaidOr404(env, raidId);
  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено');

  await requireRaidOfficer(env.DB, raidId, raid, session);

  await deleteBonusGrant(env.DB, raidId, playerName);
  await insertAudit(env.DB, raidId, session.username, 'bonus_grant_cancel', { playerName });

  return jsonResponse({ ok: true });
}
