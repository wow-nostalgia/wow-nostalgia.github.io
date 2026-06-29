import { HttpError, bearerToken } from './util.js';
import { getSessionByToken, getUserByDiscordId, deleteSession, getClaimOwner, isRaidOfficerRow, getPrimaryCharacterName } from './db.js';

export async function requireSession(db, request) {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, 'Потрібен логін через Discord');

  const session = await getSessionByToken(db, token);
  if (!session) throw new HttpError(401, 'Сесія недійсна, увійдіть знову');

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await deleteSession(db, token);
    throw new HttpError(401, 'Сесія застаріла, увійдіть знову');
  }

  const user = await getUserByDiscordId(db, session.discord_id);
  if (!user) throw new HttpError(401, 'Користувача не знайдено');

  const primaryCharacter = await getPrimaryCharacterName(db, user.discord_id);

  // username тут — ім'я для атрибуції в чіпсах/аудиті (перший збережений
  // альт, якщо є; інакше Discord-нік як фолбек).
  return {
    discordId: user.discord_id,
    username: primaryCharacter || user.username,
    avatar: user.avatar,
    primaryCharacter
  };
}

export async function isRaidOfficer(db, raidId, raid, discordId) {
  if (!discordId) return false;
  if (raid.leader_discord_id === discordId) return true;
  return Boolean(await isRaidOfficerRow(db, raidId, discordId));
}

export async function requireRaidOfficer(db, raidId, raid, session) {
  if (!(await isRaidOfficer(db, raidId, raid, session.discordId))) {
    throw new HttpError(403, 'Потрібні права лідера/офіцера рейду');
  }
}

export function requireLeader(raid, session) {
  if (raid.leader_discord_id !== session.discordId) {
    throw new HttpError(403, 'Лише лідер рейду може керувати офіцерами');
  }
}

// Для self-дій гравця: дозволяє, якщо лідер/офіцер рейду, або якщо ім'я вже
// застовплене цим самим Discord-акаунтом. allowMint=true — для першого софту
// під новим іменем (де claim ще не існує) дозволяємо пройти далі, щоб роут
// сам застовпив ім'я за цим акаунтом.
export async function checkPlayerAccess(db, raidId, raid, session, playerName, { allowMint = false } = {}) {
  if (await isRaidOfficer(db, raidId, raid, session.discordId)) {
    return { officer: true, shouldMint: false };
  }

  const claim = await getClaimOwner(db, raidId, playerName);

  if (!claim) {
    if (allowMint) return { officer: false, shouldMint: true };
    throw new HttpError(403, `Немає прав на дії гравця "${playerName}"`);
  }

  if (claim.discord_id !== session.discordId) {
    throw new HttpError(403, `Ім'я "${playerName}" вже застовплене іншим гравцем у цьому рейді`);
  }

  return { officer: false, shouldMint: false };
}
