import { HttpError, bearerToken } from './util.js';
import {
  getSessionByToken,
  getUserByDiscordId,
  deleteSession,
  getClaimOwner,
  isRaidOfficerRow,
  getPrimaryCharacterName,
  listUserCharacters
} from './db.js';

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

  // username тут — ім'я для атрибуції в чіпсах/аудиті (персонаж, позначений
  // основним у профілі, якщо є; інакше Discord-нік як фолбек).
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

// Не-офіцер може застовпити (мінтити) claim лише під іменем персонажа зі
// свого профілю ("Мої персонажі") — без цього API дозволяв би засофтити під
// будь-яким довільним іменем в обхід select'а на фронтенді, який лише
// візуально обмежує вибір профільними персонажами.
export async function requireOwnCharacter(db, discordId, characterName) {
  const characters = await listUserCharacters(db, discordId);
  const owns = characters.some((c) => c.characterName.toLocaleLowerCase('uk') === characterName.toLocaleLowerCase('uk'));
  if (!owns) {
    throw new HttpError(403, `Персонажа "${characterName}" немає у твоєму профілі — додай його на сторінці "Акаунт"`);
  }
}

// Для self-дій гравця: дозволяє, якщо лідер/офіцер рейду, або якщо ім'я вже
// застовплене цим самим Discord-акаунтом. allowMint=true — для першого софту
// під новим іменем (де claim ще не існує) дозволяємо пройти далі, щоб роут
// сам застовпив ім'я за цим акаунтом — але лише якщо це ім'я є в профілі
// заявника (requireOwnCharacter), інакше застовплення анонімних імен.
export async function checkPlayerAccess(db, raidId, raid, session, playerName, { allowMint = false } = {}) {
  if (await isRaidOfficer(db, raidId, raid, session.discordId)) {
    return { officer: true, shouldMint: false };
  }

  const claim = await getClaimOwner(db, raidId, playerName);

  if (!claim) {
    if (allowMint) {
      await requireOwnCharacter(db, session.discordId, playerName);
      return { officer: false, shouldMint: true };
    }
    throw new HttpError(403, `Немає прав на дії гравця "${playerName}"`);
  }

  if (claim.discord_id !== session.discordId) {
    throw new HttpError(403, `Ім'я "${playerName}" вже застовплене іншим гравцем у цьому рейді`);
  }

  return { officer: false, shouldMint: false };
}
