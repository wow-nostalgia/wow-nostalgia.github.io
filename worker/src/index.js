import { HttpError, jsonResponse, readJson } from './util.js';
import { requireSession } from './auth.js';
import {
  handleCreateRaid,
  handleListRaids,
  handleGetRaid,
  handleUpdateRaid,
  handleLock,
  handleSetStatus,
  handleListOfficers,
  handleAddOfficer,
  handleRemoveOfficer,
  handleToggleHiddenReserves,
  handleSetPotionLog,
  handleDeleteRaid
} from './routes/raids.js';
import {
  handleListReserves,
  handleCreateReserve,
  handleDeleteReserve,
  handleDeleteAllForPlayer,
  handleToggleReceived,
  handleOfficerAssign,
  handleUpdateBonusWeight
} from './routes/reserves.js';
import { handleListAudit } from './routes/audit.js';
import { handleListTransfers, handleCreateTransfer, handleDeleteTransfer } from './routes/transfers.js';
import { handleListBonusGrants, handleCreateBonusGrant, handleDeleteBonusGrant } from './routes/bonus-grants.js';
import { handleListPenalties, handleUpsertPenalty } from './routes/penalties.js';
import {
  handleDiscordCallback,
  handleGetMe,
  handleLogout,
  handleSearchUsers,
  handleListCharacters,
  handleAddCharacter,
  handleRemoveCharacter,
  handleSetPrimaryCharacter,
  handleClearPrimaryCharacter,
  handleAdminRemoveCharacter,
  handleListCharacterOwners,
  handleListPrimaryCharacters
} from './routes/auth.js';
import {
  listDefaultOfficers,
  addDefaultOfficer,
  removeDefaultOfficer,
  getUserByDiscordId
} from './db.js';

const ALLOWED_ORIGINS = ['https://wow-nostalgia.github.io', 'http://localhost:8080'];

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    Vary: 'Origin'
  };
}

function withCors(response, request) {
  const headers = corsHeaders(request);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

async function routeAuth(request, env, parts) {
  const method = request.method;
  const [sub, sub2, sub3, sub4] = parts;

  if (sub === 'discord' && sub2 === 'callback' && method === 'POST') return handleDiscordCallback(request, env);
  if (sub === 'me' && !sub2 && method === 'GET') return handleGetMe(request, env);

  if (sub === 'me' && sub2 === 'characters') {
    if (!sub3) {
      if (method === 'GET') return handleListCharacters(request, env);
      if (method === 'POST') return handleAddCharacter(request, env);
      throw new HttpError(405, 'Метод не підтримується');
    }
    if (sub4 === 'primary' && method === 'POST') {
      return handleSetPrimaryCharacter(request, env, decodeURIComponent(sub3));
    }
    if (sub4 === 'primary' && method === 'DELETE') {
      return handleClearPrimaryCharacter(request, env);
    }
    if (!sub4 && method === 'DELETE') return handleRemoveCharacter(request, env, decodeURIComponent(sub3));
    throw new HttpError(405, 'Метод не підтримується');
  }

  if (sub === 'logout' && method === 'POST') return handleLogout(request, env);
  if (sub === 'users' && method === 'GET') return handleSearchUsers(request, env);

  throw new HttpError(404, 'Невідомий шлях');
}

async function routeRaids(request, env, parts, session) {
  const method = request.method;
  const raidId = parts[0];

  if (!raidId) {
    if (method === 'POST') return handleCreateRaid(request, env, session);
    if (method === 'GET') return handleListRaids(request, env, session);
    throw new HttpError(405, 'Метод не підтримується');
  }

  const sub = parts[1];

  if (!sub) {
    if (method === 'GET') return handleGetRaid(request, env, raidId, session);
    if (method === 'PATCH') return handleUpdateRaid(request, env, raidId, session);
    throw new HttpError(405, 'Метод не підтримується');
  }

  if (sub === 'lock' && method === 'POST') return handleLock(request, env, raidId, true, session);
  if (sub === 'unlock' && method === 'POST') return handleLock(request, env, raidId, false, session);
  if (sub === 'toggle-hidden' && method === 'POST') return handleToggleHiddenReserves(request, env, raidId, session);
  if (sub === 'potion-log' && method === 'PATCH') return handleSetPotionLog(request, env, raidId, session);
  if (sub === 'complete' && method === 'POST') return handleSetStatus(request, env, raidId, 'completed', session);
  if (sub === 'reactivate' && method === 'POST') return handleSetStatus(request, env, raidId, 'active', session);
  if (sub === 'audit' && method === 'GET') return handleListAudit(request, env, raidId, session);

  if (sub === 'officers') {
    const discordId = parts[2];

    if (!discordId) {
      if (method === 'GET') return handleListOfficers(request, env, raidId, session);
      if (method === 'POST') return handleAddOfficer(request, env, raidId, session);
      throw new HttpError(405, 'Метод не підтримується');
    }

    if (method === 'DELETE') return handleRemoveOfficer(request, env, raidId, decodeURIComponent(discordId), session);
    throw new HttpError(405, 'Метод не підтримується');
  }

  if (sub === 'reserves') {
    const reserveId = parts[2];

    if (!reserveId) {
      if (method === 'GET') return handleListReserves(request, env, raidId, session);
      if (method === 'POST') return handleCreateReserve(request, env, raidId, session);
      throw new HttpError(405, 'Метод не підтримується');
    }

    if (parts[3] === 'received' && method === 'POST') {
      return handleToggleReceived(request, env, raidId, Number(reserveId), session);
    }
    if (parts[3] === 'bonus' && method === 'PATCH') {
      return handleUpdateBonusWeight(request, env, raidId, Number(reserveId), session);
    }
    if (!parts[3] && method === 'DELETE') {
      return handleDeleteReserve(request, env, raidId, Number(reserveId), session);
    }
    throw new HttpError(405, 'Метод не підтримується');
  }

  if (sub === 'players' && parts[3] === 'reserves') {
    const playerName = decodeURIComponent(parts[2] || '');
    if (method === 'DELETE') return handleDeleteAllForPlayer(request, env, raidId, playerName, session);
    throw new HttpError(405, 'Метод не підтримується');
  }

  if (sub === 'officer' && parts[2] === 'assign' && method === 'POST') {
    return handleOfficerAssign(request, env, raidId, session);
  }

  if (sub === 'penalties') {
    const playerName = parts[2] ? decodeURIComponent(parts[2]) : null;
    if (!playerName && method === 'GET') return handleListPenalties(request, env, raidId);
    if (playerName && method === 'PUT') return handleUpsertPenalty(request, env, raidId, playerName, session);
    throw new HttpError(405, 'Метод не підтримується');
  }

  if (sub === 'transfers') {
    const fromPlayer = parts[2] ? decodeURIComponent(parts[2]) : null;
    if (!fromPlayer && method === 'GET') return handleListTransfers(request, env, raidId);
    if (!fromPlayer && method === 'POST') return handleCreateTransfer(request, env, raidId, session);
    if (fromPlayer && method === 'DELETE') return handleDeleteTransfer(request, env, raidId, fromPlayer, session);
    throw new HttpError(405, 'Метод не підтримується');
  }

  if (sub === 'bonus-grants') {
    const playerName = parts[2] ? decodeURIComponent(parts[2]) : null;
    if (!playerName && method === 'GET') return handleListBonusGrants(request, env, raidId);
    if (!playerName && method === 'POST') return handleCreateBonusGrant(request, env, raidId, session);
    if (playerName && method === 'DELETE') return handleDeleteBonusGrant(request, env, raidId, playerName, session);
    throw new HttpError(405, 'Метод не підтримується');
  }

  throw new HttpError(404, 'Невідомий шлях');
}

// Один хардкодований Discord ID власника сайту (env var, не секрет) —
// без повноцінної системи ролей. Дає змогу примусово звільнити персонажа,
// якщо хтось помилково застовпив чужого (унікальність — first-come, без
// підтверджень, тож конфлікти можливі й мають мати ручний вихід).
async function routeAdmin(request, env, parts, session) {
  if (session.discordId !== env.ADMIN_DISCORD_ID) throw new HttpError(403, 'Лише адміністратор сайту');

  const method = request.method;
  const [sub, sub2] = parts;

  if (sub === 'characters' && sub2 && method === 'DELETE') {
    return handleAdminRemoveCharacter(request, env, decodeURIComponent(sub2), session);
  }

  if (sub === 'raids' && sub2 && method === 'DELETE') {
    return handleDeleteRaid(request, env, decodeURIComponent(sub2), session);
  }

  if (sub === 'default-officers') {
    if (!sub2) {
      if (method === 'GET') return jsonResponse(await listDefaultOfficers(env.DB));
      if (method === 'POST') {
        const body = await readJson(request);
        const discordId = String(body.discordId || '').trim();
        if (!discordId) throw new HttpError(400, 'Потрібен discordId');
        const user = await getUserByDiscordId(env.DB, discordId);
        if (!user) throw new HttpError(404, 'Користувача не знайдено');
        return jsonResponse(await addDefaultOfficer(env.DB, discordId), 201);
      }
    }
    if (sub2 && method === 'DELETE') {
      return jsonResponse(await removeDefaultOfficer(env.DB, decodeURIComponent(sub2)));
    }
  }

  throw new HttpError(404, 'Невідомий шлях');
}

async function route(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');

  if (parts[0] !== 'api' || parts[1] !== 'v1') {
    throw new HttpError(404, 'Невідомий шлях');
  }

  if (parts[2] === 'auth') return routeAuth(request, env, parts.slice(3));

  // Публічний (без логіну) — для тултіпів "ім'я основного персонажа/акаунту"
  // у статичній аналітиці й таблиці гравців рейду.
  if (parts[2] === 'characters' && parts[3] === 'owners' && request.method === 'GET') {
    return handleListCharacterOwners(request, env);
  }

  // Публічний (без логіну) — для бейджа "Основний" у статичній аналітиці.
  if (parts[2] === 'characters' && parts[3] === 'primary' && request.method === 'GET') {
    return handleListPrimaryCharacters(request, env);
  }

  if (parts[2] === 'raids') {
    const session = await requireSession(env.DB, request);
    return routeRaids(request, env, parts.slice(3), session);
  }

  if (parts[2] === 'admin') {
    const session = await requireSession(env.DB, request);
    return routeAdmin(request, env, parts.slice(3), session);
  }

  throw new HttpError(404, 'Невідомий шлях');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    try {
      const response = await route(request, env);
      return withCors(response, request);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (!(err instanceof HttpError)) console.error(err);
      return withCors(jsonResponse({ error: err.message || 'Внутрішня помилка сервера' }, status), request);
    }
  }
};
