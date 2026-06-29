function nowIso() {
  return new Date().toISOString();
}

export async function createRaid(db, { id, title, instance, difficulty, softLimitTotal, softLimitItems, allowDuplicateSoft, officerToken }) {
  const ts = nowIso();
  await db
    .prepare(
      `INSERT INTO raids (id, title, instance, difficulty, soft_limit_total, soft_limit_items, allow_duplicate_soft, is_locked, officer_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    )
    .bind(id, title, instance, difficulty, softLimitTotal, softLimitItems, allowDuplicateSoft ? 1 : 0, officerToken, ts, ts)
    .run();
  return getRaid(db, id);
}

export async function listRaids(db, limit = 50) {
  const { results } = await db
    .prepare('SELECT id, title, instance, difficulty, is_locked, created_at FROM raids ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all();
  return results;
}

export async function getRaid(db, id) {
  return db.prepare('SELECT * FROM raids WHERE id = ?').bind(id).first();
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

export async function createReserve(db, { raidId, playerName, itemId, boss, weight, assignedByOfficer }) {
  const ts = nowIso();
  const result = await db
    .prepare(
      `INSERT INTO soft_reserves (raid_id, player_name, item_id, boss, weight, is_received, assigned_by_officer, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
    )
    .bind(raidId, playerName, itemId, boss, weight, assignedByOfficer ? 1 : 0, ts, ts)
    .run();
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
    .prepare('SELECT COALESCE(SUM(weight), 0) AS total, COUNT(*) AS items FROM soft_reserves WHERE raid_id = ? AND player_name = ?')
    .bind(raidId, playerName)
    .first();
  return { totalWeight: row.total, itemCount: row.items };
}

export async function getItemReservers(db, raidId, itemId) {
  const { results } = await db
    .prepare('SELECT player_name FROM soft_reserves WHERE raid_id = ? AND item_id = ?')
    .bind(raidId, itemId)
    .all();
  return results.map((r) => r.player_name);
}

export async function getClaimToken(db, raidId, playerName) {
  return db.prepare('SELECT * FROM claim_tokens WHERE raid_id = ? AND player_name = ?').bind(raidId, playerName).first();
}

export async function createClaimToken(db, raidId, playerName, token) {
  await db
    .prepare('INSERT INTO claim_tokens (raid_id, player_name, token, created_at) VALUES (?, ?, ?, ?)')
    .bind(raidId, playerName, token, nowIso())
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
