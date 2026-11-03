import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import {
  getRaid,
  listWeightTransfers,
  getWeightTransferByFrom,
  getWeightTransferByTo,
  createWeightTransfer,
  deleteWeightTransfer,
  enforceBonusPool,
  deleteAllReservesForPlayer,
  addRaidParticipant,
  insertAudit,
  createClaim,
  getClaimOwner,
  findCharacterOwner,
  applyPenaltyBattalionIfMatched
} from '../db.js';
import { isRaidOfficer, requireOwnCharacter } from '../auth.js';

async function loadRaidOr404(env, raidId) {
  const raid = await getRaid(env.DB, raidId);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  return raid;
}

// Акаунти, яким належить персонаж: власник у профілі + хто застовпив ім'я
// в цьому рейді (персонажа могли вже прибрати з профілю).
async function characterOwnerIds(env, raidId, playerName) {
  const [profileOwner, claim] = await Promise.all([
    findCharacterOwner(env.DB, playerName),
    getClaimOwner(env.DB, raidId, playerName)
  ]);
  return new Set([profileOwner, claim?.discord_id].filter(Boolean));
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
    throw new HttpError(403, 'Передача софтів вимкнена для цього рейду');
  }

  const body = await readJson(request);
  const fromPlayer = capitalizeName(String(body.fromPlayer || '').trim());
  const toPlayer = capitalizeName(String(body.toPlayer || '').trim());

  if (!fromPlayer) throw new HttpError(400, "Потрібне ім'я гравця-донора");
  if (!toPlayer) throw new HttpError(400, "Потрібне ім'я гравця-одержувача");
  if (fromPlayer === toPlayer) throw new HttpError(400, 'Не можна передати софти самому собі');

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

  // Передача власному персонажу обійшла б правило "один акаунт софтить у
  // рейді одним персонажем": донор віддає ліміт альту, а той софтить ще й
  // свій. Забороняємо й офіцерам — це та сама подвійна вага для акаунта.
  const [fromOwners, toOwners] = await Promise.all([
    characterOwnerIds(env, raidId, fromPlayer),
    characterOwnerIds(env, raidId, toPlayer)
  ]);
  if (!officerMode) fromOwners.add(session.discordId);
  if ([...toOwners].some((id) => fromOwners.has(id))) {
    throw new HttpError(409, officerMode
      ? `${fromPlayer} і ${toPlayer} — персонажі одного акаунта, передавати софти між ними не можна`
      : 'Не можна передати софти власному персонажу');
  }

  const existingFrom = await getWeightTransferByFrom(env.DB, raidId, fromPlayer);
  if (existingFrom) {
    throw new HttpError(409, `${fromPlayer} вже передав софти гравцю ${existingFrom.to_player}`);
  }

  const existingTo = await getWeightTransferByTo(env.DB, raidId, toPlayer);
  if (existingTo) {
    throw new HttpError(409, `${toPlayer} вже отримує софти від ${existingTo.from_player}`);
  }

  // Відкладений штраф зі Штрафбату — до передачі: донор, що ще не софтив,
  // інакше передав би повний ліміт повз штраф (бонус рахується від нього).
  await applyPenaltyBattalionIfMatched(env.DB, raid, fromPlayer);

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
  // Бонусна вага з переданого пулу більше не має підстави - інакше вона
  // лишилась би "мертвим" плюсом до рол-ваги. Але зрізаємо лише надлишок
  // понад новий пул: бонус від офіцера в отримувача має лишитись.
  const trim = await enforceBonusPool(env.DB, raid, transfer.to_player);
  if (trim) await insertAudit(env.DB, raidId, session.username, 'bonus_trim', { playerName: transfer.to_player, ...trim });

  return jsonResponse({ ok: true });
}
