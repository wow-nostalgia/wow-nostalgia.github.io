import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import { requireGlobalOfficer } from '../auth.js';
import { listPenaltyBattalion, addPenaltyBattalionEntries, deletePenaltyBattalionEntry } from '../db.js';
import { instanceForBoss, templatePenalty, loadTemplateForApply } from './penalty-templates.js';

const INSTANCES = new Set(['ICC', 'RS']);

// Переглядати Штрафбат може будь-який залогінений гравець (лише читання),
// змінювати — офіцери гільдії.
export async function handleListPenaltyBattalion(request, env) {
  return jsonResponse(await listPenaltyBattalion(env.DB));
}

// Відкладений штраф — лише з шаблону. Інстанс задає бос шаблону; для
// загального шаблону його обирає офіцер.
export async function handleAddPenaltyBattalionEntry(request, env, session) {
  await requireGlobalOfficer(env.DB, session);

  const body = await readJson(request);
  const playerName = capitalizeName(String(body.playerName || '').trim());
  if (!playerName) throw new HttpError(400, "Потрібне ім'я гравця");

  const { template, count } = await loadTemplateForApply(env, body);
  const instance = instanceForBoss(template.boss) || String(body.instance || '').trim();
  if (!INSTANCES.has(instance)) throw new HttpError(400, 'instance має бути ICC або RS');

  const { rollPenalty, softPenalty } = templatePenalty(template);
  await addPenaltyBattalionEntries(env.DB, {
    playerName,
    instance,
    templateId: template.id,
    boss: template.boss,
    rollPenalty,
    softPenalty,
    reason: template.reason,
    addedBy: session.discordId
  }, count);

  return jsonResponse(await listPenaltyBattalion(env.DB), 201);
}

export async function handleDeletePenaltyBattalionEntry(request, env, id, session) {
  await requireGlobalOfficer(env.DB, session);
  await deletePenaltyBattalionEntry(env.DB, id);
  return jsonResponse(await listPenaltyBattalion(env.DB));
}
