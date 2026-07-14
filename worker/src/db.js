import { generateToken } from './util.js';

function nowIso() {
  return new Date().toISOString();
}

// Персонаж, явно позначений як "Основний" у профілі (user_characters.is_primary).
// Якщо такого нема — фолбек на username.
function primaryCharacterSubquery(alias) {
  return `(SELECT character_name FROM user_characters WHERE discord_id = ${alias}.discord_id AND is_primary = 1 LIMIT 1)`;
}

function displayNameSubquery(alias) {
  return `COALESCE(${primaryCharacterSubquery(alias)}, ${alias}.username)`;
}

export async function createRaid(db, { id, title, instance, difficulty, softLimitTotal, hiddenReserves, leaderDiscordId, transferWeightLimit }) {
  const ts = nowIso();
  const twl = (transferWeightLimit === undefined || transferWeightLimit === null) ? null : Number(transferWeightLimit);
  await db
    .prepare(
      `INSERT INTO raids (id, title, instance, difficulty, soft_limit_total, is_locked, hidden_reserves, officer_token, leader_discord_id, transfer_weight_limit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, title, instance, difficulty, softLimitTotal, hiddenReserves ? 1 : 0, generateToken(), leaderDiscordId, twl, ts, ts)
    .run();
  return getRaid(db, id);
}

export async function listRaids(db, { limit = 20, offset = 0 } = {}) {
  const { results } = await db
    .prepare(
      `SELECT r.id, r.title, r.instance, r.difficulty, r.is_locked, r.status, r.created_at,
              ${displayNameSubquery('u')} AS leader_display_name
       FROM raids r LEFT JOIN users u ON u.discord_id = r.leader_discord_id
       ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all();
  return results;
}

export async function countRaids(db) {
  const row = await db.prepare('SELECT COUNT(*) AS count FROM raids').first();
  return row.count;
}

export async function getRaid(db, id) {
  return db
    .prepare(
      `SELECT r.*, u.username AS leader_username, u.avatar AS leader_avatar,
              ${displayNameSubquery('u')} AS leader_display_name
       FROM raids r LEFT JOIN users u ON u.discord_id = r.leader_discord_id
       WHERE r.id = ?`
    )
    .bind(id)
    .first();
}

export async function updateRaidSettings(db, id, fields) {
  const columns = Object.keys(fields);
  if (!columns.length) return getRaid(db, id);

  const setClause = columns.map((col) => `${col} = ?`).join(', ');
  const values = columns.map((col) => fields[col]);

  await db
    .prepare(`UPDATE raids SET ${setClause}, updated_at = ? WHERE id = ?`)
    .bind(...values, nowIso(), id)
    .run();

  return getRaid(db, id);
}

export async function setRaidLock(db, id, locked) {
  await db.prepare('UPDATE raids SET is_locked = ?, updated_at = ? WHERE id = ?').bind(locked ? 1 : 0, nowIso(), id).run();
  return getRaid(db, id);
}

export async function setRaidStatus(db, id, status) {
  await db.prepare('UPDATE raids SET status = ?, updated_at = ? WHERE id = ?').bind(status, nowIso(), id).run();
  return getRaid(db, id);
}

export async function listReserves(db, raidId) {
  const { results } = await db
    .prepare('SELECT * FROM soft_reserves WHERE raid_id = ? ORDER BY created_at ASC')
    .bind(raidId)
    .all();
  return results;
}

export async function getReserveById(db, raidId, reserveId) {
  return db.prepare('SELECT * FROM soft_reserves WHERE raid_id = ? AND id = ?').bind(raidId, reserveId).first();
}

export async function addRaidParticipant(db, raidId, playerName) {
  await db
    .prepare('INSERT OR IGNORE INTO raid_participants (raid_id, player_name, joined_at) VALUES (?, ?, ?)')
    .bind(raidId, playerName, nowIso())
    .run();
}

export async function getRaidParticipantsWithPenalties(db, raidId) {
  const { results } = await db
    .prepare(
      `SELECT rp.player_name,
              COALESCE(pen.roll_penalty, 0) AS roll_penalty,
              COALESCE(pen.soft_penalty, 0) AS soft_penalty,
              COALESCE(pen.reason, '') AS reason
       FROM raid_participants rp
       LEFT JOIN raid_penalties pen
         ON pen.raid_id = rp.raid_id AND pen.player_name = rp.player_name
       WHERE rp.raid_id = ?
       ORDER BY rp.joined_at ASC`
    )
    .bind(raidId)
    .all();
  return results;
}

export async function upsertRaidPenalty(db, raidId, playerName, rollPenalty, softPenalty, reason) {
  await db
    .prepare(
      `INSERT INTO raid_penalties (raid_id, player_name, roll_penalty, soft_penalty, reason)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(raid_id, player_name) DO UPDATE SET
         roll_penalty = excluded.roll_penalty,
         soft_penalty = excluded.soft_penalty,
         reason = excluded.reason`
    )
    .bind(raidId, playerName, rollPenalty, softPenalty, reason)
    .run();
}

export async function createReserve(db, { raidId, playerName, itemId, boss, weight, assignedByOfficer, discordId }) {
  const ts = nowIso();
  const result = await db
    .prepare(
      `INSERT INTO soft_reserves (raid_id, player_name, item_id, boss, weight, is_received, assigned_by_officer, discord_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
    )
    .bind(raidId, playerName, itemId, boss, weight, assignedByOfficer ? 1 : 0, discordId || null, ts, ts)
    .run();
  await addRaidParticipant(db, raidId, playerName);
  return getReserveById(db, raidId, result.meta.last_row_id);
}

export async function deleteReserveById(db, raidId, reserveId) {
  await db.prepare('DELETE FROM soft_reserves WHERE raid_id = ? AND id = ?').bind(raidId, reserveId).run();
}

export async function deleteAllReservesForPlayer(db, raidId, playerName) {
  await db.prepare('DELETE FROM soft_reserves WHERE raid_id = ? AND player_name = ?').bind(raidId, playerName).run();
}

export async function setReserveReceived(db, raidId, reserveId, received) {
  await db
    .prepare('UPDATE soft_reserves SET is_received = ?, updated_at = ? WHERE raid_id = ? AND id = ?')
    .bind(received ? 1 : 0, nowIso(), raidId, reserveId)
    .run();
  return getReserveById(db, raidId, reserveId);
}

export async function sumPlayerWeight(db, raidId, playerName) {
  const row = await db
    .prepare('SELECT COALESCE(SUM(weight), 0) AS total FROM soft_reserves WHERE raid_id = ? AND player_name = ?')
    .bind(raidId, playerName)
    .first();
  return { totalWeight: row.total };
}

export async function getClaimedPlayerNames(db, raidId, discordId) {
  const { results } = await db
    .prepare('SELECT player_name FROM claim_tokens WHERE raid_id = ? AND discord_id = ?')
    .bind(raidId, discordId)
    .all();
  return new Set(results.map((r) => r.player_name));
}

export async function getClaimOwner(db, raidId, playerName) {
  return db.prepare('SELECT * FROM claim_tokens WHERE raid_id = ? AND player_name = ?').bind(raidId, playerName).first();
}

export async function createClaim(db, raidId, playerName, discordId) {
  await db
    .prepare('INSERT INTO claim_tokens (raid_id, player_name, discord_id, created_at) VALUES (?, ?, ?, ?)')
    .bind(raidId, playerName, discordId, nowIso())
    .run();
}

export async function insertAudit(db, raidId, actorName, action, detail) {
  await db
    .prepare('INSERT INTO audit_log (raid_id, actor_name, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(raidId, actorName, action, JSON.stringify(detail || {}), nowIso())
    .run();
}

export async function listAudit(db, raidId, limit = 250) {
  const { results } = await db
    .prepare('SELECT * FROM audit_log WHERE raid_id = ? ORDER BY created_at DESC LIMIT ?')
    .bind(raidId, limit)
    .all();
  return results;
}

export async function getUserByDiscordId(db, discordId) {
  return db.prepare('SELECT * FROM users WHERE discord_id = ?').bind(discordId).first();
}

export async function upsertUser(db, { discordId, username, avatar }) {
  const ts = nowIso();
  const existing = await getUserByDiscordId(db, discordId);

  if (existing) {
    await db
      .prepare('UPDATE users SET username = ?, avatar = ?, updated_at = ? WHERE discord_id = ?')
      .bind(username, avatar, ts, discordId)
      .run();
  } else {
    await db
      .prepare('INSERT INTO users (discord_id, username, avatar, character_name, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)')
      .bind(discordId, username, avatar, ts, ts)
      .run();
  }

  return getUserByDiscordId(db, discordId);
}

// Публічна мапа "застовплений персонаж -> ім'я для тултіпа" (основний
// персонаж власника, або username, якщо основного не позначено) — для
// тултіпів у статичній аналітиці/таблиці гравців рейду. Без авторизації:
// видає лише публічний display name, не discord_id чи інші дані акаунту.
export async function listCharacterOwnerNames(db) {
  const { results } = await db
    .prepare(
      `SELECT uc.character_name AS owned_name, ${displayNameSubquery('u')} AS display_name
       FROM user_characters uc
       JOIN users u ON u.discord_id = uc.discord_id`
    )
    .all();
  return results;
}

// Публічний список імен персонажів, позначених основними у профілі —
// для бейджа "Основний" у статичній аналітиці. Без авторизації: лише
// character_name, без discord_id чи інших даних акаунту.
export async function listPrimaryCharacterNames(db) {
  const { results } = await db.prepare('SELECT character_name FROM user_characters WHERE is_primary = 1').all();
  return results.map((r) => r.character_name);
}

export async function listUserCharacters(db, discordId) {
  const { results } = await db
    .prepare('SELECT character_name, is_primary FROM user_characters WHERE discord_id = ? ORDER BY created_at ASC')
    .bind(discordId)
    .all();
  return results.map((r) => ({ characterName: r.character_name, isPrimary: Boolean(r.is_primary) }));
}

export async function addUserCharacter(db, discordId, characterName) {
  await db
    .prepare('INSERT OR IGNORE INTO user_characters (discord_id, character_name, created_at) VALUES (?, ?, ?)')
    .bind(discordId, characterName, nowIso())
    .run();
  return listUserCharacters(db, discordId);
}

export async function removeUserCharacter(db, discordId, characterName) {
  await db.prepare('DELETE FROM user_characters WHERE discord_id = ? AND character_name = ?').bind(discordId, characterName).run();
  return listUserCharacters(db, discordId);
}

// Глобальна унікальність персонажа (across усіх акаунтів) — на рівні
// застосунку, а не DB UNIQUE/COLLATE NOCASE: SQLite кейсфолдить лише ASCII,
// кириличні "борис"/"Борис" через DB-рівень не зловити (як і в searchUsers).
// Повертає рядок зі збереженим написанням імені (потрібне для точного
// DELETE — введений запит може відрізнятись регістром від збереженого).
async function findCharacterClaim(db, characterName) {
  const { results } = await db.prepare('SELECT discord_id, character_name FROM user_characters').all();
  const q = characterName.toLocaleLowerCase('uk');
  const match = results.find((r) => r.character_name.toLocaleLowerCase('uk') === q);
  return match ? { discordId: match.discord_id, characterName: match.character_name } : null;
}

export async function findCharacterOwner(db, characterName) {
  const claim = await findCharacterClaim(db, characterName);
  return claim?.discordId || null;
}

// Адмінське форс-видалення — виправлення помилкового застовплення чужого
// персонажа, без перевірки фактичного власника.
export async function removeCharacterByAnyOwner(db, characterName) {
  const claim = await findCharacterClaim(db, characterName);
  if (!claim) return null;
  await db
    .prepare('DELETE FROM user_characters WHERE discord_id = ? AND character_name = ?')
    .bind(claim.discordId, claim.characterName)
    .run();
  return claim.discordId;
}

// Позначає персонажа як "Основний" (для атрибуції лідера/офіцера на сторінці
// рейду) — знімає прапорець з усіх інших персонажів акаунту, бо основний
// може бути лише один.
export async function setPrimaryCharacter(db, discordId, characterName) {
  await db.prepare('UPDATE user_characters SET is_primary = 0 WHERE discord_id = ?').bind(discordId).run();
  await db
    .prepare('UPDATE user_characters SET is_primary = 1 WHERE discord_id = ? AND character_name = ?')
    .bind(discordId, characterName)
    .run();
  return listUserCharacters(db, discordId);
}

export async function clearPrimaryCharacter(db, discordId) {
  await db.prepare('UPDATE user_characters SET is_primary = 0 WHERE discord_id = ?').bind(discordId).run();
  return listUserCharacters(db, discordId);
}

export async function getPrimaryCharacterName(db, discordId) {
  const row = await db
    .prepare('SELECT character_name FROM user_characters WHERE discord_id = ? AND is_primary = 1 LIMIT 1')
    .bind(discordId)
    .first();
  return row?.character_name || null;
}

// Пошук для призначення офіцера — свідомо лише по Discord-ніку (не по
// імені альта): офіцерський статус прив'язаний до discord_id, тож будь-який
// твін цього акаунта вже вважається офіцером — пошук по нікнейму прибирає
// плутанину "кого саме я призначаю".
// Фільтруємо в JS, а не через SQL LIKE/NOCASE — SQLite нечутливий до регістру
// лише для ASCII, кириличні "Борис"/"борис" через LIKE не збігаються.
export async function searchUsers(db, query, limit = 50) {
  const { results } = await db
    .prepare('SELECT discord_id, username, avatar FROM users ORDER BY username COLLATE NOCASE')
    .all();

  const q = query.toLocaleLowerCase('uk');
  const matches = q ? results.filter((u) => u.username.toLocaleLowerCase('uk').includes(q)) : results;
  return matches.slice(0, limit);
}

export async function createSession(db, token, discordId, expiresAt) {
  await db.prepare('INSERT INTO sessions (token, discord_id, expires_at) VALUES (?, ?, ?)').bind(token, discordId, expiresAt).run();
}

export async function getSessionByToken(db, token) {
  return db.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
}

export async function deleteSession(db, token) {
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

export async function listRaidOfficers(db, raidId) {
  const { results } = await db
    .prepare(
      `SELECT u.discord_id, u.username, u.avatar,
              ${displayNameSubquery('u')} AS display_name
       FROM raid_officers ro
       JOIN users u ON u.discord_id = ro.discord_id
       WHERE ro.raid_id = ? ORDER BY ro.added_at ASC`
    )
    .bind(raidId)
    .all();
  return results;
}

export async function isRaidOfficerRow(db, raidId, discordId) {
  return db.prepare('SELECT 1 FROM raid_officers WHERE raid_id = ? AND discord_id = ?').bind(raidId, discordId).first();
}

export async function addRaidOfficer(db, raidId, discordId) {
  await db
    .prepare('INSERT OR IGNORE INTO raid_officers (raid_id, discord_id, added_at) VALUES (?, ?, ?)')
    .bind(raidId, discordId, nowIso())
    .run();
}

export async function removeRaidOfficer(db, raidId, discordId) {
  await db.prepare('DELETE FROM raid_officers WHERE raid_id = ? AND discord_id = ?').bind(raidId, discordId).run();
}

export async function listDefaultOfficers(db) {
  const { results } = await db
    .prepare(
      `SELECT do.discord_id, ${displayNameSubquery('u')} AS display_name, u.username
       FROM default_officers do
       JOIN users u ON u.discord_id = do.discord_id
       ORDER BY do.added_at ASC`
    )
    .all();
  return results;
}

export async function addDefaultOfficer(db, discordId) {
  await db
    .prepare('INSERT OR IGNORE INTO default_officers (discord_id, added_at) VALUES (?, ?)')
    .bind(discordId, nowIso())
    .run();
  return listDefaultOfficers(db);
}

export async function removeDefaultOfficer(db, discordId) {
  await db.prepare('DELETE FROM default_officers WHERE discord_id = ?').bind(discordId).run();
  return listDefaultOfficers(db);
}

export async function deleteRaid(db, raidId) {
  await db.prepare('DELETE FROM raids WHERE id = ?').bind(raidId).run();
}

export async function listWeightTransfers(db, raidId) {
  const { results } = await db
    .prepare('SELECT from_player, to_player, created_at FROM raid_weight_transfers WHERE raid_id = ? ORDER BY created_at ASC')
    .bind(raidId)
    .all();
  return results;
}

export async function getWeightTransferByFrom(db, raidId, fromPlayer) {
  return db
    .prepare('SELECT from_player, to_player FROM raid_weight_transfers WHERE raid_id = ? AND from_player = ?')
    .bind(raidId, fromPlayer)
    .first();
}

export async function getWeightTransferByTo(db, raidId, toPlayer) {
  return db
    .prepare('SELECT from_player, to_player FROM raid_weight_transfers WHERE raid_id = ? AND to_player = ?')
    .bind(raidId, toPlayer)
    .first();
}

export async function createWeightTransfer(db, raidId, fromPlayer, toPlayer) {
  await db
    .prepare('INSERT INTO raid_weight_transfers (raid_id, from_player, to_player, created_at) VALUES (?, ?, ?, ?)')
    .bind(raidId, fromPlayer, toPlayer, nowIso())
    .run();
}

export async function deleteWeightTransfer(db, raidId, fromPlayer) {
  await db
    .prepare('DELETE FROM raid_weight_transfers WHERE raid_id = ? AND from_player = ?')
    .bind(raidId, fromPlayer)
    .run();
}

export async function deleteAllTransfersForRaid(db, raidId) {
  await db
    .prepare('DELETE FROM raid_weight_transfers WHERE raid_id = ?')
    .bind(raidId)
    .run();
}

export async function resetAllBonusWeightsForRaid(db, raidId) {
  await db
    .prepare('UPDATE soft_reserves SET bonus_weight = 0 WHERE raid_id = ?')
    .bind(raidId)
    .run();
}

export async function sumBonusWeight(db, raidId, playerName) {
  const row = await db
    .prepare('SELECT COALESCE(SUM(bonus_weight), 0) AS total FROM soft_reserves WHERE raid_id = ? AND player_name = ?')
    .bind(raidId, playerName)
    .first();
  return { totalBonus: row.total };
}

export async function updateReserveBonusWeight(db, raidId, reserveId, delta) {
  await db
    .prepare('UPDATE soft_reserves SET bonus_weight = bonus_weight + ?, updated_at = ? WHERE id = ? AND raid_id = ?')
    .bind(delta, nowIso(), reserveId, raidId)
    .run();
  return getReserveById(db, raidId, reserveId);
}

export async function updateReserveOfficerBonusWeight(db, raidId, reserveId, delta) {
  await db
    .prepare('UPDATE soft_reserves SET officer_bonus_weight = officer_bonus_weight + ?, updated_at = ? WHERE id = ? AND raid_id = ?')
    .bind(delta, nowIso(), reserveId, raidId)
    .run();
  return getReserveById(db, raidId, reserveId);
}
