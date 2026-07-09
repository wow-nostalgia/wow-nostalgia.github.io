import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import {
  getRaid,
  listWeightTransfers,
  getWeightTransferByFrom,
  getWeightTransferByTo,
  createWeightTransfer,
  deleteWeightTransfer,
  deleteAllReservesForPlayer,
  addRaidParticipant,
  insertAudit,
  createClaim,
  getClaimOwner
} from '../db.js';
import { isRaidOfficer, requireOwnCharacter } from '../auth.js';

async function loadRaidOr404(env, raidId) {
  const raid = await getRaid(env.DB, raidId);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  return raid;
}

export async function handleListTransfers(request, env, raidId) {
  await loadRaidOr404(env, raidId);
  return jsonResponse(await listWeightTransfers(env.DB, raidId));
}

export async function handleCreateTransfer(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено');

  const transferLimit = raid.transfer_weight_limit;
  if (transferLimit !== null && transferLimit === 0) {
    throw new HttpError(403, 'Передача ваги вимкнена для цього рейду');
  }

  const body = await readJson(request);
  const fromPlayer = capitalizeName(String(body.fromPlayer || '').trim());
  const toPlayer = capitalizeName(String(body.toPlayer || '').trim());

  if (!fromPlayer) throw new HttpError(400, "Потрібне ім'я гравця-донора");
  if (!toPlayer) throw new HttpError(400, "Потрібне ім'я гравця-одержувача");
  if (fromPlayer === toPlayer) throw new HttpError(400, 'Не можна передати вагу самому собі');

  // Перевіряємо право на fromPlayer: або офіцер, або власник claim
  const officerMode = await isRaidOfficer(env.DB, raidId, raid, session.discordId);
  if (!officerMode) {
    const claim = await getClaimOwner(env.DB, raidId, fromPlayer);
    if (!claim) {
      // Перший раз — дозволяємо і карбуємо claim, але лише під іменем
      // персонажа з власного профілю (той самий принцип, що для софту).
      await requireOwnCharacter(env.DB, session.discordId, fromPlayer);
      await createClaim(env.DB, raidId, fromPlayer, session.discordId);
    } else if (claim.discord_id !== session.discordId) {
      throw new HttpError(403, `Ім'я "${fromPlayer}" застовплене іншим гравцем`);
    }
  }

  const existingFrom = await getWeightTransferByFrom(env.DB, raidId, fromPlayer);
  if (existingFrom) {
    throw new HttpError(409, `${fromPlayer} вже передав вагу гравцю ${existingFrom.to_player}`);
  }

  const existingTo = await getWeightTransferByTo(env.DB, raidId, toPlayer);
  if (existingTo) {
    throw new HttpError(409, `${toPlayer} вже отримує вагу від ${existingTo.from_player}`);
  }

  // Видаляємо всі softs від fromPlayer і додаємо його до учасників рейду
  await deleteAllReservesForPlayer(env.DB, raidId, fromPlayer);
  await addRaidParticipant(env.DB, raidId, fromPlayer);
  await createWeightTransfer(env.DB, raidId, fromPlayer, toPlayer);
  await insertAudit(env.DB, raidId, fromPlayer, 'weight_transfer', { fromPlayer, toPlayer });

  return jsonResponse({ fromPlayer, toPlayer }, 201);
}

export async function handleDeleteTransfer(request, env, raidId, fromPlayer, session) {
  const raid = await loadRaidOr404(env, raidId);
  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено');

  const transfer = await getWeightTransferByFrom(env.DB, raidId, fromPlayer);
  if (!transfer) throw new HttpError(404, 'Передачу не знайдено');

  const officerMode = await isRaidOfficer(env.DB, raidId, raid, session.discordId);
  if (!officerMode) {
    const claim = await getClaimOwner(env.DB, raidId, fromPlayer);
    if (!claim || claim.discord_id !== session.discordId) {
      throw new HttpError(403, 'Немає прав для скасування цієї передачі');
    }
  }

  await deleteWeightTransfer(env.DB, raidId, fromPlayer);
  await insertAudit(env.DB, raidId, session.username, 'weight_transfer_cancel', {
    fromPlayer,
    toPlayer: transfer.to_player
  });

  return jsonResponse({ ok: true });
}
