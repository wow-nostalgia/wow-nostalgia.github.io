import { HttpError, jsonResponse, readJson, readJsonSafe, generateToken, extractOfficerName } from '../util.js';
import {
  getRaid,
  listReserves,
  getReserveById,
  createReserve,
  deleteReserveById,
  deleteAllReservesForPlayer,
  setReserveReceived,
  sumPlayerWeight,
  getItemReservers,
  createClaimToken,
  insertAudit
} from '../db.js';
import { isOfficer, checkPlayerAccess } from '../auth.js';

async function loadRaidOr404(env, raidId) {
  const raid = await getRaid(env.DB, raidId);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  return raid;
}

export async function handleListReserves(request, env, raidId) {
  await loadRaidOr404(env, raidId);
  const reserves = await listReserves(env.DB, raidId);
  return jsonResponse(reserves);
}

export async function handleCreateReserve(request, env, raidId) {
  const raid = await loadRaidOr404(env, raidId);
  const body = await readJson(request);

  const playerName = String(body.playerName || '').trim();
  const itemId = Number(body.itemId);
  const boss = String(body.boss || '').trim();
  const weight = Number(body.weight);

  if (!playerName) throw new HttpError(400, "Потрібне ім'я гравця");
  if (!boss) throw new HttpError(400, 'Потрібен бос');
  if (!Number.isInteger(itemId)) throw new HttpError(400, 'Невалідний itemId');
  if (![1, 2, 3].includes(weight)) throw new HttpError(400, 'weight має бути 1, 2 або 3');

  const access = await checkPlayerAccess(env.DB, request, raid, playerName, { allowMint: true });

  if (raid.is_locked && !access.officer) {
    throw new HttpError(423, 'Рейд заблоковано для редагування');
  }

  const { totalWeight, itemCount } = await sumPlayerWeight(env.DB, raidId, playerName);

  if (itemCount + 1 > raid.soft_limit_items) {
    throw new HttpError(409, `Перевищено ліміт предметів (${raid.soft_limit_items})`);
  }
  if (totalWeight + weight > raid.soft_limit_total) {
    throw new HttpError(409, `Перевищено ліміт ваги (${raid.soft_limit_total})`);
  }

  if (!raid.allow_duplicate_soft) {
    const reservers = await getItemReservers(env.DB, raidId, itemId);
    if (reservers.some((name) => name !== playerName)) {
      throw new HttpError(409, 'Цей предмет уже застовплений іншим гравцем');
    }
  }

  let claimToken;
  if (access.shouldMint) {
    claimToken = generateToken();
    await createClaimToken(env.DB, raidId, playerName, claimToken);
  }

  let reserve;
  try {
    reserve = await createReserve(env.DB, {
      raidId,
      playerName,
      itemId,
      boss,
      weight,
      assignedByOfficer: access.officer
    });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      throw new HttpError(409, 'Ви вже софтнули цей предмет');
    }
    throw err;
  }

  await insertAudit(env.DB, raidId, playerName, 'soft_add', { itemId, boss, weight });

  return jsonResponse(claimToken ? { ...reserve, claimToken } : reserve, 201);
}

export async function handleDeleteReserve(request, env, raidId, reserveId) {
  const raid = await loadRaidOr404(env, raidId);
  const reserve = await getReserveById(env.DB, raidId, reserveId);
  if (!reserve) throw new HttpError(404, 'Софт не знайдено');

  const access = await checkPlayerAccess(env.DB, request, raid, reserve.player_name);
  const body = await readJsonSafe(request);

  if (raid.is_locked && !access.officer) {
    throw new HttpError(423, 'Рейд заблоковано для редагування');
  }

  await deleteReserveById(env.DB, raidId, reserveId);
  await insertAudit(env.DB, raidId, access.officer ? extractOfficerName(body) : reserve.player_name, 'soft_remove', {
    itemId: reserve.item_id,
    boss: reserve.boss
  });

  return jsonResponse({ ok: true });
}

export async function handleDeleteAllForPlayer(request, env, raidId, playerName) {
  const raid = await loadRaidOr404(env, raidId);
  const access = await checkPlayerAccess(env.DB, request, raid, playerName);
  const body = await readJsonSafe(request);

  if (raid.is_locked && !access.officer) {
    throw new HttpError(423, 'Рейд заблоковано для редагування');
  }

  await deleteAllReservesForPlayer(env.DB, raidId, playerName);
  await insertAudit(env.DB, raidId, access.officer ? extractOfficerName(body) : playerName, 'soft_remove_all', { playerName });

  return jsonResponse({ ok: true });
}

export async function handleToggleReceived(request, env, raidId, reserveId) {
  const raid = await loadRaidOr404(env, raidId);
  const reserve = await getReserveById(env.DB, raidId, reserveId);
  if (!reserve) throw new HttpError(404, 'Софт не знайдено');

  await checkPlayerAccess(env.DB, request, raid, reserve.player_name);

  const updated = await setReserveReceived(env.DB, raidId, reserveId, !reserve.is_received);
  await insertAudit(env.DB, raidId, reserve.player_name, 'item_received', {
    itemId: reserve.item_id,
    received: Boolean(updated.is_received)
  });

  return jsonResponse(updated);
}

export async function handleOfficerAssign(request, env, raidId) {
  const raid = await loadRaidOr404(env, raidId);

  if (!isOfficer(request, raid)) {
    throw new HttpError(403, 'Потрібен officer token');
  }

  const body = await readJson(request);
  const playerName = String(body.playerName || '').trim();
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
      assignedByOfficer: true
    });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      throw new HttpError(409, 'Гравець уже має софт на цей предмет');
    }
    throw err;
  }

  await insertAudit(env.DB, raidId, extractOfficerName(body), 'officer_assign', { playerName, itemId, boss, weight });

  return jsonResponse(reserve, 201);
}
