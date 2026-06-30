import { HttpError, jsonResponse, readJson, generateToken, bearerToken, capitalizeName } from '../util.js';
import {
  upsertUser,
  createSession,
  deleteSession,
  getUserByDiscordId,
  searchUsers,
  listUserCharacters,
  addUserCharacter,
  removeUserCharacter,
  setPrimaryCharacter,
  findCharacterOwner,
  removeCharacterByAnyOwner,
  listCharacterOwnerNames
} from '../db.js';
import { requireSession } from '../auth.js';

const SESSION_TTL_DAYS = 30;

// Discord вимагає точного збігу redirect_uri між /authorize і обміном code.
// Клієнт рахує його від window.location.origin (прод і localhost — різні
// origin), тож звіряємо з тим самим allowlist, що зареєстрований у Discord-
// застосунку, замість одного фіксованого значення з env.
const ALLOWED_REDIRECT_URIS = [
  'https://wow-nostalgia.github.io/account/callback/',
  'http://localhost:8080/account/callback/'
];

function discordAvatarUrl(discordId, avatarHash) {
  return avatarHash ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png` : null;
}

function publicUser(user) {
  if (!user) return null;
  return {
    discordId: user.discord_id,
    username: user.username,
    avatar: user.avatar
  };
}

export async function handleDiscordCallback(request, env) {
  const body = await readJson(request);
  const code = String(body.code || '').trim();
  if (!code) throw new HttpError(400, 'Потрібен code');

  const redirectUri = ALLOWED_REDIRECT_URIS.includes(body.redirectUri) ? body.redirectUri : env.DISCORD_REDIRECT_URI;

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });

  if (!tokenRes.ok) throw new HttpError(401, 'Не вдалося авторизуватись через Discord');
  const tokenData = await tokenRes.json();

  const meRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });

  if (!meRes.ok) throw new HttpError(401, 'Не вдалося отримати профіль Discord');
  const me = await meRes.json();

  const username = me.global_name || me.username;
  const avatar = discordAvatarUrl(me.id, me.avatar);
  const user = await upsertUser(env.DB, { discordId: me.id, username, avatar });

  const sessionToken = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await createSession(env.DB, sessionToken, me.id, expiresAt);

  return jsonResponse({ sessionToken, user: publicUser(user) }, 201);
}

export async function handleGetMe(request, env) {
  const session = await requireSession(env.DB, request);
  const user = await getUserByDiscordId(env.DB, session.discordId);
  return jsonResponse({ ...publicUser(user), isAdmin: session.discordId === env.ADMIN_DISCORD_ID });
}

export async function handleLogout(request, env) {
  const token = bearerToken(request);
  if (token) await deleteSession(env.DB, token);
  return jsonResponse({ ok: true });
}

export async function handleListCharacters(request, env) {
  const session = await requireSession(env.DB, request);
  return jsonResponse(await listUserCharacters(env.DB, session.discordId));
}

export async function handleAddCharacter(request, env) {
  const session = await requireSession(env.DB, request);
  const body = await readJson(request);
  const characterName = capitalizeName(String(body.characterName || '').trim());
  if (!characterName) throw new HttpError(400, "Потрібне ім'я персонажа");

  const ownerId = await findCharacterOwner(env.DB, characterName);
  if (ownerId && ownerId !== session.discordId) {
    throw new HttpError(409, `Персонажа "${characterName}" вже застовпив інший акаунт`);
  }

  return jsonResponse(await addUserCharacter(env.DB, session.discordId, characterName), 201);
}

export async function handleRemoveCharacter(request, env, characterName) {
  const session = await requireSession(env.DB, request);
  return jsonResponse(await removeUserCharacter(env.DB, session.discordId, characterName));
}

export async function handleSetPrimaryCharacter(request, env, characterName) {
  const session = await requireSession(env.DB, request);
  return jsonResponse(await setPrimaryCharacter(env.DB, session.discordId, characterName));
}

export async function handleAdminRemoveCharacter(request, env, characterName, session) {
  const removedFromDiscordId = await removeCharacterByAnyOwner(env.DB, characterName);
  return jsonResponse({ removedFromDiscordId });
}

// Публічно (без логіну) — для тултіпів "це альт когось" у статичній
// аналітиці/таблиці гравців рейду. Видає лише ім'я для атрибуції, не сам
// discord_id чи інші дані акаунту.
export async function handleListCharacterOwners(request, env) {
  const rows = await listCharacterOwnerNames(env.DB);
  const map = {};
  for (const row of rows) map[row.owned_name] = row.display_name;
  return jsonResponse(map);
}

export async function handleSearchUsers(request, env) {
  await requireSession(env.DB, request);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();

  const users = await searchUsers(env.DB, q);
  return jsonResponse(users.map((u) => ({ discordId: u.discord_id, username: u.username, avatar: u.avatar })));
}
