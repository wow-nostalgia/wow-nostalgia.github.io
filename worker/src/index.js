import { HttpError, jsonResponse } from './util.js';
import { handleCreateRaid, handleListRaids, handleGetRaid, handleUpdateRaid, handleLock, handleSetStatus } from './routes/raids.js';
import {
  handleListReserves,
  handleCreateReserve,
  handleDeleteReserve,
  handleDeleteAllForPlayer,
  handleToggleReceived,
  handleOfficerAssign
} from './routes/reserves.js';
import { handleListAudit } from './routes/audit.js';

const ALLOWED_ORIGINS = ['https://wow-nostalgia.github.io', 'http://localhost:8080'];

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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

async function route(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');

  // очікуємо /api/v1/raids/...
  if (parts[0] !== 'api' || parts[1] !== 'v1' || parts[2] !== 'raids') {
    throw new HttpError(404, 'Невідомий шлях');
  }

  const method = request.method;
  const raidId = parts[3];

  if (!raidId) {
    if (method === 'POST') return handleCreateRaid(request, env);
    if (method === 'GET') return handleListRaids(request, env);
    throw new HttpError(405, 'Метод не підтримується');
  }

  const sub = parts[4];

  if (!sub) {
    if (method === 'GET') return handleGetRaid(request, env, raidId);
    if (method === 'PATCH') return handleUpdateRaid(request, env, raidId);
    throw new HttpError(405, 'Метод не підтримується');
  }

  if (sub === 'lock' && method === 'POST') return handleLock(request, env, raidId, true);
  if (sub === 'unlock' && method === 'POST') return handleLock(request, env, raidId, false);
  if (sub === 'complete' && method === 'POST') return handleSetStatus(request, env, raidId, 'completed');
  if (sub === 'reactivate' && method === 'POST') return handleSetStatus(request, env, raidId, 'active');
  if (sub === 'audit' && method === 'GET') return handleListAudit(request, env, raidId);

  if (sub === 'reserves') {
    const reserveId = parts[5];

    if (!reserveId) {
      if (method === 'GET') return handleListReserves(request, env, raidId);
      if (method === 'POST') return handleCreateReserve(request, env, raidId);
      throw new HttpError(405, 'Метод не підтримується');
    }

    if (parts[6] === 'received' && method === 'POST') {
      return handleToggleReceived(request, env, raidId, Number(reserveId));
    }
    if (!parts[6] && method === 'DELETE') {
      return handleDeleteReserve(request, env, raidId, Number(reserveId));
    }
    throw new HttpError(405, 'Метод не підтримується');
  }

  if (sub === 'players' && parts[6] === 'reserves') {
    const playerName = decodeURIComponent(parts[5] || '');
    if (method === 'DELETE') return handleDeleteAllForPlayer(request, env, raidId, playerName);
    throw new HttpError(405, 'Метод не підтримується');
  }

  if (sub === 'officer' && parts[5] === 'assign' && method === 'POST') {
    return handleOfficerAssign(request, env, raidId);
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
