import { HttpError, jsonResponse, readJson } from '../util.js';
import {
  getRaid,
  getRaidParticipantsWithPenalties,
  upsertRaidPenalty,
  enforceSoftPenaltyLimit,
  insertAudit,
  listUserCharacters,
  findPenaltyBattalionEntry
} from '../db.js';
import { requireRaidOfficer } from '../auth.js';

async function loadRaidOr404(env, id) {
  const raid = await getRaid(env.DB, id);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  return raid;
}

// Штраф зі Штрафбату переїжджає в рейд лише першим софтом гравця, тож до
// того рейд про нього не знає і клієнт малював би всі кнопки ваги
// активними. Показуємо такий штраф заздалегідь з позначкою pending —
// запис у Штрафбаті при цьому лишається недоторканим і списується, як і
// раніше, успішним софтом.
//
// Тільки для персонажів того, хто робить запит: чужі відкладені штрафи —
// це вміст Штрафбату, а він видимий лише офіцерам.
async function pendingPenaltiesForCaller(env, raid, session, rows) {
  const characters = await listUserCharacters(env.DB, session.discordId);
  const byName = new Map(rows.map((row) => [row.player_name, row]));
  const pending = [];

  for (const { characterName } of characters) {
    const existing = byName.get(characterName);
    // Реальний штраф у рейді завжди важливіший за відкладений.
    if (existing && (existing.roll_penalty > 0 || existing.soft_penalty > 0)) continue;

    const entry = await findPenaltyBattalionEntry(env.DB, characterName, raid.instance);
    if (!entry) continue;

    pending.push({
      player_name: characterName,
      roll_penalty: entry.roll_penalty,
      soft_penalty: Math.min(raid.soft_limit_total, entry.soft_penalty),
      reason: entry.reason || 'Штрафбат',
      pending: true
    });
  }

  return pending;
}

export async function handleListPenalties(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  const rows = await getRaidParticipantsWithPenalties(env.DB, raidId);
  const pending = await pendingPenaltiesForCaller(env, raid, session, rows);

  // Відкладений штраф заміщає порожній рядок учасника, інакше клієнт узяв
  // би перший збіг по імені й показав нульовий штраф.
  const pendingNames = new Set(pending.map((p) => p.player_name));
  return jsonResponse([...rows.filter((row) => !pendingNames.has(row.player_name)), ...pending]);
}

export async function handleUpsertPenalty(request, env, raidId, playerName, session) {
  const raid = await loadRaidOr404(env, raidId);
  await requireRaidOfficer(env.DB, raidId, raid, session);

  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено — штрафи більше не редагуються');

  const body = await readJson(request);
  const rollPenalty = Math.max(0, Math.floor(Number(body.rollPenalty) || 0));
  const softPenalty = Math.max(0, Math.min(raid.soft_limit_total, Math.floor(Number(body.softPenalty) || 0)));
  const reason = String(body.reason || '').trim().slice(0, 500);

  await upsertRaidPenalty(env.DB, raidId, playerName, rollPenalty, softPenalty, reason);

  // Гравець міг набрати вагу ще до штрафу — вирівнюємо вже поставлені софти
  // під новий ліміт. Кожну зміну пишемо в аудит окремо, щоб гравець бачив,
  // що саме зрізало і чому.
  const changes = await enforceSoftPenaltyLimit(env.DB, raid, playerName);
  for (const change of changes) {
    await insertAudit(env.DB, raidId, session.username, 'soft_penalty_trim', { playerName, ...change });
  }

  return jsonResponse(await getRaidParticipantsWithPenalties(env.DB, raidId));
}
