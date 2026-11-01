import { HttpError, jsonResponse, readJson } from '../util.js';
import { requireGlobalOfficer } from '../auth.js';
import {
  listPenaltyTemplates,
  getPenaltyTemplate,
  createPenaltyTemplate,
  updatePenaltyTemplate,
  deletePenaltyTemplate
} from '../db.js';

// Ті самі списки, що ICC_BOSSES/RS_BOSSES у scripts/raid-manager-shared.js.
const ICC_BOSSES = [
  'Lord Marrowgar', 'Lady Deathwhisper', 'Gunship Battle', 'Deathbringer Saurfang',
  'Festergut', 'Rotface', 'Professor Putricide', 'Blood Prince Council',
  "Blood-Queen Lana'thel", 'Valithria Dreamwalker', 'Sindragosa', 'The Lich King'
];
const RS_BOSSES = ['Halion'];

// Інстанс боса шаблону; null — загальний шаблон (діє в будь-якому інстансі).
export function instanceForBoss(boss) {
  if (!boss) return null;
  if (ICC_BOSSES.includes(boss)) return 'ICC';
  if (RS_BOSSES.includes(boss)) return 'RS';
  return null;
}

// Значення штрафу, яке шаблон дає гравцю: { rollPenalty, softPenalty }.
export function templatePenalty(template) {
  return template.penalty_type === 'roll'
    ? { rollPenalty: template.value, softPenalty: 0 }
    : { rollPenalty: 0, softPenalty: template.value };
}

function parseTemplateBody(body) {
  const boss = body.boss ? String(body.boss).trim() : null;
  if (boss && !instanceForBoss(boss)) throw new HttpError(400, 'Невідомий бос');

  const reason = String(body.reason || '').trim().slice(0, 200);
  if (!reason) throw new HttpError(400, 'Потрібна причина');

  const penaltyType = String(body.penaltyType || '');
  if (penaltyType !== 'roll' && penaltyType !== 'soft') throw new HttpError(400, 'Тип штрафу має бути roll або soft');

  const value = Number(body.value);
  if (penaltyType === 'roll' && !(Number.isInteger(value) && value >= 5 && value <= 100 && value % 5 === 0)) {
    throw new HttpError(400, 'Мінус до ролу — від 5 до 100, кратний 5');
  }
  if (penaltyType === 'soft' && !(Number.isInteger(value) && value >= 1 && value <= 3)) {
    throw new HttpError(400, 'Мінус до софту — від 1 до 3');
  }

  return { boss, reason, penaltyType, value };
}

// Читати шаблони може будь-який залогінений: офіцер рейду не завжди офіцер
// гільдії, а гравці бачать шаблони на сторінці Штрафбату.
export async function handleListPenaltyTemplates(request, env) {
  return jsonResponse(await listPenaltyTemplates(env.DB));
}

export async function handleCreatePenaltyTemplate(request, env, session) {
  await requireGlobalOfficer(env.DB, session);
  const fields = parseTemplateBody(await readJson(request));
  await createPenaltyTemplate(env.DB, { ...fields, createdBy: session.discordId });
  return jsonResponse(await listPenaltyTemplates(env.DB), 201);
}

export async function handleUpdatePenaltyTemplate(request, env, id, session) {
  await requireGlobalOfficer(env.DB, session);
  if (!(await getPenaltyTemplate(env.DB, id))) throw new HttpError(404, 'Шаблон не знайдено');
  const fields = parseTemplateBody(await readJson(request));
  await updatePenaltyTemplate(env.DB, id, fields);
  return jsonResponse(await listPenaltyTemplates(env.DB));
}

// Застосовані штрафи зберігають знімок причини/значення, тож видалення
// шаблону їх не чіпає.
export async function handleDeletePenaltyTemplate(request, env, id, session) {
  await requireGlobalOfficer(env.DB, session);
  await deletePenaltyTemplate(env.DB, id);
  return jsonResponse(await listPenaltyTemplates(env.DB));
}

// Шаблон для застосування (у рейді чи Штрафбаті) + перевірка кількості.
export async function loadTemplateForApply(env, body) {
  const templateId = Number(body.templateId);
  if (!Number.isInteger(templateId)) throw new HttpError(400, 'Потрібен шаблон штрафу');
  const template = await getPenaltyTemplate(env.DB, templateId);
  if (!template) throw new HttpError(404, 'Шаблон не знайдено');

  const count = body.count === undefined ? 1 : Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new HttpError(400, 'Кількість — від 1 до 10');

  return { template, count };
}
