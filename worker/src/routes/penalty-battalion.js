import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import { requireGlobalOfficer } from '../auth.js';
import { listPenaltyBattalion, addPenaltyBattalionEntry, deletePenaltyBattalionEntry } from '../db.js';

const INSTANCES = new Set(['ICC', 'RS']);

export async function handleListPenaltyBattalion(request, env, session) {
  await requireGlobalOfficer(env.DB, session);
  return jsonResponse(await listPenaltyBattalion(env.DB));
}

export async function handleAddPenaltyBattalionEntry(request, env, session) {
  await requireGlobalOfficer(env.DB, session);

  const body = await readJson(request);
  const playerName = capitalizeName(String(body.playerName || '').trim());
  const instance = String(body.instance || '').trim();

  if (!playerName) throw new HttpError(400, "Потрібне ім'я гравця");
  if (!INSTANCES.has(instance)) throw new HttpError(400, 'instance має бути ICC або RS');

  const rollPenalty = Math.max(0, Math.floor(Number(body.rollPenalty) || 0));
  const softPenalty = Math.max(0, Math.floor(Number(body.softPenalty) || 0));
  const reason = String(body.reason || '').trim().slice(0, 500);

  await addPenaltyBattalionEntry(env.DB, {
    playerName,
    instance,
    rollPenalty,
    softPenalty,
    reason,
    addedBy: session.discordId
  });

  return jsonResponse(await listPenaltyBattalion(env.DB), 201);
}

export async function handleDeletePenaltyBattalionEntry(request, env, id, session) {
  await requireGlobalOfficer(env.DB, session);
  await deletePenaltyBattalionEntry(env.DB, id);
  return jsonResponse(await listPenaltyBattalion(env.DB));
}
