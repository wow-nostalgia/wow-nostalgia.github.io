import { generateToken } from './util.js';

function nowIso() {
  return new Date().toISOString();
}

// Сумарний мінус до ролу гравця (у рейді / в інстансі Штрафбату) — не більше.
export const MAX_ROLL_PENALTY = 100;
// Сумарний мінус до софту гравця в інстансі Штрафбату (= максимальний ліміт
// софтів рейду). У самому рейді діє ліміт софтів цього рейду.
export const MAX_SOFT_PENALTY = 3;

// Персонаж, явно позначений як "Основний" у профілі (user_characters.is_primary).
// Якщо такого нема — фолбек на username.
function primaryCharacterSubquery(alias) {
  return `(SELECT character_name FROM user_characters WHERE discord_id = ${alias}.discord_id AND is_primary = 1 LIMIT 1)`;
}

function displayNameSubquery(alias) {
  return `COALESCE(${primaryCharacterSubquery(alias)}, ${alias}.username)`;
}

// Усі персонажі з профілю користувача одним рядком "A|B|C" — сторінка рейду
// показує офіцерам, на кому з них офіцер/лідер у цьому рейді.
function charactersSubquery(discordIdExpr) {
  return `(SELECT GROUP_CONCAT(character_name, '|') FROM user_characters WHERE discord_id = ${discordIdExpr})`;
}

export async function getUserCharactersJoined(db, discordId) {
  const row = await db.prepare(`SELECT ${charactersSubquery('?')} AS characters`).bind(discordId).first();
  return row?.characters || null;
}

export async function createRaid(db, { id, title, instance, difficulty, softLimitTotal, hiddenReserves, leaderDiscordId, transferWeightLimit, allowMountSofts, lkOnly, startsAt }) {
  const ts = nowIso();
  const twl = (transferWeightLimit === undefined || transferWeightLimit === null) ? null : Number(transferWeightLimit);
  await db
    .prepare(
      `INSERT INTO raids (id, title, instance, difficulty, soft_limit_total, is_locked, hidden_reserves, officer_token, leader_discord_id, transfer_weight_limit, allow_mount_softs, lk_only, starts_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, title, instance, difficulty, softLimitTotal, hiddenReserves ? 1 : 0, generateToken(), leaderDiscordId, twl, allowMountSofts ? 1 : 0, lkOnly ? 1 : 0, startsAt || ts, ts, ts)
    .run();
  return getRaid(db, id);
}

// Створення рейду + запис в історії + гільдійські офіцери (сайт і імпорт з
// Raid-Helper).
export async function createRaidWithDefaults(db, fields, actorName) {
  const raid = await createRaid(db, fields);
  await insertAudit(db, raid.id, actorName, 'raid_create', { title: fields.title, instance: fields.instance, difficulty: fields.difficulty });
  const defaultOfficers = await listDefaultOfficers(db);
  await Promise.all(defaultOfficers.map((o) => addRaidOfficer(db, raid.id, o.discord_id)));
  return raid;
}

export async function listRaids(db, { limit = 20, offset = 0 } = {}) {
  const { results } = await db
    .prepare(
      `SELECT r.id, r.title, r.instance, r.difficulty, r.is_locked, r.status, r.created_at, r.starts_at,
              ${displayNameSubquery('u')} AS leader_display_name
       FROM raids r LEFT JOIN users u ON u.discord_id = r.leader_discord_id
       ORDER BY COALESCE(r.starts_at, r.created_at) DESC, r.created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all();
  return results;
}

// Календар рейдів: рейди, що починаються в [fromIso, toIso). ISO-рядки UTC
// порівнюються лексикографічно коректно (однаковий формат toISOString).
// signed_count - основа (signed), extra_count - late/tentative/bench (як
// "15 (+12)" у Raid-Helper; відсутні не рахуються), my_status - власний запис.
export async function listRaidsInRange(db, fromIso, toIso, discordId) {
  const { results } = await db
    .prepare(
      `SELECT r.id, r.title, r.instance, r.difficulty, r.is_locked, r.status, r.created_at, r.starts_at,
              ${displayNameSubquery('u')} AS leader_display_name,
              (SELECT COUNT(*) FROM raid_signups s WHERE s.raid_id = r.id AND s.status = 'signed') AS signed_count,
              (SELECT COUNT(*) FROM raid_signups s WHERE s.raid_id = r.id AND s.status IN ('late', 'tentative', 'bench')) AS extra_count,
              (SELECT s.status FROM raid_signups s WHERE s.raid_id = r.id AND s.discord_id = ?) AS my_status
       FROM raids r LEFT JOIN users u ON u.discord_id = r.leader_discord_id
       WHERE COALESCE(r.starts_at, r.created_at) >= ? AND COALESCE(r.starts_at, r.created_at) < ?
       ORDER BY COALESCE(r.starts_at, r.created_at) ASC
       LIMIT 500`
    )
    .bind(discordId, fromIso, toIso)
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

// ---- Штрафи в рейді: окремі записи, підсумок гравця — їх сума ----

export async function listRaidPenaltyEntries(db, raidId) {
  const { results } = await db
    .prepare('SELECT * FROM raid_penalty_entries WHERE raid_id = ? ORDER BY created_at ASC, id ASC')
    .bind(raidId)
    .all();
  return results;
}

// Причини штрафів до софту — для пояснення гравцю, чому в нього менше софтів
// (штрафи до ролу на софти не впливають). Повтори: "Вайп рейду ×2".
export function softPenaltyReason(entries) {
  const counts = new Map();
  entries.filter((e) => e.soft_penalty > 0 && e.reason).forEach((e) => counts.set(e.reason, (counts.get(e.reason) || 0) + 1));
  return [...counts].map(([reason, n]) => (n > 1 ? `${reason} ×${n}` : reason)).join(', ');
}

// Учасники рейду з підсумком штрафів і списком записів (entries). Гравець зі
// штрафом, але без запису в raid_participants (штраф поставили до першого
// софту), теж потрапляє в список.
export async function getRaidParticipantsWithPenalties(db, raidId) {
  const [{ results: participants }, entries] = await Promise.all([
    db.prepare('SELECT player_name FROM raid_participants WHERE raid_id = ? ORDER BY joined_at ASC').bind(raidId).all(),
    listRaidPenaltyEntries(db, raidId)
  ]);
  const rows = new Map(participants.map(({ player_name }) => [player_name, {
    player_name, roll_penalty: 0, soft_penalty: 0, reason: '', entries: []
  }]));
  for (const entry of entries) {
    if (!rows.has(entry.player_name)) {
      rows.set(entry.player_name, { player_name: entry.player_name, roll_penalty: 0, soft_penalty: 0, reason: '', entries: [] });
    }
    const row = rows.get(entry.player_name);
    row.roll_penalty += entry.roll_penalty;
    row.soft_penalty += entry.soft_penalty;
    row.entries.push(entry);
  }
  for (const row of rows.values()) {
    row.reason = row.entries.map((e) => e.reason).filter(Boolean).join(', ');
    row.soft_reason = softPenaltyReason(row.entries);
    // Автозастосування зі Штрафбату не блокується лімітом — обрізаємо суму.
    row.roll_penalty = Math.min(MAX_ROLL_PENALTY, row.roll_penalty);
  }
  return [...rows.values()];
}

// Сума мінусів до ролу гравця (без обрізання) — для перевірки ліміту.
export async function sumRaidRollPenalty(db, raidId, playerName) {
  const row = await db
    .prepare('SELECT COALESCE(SUM(roll_penalty), 0) AS total FROM raid_penalty_entries WHERE raid_id = ? AND player_name = ?')
    .bind(raidId, playerName)
    .first();
  return row.total;
}

// Будь-яка зміна штрафів рейду оновлює raids.updated_at: сторінка рейду
// порівнює його при кожному оновленні й перечитує штрафи лише коли він
// змінився (рядок рейду читається й так — без зайвих читань D1).
function touchRaidStmt(db, raidId, ts) {
  return db.prepare('UPDATE raids SET updated_at = ? WHERE id = ?').bind(ts, raidId);
}

export async function addRaidPenaltyEntries(db, raidId, playerName, { templateId, boss, reason, rollPenalty, softPenalty }, count, createdBy) {
  const ts = nowIso();
  const stmt = db.prepare(
    `INSERT INTO raid_penalty_entries (raid_id, player_name, template_id, boss, reason, roll_penalty, soft_penalty, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  await db.batch([
    ...Array.from({ length: count }, () =>
      stmt.bind(raidId, playerName, templateId ?? null, boss ?? null, reason, rollPenalty, softPenalty, createdBy, ts)),
    touchRaidStmt(db, raidId, ts)
  ]);
}

export async function getRaidPenaltyEntry(db, raidId, entryId) {
  return db.prepare('SELECT * FROM raid_penalty_entries WHERE raid_id = ? AND id = ?').bind(raidId, entryId).first();
}

export async function deleteRaidPenaltyEntry(db, raidId, entryId) {
  await db.batch([
    db.prepare('DELETE FROM raid_penalty_entries WHERE raid_id = ? AND id = ?').bind(raidId, entryId),
    touchRaidStmt(db, raidId, nowIso())
  ]);
}

// ---- Шаблони штрафів ----

export async function listPenaltyTemplates(db) {
  const { results } = await db.prepare('SELECT * FROM penalty_templates ORDER BY id ASC').all();
  return results;
}

export async function getPenaltyTemplate(db, id) {
  return db.prepare('SELECT * FROM penalty_templates WHERE id = ?').bind(id).first();
}

export async function createPenaltyTemplate(db, { boss, reason, penaltyType, value, createdBy }) {
  const ts = nowIso();
  await db
    .prepare(
      `INSERT INTO penalty_templates (boss, reason, penalty_type, value, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(boss, reason, penaltyType, value, createdBy, ts, ts)
    .run();
}

export async function updatePenaltyTemplate(db, id, { boss, reason, penaltyType, value }) {
  await db
    .prepare('UPDATE penalty_templates SET boss = ?, reason = ?, penalty_type = ?, value = ?, updated_at = ? WHERE id = ?')
    .bind(boss, reason, penaltyType, value, nowIso(), id)
    .run();
}

export async function deletePenaltyTemplate(db, id) {
  await db.prepare('DELETE FROM penalty_templates WHERE id = ?').bind(id).run();
}

// ---- Штрафбат (відкладені штрафи, не прив'язані до конкретного рейду) ----

export async function listPenaltyBattalion(db) {
  const { results } = await db.prepare('SELECT * FROM penalty_battalion ORDER BY created_at DESC, id DESC').all();
  return results;
}

export async function addPenaltyBattalionEntries(db, { playerName, instance, templateId, boss, rollPenalty, softPenalty, reason, addedBy }, count) {
  const ts = nowIso();
  const stmt = db.prepare(
    `INSERT INTO penalty_battalion (player_name, instance, template_id, boss, roll_penalty, soft_penalty, reason, added_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  await db.batch(Array.from({ length: count }, () =>
    stmt.bind(playerName, instance, templateId, boss, rollPenalty, softPenalty, reason, addedBy, ts)));
}

// Суми відкладених мінусів гравця в інстансі: { roll, soft }.
export async function sumBattalionPenalties(db, playerName, instance) {
  return db
    .prepare('SELECT COALESCE(SUM(roll_penalty), 0) AS roll, COALESCE(SUM(soft_penalty), 0) AS soft FROM penalty_battalion WHERE player_name = ? AND instance = ?')
    .bind(playerName, instance)
    .first();
}

export async function getPenaltyBattalionEntry(db, id) {
  return db.prepare('SELECT * FROM penalty_battalion WHERE id = ?').bind(id).first();
}

// ---- Історія змін Штрафбату (шаблони + відкладені штрафи) ----

export async function insertPenaltyAudit(db, actorName, action, detail) {
  await db
    .prepare('INSERT INTO penalty_audit_log (actor_name, action, detail_json, created_at) VALUES (?, ?, ?, ?)')
    .bind(actorName, action, JSON.stringify(detail || {}), nowIso())
    .run();
}

export async function listPenaltyAudit(db, { from, to, actor, action } = {}, limit = 250) {
  const where = [];
  const binds = [];
  if (from) { where.push('created_at >= ?'); binds.push(from); }
  if (to) { where.push('created_at < ?'); binds.push(to); }
  if (actor) { where.push('actor_name = ?'); binds.push(actor); }
  if (action) { where.push('action = ?'); binds.push(action); }

  const sql = `SELECT * FROM penalty_audit_log${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT ?`;
  const { results } = await db.prepare(sql).bind(...binds, limit).all();
  return results;
}

export async function listPenaltyAuditActors(db) {
  const { results } = await db
    .prepare('SELECT DISTINCT actor_name FROM penalty_audit_log ORDER BY actor_name COLLATE NOCASE')
    .all();
  return results.map((r) => r.actor_name);
}

export async function deletePenaltyBattalionEntry(db, id) {
  await db.prepare('DELETE FROM penalty_battalion WHERE id = ?').bind(id).run();
}

// Відкладені штрафи гравця, що стосуються цього рейду: того ж інстансу і
// додані в Штрафбат не пізніше, ніж створено рейд. Штраф діє лише на майбутні
// рейди — у вже створений (навіть ще не початий) рейд він не потрапляє.
export async function findPenaltyBattalionEntries(db, playerName, raid) {
  const { results } = await db
    .prepare('SELECT * FROM penalty_battalion WHERE player_name = ? AND instance = ? AND created_at <= ? ORDER BY created_at ASC, id ASC')
    .bind(playerName, raid.instance, raid.created_at)
    .all();
  return results;
}

// Автозастосування відкладених штрафів: при першому софті (призначенні софту
// офіцером, передачі) гравця в рейді того ж інстансу всі його записи
// Штрафбату переходять у рейд і додаються до вже наявних штрафів.
export async function applyPenaltyBattalionIfMatched(db, raid, playerName) {
  const entries = await findPenaltyBattalionEntries(db, playerName, raid);
  if (!entries.length) return;

  for (const entry of entries) {
    await addRaidPenaltyEntries(db, raid.id, playerName, {
      templateId: entry.template_id,
      boss: entry.boss,
      reason: entry.reason || 'Штрафбат',
      rollPenalty: entry.roll_penalty,
      softPenalty: entry.soft_penalty
    }, 1, 'Штрафбат');
    await deletePenaltyBattalionEntry(db, entry.id);
    await insertPenaltyAudit(db, 'Автоматично', 'battalion_apply', {
      playerName,
      instance: entry.instance,
      boss: entry.boss,
      reason: entry.reason,
      rollPenalty: entry.roll_penalty,
      softPenalty: entry.soft_penalty,
      raidTitle: raid.title
    });
  }
  // Вкладка "Штрафи" будується від списку учасників, а він поповнюється лише
  // успішним софтом. Без цього рядка штраф, застосований при невдалій спробі
  // (напр. штраф дорівнює ліміту рейду - доступних софтів нуль), не побачив
  // би ні офіцер, ні сам гравець.
  await addRaidParticipant(db, raid.id, playerName);
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

export async function listRaidSoftPlayerNames(db, raidId) {
  const { results } = await db
    .prepare('SELECT DISTINCT player_name FROM soft_reserves WHERE raid_id = ?')
    .bind(raidId)
    .all();
  return results.map((r) => r.player_name);
}

export async function deleteReserveById(db, raidId, reserveId) {
  await db.prepare('DELETE FROM soft_reserves WHERE raid_id = ? AND id = ?').bind(raidId, reserveId).run();
}

// "Тільки Король-ліч": прибираємо софти на предмети, яких немає в луті Ліча.
// Каталогу луту у воркері немає — id предметів Ліча надсилає сторінка рейду.
export async function deleteReservesExceptItems(db, raidId, keepItemIds) {
  const placeholders = keepItemIds.map(() => '?').join(', ');
  const { meta } = await db
    .prepare(`DELETE FROM soft_reserves WHERE raid_id = ? AND item_id NOT IN (${placeholders})`)
    .bind(raidId, ...keepItemIds)
    .run();
  return meta.changes || 0;
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

export async function getSoftPenalty(db, raidId, playerName) {
  const row = await db
    .prepare('SELECT COALESCE(SUM(soft_penalty), 0) AS total FROM raid_penalty_entries WHERE raid_id = ? AND player_name = ?')
    .bind(raidId, playerName)
    .first();
  return row ? row.total : 0;
}

// Персональний ліміт ваги: базовий ліміт рейду мінус штраф гравця. Бонусна
// вага (передачі/гранти) сюди не входить — вона окремий пул із власним
// лімітом (див. handleUpdateBonusWeight).
export async function getEffectiveSoftLimit(db, raid, playerName) {
  const penalty = await getSoftPenalty(db, raid.id, playerName);
  return Math.max(0, raid.soft_limit_total - penalty);
}

export async function setReserveWeight(db, raidId, reserveId, weight) {
  await db
    .prepare('UPDATE soft_reserves SET weight = ?, updated_at = ? WHERE id = ? AND raid_id = ?')
    .bind(weight, nowIso(), reserveId, raidId)
    .run();
}

// Вирівнює вже поставлені софти під новий (зменшений) ліміт — коли офіцер
// виставив штраф уже після того, як гравець набрав вагу.
//
// Ріжемо вагу з кінця (найпізніші софти), а не видаляємо предмет цілком:
// weight має CHECK (weight IN (1,2,3)), тож коли вага впала б до нуля —
// софт видаляється. Завдяки цьому втрата дорівнює саме розміру штрафу, а
// не вазі випадково останнього предмета.
//
// Повертає список змін для аудиту: { itemId, boss, from, to } (to = 0 —
// софт видалено).
export async function enforceSoftPenaltyLimit(db, raid, playerName) {
  const limit = await getEffectiveSoftLimit(db, raid, playerName);
  const { results } = await db
    .prepare('SELECT * FROM soft_reserves WHERE raid_id = ? AND player_name = ? ORDER BY created_at ASC')
    .bind(raid.id, playerName)
    .all();

  let used = results.reduce((sum, r) => sum + (r.weight || 0), 0);
  const changes = [];

  for (let i = results.length - 1; i >= 0 && used > limit; i--) {
    const reserve = results[i];
    const from = reserve.weight || 0;
    const to = Math.max(0, from - (used - limit));

    if (to === 0) await deleteReserveById(db, raid.id, reserve.id);
    else await setReserveWeight(db, raid.id, reserve.id, to);

    used -= from - to;
    changes.push({ itemId: reserve.item_id, boss: reserve.boss, from, to });
  }

  return changes;
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

// Ім'я для навбара: основний персонаж, а якщо його не позначено — нік Discord.
export async function getUserDisplayName(db, discordId) {
  const row = await db
    .prepare(`SELECT ${displayNameSubquery('u')} AS name FROM users u WHERE u.discord_id = ?`)
    .bind(discordId)
    .first();
  return row?.name || null;
}

// Гучність звукових сповіщень за замовчуванням, %. Колонка в базі має
// DEFAULT 70 з міграції 0017 (у SQLite його не змінити без перебудови
// таблиці), тож новим користувачам значення пишемо явно.
export const DEFAULT_SOUND_VOLUME = 50;

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
      .prepare('INSERT INTO users (discord_id, username, avatar, character_name, sound_volume, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?)')
      .bind(discordId, username, avatar, DEFAULT_SOUND_VOLUME, ts, ts)
      .run();
  }

  return getUserByDiscordId(db, discordId);
}

// Родовий апдейт налаштувань профілю - той самий патерн, що
// updateRaidSettings: {колонка: значення} -> динамічний UPDATE.
export async function updateUserPreferences(db, discordId, fields) {
  const columns = Object.keys(fields);
  if (!columns.length) return getUserByDiscordId(db, discordId);

  const setClause = columns.map((col) => `${col} = ?`).join(', ');
  const values = columns.map((col) => fields[col]);

  await db
    .prepare(`UPDATE users SET ${setClause}, updated_at = ? WHERE discord_id = ?`)
    .bind(...values, nowIso(), discordId)
    .run();

  return getUserByDiscordId(db, discordId);
}

// Статистика фонів для адмін-панелі — лише агрегати, без жодних даних
// акаунтів. background NULL означає і "обрав стандартний", і "ще не
// обирав": обидва випадки зберігаються однаково (див. міграцію 0018).
// Для нестандартних фонів додаємо й імена (основний персонаж або username) —
// для "Стандартного" список був би на сотню людей і нікому не потрібен.
export async function countUsersByBackground(db) {
  const [{ results: counts }, { results: users }] = await db.batch([
    db.prepare('SELECT background, COUNT(*) AS count FROM users GROUP BY background'),
    db.prepare(
      `SELECT u.background AS background, ${displayNameSubquery('u')} AS name
       FROM users u
       WHERE u.background IS NOT NULL AND u.background <> 'default.jpg'`
    )
  ]);
  const namesByBackground = new Map();
  for (const { background, name } of users) {
    if (!namesByBackground.has(background)) namesByBackground.set(background, []);
    namesByBackground.get(background).push(name);
  }
  return counts.map((row) => ({
    ...row,
    names: (namesByBackground.get(row.background) || []).sort((a, b) => a.localeCompare(b))
  }));
}

// Те саме для теми сайту (users.theme; NULL - стандартна). Імена - лише для
// нестандартних тем, як і для фонів.
export async function countUsersByTheme(db) {
  const [{ results: counts }, { results: users }] = await db.batch([
    db.prepare('SELECT theme, COUNT(*) AS count FROM users GROUP BY theme'),
    db.prepare(`SELECT u.theme AS theme, ${displayNameSubquery('u')} AS name FROM users u WHERE u.theme IS NOT NULL`)
  ]);
  const namesByTheme = new Map();
  for (const { theme, name } of users) {
    if (!namesByTheme.has(theme)) namesByTheme.set(theme, []);
    namesByTheme.get(theme).push(name);
  }
  return counts.map((row) => ({
    ...row,
    names: (namesByTheme.get(row.theme) || []).sort((a, b) => a.localeCompare(b))
  }));
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

// КД героїчних рейдів персонажа: API-ключ -> колонка user_characters.
export const CHARACTER_COOLDOWN_COLUMNS = {
  icc10: 'cd_icc10',
  icc25: 'cd_icc25',
  rs10: 'cd_rs10',
  rs25: 'cd_rs25'
};

export async function listUserCharacters(db, discordId) {
  const { results } = await db
    .prepare(
      `SELECT character_name, is_primary, cd_icc10, cd_icc25, cd_rs10, cd_rs25, gear_score
       FROM user_characters WHERE discord_id = ? ORDER BY created_at ASC`
    )
    .bind(discordId)
    .all();
  return results.map((r) => ({
    characterName: r.character_name,
    isPrimary: Boolean(r.is_primary),
    cooldowns: Object.fromEntries(
      Object.entries(CHARACTER_COOLDOWN_COLUMNS).map(([key, col]) => [key, Boolean(r[col])])
    ),
    // У БД - десяті (65), назовні - число з одним знаком (6.5).
    gearScore: r.gear_score == null ? null : r.gear_score / 10
  }));
}

// fields: {колонка: значення}, колонки - лише з білого списку в роуті.
// Повертає null, якщо такого персонажа в цього акаунта немає.
export async function updateUserCharacter(db, discordId, characterName, fields) {
  const columns = Object.keys(fields);
  const setClause = columns.map((col) => `${col} = ?`).join(', ');
  const { meta } = await db
    .prepare(`UPDATE user_characters SET ${setClause} WHERE discord_id = ? AND character_name = ?`)
    .bind(...columns.map((col) => fields[col]), discordId, characterName)
    .run();
  if (!meta.changes) return null;
  return listUserCharacters(db, discordId);
}

// Офіцер з вкладки "Лог" рейду ставить/знімає КД списку персонажів. Імена
// з логу можуть відрізнятись регістром від збережених - звіряємо без
// регістру, як findCharacterClaim. column - лише з CHARACTER_COOLDOWN_COLUMNS.
// Повертає { updated: [збережені імена], missing: [імена без профілю] }.
export async function setCharacterCooldownsByNames(db, column, names, value) {
  if (!Object.values(CHARACTER_COOLDOWN_COLUMNS).includes(column)) throw new Error(`bad column ${column}`);
  const { results } = await db.prepare('SELECT discord_id, character_name FROM user_characters').all();
  const byLower = new Map(results.map((r) => [r.character_name.toLocaleLowerCase('uk'), r]));

  const updated = [];
  const missing = [];
  const statements = [];
  for (const name of names) {
    const row = byLower.get(name.toLocaleLowerCase('uk'));
    if (!row) {
      missing.push(name);
      continue;
    }
    updated.push(row.character_name);
    statements.push(
      db.prepare(`UPDATE user_characters SET ${column} = ? WHERE discord_id = ? AND character_name = ?`)
        .bind(value ? 1 : 0, row.discord_id, row.character_name)
    );
  }
  if (statements.length) await db.batch(statements);
  return { updated, missing };
}

// КД для перегляду (Рейтинг DPS -> "Гравець", лише залогіненим). Ключ
// відповіді - ім'я так, як його передали (без регістру при пошуку);
// персонажів без профілю у відповіді немає.
export async function getCooldownsByNames(db, names) {
  const { results } = await db
    .prepare('SELECT character_name, cd_icc10, cd_icc25, cd_rs10, cd_rs25 FROM user_characters')
    .all();
  const byLower = new Map(results.map((r) => [r.character_name.toLocaleLowerCase('uk'), r]));
  const out = {};
  for (const name of names) {
    const row = byLower.get(name.toLocaleLowerCase('uk'));
    if (!row) continue;
    out[name] = Object.fromEntries(
      Object.entries(CHARACTER_COOLDOWN_COLUMNS).map(([key, col]) => [key, Boolean(row[col])])
    );
  }
  return out;
}

// GearScore для перегляду (Рейтинг DPS -> "Гравець", усім залогіненим).
// Лише персонажі з проставленим GS; ключ - ім'я так, як його передали.
export async function getGearScoresByNames(db, names) {
  const { results } = await db
    .prepare('SELECT character_name, gear_score FROM user_characters WHERE gear_score IS NOT NULL')
    .all();
  const byLower = new Map(results.map((r) => [r.character_name.toLocaleLowerCase('uk'), r.gear_score]));
  const out = {};
  for (const name of names) {
    const tenths = byLower.get(name.toLocaleLowerCase('uk'));
    if (tenths != null) out[name] = tenths / 10;
  }
  return out;
}

// Щотижневе оновлення КД рейдів (cron, п'ятниця 04:00 за Києвом).
export async function resetCharacterCooldowns(db) {
  const { meta } = await db
    .prepare(
      `UPDATE user_characters SET cd_icc10 = 0, cd_icc25 = 0, cd_rs10 = 0, cd_rs25 = 0
       WHERE cd_icc10 = 1 OR cd_icc25 = 1 OR cd_rs10 = 1 OR cd_rs25 = 1`
    )
    .run();
  return meta.changes;
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
              ${displayNameSubquery('u')} AS display_name,
              ${charactersSubquery('u.discord_id')} AS characters
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

export async function isDefaultOfficer(db, discordId) {
  return Boolean(await db.prepare('SELECT 1 FROM default_officers WHERE discord_id = ?').bind(discordId).first());
}

export async function deleteRaid(db, raidId) {
  // raid_participants, raid_penalties і raid_penalty_entries не мають ON DELETE CASCADE
  // (заведені в 0005_add_penalties.sql без FK) — каскад на них не спрацює,
  // тому чистимо їх явно. Решта таблиць з raid_id мають коректний FK.
  await db.prepare('DELETE FROM raid_participants WHERE raid_id = ?').bind(raidId).run();
  await db.prepare('DELETE FROM raid_penalties WHERE raid_id = ?').bind(raidId).run();
  await db.prepare('DELETE FROM raid_penalty_entries WHERE raid_id = ?').bind(raidId).run();
  return db.prepare('DELETE FROM raids WHERE id = ?').bind(raidId).run();
}

export async function getRaidCountAndSize(db) {
  // .all() (не .first()) — лише він повертає meta.size_after, точний
  // поточний розмір D1-бази в байтах, без dbstat/PRAGMA/Cloudflare API.
  const { results, meta } = await db.prepare('SELECT COUNT(*) AS n FROM raids').all();
  return { count: results[0].n, sizeBytes: meta.size_after };
}

export async function pruneOldRaidsIfOverLimit(
  db,
  { thresholdBytes = 450_000_000, minRaidsToKeep = 20, maxDeletesPerRun = 10 } = {}
) {
  let { count: remaining, sizeBytes } = await getRaidCountAndSize(db);
  let deleted = 0;

  while (sizeBytes > thresholdBytes && remaining > minRaidsToKeep && deleted < maxDeletesPerRun) {
    const oldest = await db.prepare('SELECT id, title FROM raids ORDER BY created_at ASC LIMIT 1').first();
    if (!oldest) break;
    const result = await deleteRaid(db, oldest.id);
    deleted++;
    remaining--;
    sizeBytes = result.meta.size_after;
    console.log(`[prune] deleted raid ${oldest.id} ("${oldest.title}"); db=${sizeBytes}B; ${remaining} raids left`);
  }

  return { deleted, sizeBytes, remaining };
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

export async function listBonusGrants(db, raidId) {
  const { results } = await db
    .prepare('SELECT player_name, granted_by, amount, created_at FROM raid_bonus_grants WHERE raid_id = ? ORDER BY created_at ASC')
    .bind(raidId)
    .all();
  return results;
}

export async function getBonusGrant(db, raidId, playerName) {
  return db
    .prepare('SELECT player_name, granted_by, amount FROM raid_bonus_grants WHERE raid_id = ? AND player_name = ?')
    .bind(raidId, playerName)
    .first();
}

// Новий грант або зміна кількості в наявному. created_at при зміні не
// чіпаємо — це момент призначення (за ним сторінка рейду відрізняє новий
// грант від уже відомого).
export async function upsertBonusGrant(db, raidId, playerName, amount, grantedBy) {
  await db
    .prepare(
      `INSERT INTO raid_bonus_grants (raid_id, player_name, granted_by, amount, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (raid_id, player_name) DO UPDATE SET amount = excluded.amount, granted_by = excluded.granted_by`
    )
    .bind(raidId, playerName, grantedBy, amount, nowIso())
    .run();
}

export async function deleteBonusGrant(db, raidId, playerName) {
  await db
    .prepare('DELETE FROM raid_bonus_grants WHERE raid_id = ? AND player_name = ?')
    .bind(raidId, playerName)
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

// Скільки софтів дає передача: не більше за ліміт передачі, ліміт софтів
// рейду і власний ліміт донора з урахуванням його штрафу — передати можна
// лише те, що донор сам міг би засофтити. Ту саму формулу дублює фронт
// (transferBonusFor у raid-manager-detail.js).
export async function getTransferBonus(db, raid, fromPlayer) {
  const base = Math.min(raid.transfer_weight_limit ?? raid.soft_limit_total, raid.soft_limit_total);
  const donorLimit = await getEffectiveSoftLimit(db, raid, fromPlayer);
  return Math.max(0, Math.min(base, donorLimit));
}

// Бонусний пул гравця за джерелами: передача + грант офіцера (amount, 1-5).
export async function getBonusPool(db, raid, playerName) {
  const transfer = await getWeightTransferByTo(db, raid.id, playerName);
  const grant = await getBonusGrant(db, raid.id, playerName);
  return (transfer ? await getTransferBonus(db, raid, transfer.from_player) : 0) + (grant ? grant.amount : 0);
}

// Обрізає вже розподілену бонусну вагу під поточний пул (знизили ліміт
// софтів/передачі або оштрафували донора). Ріжемо з найпізніших софтів.
// Повертає { from, to } для аудиту або null, якщо обрізати не треба.
export async function enforceBonusPool(db, raid, playerName) {
  const pool = await getBonusPool(db, raid, playerName);
  const { results } = await db
    .prepare('SELECT id, bonus_weight FROM soft_reserves WHERE raid_id = ? AND player_name = ? AND bonus_weight > 0 ORDER BY created_at ASC')
    .bind(raid.id, playerName)
    .all();
  const total = results.reduce((sum, r) => sum + r.bonus_weight, 0);
  if (total <= pool) return null;

  let excess = total - pool;
  for (let i = results.length - 1; i >= 0 && excess > 0; i--) {
    const cut = Math.min(results[i].bonus_weight, excess);
    await db
      .prepare('UPDATE soft_reserves SET bonus_weight = bonus_weight - ?, updated_at = ? WHERE id = ? AND raid_id = ?')
      .bind(cut, nowIso(), results[i].id, raid.id)
      .run();
    excess -= cut;
  }
  return { from: total, to: pool };
}

// Те саме для всіх отримувачів бонусів рейду.
export async function enforceAllBonusPools(db, raid) {
  const { results } = await db
    .prepare(
      `SELECT to_player AS player_name FROM raid_weight_transfers WHERE raid_id = ?
       UNION SELECT player_name FROM raid_bonus_grants WHERE raid_id = ?`
    )
    .bind(raid.id, raid.id)
    .all();
  const changes = [];
  for (const { player_name: playerName } of results) {
    const change = await enforceBonusPool(db, raid, playerName);
    if (change) changes.push({ playerName, ...change });
  }
  return changes;
}

export async function updateReserveBonusWeight(db, raidId, reserveId, delta) {
  await db
    .prepare('UPDATE soft_reserves SET bonus_weight = bonus_weight + ?, updated_at = ? WHERE id = ? AND raid_id = ?')
    .bind(delta, nowIso(), reserveId, raidId)
    .run();
  return getReserveById(db, raidId, reserveId);
}

// ---- Черга на уламки і кров (гільдійна, не прив'язана до raid_id) ----

export async function listShardQueueDays(db) {
  const { results } = await db.prepare('SELECT * FROM shard_queue_days ORDER BY sort_order ASC').all();
  return results;
}

export async function getShardQueueDay(db, id) {
  return db.prepare('SELECT * FROM shard_queue_days WHERE id = ?').bind(id).first();
}

export async function createShardQueueDay(db, label) {
  const ts = nowIso();
  const row = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM shard_queue_days').first();
  const result = await db
    .prepare('INSERT INTO shard_queue_days (label, sort_order, is_active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)')
    .bind(label, row.maxOrder + 1, ts, ts)
    .run();
  return getShardQueueDay(db, result.meta.last_row_id);
}

// Частковий апдейт — рядок будується динамічно з переданих полів (той самий
// підхід, що updateRaidSettings). Той самий ендпоінт і для перейменування,
// і для анулювати/повернути (isActive true/false).
export async function updateShardQueueDay(db, id, { label, isActive } = {}) {
  const fields = [];
  const values = [];
  if (label !== undefined) {
    fields.push('label = ?');
    values.push(label);
  }
  if (isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(isActive ? 1 : 0);
  }
  if (!fields.length) return getShardQueueDay(db, id);

  await db
    .prepare(`UPDATE shard_queue_days SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`)
    .bind(...values, nowIso(), id)
    .run();
  return getShardQueueDay(db, id);
}

export async function listShardQueueEntries(db) {
  const { results } = await db
    .prepare('SELECT * FROM shard_queue_entries ORDER BY day_id ASC, resource_type ASC, priority_rank ASC')
    .all();
  return results;
}

export async function listShardQueueEntriesByDay(db, dayId) {
  const { results } = await db.prepare('SELECT * FROM shard_queue_entries WHERE day_id = ?').bind(dayId).all();
  return results;
}

export async function getShardQueueEntry(db, id) {
  return db.prepare('SELECT * FROM shard_queue_entries WHERE id = ?').bind(id).first();
}

// Для точного 409-повідомлення "вже в черзі"/"вже зібрав" перед тим, як
// покластись на сам UNIQUE-виняток (той лишається останньою страховкою).
export async function getShardQueueEntryByResource(db, resourceType, playerName) {
  return db
    .prepare('SELECT * FROM shard_queue_entries WHERE resource_type = ? AND player_name = ?')
    .bind(resourceType, playerName)
    .first();
}

async function nextShardQueueRank(db, dayId, resourceType) {
  const row = await db
    .prepare('SELECT COALESCE(MAX(priority_rank), -1) AS maxRank FROM shard_queue_entries WHERE day_id = ? AND resource_type = ?')
    .bind(dayId, resourceType)
    .first();
  return row.maxRank + 1;
}

export async function createShardQueueEntry(db, dayId, resourceType, playerName) {
  const ts = nowIso();
  const rank = await nextShardQueueRank(db, dayId, resourceType);
  const result = await db
    .prepare(
      `INSERT INTO shard_queue_entries (day_id, resource_type, player_name, priority_rank, progress, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    )
    .bind(dayId, resourceType, playerName, rank, ts, ts)
    .run();
  return getShardQueueEntry(db, result.meta.last_row_id);
}

export async function updateShardQueueProgress(db, id, progress) {
  await db
    .prepare('UPDATE shard_queue_entries SET progress = ?, updated_at = ? WHERE id = ?')
    .bind(progress, nowIso(), id)
    .run();
  return getShardQueueEntry(db, id);
}

// Своп рангу на "додати в кінець поточної групи день+ресурс" — для
// self-add/officer-add (нова стрічка) і для реактивації рядка з беклогу
// назад в активну чергу (стара позиція вже нерелевантна).
export async function appendShardQueueEntryToEnd(db, id) {
  const entry = await getShardQueueEntry(db, id);
  const rank = await nextShardQueueRank(db, entry.day_id, entry.resource_type);
  await db
    .prepare('UPDATE shard_queue_entries SET priority_rank = ?, updated_at = ? WHERE id = ?')
    .bind(rank, nowIso(), id)
    .run();
  return getShardQueueEntry(db, id);
}

// Переносить рядок на інший день, завжди в кінець черги дня-призначення.
export async function moveShardQueueEntryDay(db, id, newDayId) {
  await db.prepare('UPDATE shard_queue_entries SET day_id = ?, updated_at = ? WHERE id = ?').bind(newDayId, nowIso(), id).run();
  return appendShardQueueEntryToEnd(db, id);
}

// Для drag-and-drop — приймає повний упорядкований масив id активних рядків
// однієї групи день+ресурс, rank = позиція в масиві.
export async function reorderShardQueueEntries(db, orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db.prepare('UPDATE shard_queue_entries SET priority_rank = ?, updated_at = ? WHERE id = ?').bind(index, nowIso(), id).run()
    )
  );
}

export async function deleteShardQueueEntry(db, id) {
  await db.prepare('DELETE FROM shard_queue_entries WHERE id = ?').bind(id).run();
}

export async function insertShardQueueAudit(db, actorName, action, detail) {
  await db
    .prepare('INSERT INTO shard_queue_audit_log (actor_name, action, detail_json, created_at) VALUES (?, ?, ?, ?)')
    .bind(actorName, action, JSON.stringify(detail || {}), nowIso())
    .run();
}

export async function listShardQueueAudit(db, limit = 250) {
  const { results } = await db
    .prepare('SELECT * FROM shard_queue_audit_log ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all();
  return results;
}

// ---- Черга на посилення (гільдійна, не прив'язана до raid_id) ----
// Та сама жива черга, що й на уламки, але черга окрема на кожну трійку
// "день + бос + тип посилення" (див. migrations/0019_buff_queue.sql).

export async function listBuffQueueDays(db) {
  const { results } = await db.prepare('SELECT * FROM buff_queue_days ORDER BY sort_order ASC').all();
  return results;
}

export async function getBuffQueueDay(db, id) {
  return db.prepare('SELECT * FROM buff_queue_days WHERE id = ?').bind(id).first();
}

export async function createBuffQueueDay(db, label) {
  const ts = nowIso();
  const row = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM buff_queue_days').first();
  const result = await db
    .prepare('INSERT INTO buff_queue_days (label, sort_order, is_active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)')
    .bind(label, row.maxOrder + 1, ts, ts)
    .run();
  return getBuffQueueDay(db, result.meta.last_row_id);
}

// Спільний частковий апдейт для днів і типів посилень: обидві таблиці мають
// однакові поля label/is_active. Ім'я таблиці приходить лише з коду нижче,
// не від користувача.
async function updateLabelActiveRow(db, table, id, { label, isActive } = {}) {
  const fields = [];
  const values = [];
  if (label !== undefined) {
    fields.push('label = ?');
    values.push(label);
  }
  if (isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(isActive ? 1 : 0);
  }
  if (fields.length) {
    await db
      .prepare(`UPDATE ${table} SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`)
      .bind(...values, nowIso(), id)
      .run();
  }
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
}

export async function updateBuffQueueDay(db, id, fields) {
  return updateLabelActiveRow(db, 'buff_queue_days', id, fields);
}

export async function listBuffQueueTypes(db) {
  const { results } = await db.prepare('SELECT * FROM buff_queue_types ORDER BY sort_order ASC').all();
  return results;
}

export async function getBuffQueueType(db, id) {
  return db.prepare('SELECT * FROM buff_queue_types WHERE id = ?').bind(id).first();
}

export async function createBuffQueueType(db, label) {
  const ts = nowIso();
  const row = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM buff_queue_types').first();
  const result = await db
    .prepare('INSERT INTO buff_queue_types (label, sort_order, is_active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)')
    .bind(label, row.maxOrder + 1, ts, ts)
    .run();
  return getBuffQueueType(db, result.meta.last_row_id);
}

export async function updateBuffQueueType(db, id, fields) {
  return updateLabelActiveRow(db, 'buff_queue_types', id, fields);
}

export async function listBuffQueueBosses(db) {
  const { results } = await db.prepare('SELECT * FROM buff_queue_bosses ORDER BY sort_order ASC').all();
  return results;
}

export async function getBuffQueueBoss(db, boss) {
  return db.prepare('SELECT * FROM buff_queue_bosses WHERE boss = ?').bind(boss).first();
}

export async function setBuffQueueBossActive(db, boss, isActive) {
  await db
    .prepare('UPDATE buff_queue_bosses SET is_active = ?, updated_at = ? WHERE boss = ?')
    .bind(isActive ? 1 : 0, nowIso(), boss)
    .run();
  return getBuffQueueBoss(db, boss);
}

export async function listBuffQueueEntries(db) {
  const { results } = await db
    .prepare('SELECT * FROM buff_queue_entries ORDER BY day_id ASC, boss ASC, buff_type_id ASC, priority_rank ASC')
    .all();
  return results;
}

// Лише невиконані записи (без архіву) і без ORDER BY — для snapshot сторінки
// рейду, що сортує сам: сортування в SQL подвоювало rows_read у D1.
export async function listActiveBuffQueueEntries(db) {
  const { results } = await db.prepare("SELECT * FROM buff_queue_entries WHERE status <> 'done'").all();
  return results;
}

export async function getBuffQueueEntry(db, id) {
  return db.prepare('SELECT * FROM buff_queue_entries WHERE id = ?').bind(id).first();
}

// Невиконаний запис гравця на "бос + посилення" на будь-який день — для
// точного 409 "уже в черзі, день X" до того, як спрацює частковий
// UNIQUE-індекс (той лишається останньою страховкою від гонки запитів).
export async function findActiveBuffQueueEntry(db, playerName, boss, buffTypeId) {
  return db
    .prepare("SELECT * FROM buff_queue_entries WHERE player_name = ? AND boss = ? AND buff_type_id = ? AND status <> 'done'")
    .bind(playerName, boss, buffTypeId)
    .first();
}

// Чи лишились у дня/типу/боса невиконані записи — щоб не приховати те, на
// що люди ще стоять у черзі. column приходить лише з коду нижче.
async function hasActiveBuffQueueEntries(db, column, value) {
  const row = await db
    .prepare(`SELECT 1 FROM buff_queue_entries WHERE ${column} = ? AND status <> 'done' LIMIT 1`)
    .bind(value)
    .first();
  return Boolean(row);
}

export function buffQueueDayHasActiveEntries(db, dayId) {
  return hasActiveBuffQueueEntries(db, 'day_id', dayId);
}

export function buffQueueTypeHasActiveEntries(db, buffTypeId) {
  return hasActiveBuffQueueEntries(db, 'buff_type_id', buffTypeId);
}

export function buffQueueBossHasActiveEntries(db, boss) {
  return hasActiveBuffQueueEntries(db, 'boss', boss);
}

async function nextBuffQueueRank(db, dayId, boss, buffTypeId) {
  const row = await db
    .prepare(
      `SELECT COALESCE(MAX(priority_rank), -1) AS maxRank FROM buff_queue_entries
       WHERE day_id = ? AND boss = ? AND buff_type_id = ? AND status <> 'done'`
    )
    .bind(dayId, boss, buffTypeId)
    .first();
  return row.maxRank + 1;
}

export async function createBuffQueueEntry(db, { dayId, boss, buffTypeId, playerName }) {
  const ts = nowIso();
  const rank = await nextBuffQueueRank(db, dayId, boss, buffTypeId);
  const result = await db
    .prepare(
      `INSERT INTO buff_queue_entries (day_id, boss, buff_type_id, player_name, status, priority_rank, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'waiting', ?, ?, ?)`
    )
    .bind(dayId, boss, buffTypeId, playerName, rank, ts, ts)
    .run();
  return getBuffQueueEntry(db, result.meta.last_row_id);
}

// done_at пишемо лише при переході в done: вкладка "Архів" сортується й
// показує саме цю дату, а updated_at міг би змінитись пізніше.
export async function setBuffQueueEntryStatus(db, id, status) {
  const ts = nowIso();
  await db
    .prepare('UPDATE buff_queue_entries SET status = ?, updated_at = ?, done_at = ? WHERE id = ?')
    .bind(status, ts, status === 'done' ? ts : null, id)
    .run();
  return getBuffQueueEntry(db, id);
}

// Перенос на інший день — завжди в кінець черги дня-призначення (та сама
// поведінка, що в черзі на уламки).
export async function moveBuffQueueEntryDay(db, id, newDayId) {
  const entry = await getBuffQueueEntry(db, id);
  const rank = await nextBuffQueueRank(db, newDayId, entry.boss, entry.buff_type_id);
  await db
    .prepare('UPDATE buff_queue_entries SET day_id = ?, priority_rank = ?, updated_at = ? WHERE id = ?')
    .bind(newDayId, rank, nowIso(), id)
    .run();
  return getBuffQueueEntry(db, id);
}

export async function reorderBuffQueueEntries(db, orderedIds) {
  const ts = nowIso();
  await Promise.all(
    orderedIds.map((id, index) =>
      db.prepare('UPDATE buff_queue_entries SET priority_rank = ?, updated_at = ? WHERE id = ?').bind(index, ts, id).run()
    )
  );
}

export async function deleteBuffQueueEntry(db, id) {
  await db.prepare('DELETE FROM buff_queue_entries WHERE id = ?').bind(id).run();
}

export async function insertBuffQueueAudit(db, actorName, action, detail) {
  await db
    .prepare('INSERT INTO buff_queue_audit_log (actor_name, action, detail_json, created_at) VALUES (?, ?, ?, ?)')
    .bind(actorName, action, JSON.stringify(detail || {}), nowIso())
    .run();
}

// Фільтри необов'язкові. from/to — ISO-моменти (межі доби за Києвом рахує
// фронт), порівнюються як рядки: created_at теж ISO в UTC. actions —
// масив action; statusTo додатково звужує status_update до переходу "в ...".
export async function listBuffQueueAudit(db, { from, to, actor, actions, statusTo } = {}, limit = 250) {
  const where = [];
  const binds = [];
  if (from) { where.push('created_at >= ?'); binds.push(from); }
  if (to) { where.push('created_at < ?'); binds.push(to); }
  if (actor) { where.push('actor_name = ?'); binds.push(actor); }
  if (actions?.length) {
    where.push(`action IN (${actions.map(() => '?').join(', ')})`);
    binds.push(...actions);
  }
  if (statusTo) { where.push("json_extract(detail_json, '$.to') = ?"); binds.push(statusTo); }

  const sql = `SELECT * FROM buff_queue_audit_log${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`;
  const { results } = await db.prepare(sql).bind(...binds, limit).all();
  return results;
}

export async function listBuffQueueAuditActors(db) {
  const { results } = await db
    .prepare('SELECT DISTINCT actor_name FROM buff_queue_audit_log ORDER BY actor_name COLLATE NOCASE')
    .all();
  return results.map((r) => r.actor_name);
}


// ---- Попередній запис на рейд (raid_signups) ----
// Кожна зміна "торкає" raids.updated_at - поллінг сторінки рейду бачить це й
// перечитує список записаних.

export async function listRaidSignups(db, raidId) {
  const { results } = await db
    .prepare(
      `SELECT s.id, s.discord_id, s.discord_name, s.character_name, s.class, s.spec, s.status, s.position,
              s.source, s.created_at, s.updated_at, ${displayNameSubquery('u')} AS owner_display_name
       FROM raid_signups s LEFT JOIN users u ON u.discord_id = s.discord_id
       WHERE s.raid_id = ?
       ORDER BY s.position ASC`
    )
    .bind(raidId)
    .all();
  return results;
}

// Свій запис: новий - номер max+1; зміна - номер лишається (preserve_order).
export async function upsertOwnSignup(db, raidId, discordId, { characterName, cls, spec, status }) {
  const ts = nowIso();
  await db.batch([
    db.prepare(
      `INSERT INTO raid_signups (raid_id, discord_id, character_name, class, spec, status, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM raid_signups WHERE raid_id = ?), ?, ?)
       ON CONFLICT (raid_id, discord_id) DO UPDATE SET
         character_name = excluded.character_name, class = excluded.class, spec = excluded.spec,
         status = excluded.status, updated_at = excluded.updated_at`
    ).bind(raidId, discordId, characterName, cls, spec, status, raidId, ts, ts),
    touchRaidStmt(db, raidId, ts)
  ]);
}

export async function deleteOwnSignup(db, raidId, discordId) {
  const ts = nowIso();
  await db.batch([
    db.prepare('DELETE FROM raid_signups WHERE raid_id = ? AND discord_id = ?').bind(raidId, discordId),
    touchRaidStmt(db, raidId, ts)
  ]);
}

export async function getRaidSignup(db, raidId, signupId) {
  return db.prepare('SELECT * FROM raid_signups WHERE raid_id = ? AND id = ?').bind(raidId, signupId).first();
}

export async function setSignupStatus(db, raidId, signupId, status) {
  const ts = nowIso();
  await db.batch([
    db.prepare('UPDATE raid_signups SET status = ?, updated_at = ? WHERE raid_id = ? AND id = ?').bind(status, ts, raidId, signupId),
    touchRaidStmt(db, raidId, ts)
  ]);
}

export async function deleteSignupById(db, raidId, signupId) {
  const ts = nowIso();
  await db.batch([
    db.prepare('DELETE FROM raid_signups WHERE raid_id = ? AND id = ?').bind(raidId, signupId),
    touchRaidStmt(db, raidId, ts)
  ]);
}

// ---- Синхронізація з Raid-Helper ----

// Персонажі гравців (Map discordId -> [імена]) - підбір персонажа за ніком у
// Discord для записів з Raid-Helper.
export async function listCharacterNamesByDiscordIds(db, discordIds) {
  const map = new Map();
  if (!discordIds.length) return map;
  const { results } = await db.prepare(
    'SELECT discord_id, character_name FROM user_characters WHERE discord_id IN (SELECT value FROM json_each(?))'
  ).bind(JSON.stringify(discordIds)).all();
  results.forEach((r) => {
    if (!map.has(r.discord_id)) map.set(r.discord_id, []);
    map.get(r.discord_id).push(r.character_name);
  });
  return map;
}

// Персонажі записаних на рейд гравців: GS (тисячі, 6.4) і КД цього рейду
// (cdColumn - одна з CHARACTER_COOLDOWN_COLUMNS або null). Для підказки над
// записом у вкладці "Попередній запис".
export async function listSignupCharacters(db, raidId, cdColumn) {
  const cd = cdColumn ? `c.${cdColumn}` : 'NULL';
  const { results } = await db.prepare(
    `SELECT c.discord_id, c.character_name, c.gear_score, ${cd} AS cd
     FROM user_characters c
     WHERE c.discord_id IN (SELECT discord_id FROM raid_signups WHERE raid_id = ?)`
  ).bind(raidId).all();
  const out = {};
  results.forEach((r) => {
    (out[r.discord_id] ||= []).push({
      name: r.character_name,
      gs: r.gear_score == null ? null : r.gear_score / 10,
      cd: r.cd == null ? null : Boolean(r.cd)
    });
  });
  return out;
}

export async function listSignupRows(db, raidId) {
  const { results } = await db.prepare('SELECT * FROM raid_signups WHERE raid_id = ?').bind(raidId).all();
  return results;
}

// Застосувати знімок з Raid-Helper: upserts - рядки { discordId, discordName,
// characterName, cls, spec, status, position, externalId, source }, deleteIds -
// id локальних записів, яких у Raid-Helper уже немає. Рейд "торкається" лише
// якщо щось змінилось (інакше поллінг сторінки перечитував би записи щоразу).
export async function applySignupSync(db, raidId, { upserts, deleteIds }) {
  const ts = nowIso();
  const stmts = upserts.map((u) => db.prepare(
    `INSERT INTO raid_signups (raid_id, discord_id, discord_name, character_name, class, spec, status, position, source, external_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (raid_id, discord_id) DO UPDATE SET
       discord_name = excluded.discord_name, character_name = excluded.character_name,
       class = excluded.class, spec = excluded.spec, status = excluded.status,
       position = excluded.position, external_id = excluded.external_id, updated_at = excluded.updated_at`
  ).bind(raidId, u.discordId, u.discordName, u.characterName, u.cls, u.spec, u.status, u.position, u.source, u.externalId, ts, ts));
  deleteIds.forEach((id) => stmts.push(db.prepare('DELETE FROM raid_signups WHERE raid_id = ? AND id = ?').bind(raidId, id)));
  if (!stmts.length) return;
  stmts.push(touchRaidStmt(db, raidId, ts));
  await db.batch(stmts);
}

// Персонаж/клас/спек, обрані на сайті, - Raid-Helper персонажів не знає.
export async function setSignupSiteFields(db, raidId, discordId, { characterName, cls, spec }) {
  const ts = nowIso();
  await db.batch([
    db.prepare(
      'UPDATE raid_signups SET character_name = ?, class = ?, spec = ?, updated_at = ? WHERE raid_id = ? AND discord_id = ?'
    ).bind(characterName, cls, spec, ts, raidId, discordId),
    touchRaidStmt(db, raidId, ts)
  ]);
}

export async function setRaidHelperLink(db, raidId, eventId) {
  await db.prepare(
    'UPDATE raids SET rh_event_id = ?, rh_synced_at = NULL, rh_sync_error = NULL, updated_at = ? WHERE id = ?'
  ).bind(eventId, nowIso(), raidId).run();
}

// Стан синхронізації без "торкання" рейду - лише текст помилки, коли він
// змінюється, торкає (щоб сторінка показала/прибрала попередження).
export async function setRaidSyncState(db, raidId, { synced, error }) {
  const ts = nowIso();
  if (synced) {
    await db.prepare(
      `UPDATE raids SET rh_synced_at = ?, rh_sync_error = NULL,
         updated_at = CASE WHEN rh_sync_error IS NULL THEN updated_at ELSE ? END
       WHERE id = ?`
    ).bind(ts, ts, raidId).run();
  } else {
    await db.prepare(
      `UPDATE raids SET rh_sync_error = ?,
         updated_at = CASE WHEN rh_sync_error IS ? THEN updated_at ELSE ? END
       WHERE id = ?`
    ).bind(error, error, ts, raidId).run();
  }
}

// Назва/дата змінились у Discord - переносимо на сайт.
export async function updateRaidFromRaidHelper(db, raidId, { title, startsAt }) {
  await db.prepare('UPDATE raids SET title = ?, starts_at = ?, updated_at = ? WHERE id = ?')
    .bind(title, startsAt, nowIso(), raidId).run();
}

// Рейд видалили в Discord: рейд на сайті лишається (софти, лут), лише
// відв'язується з позначкою.
export async function markRaidHelperEventDeleted(db, raidId) {
  await db.prepare(
    "UPDATE raids SET rh_event_id = NULL, rh_synced_at = NULL, rh_sync_error = 'Рейд видалено в Discord', updated_at = ? WHERE id = ?"
  ).bind(nowIso(), raidId).run();
}

// Рейди Raid-Helper, які імпорт пропускає: уже прив'язані + відв'язані офіцером.
export async function listLinkedRhEventIds(db) {
  const { results } = await db.prepare(
    'SELECT rh_event_id AS id FROM raids WHERE rh_event_id IS NOT NULL UNION SELECT event_id FROM rh_ignored_events'
  ).all();
  return new Set(results.map((r) => r.id));
}

export async function ignoreRhEvent(db, eventId) {
  await db.prepare('INSERT OR IGNORE INTO rh_ignored_events (event_id, created_at) VALUES (?, ?)').bind(eventId, nowIso()).run();
}

export async function unignoreRhEvent(db, eventId) {
  await db.prepare('DELETE FROM rh_ignored_events WHERE event_id = ?').bind(eventId).run();
}

// Нерозпізнані рейди з Discord - повна заміна списку (cron).
export async function replaceUnmatchedEvents(db, events) {
  const ts = nowIso();
  const stmts = [db.prepare('DELETE FROM rh_unmatched_events')];
  events.forEach((e) => stmts.push(db.prepare(
    'INSERT INTO rh_unmatched_events (event_id, title, channel_name, starts_at, seen_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(e.eventId, e.title, e.channelName, e.startsAt, ts)));
  await db.batch(stmts);
}

export async function listUnmatchedEvents(db) {
  const { results } = await db.prepare('SELECT * FROM rh_unmatched_events ORDER BY starts_at ASC').all();
  return results;
}

export async function deleteUnmatchedEvent(db, eventId) {
  await db.prepare('DELETE FROM rh_unmatched_events WHERE event_id = ?').bind(eventId).run();
}

export async function findRaidByRhEventId(db, eventId) {
  return db.prepare('SELECT id, title FROM raids WHERE rh_event_id = ?').bind(eventId).first();
}

// Рейди для фонової синхронізації: прив'язані, не завершені, з початком у
// вікні [from, to].
export async function listRaidsToSync(db, fromIso, toIso) {
  const { results } = await db.prepare(
    `SELECT * FROM raids
     WHERE rh_event_id IS NOT NULL AND status != 'completed'
       AND COALESCE(starts_at, created_at) BETWEEN ? AND ?`
  ).bind(fromIso, toIso).all();
  return results;
}
