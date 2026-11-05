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
  clearPrimaryCharacter,
  findCharacterOwner,
  removeCharacterByAnyOwner,
  listCharacterOwnerNames,
  listPrimaryCharacterNames,
  isDefaultOfficer,
  updateUserPreferences,
  getUserDisplayName,
  updateUserCharacter,
  getCooldownsByNames,
  getRaid,
  CHARACTER_COOLDOWN_COLUMNS,
  DEFAULT_SOUND_VOLUME
} from '../db.js';
import { requireSession, requireGlobalOfficer, requireRaidOfficer } from '../auth.js';

const SESSION_TTL_DAYS = 30;


// Discord вимагає точного збігу redirect_uri між /authorize і обміном code.
// Клієнт рахує його від window.location.origin (прод і localhost — різні
// origin), тож звіряємо з тим самим allowlist, що зареєстрований у Discord-
// застосунку, замість одного фіксованого значення з env.
const ALLOWED_REDIRECT_URIS = [
  'https://wow-nostalgia.github.io/account/callback/',
  'http://localhost:8080/account/callback/'
];

const NO_BACKGROUND = 'none';
const BACKGROUND_EXTENSIONS = /\.(jpe?g|png|webp|avif)$/i;
// Worker не бачить вмісту images/backgrounds/ на GitHub Pages, тож звірити
// значення зі списком реальних файлів тут неможливо — натомість не даємо
// зберегти нічого, що змогло б вирватися з CSS url(...) чи з шляху папки.
// Імена фонів кирилицею з пробілами допустимі: фронт підставляє їх через
// encodeURIComponent, тому в CSS потрапляє лише percent-encoded ASCII.
const BACKGROUND_FORBIDDEN = /[\u0000-\u001f\u007f/\\"'()<>`]/;

function normalizeBackground(value) {
  if (value === null) return null;

  if (typeof value !== 'string') {
    throw new HttpError(400, 'background має бути назвою файлу, "none" або null');
  }

  const name = value.trim();
  if (!name) return null;
  if (name === NO_BACKGROUND) return NO_BACKGROUND;

  if (name.length > 120) throw new HttpError(400, 'Занадто довга назва фону');
  if (name.startsWith('.') || BACKGROUND_FORBIDDEN.test(name)) {
    throw new HttpError(400, 'Недопустима назва фону');
  }
  if (!BACKGROUND_EXTENSIONS.test(name)) {
    throw new HttpError(400, 'Фон має бути зображенням (jpg, png, webp, avif)');
  }

  return name;
}

// Мають збігатися з SITE_THEMES у scripts/background.js (крім 'default',
// який зберігаємо як NULL).
const SITE_THEMES = ['atom'];

function normalizeTheme(value) {
  if (value === null || value === 'default') return null;
  if (!SITE_THEMES.includes(value)) throw new HttpError(400, 'Невідома тема сайту');
  return value;
}

function discordAvatarUrl(discordId, avatarHash) {
  return avatarHash ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png` : null;
}

function publicUser(user) {
  if (!user) return null;
  return {
    discordId: user.discord_id,
    username: user.username,
    avatar: user.avatar,
    // Колонок може не бути лише теоретично (обидві NOT NULL DEFAULT), але ??
    // страхує від undefined, якщо міграцію накотять не скрізь.
    soundNotifications: Boolean(user.sound_notifications ?? 1),
    soundVolume: user.sound_volume ?? DEFAULT_SOUND_VOLUME,
    // null - стандартний фон, 'none' - без фону, інакше ім'я файлу.
    background: user.background ?? null,
    // null - стандартна тема, інакше назва з SITE_THEMES.
    theme: user.theme ?? null
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
  return jsonResponse({
    ...publicUser(user),
    displayName: await getUserDisplayName(env.DB, session.discordId),
    isAdmin: session.discordId === env.ADMIN_DISCORD_ID,
    isGuildOfficer: await isDefaultOfficer(env.DB, session.discordId)
  });
}

// Шлях навмисно узагальнений: наступні налаштування профілю ляжуть сюди ж,
// без нового ендпоінта на кожен прапорець.
export async function handleUpdatePreferences(request, env) {
  const session = await requireSession(env.DB, request);
  const body = await readJson(request);
  const fields = {};

  if (body.soundNotifications !== undefined) {
    if (typeof body.soundNotifications !== 'boolean') {
      throw new HttpError(400, 'soundNotifications має бути true або false');
    }
    fields.sound_notifications = body.soundNotifications ? 1 : 0;
  }

  if (body.soundVolume !== undefined) {
    const volume = Number(body.soundVolume);
    if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
      throw new HttpError(400, 'soundVolume має бути цілим числом 0-100');
    }
    fields.sound_volume = volume;
  }

  if (body.background !== undefined) {
    fields.background = normalizeBackground(body.background);
  }

  if (body.theme !== undefined) {
    fields.theme = normalizeTheme(body.theme);
  }

  if (!Object.keys(fields).length) throw new HttpError(400, 'Немає що змінювати');

  const user = await updateUserPreferences(env.DB, session.discordId, fields);
  return jsonResponse(publicUser(user));
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

// Відмітки КД і GearScore персонажа. body: { cooldowns?: {icc10?: bool, ...},
// gearScore?: number|null } - можна передати лише те, що змінилось.
export async function handleUpdateCharacter(request, env, characterName) {
  const session = await requireSession(env.DB, request);
  const body = await readJson(request);
  const fields = {};

  if (body.cooldowns !== undefined) {
    if (!body.cooldowns || typeof body.cooldowns !== 'object' || Array.isArray(body.cooldowns)) {
      throw new HttpError(400, 'cooldowns має бути об’єктом');
    }
    for (const [key, value] of Object.entries(body.cooldowns)) {
      const column = CHARACTER_COOLDOWN_COLUMNS[key];
      if (!column) throw new HttpError(400, `Невідомий рейд: ${key}`);
      if (typeof value !== 'boolean') throw new HttpError(400, `cooldowns.${key} має бути true або false`);
      fields[column] = value ? 1 : 0;
    }
  }

  if (body.gearScore !== undefined) {
    if (body.gearScore === null) {
      fields.gear_score = null;
    } else {
      const tenths = Math.round(Number(body.gearScore) * 10);
      if (typeof body.gearScore !== 'number' || !Number.isFinite(body.gearScore)
        || tenths < 0 || tenths > 99 || Math.abs(body.gearScore * 10 - tenths) > 1e-6) {
        throw new HttpError(400, 'GS має бути числом від 0.0 до 9.9 з одним знаком після крапки');
      }
      fields.gear_score = tenths;
    }
  }

  if (!Object.keys(fields).length) throw new HttpError(400, 'Немає що змінювати');

  const characters = await updateUserCharacter(env.DB, session.discordId, characterName, fields);
  if (!characters) throw new HttpError(404, 'Персонажа не знайдено');
  return jsonResponse(characters);
}

export async function handleClearPrimaryCharacter(request, env) {
  const session = await requireSession(env.DB, request);
  return jsonResponse(await clearPrimaryCharacter(env.DB, session.discordId));
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

// Публічно (без логіну) — для бейджа "Основний" у статичній аналітиці.
// Видає лише character_name, без discord_id чи інших даних акаунту.
export async function handleListPrimaryCharacters(request, env) {
  return jsonResponse(await listPrimaryCharacterNames(env.DB));
}

const MAX_COOLDOWN_LOOKUP = 40;

// КД персонажів (read-only), лише офіцерам. ?names=A,B,C[&raidId=X]
//   з raidId - вкладка "Лог" рейду: лідер/офіцер саме цього рейду;
//   без raidId - Рейтинг DPS -> "Гравець": офіцер гільдії.
export async function handleListCharacterCooldowns(request, env) {
  const session = await requireSession(env.DB, request);
  const params = new URL(request.url).searchParams;
  const raidId = params.get('raidId');
  if (raidId) {
    const raid = await getRaid(env.DB, raidId);
    if (!raid) throw new HttpError(404, 'Рейд не знайдено');
    await requireRaidOfficer(env.DB, raidId, raid, session);
  } else {
    await requireGlobalOfficer(env.DB, session);
  }
  const raw = params.get('names') || '';
  const names = [...new Set(raw.split(',').map((n) => n.trim()).filter(Boolean))];
  if (!names.length) return jsonResponse({});
  if (names.length > MAX_COOLDOWN_LOOKUP) throw new HttpError(400, `Не більше ${MAX_COOLDOWN_LOOKUP} персонажів за раз`);
  if (names.some((n) => n.length > 24)) throw new HttpError(400, "Некоректні імена персонажів");
  return jsonResponse(await getCooldownsByNames(env.DB, names));
}

export async function handleSearchUsers(request, env) {
  await requireSession(env.DB, request);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();

  const users = await searchUsers(env.DB, q);
  return jsonResponse(users.map((u) => ({ discordId: u.discord_id, username: u.username, avatar: u.avatar })));
}
