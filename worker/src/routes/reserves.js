import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import {
  getRaid,
  listReserves,
  getReserveById,
  createReserve,
  deleteReserveById,
  deleteAllReservesForPlayer,
  setReserveReceived,
  sumPlayerWeight,
  createClaim,
  insertAudit,
  getClaimedPlayerNames
} from '../db.js';
import { checkPlayerAccess, requireRaidOfficer, isRaidOfficer } from '../auth.js';

async function loadRaidOr404(env, raidId) {
  const raid = await getRaid(env.DB, raidId);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  return raid;
}

export async function handleListReserves(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  const reserves = await listReserves(env.DB, raidId);

  if (!raid.hidden_reserves) return jsonResponse(reserves);

  if (await isRaidOfficer(env.DB, raidId, raid, session.discordId)) return jsonResponse(reserves);

  // Приховуємо імена чужих гравців: своє ім'я залишається, чужі → player_name: null
  const ownNames = await getClaimedPlayerNames(env.DB, raidId, session.discordId);
  const filtered = reserves.map((r) => (ownNames.has(r.player_name) ? r : { ...r, player_name: null }));
  return jsonResponse(filtered);
}

export async function handleCreateReserve(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  const body = await readJson(request);

  const playerName = capitalizeName(String(body.playerName || '').trim());
  const itemId = Number(body.itemId);
  const boss = String(body.boss || '').trim();
  const weight = Number(body.weight);

  if (!playerName) throw new HttpError(400, "Потрібне ім'я гравця");
  if (!boss) throw new HttpError(400, 'Потрібен бос');
  if (!Number.isInteger(itemId)) throw new HttpError(400, 'Невалідний itemId');
  if (![1, 2, 3].includes(weight)) throw new HttpError(400, 'weight має бути 1, 2 або 3');

  const access = await checkPlayerAccess(env.DB, raidId, raid, session, playerName, { allowMint: true });

  if (raid.is_locked && !access.officer) {
    throw new HttpError(423, 'Рейд заблоковано для редагування');
  }

  const { totalWeight } = await sumPlayerWeight(env.DB, raidId, playerName);

  if (totalWeight + weight > raid.soft_limit_total) {
    throw new HttpError(409, `Перевищено ліміт ваги (${raid.soft_limit_total})`);
  }

  if (access.shouldMint) {
    await createClaim(env.DB, raidId, playerName, session.discordId);
  }

  let reserve;
  try {
    reserve = await createReserve(env.DB, {
      raidId,
      playerName,
      itemId,
      boss,
      weight,
      assignedByOfficer: access.officer,
      discordId: session.discordId
    });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      throw new HttpError(409, 'Ви вже софтнули цей предмет');
    }
    throw err;
  }

  await insertAudit(env.DB, raidId, access.officer ? session.username : playerName, 'soft_add', { itemId, boss, weight });

  return jsonResponse(reserve, 201);
}

export async function handleDeleteReserve(request, env, raidId, reserveId, session) {
  const raid = await loadRaidOr404(env, raidId);
  const reserve = await getReserveById(env.DB, raidId, reserveId);
  if (!reserve) throw new HttpError(404, 'Софт не знайдено');

  const access = await checkPlayerAccess(env.DB, raidId, raid, session, reserve.player_name);

  if (raid.is_locked && !access.officer) {
    throw new HttpError(423, 'Рейд заблоковано для редагування');
  }

  await deleteReserveById(env.DB, raidId, reserveId);
  await insertAudit(env.DB, raidId, access.officer ? session.username : reserve.player_name, 'soft_remove', {
    itemId: reserve.item_id,
    boss: reserve.boss
  });

  return jsonResponse({ ok: true });
}

export async function handleDeleteAllForPlayer(request, env, raidId, playerName, session) {
  const raid = await loadRaidOr404(env, raidId);
  const access = await checkPlayerAccess(env.DB, raidId, raid, session, playerName);

  if (raid.is_locked && !access.officer) {
    throw new HttpError(423, 'Рейд заблоковано для редагування');
  }

  await deleteAllReservesForPlayer(env.DB, raidId, playerName);
  await insertAudit(env.DB, raidId, access.officer ? session.username : playerName, 'soft_remove_all', { playerName });

  return jsonResponse({ ok: true });
}

export async function handleToggleReceived(request, env, raidId, reserveId, session) {
  const raid = await loadRaidOr404(env, raidId);
  const reserve = await getReserveById(env.DB, raidId, reserveId);
  if (!reserve) throw new HttpError(404, 'Софт не знайдено');

  await checkPlayerAccess(env.DB, raidId, raid, session, reserve.player_name);

  const updated = await setReserveReceived(env.DB, raidId, reserveId, !reserve.is_received);
  await insertAudit(env.DB, raidId, reserve.player_name, 'item_received', {
    itemId: reserve.item_id,
    received: Boolean(updated.is_received)
  });

  return jsonResponse(updated);
}

export async function handleOfficerAssign(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  await requireRaidOfficer(env.DB, raidId, raid, session);

  const body = await readJson(request);
  const playerName = capitalizeName(String(body.playerName || '').trim());
  const itemId = Number(body.itemId);
  const boss = String(body.boss || '').trim();
  const weight = Number(body.weight);

  if (!playerName) throw new HttpError(400, "Потрібне ім'я гравця");
  if (!boss) throw new HttpError(400, 'Потрібен бос');
  if (!Number.isInteger(itemId)) throw new HttpError(400, 'Невалідний itemId');
  if (![1, 2, 3].includes(weight)) throw new HttpError(400, 'weight має бути 1, 2 або 3');

  let reserve;
  try {
    reserve = await createReserve(env.DB, {
      raidId,
      playerName,
      itemId,
      boss,
      weight,
      assignedByOfficer: true,
      discordId: null
    });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      throw new HttpError(409, 'Гравець уже має софт на цей предмет');
    }
    throw err;
  }

  await insertAudit(env.DB, raidId, session.username, 'officer_assign', { playerName, itemId, boss, weight });

  return jsonResponse(reserve, 201);
}
