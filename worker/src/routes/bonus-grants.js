import { HttpError, jsonResponse, readJson, capitalizeName } from '../util.js';
import {
  getRaid,
  listBonusGrants,
  getBonusGrant,
  upsertBonusGrant,
  deleteBonusGrant,
  enforceBonusPool,
  insertAudit
} from '../db.js';
import { requireRaidOfficer } from '../auth.js';

const MAX_BONUS_GRANT = 5;

async function loadRaidOr404(env, raidId) {
  const raid = await getRaid(env.DB, raidId);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');
  return raid;
}

export async function handleListBonusGrants(request, env, raidId) {
  await loadRaidOr404(env, raidId);
  return jsonResponse(await listBonusGrants(env.DB, raidId));
}

// Призначення або зміна кількості бонусних софтів (1-5). Без amount — 1,
// як було до появи кількості.
export async function handleCreateBonusGrant(request, env, raidId, session) {
  const raid = await loadRaidOr404(env, raidId);
  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено');

  await requireRaidOfficer(env.DB, raidId, raid, session);

  const body = await readJson(request);
  const playerName = capitalizeName(String(body.playerName || '').trim());
  if (!playerName) throw new HttpError(400, "Потрібне ім'я гравця");
  const amount = body.amount === undefined ? 1 : Number(body.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_BONUS_GRANT) {
    throw new HttpError(400, `Кількість бонусних софтів — від 1 до ${MAX_BONUS_GRANT}`);
  }

  const existing = await getBonusGrant(env.DB, raidId, playerName);
  if (existing?.amount === amount) return jsonResponse({ playerName, amount });

  await upsertBonusGrant(env.DB, raidId, playerName, amount, session.username);
  if (existing) {
    await insertAudit(env.DB, raidId, session.username, 'bonus_grant_change', { playerName, from: existing.amount, to: amount });
    // Зменшили нижче вже розподіленого — зайве зрізаємо з найпізніших софтів.
    const trim = await enforceBonusPool(env.DB, raid, playerName);
    if (trim) await insertAudit(env.DB, raidId, session.username, 'bonus_trim', { playerName, ...trim });
  } else {
    await insertAudit(env.DB, raidId, session.username, 'bonus_grant', { playerName, amount });
  }

  return jsonResponse({ playerName, amount }, existing ? 200 : 201);
}

export async function handleDeleteBonusGrant(request, env, raidId, playerName, session) {
  const raid = await loadRaidOr404(env, raidId);
  if (raid.status === 'completed') throw new HttpError(423, 'Рейд завершено');

  await requireRaidOfficer(env.DB, raidId, raid, session);

  await deleteBonusGrant(env.DB, raidId, playerName);
  await insertAudit(env.DB, raidId, session.username, 'bonus_grant_cancel', { playerName });
  // Зрізаємо лише надлишок понад новий пул: бонус від переданих софтів,
  // якщо гравець їх отримав, лишається.
  const trim = await enforceBonusPool(env.DB, raid, playerName);
  if (trim) await insertAudit(env.DB, raidId, session.username, 'bonus_trim', { playerName, ...trim });

  return jsonResponse({ ok: true });
}
