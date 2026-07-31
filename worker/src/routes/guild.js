import { HttpError, jsonResponse, readJson } from '../util.js';
import { requireSession } from '../auth.js';
import {
  setCharacterGuild,
  listCharacterGuildInfo,
  listPendingGuildRequests,
  approveCharacterGuild,
  rejectCharacterGuild,
  isDefaultOfficer
} from '../db.js';

const GUILD_NAME_MAX_LENGTH = 40;

export async function handleSetCharacterGuild(request, env, characterName) {
  const session = await requireSession(env.DB, request);
  const body = await readJson(request);
  const guild = String(body.guild ?? '').trim();
  if (guild.length > GUILD_NAME_MAX_LENGTH) throw new HttpError(400, 'Задовга назва гільдії');

  return jsonResponse(await setCharacterGuild(env.DB, session.discordId, characterName, guild));
}

// Публічно (без логіну) — для build-guild-rosters.js і для наповнення
// дропдауна "Гільдія" в профілі.
export async function handleListCharacterGuildInfo(request, env) {
  const rows = await listCharacterGuildInfo(env.DB);
  const map = {};
  for (const row of rows) map[row.character_name] = { guild: row.guild, updatedAt: row.guild_updated_at };
  return jsonResponse(map);
}

async function requireOfficer(env, request) {
  const session = await requireSession(env.DB, request);
  if (!(await isDefaultOfficer(env.DB, session.discordId))) throw new HttpError(403, 'Лише офіцер гільдії');
  return session;
}

export async function handleListGuildRequests(request, env) {
  await requireOfficer(env, request);
  return jsonResponse(await listPendingGuildRequests(env.DB));
}

export async function handleApproveGuildRequest(request, env, characterName) {
  await requireOfficer(env, request);
  await approveCharacterGuild(env.DB, characterName);
  return jsonResponse(await listPendingGuildRequests(env.DB));
}

export async function handleRejectGuildRequest(request, env, characterName) {
  await requireOfficer(env, request);
  await rejectCharacterGuild(env.DB, characterName);
  return jsonResponse(await listPendingGuildRequests(env.DB));
}
