import { HttpError, jsonResponse, readJson } from '../util.js';
import { getRaid, getRaidParticipantsWithPenalties, upsertRaidPenalty } from '../db.js';
import { requireRaidOfficer } from '../auth.js';

async function loadRaidOr404(env, id) {
  const raid = await getRaid(env.DB, id);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  return raid;
}

export async function handleListPenalties(request, env, raidId) {
  await loadRaidOr404(env, raidId);
  return jsonResponse(await getRaidParticipantsWithPenalties(env.DB, raidId));
}

export async function handleUpsertPenalty(request, env, raidId, playerName, session) {
  const raid = await loadRaidOr404(env, raidId);
  await requireRaidOfficer(env.DB, raidId, raid, session);

  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено — штрафи більше не редагуються');

  const body = await readJson(request);
  const rollPenalty = Math.max(0, Math.floor(Number(body.rollPenalty) || 0));
  const softPenalty = Math.max(0, Math.min(raid.soft_limit_total, Math.floor(Number(body.softPenalty) || 0)));

  await upsertRaidPenalty(env.DB, raidId, playerName, rollPenalty, softPenalty);
  return jsonResponse(await getRaidParticipantsWithPenalties(env.DB, raidId));
}
