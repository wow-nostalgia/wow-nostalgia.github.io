// Попередній запис на рейд (вкладка "Попередній запис" + календар).
// Правила (узгоджено, за зразком Raid-Helper):
// - один запис на гравця (Discord-акаунт) у рейді, персонаж - лише зі свого
//   профілю; клас + спек + статус (signed/late/tentative/bench/absent);
// - номер запису присвоюється при першому записі й не змінюється;
// - гравець записується/змінює/скасовує до часу початку рейду (deadline 0);
//   після - лише лідер/офіцер рейду (статус, видалення);
// - ліміт 25 лише показується (фронт позначає "понад ліміт").
import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import {
  listRaidSignups,
  upsertOwnSignup,
  deleteOwnSignup,
  getRaidSignup,
  setSignupStatus,
  deleteSignupById,
  insertAudit
} from '../db.js';
import { requireOwnCharacter, requireRaidOfficer } from '../auth.js';
import { loadRaidOr404 } from './raids.js';
import { isValidClassSpec, SIGNUP_STATUSES } from '../signup-specs.js';

function requireSignupsOpen(raid) {
  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено');
  const start = raid.starts_at ? Date.parse(raid.starts_at) : null;
  if (start !== null && Date.now() >= start) {
    throw new HttpError(423, 'Запис закрито: рейд уже почався. Зміни може внести лідер або офіцер.');
  }
}

function parseStatus(value) {
  if (!SIGNUP_STATUSES.includes(value)) throw new HttpError(400, 'Невідомий статус запису');
  return value;
}

export async function handleListSignups(request, env, raidId) {
  await loadRaidOr404(env, raidId);
  return jsonResponse(await listRaidSignups(env.DB, raidId));
}

// PUT /raids/:id/signups/me { characterName, class, spec, status }
export async function handleUpsertOwnSignup(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  requireSignupsOpen(raid);

  const body = await readJson(request);
  const characterName = capitalizeName(String(body.characterName || '').trim());
  const cls = String(body.class || '');
  const spec = String(body.spec || '');
  if (!characterName) throw new HttpError(400, 'Обери персонажа');
  if (!isValidClassSpec(cls, spec)) throw new HttpError(400, 'Невідомий клас або спек');
  const status = parseStatus(body.status);
  await requireOwnCharacter(env.DB, session.discordId, characterName);

  await upsertOwnSignup(env.DB, raidId, session.discordId, { characterName, cls, spec, status });
  return jsonResponse(await listRaidSignups(env.DB, raidId));
}

export async function handleDeleteOwnSignup(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  requireSignupsOpen(raid);
  await deleteOwnSignup(env.DB, raidId, session.discordId);
  return jsonResponse(await listRaidSignups(env.DB, raidId));
}

// PATCH /raids/:id/signups/:signupId { status } - лідер/офіцер, будь-коли.
export async function handleOfficerSetSignupStatus(request, env, raidId, signupId, session) {
  const raid = await loadRaidOr404(env, raidId);
  await requireRaidOfficer(env.DB, raidId, raid, session);
  const body = await readJson(request);
  const status = parseStatus(body.status);
  const signup = await getRaidSignup(env.DB, raidId, signupId);
  if (!signup) throw new HttpError(404, 'Запис не знайдено');
  await setSignupStatus(env.DB, raidId, signupId, status);
  await insertAudit(env.DB, raidId, session.username, 'signup_status', {
    characterName: signup.character_name, from: signup.status, to: status
  });
  return jsonResponse(await listRaidSignups(env.DB, raidId));
}

export async function handleOfficerDeleteSignup(request, env, raidId, signupId, session) {
  const raid = await loadRaidOr404(env, raidId);
  await requireRaidOfficer(env.DB, raidId, raid, session);
  const signup = await getRaidSignup(env.DB, raidId, signupId);
  if (!signup) throw new HttpError(404, 'Запис не знайдено');
  await deleteSignupById(env.DB, raidId, signupId);
  await insertAudit(env.DB, raidId, session.username, 'signup_remove', { characterName: signup.character_name });
  return jsonResponse(await listRaidSignups(env.DB, raidId));
}
