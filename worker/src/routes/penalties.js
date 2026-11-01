import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import {
  getRaid,
  getRaidParticipantsWithPenalties,
  addRaidPenaltyEntries,
  getRaidPenaltyEntry,
  deleteRaidPenaltyEntry,
  enforceSoftPenaltyLimit,
  insertAudit,
  listUserCharacters,
  findPenaltyBattalionEntries,
  enforceAllBonusPools
} from '../db.js';
import { requireRaidOfficer } from '../auth.js';
import { instanceForBoss, templatePenalty, loadTemplateForApply } from './penalty-templates.js';

async function loadRaidOr404(env, id) {
  const raid = await getRaid(env.DB, id);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  return raid;
}

// Штрафи зі Штрафбату переїжджають у рейд лише першим софтом гравця, тож до
// того рейд про них не знає і клієнт малював би всі кнопки ваги активними.
// Показуємо їх заздалегідь з позначкою pending (сумою, разом із вже
// наявними штрафами в рейді) — записи в Штрафбаті при цьому лишаються
// недоторканими і списуються, як і раніше, успішним софтом.
//
// Тільки для персонажів того, хто робить запит: чужі відкладені штрафи
// гравцю тут не потрібні.
async function pendingPenaltiesForCaller(env, raid, session, rows) {
  const characters = await listUserCharacters(env.DB, session.discordId);
  const byName = new Map(rows.map((row) => [row.player_name, row]));
  const pending = [];

  for (const { characterName } of characters) {
    const entries = await findPenaltyBattalionEntries(env.DB, characterName, raid.instance);
    if (!entries.length) continue;

    const existing = byName.get(characterName);
    const roll = entries.reduce((sum, e) => sum + e.roll_penalty, existing?.roll_penalty || 0);
    const soft = entries.reduce((sum, e) => sum + e.soft_penalty, existing?.soft_penalty || 0);
    const reasons = [existing?.reason, ...entries.map((e) => e.reason)].filter(Boolean);

    pending.push({
      player_name: characterName,
      roll_penalty: roll,
      soft_penalty: Math.min(raid.soft_limit_total, soft),
      reason: reasons.join(', ') || 'Штрафбат',
      entries: existing?.entries || [],
      pending: true
    });
  }

  return pending;
}

export async function handleListPenalties(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  const rows = await getRaidParticipantsWithPenalties(env.DB, raidId);
  const pending = await pendingPenaltiesForCaller(env, raid, session, rows);

  // Відкладений штраф заміщає рядок учасника, інакше клієнт узяв би перший
  // збіг по імені й показав штраф без відкладеної частини.
  const pendingNames = new Set(pending.map((p) => p.player_name));
  return jsonResponse([...rows.filter((row) => !pendingNames.has(row.player_name)), ...pending]);
}

// Гравець уже набрав вагу — вирівнюємо софти під новий ліміт (кожну зміну в
// аудит) і бонуси отримувачів, якщо оштрафували донора.
async function enforceLimitsAfterPenalty(env, raid, playerName, actor) {
  for (const change of await enforceSoftPenaltyLimit(env.DB, raid, playerName)) {
    await insertAudit(env.DB, raid.id, actor, 'soft_penalty_trim', { playerName, ...change });
  }
  for (const change of await enforceAllBonusPools(env.DB, raid)) {
    await insertAudit(env.DB, raid.id, actor, 'bonus_trim', change);
  }
}

// Штрафи накопичуються: кожне застосування шаблону — окремий запис
// (count разів, наприклад "2 духи леді").
export async function handleAddPenalty(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  await requireRaidOfficer(env.DB, raidId, raid, session);
  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено — штрафи більше не редагуються');

  const body = await readJson(request);
  const playerName = capitalizeName(String(body.playerName || '').trim());
  if (!playerName) throw new HttpError(400, "Потрібне ім'я гравця");

  const { template, count } = await loadTemplateForApply(env, body);
  const templateInstance = instanceForBoss(template.boss);
  if (templateInstance && templateInstance !== raid.instance) {
    throw new HttpError(400, 'Шаблон для боса іншого інстансу');
  }

  const { rollPenalty, softPenalty } = templatePenalty(template);
  await addRaidPenaltyEntries(env.DB, raidId, playerName, {
    templateId: template.id,
    boss: template.boss,
    reason: template.reason,
    rollPenalty,
    softPenalty
  }, count, session.username);
  await insertAudit(env.DB, raidId, session.username, 'penalty_add', {
    playerName, boss: template.boss, reason: template.reason, rollPenalty, softPenalty, count
  });

  await enforceLimitsAfterPenalty(env, raid, playerName, session.username);
  return jsonResponse(await getRaidParticipantsWithPenalties(env.DB, raidId), 201);
}

export async function handleDeletePenalty(request, env, raidId, entryId, session) {
  const raid = await loadRaidOr404(env, raidId);
  await requireRaidOfficer(env.DB, raidId, raid, session);
  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено — штрафи більше не редагуються');

  const entry = await getRaidPenaltyEntry(env.DB, raidId, entryId);
  if (!entry) throw new HttpError(404, 'Штраф не знайдено');

  await deleteRaidPenaltyEntry(env.DB, raidId, entryId);
  await insertAudit(env.DB, raidId, session.username, 'penalty_remove', {
    playerName: entry.player_name,
    boss: entry.boss,
    reason: entry.reason,
    rollPenalty: entry.roll_penalty,
    softPenalty: entry.soft_penalty
  });

  return jsonResponse(await getRaidParticipantsWithPenalties(env.DB, raidId));
}
