// Розіграш призів у рейді.
//
// Офіцер рейду запускає розіграш: список призів (кожен - окремий раунд),
// умови участі й тривалість раунду. Гравці, що пройшли умови, тиснуть
// "Кинути" - число 1-100 кидає сервер (crypto), клієнт лише анімує. Найвищий
// рол у раунді виграє приз; нічия на першому місці - приховане перекидання
// між тими, хто зрівнявся (як у WoW). Один гравець може виграти кілька
// призів.
//
// Окремого таймера немає: раунд закривається першим запитом після ends_at
// (advanceGiveaway), тому всі переходи - умовні UPDATE ... WHERE status = ?,
// і паралельні запити не визначать двох переможців.

import { HttpError, jsonResponse, readJson } from './util.js';
import { insertAudit, getUserDisplayName } from './db.js';
import { isRaidOfficer, requireRaidOfficer } from './auth.js';
import { GIVEAWAY_PRIZE_CATEGORIES, GIVEAWAY_PRIZES_BY_ID } from './giveaway-prizes.js';

export const GIVEAWAY_ROUND_SECONDS = [20, 30, 60];
// Відлік до старту раунду (анонс). Про новий розіграш сторінка дізнається
// зі snapshot (раз на 20 с), тож хто відкрив її раніше, може побачити
// перший раунд уже після старту - так вирішено (2026-11-15).
const FIRST_ROUND_LEAD_MS = 10000;
const NEXT_ROUND_LEAD_MS = 10000;
const MAX_ROUNDS = 50;
const MAX_QUANTITY = 20;
const MAX_GOLD = 10000;
const CRITERIA_KEYS = ['signup', 'gearScore', 'softs', 'noPenalties'];

function nowIso(ms = Date.now()) {
  return new Date(ms).toISOString();
}

// Рівномірне 1..100 без зсуву по модулю.
function rollD100() {
  const limit = Math.floor(0x100000000 / 100) * 100;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return (buf[0] % 100) + 1;
}

function lower(name) {
  return String(name || '').toLocaleLowerCase('uk');
}

// ---------- читання ----------

async function getLatestGiveaway(db, raidId) {
  return db.prepare('SELECT * FROM raid_giveaways WHERE raid_id = ? ORDER BY id DESC LIMIT 1').bind(raidId).first();
}

async function getGiveaway(db, raidId, giveawayId) {
  return db.prepare('SELECT * FROM raid_giveaways WHERE raid_id = ? AND id = ?').bind(raidId, giveawayId).first();
}

async function listRounds(db, giveawayId) {
  const { results } = await db
    .prepare('SELECT * FROM raid_giveaway_rounds WHERE giveaway_id = ? ORDER BY position ASC, id ASC')
    .bind(giveawayId)
    .all();
  return results;
}

async function listRolls(db, giveawayId) {
  const { results } = await db
    .prepare(
      `SELECT r.* FROM raid_giveaway_rolls r
       JOIN raid_giveaway_rounds g ON g.id = r.round_id
       WHERE g.giveaway_id = ? ORDER BY r.created_at ASC`
    )
    .bind(giveawayId)
    .all();
  return results;
}

// Для snapshot сторінки рейду: лише id і статус останнього розіграшу - щоб
// сторінка знала, коли вмикати часте оновлення.
export async function getGiveawaySummary(db, raidId) {
  const row = await db
    .prepare('SELECT id, status FROM raid_giveaways WHERE raid_id = ? ORDER BY id DESC LIMIT 1')
    .bind(raidId)
    .first();
  return row ? { id: row.id, status: row.status } : null;
}

// ---------- перехід раундів ----------

// Закриває раунд, що вже скінчився: переможець - найвищий рол; нічия на
// першому місці - перекидання (tie_roll) між тими, хто зрівнявся, доки не
// буде одного найвищого. Ніхто не кинув - раунд "void".
async function resolveRound(db, round) {
  const { results: rolls } = await db
    .prepare('SELECT * FROM raid_giveaway_rolls WHERE round_id = ?')
    .bind(round.id)
    .all();
  if (!rolls.length) {
    await db.prepare("UPDATE raid_giveaway_rounds SET status = 'void' WHERE id = ? AND status = 'active'").bind(round.id).run();
    return;
  }
  const top = Math.max(...rolls.map((r) => r.roll));
  let contenders = rolls.filter((r) => r.roll === top);
  const tieRolls = new Map();
  while (contenders.length > 1) {
    contenders.forEach((r) => tieRolls.set(r.discord_id, rollD100()));
    const best = Math.max(...contenders.map((r) => tieRolls.get(r.discord_id)));
    contenders = contenders.filter((r) => tieRolls.get(r.discord_id) === best);
  }
  const winner = contenders[0];
  const { meta } = await db
    .prepare(
      `UPDATE raid_giveaway_rounds SET status = 'done', winner_discord_id = ?, winner_name = ?, winner_roll = ?
       WHERE id = ? AND status = 'active'`
    )
    .bind(winner.discord_id, winner.player_name, winner.roll, round.id)
    .run();
  // Інший запит уже закрив раунд - його перекидання й лишаються.
  if (!meta.changes || !tieRolls.size) return;
  await db.batch([...tieRolls].map(([discordId, value]) =>
    db.prepare('UPDATE raid_giveaway_rolls SET tie_roll = ? WHERE round_id = ? AND discord_id = ?')
      .bind(value, round.id, discordId)));
}

// Доводить розіграш до поточного моменту: закриває раунд, що скінчився,
// стартує перший раунд, завершує розіграш, коли раундів не лишилось.
// Кожен наступний раунд стартує лише з дії офіцера (startNextRound):
// позначка "видано" або кнопка "Наступний раунд". Повертає актуальні раунди.
async function advanceGiveaway(db, giveaway) {
  if (giveaway.status !== 'active') return listRounds(db, giveaway.id);
  const now = Date.now();
  let rounds = await listRounds(db, giveaway.id);
  const active = rounds.find((r) => r.status === 'active');
  if (active) {
    if (now < Date.parse(active.ends_at)) return rounds;
    await resolveRound(db, active);
    rounds = await listRounds(db, giveaway.id);
  }
  if (!rounds.some((r) => r.status === 'pending')) {
    await db
      .prepare("UPDATE raid_giveaways SET status = 'finished', finished_at = ? WHERE id = ? AND status = 'active'")
      .bind(nowIso(now), giveaway.id)
      .run();
    giveaway.status = 'finished';
    return listRounds(db, giveaway.id);
  }
  // Перший раунд - сам, після відліку від старту розіграшу.
  if (!rounds.some((r) => r.starts_at)) {
    await startNextRound(db, giveaway, FIRST_ROUND_LEAD_MS);
    return listRounds(db, giveaway.id);
  }
  return rounds;
}

// Ставить наступний раунд черги (статус active, старт через leadMs - до
// нього гравці бачать відлік), якщо зараз жоден не йде. Умова в самому
// UPDATE - паралельні запити не запустять двох раундів.
async function startNextRound(db, giveaway, leadMs = NEXT_ROUND_LEAD_MS) {
  const startMs = Date.now() + leadMs;
  await db
    .prepare(
      `UPDATE raid_giveaway_rounds SET status = 'active', starts_at = ?, ends_at = ?
       WHERE id = (SELECT id FROM raid_giveaway_rounds WHERE giveaway_id = ? AND status = 'pending'
                   ORDER BY position ASC, id ASC LIMIT 1)
         AND status = 'pending'
         AND NOT EXISTS (SELECT 1 FROM raid_giveaway_rounds WHERE giveaway_id = ? AND status = 'active')`
    )
    .bind(nowIso(startMs), nowIso(startMs + giveaway.round_seconds * 1000), giveaway.id, giveaway.id)
    .run();
}

// Розіграш чекає офіцера: раунд не йде, а в черзі ще є призи.
function isWaitingForOfficer(giveaway, rounds) {
  return giveaway.status === 'active'
    && !rounds.some((r) => r.status === 'active')
    && rounds.some((r) => r.status === 'pending');
}

// ---------- умови участі ----------

function parseCriteria(json) {
  try {
    const c = JSON.parse(json);
    return Object.fromEntries(CRITERIA_KEYS.map((k) => [k, Boolean(c[k])]));
  } catch {
    return Object.fromEntries(CRITERIA_KEYS.map((k) => [k, true]));
  }
}

// { eligible, missing: [текст для гравця] } - чого бракує, щоб узяти участь.
export async function checkGiveawayEligibility(db, raid, criteria, discordId) {
  const missing = [];
  const needChars = criteria.gearScore || criteria.softs || criteria.noPenalties;
  const characters = needChars
    ? (await db
      .prepare(
        `SELECT c.character_name, c.gear_score,
                EXISTS (SELECT 1 FROM character_gear_scores g
                        WHERE g.discord_id = c.discord_id AND g.character_name = c.character_name) AS has_spec_gs
         FROM user_characters c WHERE c.discord_id = ?`
      )
      .bind(discordId)
      .all()).results
    : [];
  const ownNames = new Set(characters.map((c) => lower(c.character_name)));

  if (criteria.signup) {
    const signup = await db
      .prepare('SELECT status, source, created_at FROM raid_signups WHERE raid_id = ? AND discord_id = ?')
      .bind(raid.id, discordId)
      .first();
    // Запис із Discord з'являється на сайті з затримкою синхронізації, але
    // Raid-Helper сам закриває запис на старті рейду - тож час не звіряємо.
    const inTime = signup && (signup.source === 'discord' || !raid.starts_at
      || Date.parse(signup.created_at) <= Date.parse(raid.starts_at));
    if (!signup || signup.status === 'absent' || !inTime) missing.push('Не записаний у рейд до його початку');
  }

  if (criteria.gearScore) {
    if (!characters.length) {
      missing.push('Немає персонажів у профілі');
    } else {
      const noGs = characters.filter((c) => !c.has_spec_gs && c.gear_score == null).map((c) => c.character_name);
      if (noGs.length) missing.push(`Не вказано GS: ${noGs.join(', ')}`);
    }
  }

  if (criteria.softs) {
    const { results } = await db
      .prepare('SELECT player_name, discord_id FROM soft_reserves WHERE raid_id = ?')
      .bind(raid.id)
      .all();
    let has = results.some((r) => r.discord_id === discordId || ownNames.has(lower(r.player_name)));
    // Хто передав свій софт іншому гравцю, теж бере участь у рейді софтом.
    if (!has && ownNames.size) {
      const { results: transfers } = await db
        .prepare('SELECT from_player FROM raid_weight_transfers WHERE raid_id = ?')
        .bind(raid.id)
        .all();
      has = transfers.some((t) => ownNames.has(lower(t.from_player)));
    }
    if (!has) missing.push('Немає софтів у цьому рейді');
  }

  if (criteria.noPenalties) {
    const { results } = await db
      .prepare('SELECT DISTINCT player_name FROM raid_penalty_entries WHERE raid_id = ?')
      .bind(raid.id)
      .all();
    const fined = results.map((r) => r.player_name).filter((n) => ownNames.has(lower(n)));
    if (fined.length) missing.push(`Є штраф у рейді: ${fined.join(', ')}`);
  }

  return { eligible: !missing.length, missing };
}

// ---------- відповідь ----------

// Прихований приз (розіграш наосліп) гравці бачать лише після раунду;
// офіцер, що веде розіграш (canSee), - завжди, з позначкою hidden; інші офіцери - як гравці.
function prizeView(round, canSee = true) {
  const hidden = Boolean(round.hidden);
  if (hidden && !canSee && !['done', 'void', 'rerolled'].includes(round.status)) return { type: 'hidden', hidden: true };
  const quantity = round.quantity || 1;
  if (round.gold != null) return { type: 'gold', gold: round.gold, quantity, hidden };
  const item = catalogById.get(round.item_id);
  return {
    type: 'item',
    itemId: round.item_id,
    name: item?.name || `#${round.item_id}`,
    icon: item?.icon || 'inv_misc_questionmark',
    quality: item?.quality ?? 1,
    // Доданим з сайту предметам опису немає в data/item-icons.json - шлемо його.
    tooltip: item?.custom ? item.tooltip : undefined,
    quantity,
    hidden
  };
}

// Керує розіграшем (скасування, видача, перекидання, наступний раунд) лише
// офіцер, що його почав - щоб кілька офіцерів не перебивали одне одного.
// Розіграші до цього правила (без created_by_discord_id) - будь-який офіцер.
function isGiveawayOwner(giveaway, session) {
  return !giveaway.created_by_discord_id || giveaway.created_by_discord_id === session.discordId;
}

async function requireGiveawayOwner(db, raid, session, giveaway) {
  await requireRaidOfficer(db, raid.id, raid, session);
  if (!isGiveawayOwner(giveaway, session)) {
    throw new HttpError(403, `Керувати розіграшем може лише офіцер, що його почав: ${giveaway.created_by}`);
  }
}

async function giveawayState(db, raid, session) {
  await loadCatalog(db);
  const giveaway = await getLatestGiveaway(db, raid.id);
  const isOfficer = await isRaidOfficer(db, raid.id, raid, session.discordId);
  if (!giveaway) return { serverNow: nowIso(), canManage: isOfficer, giveaway: null, me: null };
  const canManage = isOfficer && isGiveawayOwner(giveaway, session);

  const rounds = await advanceGiveaway(db, giveaway);
  const rolls = await listRolls(db, giveaway.id);
  const criteria = parseCriteria(giveaway.criteria);
  const active = rounds.find((r) => r.status === 'active');

  let me = null;
  if (giveaway.status === 'active') {
    const eligibility = await checkGiveawayEligibility(db, raid, criteria, session.discordId);
    const myRoll = active ? rolls.find((r) => r.round_id === active.id && r.discord_id === session.discordId) : null;
    me = {
      discordId: session.discordId,
      ...eligibility,
      excluded: Boolean(active && active.excluded_discord_id === session.discordId),
      roll: myRoll ? myRoll.roll : null
    };
  }

  return {
    serverNow: nowIso(),
    canManage,
    giveaway: {
      id: giveaway.id,
      status: giveaway.status,
      criteria,
      roundSeconds: giveaway.round_seconds,
      waitingForOfficer: isWaitingForOfficer(giveaway, rounds),
      createdBy: giveaway.created_by,
      createdAt: giveaway.created_at,
      rounds: rounds.map((r) => ({
        id: r.id,
        position: r.position,
        prize: prizeView(r, canManage),
        status: r.status,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        winner: r.winner_discord_id ? { discordId: r.winner_discord_id, name: r.winner_name, roll: r.winner_roll } : null,
        delivered: Boolean(r.delivered),
        rolls: rolls
          .filter((x) => x.round_id === r.id)
          .map((x) => ({ discordId: x.discord_id, name: x.player_name, roll: x.roll, tieRoll: x.tie_roll }))
          .sort((a, b) => b.roll - a.roll || (b.tieRoll ?? 0) - (a.tieRoll ?? 0))
      }))
    },
    me
  };
}

// ---------- обробники ----------

export async function handleGetGiveaway(request, env, raid, session) {
  return jsonResponse(await giveawayState(env.DB, raid, session));
}

export async function handleListGiveawayPrizes(request, env, raid, session) {
  await requireRaidOfficer(env.DB, raid.id, raid, session);
  return jsonResponse(await catalogResponse(env.DB, session));
}

// ---------- каталог призів (редагують офіцери гільдії) ----------

// Каталог = вбудований (giveaway-prizes.js) + рядки giveaway_catalog.
// catalogById - усі відомі предмети (і прибрані - для старих раундів),
// activeCatalogIds - ті, що зараз можна обрати. Оновлюється на початку
// кожного запиту, що їх читає (loadCatalog).
let catalogById = new Map(GIVEAWAY_PRIZES_BY_ID);
let activeCatalogIds = new Set(GIVEAWAY_PRIZES_BY_ID.keys());

async function loadCatalog(db) {
  const { results } = await db.prepare('SELECT * FROM giveaway_catalog').all();
  const byId = new Map(GIVEAWAY_PRIZES_BY_ID);
  const active = new Set(GIVEAWAY_PRIZES_BY_ID.keys());
  for (const r of results) {
    byId.set(r.item_id, {
      id: r.item_id, name: r.name, icon: r.icon, quality: r.quality, category: r.category, tooltip: r.tooltip, custom: true
    });
    if (r.removed) active.delete(r.item_id); else active.add(r.item_id);
  }
  catalogById = byId;
  activeCatalogIds = active;
}

async function isGuildOfficer(db, discordId) {
  return Boolean(await db.prepare('SELECT 1 FROM default_officers WHERE discord_id = ?').bind(discordId).first());
}

async function requireGuildOfficer(db, session) {
  if (!(await isGuildOfficer(db, session.discordId))) throw new HttpError(403, 'Каталог призів редагують лише офіцери гільдії');
}

async function catalogResponse(db, session) {
  await loadCatalog(db);
  return {
    categories: GIVEAWAY_PRIZE_CATEGORIES,
    prizes: [...activeCatalogIds].map((id) => catalogById.get(id)),
    roundSeconds: GIVEAWAY_ROUND_SECONDS,
    canEditCatalog: await isGuildOfficer(db, session.discordId)
  };
}

function upsertCatalogRow(db, item, removed, session) {
  return db.prepare(
    `INSERT INTO giveaway_catalog (item_id, name, icon, quality, category, tooltip, removed, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (item_id) DO UPDATE SET name = excluded.name, icon = excluded.icon, quality = excluded.quality,
       category = excluded.category, tooltip = excluded.tooltip, removed = excluded.removed,
       updated_by = excluded.updated_by, updated_at = excluded.updated_at`
  ).bind(item.id, item.name, item.icon, item.quality ?? 1, item.category, item.tooltip || null, removed, session.username, nowIso()).run();
}

// body: { itemId, category } - додати предмет за WoW ID; назва, іконка,
// якість і опис - з Wowhead (WotLK).
export async function handleAddCatalogPrize(request, env, raid, session) {
  const db = env.DB;
  await requireGuildOfficer(db, session);
  const body = await readJson(request);
  const itemId = Number(body.itemId);
  if (!Number.isInteger(itemId) || itemId < 1 || itemId > 999999) throw new HttpError(400, 'WoW ID - ціле додатне число');
  if (!GIVEAWAY_PRIZE_CATEGORIES.some((c) => c.key === body.category)) throw new HttpError(400, 'Обери категорію');
  let data = null;
  try {
    const res = await fetch(`https://nether.wowhead.com/tooltip/item/${itemId}?dataEnv=8&locale=0`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) data = await res.json();
  } catch { data = null; }
  if (!data?.name || !data?.icon) throw new HttpError(404, `Предмет ${itemId} не знайдено на Wowhead`);
  await upsertCatalogRow(db, {
    id: itemId, name: data.name, icon: data.icon, quality: data.quality, category: body.category, tooltip: data.tooltip
  }, 0, session);
  return jsonResponse(await catalogResponse(db, session));
}

// Прибрати предмет з каталогу (і вбудований теж): рядок лишається з
// removed = 1 - старі раунди й далі показують назву та іконку.
export async function handleRemoveCatalogPrize(request, env, raid, session, itemId) {
  const db = env.DB;
  await requireGuildOfficer(db, session);
  await loadCatalog(db);
  if (!activeCatalogIds.has(itemId)) throw new HttpError(404, 'Цього предмета немає в каталозі');
  await upsertCatalogRow(db, catalogById.get(itemId), 1, session);
  return jsonResponse(await catalogResponse(db, session));
}

// body: { prizes: [{ itemId, count, hidden? } | { gold, count, hidden? }], criteria: {...}, roundSeconds }
export async function handleStartGiveaway(request, env, raid, session) {
  const db = env.DB;
  await loadCatalog(db);
  await requireRaidOfficer(db, raid.id, raid, session);
  if (raid.status === 'completed') throw new HttpError(400, 'Рейд завершено');

  const latest = await getLatestGiveaway(db, raid.id);
  if (latest && latest.status === 'active') {
    await advanceGiveaway(db, latest);
    if (latest.status === 'active') throw new HttpError(409, 'Розіграш уже триває');
  }

  const body = await readJson(request);
  const roundSeconds = Number(body.roundSeconds);
  if (!GIVEAWAY_ROUND_SECONDS.includes(roundSeconds)) throw new HttpError(400, 'Невідома тривалість раунду');
  if (!body.criteria || typeof body.criteria !== 'object') throw new HttpError(400, 'Потрібні умови участі');
  const criteria = Object.fromEntries(CRITERIA_KEYS.map((k) => [k, Boolean(body.criteria[k])]));

  if (!Array.isArray(body.prizes) || !body.prizes.length) throw new HttpError(400, 'Не обрано жодного призу');
  // Кожен рядок - один раунд; кількість розігрується пачкою.
  const rounds = [];
  for (const p of body.prizes) {
    const quantity = Number(p?.count ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new HttpError(400, `Кількість призу - ціле число від 1 до ${MAX_QUANTITY}`);
    }
    if (p.itemId != null) {
      const itemId = Number(p.itemId);
      if (!activeCatalogIds.has(itemId)) throw new HttpError(400, `Невідомий приз: ${p.itemId}`);
      rounds.push({ itemId, gold: null, quantity, hidden: Boolean(p.hidden) });
    } else {
      const gold = Number(p.gold);
      if (!Number.isInteger(gold) || gold < 1 || gold > MAX_GOLD) throw new HttpError(400, `Золото - ціле число від 1 до ${MAX_GOLD}`);
      rounds.push({ itemId: null, gold, quantity, hidden: Boolean(p.hidden) });
    }
  }
  if (rounds.length > MAX_ROUNDS) throw new HttpError(400, `Не більше ${MAX_ROUNDS} призів за розіграш`);

  const created = await db
    .prepare(
      `INSERT INTO raid_giveaways (raid_id, status, criteria, round_seconds, created_by, created_by_discord_id, created_at)
       VALUES (?, 'active', ?, ?, ?, ?, ?) RETURNING id`
    )
    .bind(raid.id, JSON.stringify(criteria), roundSeconds, session.username, session.discordId, nowIso())
    .first();
  await db.batch(rounds.map((r, i) => db
    .prepare("INSERT INTO raid_giveaway_rounds (giveaway_id, position, item_id, gold, quantity, hidden, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')")
    .bind(created.id, i + 1, r.itemId, r.gold, r.quantity, r.hidden ? 1 : 0)));
  await insertAudit(db, raid.id, session.username, 'giveaway_start', {
    rounds: rounds.length,
    // Приховані призи в історії не розкриваємо.
    prizes: body.prizes.map((p) => (p.hidden ? { hidden: true }
      : p.itemId != null
        ? { name: catalogById.get(Number(p.itemId)).name, count: Number(p.count ?? 1) }
        : { gold: Number(p.gold), count: Number(p.count ?? 1) })),
    criteria
  });

  return jsonResponse(await giveawayState(db, raid, session), 201);
}

export async function handleGiveawayRoll(request, env, raid, session) {
  const db = env.DB;
  const giveaway = await getLatestGiveaway(db, raid.id);
  if (!giveaway || giveaway.status !== 'active') throw new HttpError(400, 'Зараз немає розіграшу');
  const rounds = await advanceGiveaway(db, giveaway);
  const now = Date.now();
  const active = rounds.find((r) => r.status === 'active');
  if (!active || now < Date.parse(active.starts_at) || now >= Date.parse(active.ends_at)) {
    throw new HttpError(400, 'Раунд ще не почався або вже закінчився');
  }
  if (active.excluded_discord_id === session.discordId) {
    throw new HttpError(403, 'Цей приз перекидається без тебе - ти вже його вигравав');
  }
  const { eligible, missing } = await checkGiveawayEligibility(db, raid, parseCriteria(giveaway.criteria), session.discordId);
  if (!eligible) throw new HttpError(403, missing.join('; '));

  const name = (await getUserDisplayName(db, session.discordId)) || session.username;
  const { meta } = await db
    .prepare(
      `INSERT OR IGNORE INTO raid_giveaway_rolls (round_id, discord_id, player_name, roll, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(active.id, session.discordId, name, rollD100(), nowIso(now))
    .run();
  if (!meta.changes) throw new HttpError(409, 'Ти вже кинув у цьому раунді');

  return jsonResponse(await giveawayState(db, raid, session));
}

export async function handleCancelGiveaway(request, env, raid, session) {
  const db = env.DB;
  await requireRaidOfficer(db, raid.id, raid, session);
  const giveaway = await getLatestGiveaway(db, raid.id);
  if (!giveaway || giveaway.status !== 'active') throw new HttpError(400, 'Зараз немає розіграшу');
  await requireGiveawayOwner(db, raid, session, giveaway);
  await db.batch([
    db.prepare("UPDATE raid_giveaways SET status = 'cancelled', finished_at = ? WHERE id = ? AND status = 'active'")
      .bind(nowIso(), giveaway.id),
    // Незіграні й поточний раунд - без переможця.
    db.prepare("UPDATE raid_giveaway_rounds SET status = 'void' WHERE giveaway_id = ? AND status IN ('pending', 'active')")
      .bind(giveaway.id)
  ]);
  await insertAudit(db, raid.id, session.username, 'giveaway_cancel', { giveawayId: giveaway.id });
  return jsonResponse(await giveawayState(db, raid, session));
}

async function loadRoundOr404(db, raid, roundId) {
  const round = await db
    .prepare(
      `SELECT g.* FROM raid_giveaway_rounds g JOIN raid_giveaways w ON w.id = g.giveaway_id
       WHERE g.id = ? AND w.raid_id = ?`
    )
    .bind(roundId, raid.id)
    .first();
  if (!round) throw new HttpError(404, 'Раунд не знайдено');
  return round;
}

// Переможця немає (не відгукнувся) або ніхто не кинув - приз розігрується
// ще раз новим раундом у кінці черги; попередній переможець не бере участі.
export async function handleRerollGiveawayRound(request, env, raid, session, roundId) {
  const db = env.DB;
  await requireRaidOfficer(db, raid.id, raid, session);
  if (raid.status === 'completed') throw new HttpError(400, 'Рейд завершено');
  const round = await loadRoundOr404(db, raid, roundId);
  await loadCatalog(db);
  if (!['done', 'void'].includes(round.status)) throw new HttpError(400, 'Перекинути можна лише зіграний раунд');
  if (round.delivered) throw new HttpError(400, 'Приз уже видано');
  const giveaway = await getGiveaway(db, raid.id, round.giveaway_id);
  await requireGiveawayOwner(db, raid, session, giveaway);
  if (giveaway.status === 'cancelled') throw new HttpError(400, 'Розіграш скасовано');

  const last = await db
    .prepare('SELECT COALESCE(MAX(position), 0) AS pos FROM raid_giveaway_rounds WHERE giveaway_id = ?')
    .bind(giveaway.id)
    .first();
  const { meta } = await db
    .prepare("UPDATE raid_giveaway_rounds SET status = 'rerolled' WHERE id = ? AND status = ?")
    .bind(round.id, round.status)
    .run();
  if (!meta.changes) throw new HttpError(409, 'Раунд уже змінено');
  await db.batch([
    db.prepare(
      `INSERT INTO raid_giveaway_rounds (giveaway_id, position, item_id, gold, quantity, hidden, status, excluded_discord_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(giveaway.id, last.pos + 1, round.item_id, round.gold, round.quantity || 1, round.hidden, round.winner_discord_id),
    // Розіграш уже скінчився - продовжуємо його цим раундом.
    db.prepare("UPDATE raid_giveaways SET status = 'active', finished_at = NULL WHERE id = ? AND status = 'finished'")
      .bind(giveaway.id)
  ]);
  await insertAudit(db, raid.id, session.username, 'giveaway_reroll', {
    prize: prizeView(round),
    previousWinner: round.winner_name || null
  });
  return jsonResponse(await giveawayState(db, raid, session));
}

// body: { delivered: boolean } - офіцер передав приз у грі.
export async function handleSetGiveawayDelivered(request, env, raid, session, roundId) {
  const db = env.DB;
  await requireRaidOfficer(db, raid.id, raid, session);
  const round = await loadRoundOr404(db, raid, roundId);
  await loadCatalog(db);
  if (round.status !== 'done') throw new HttpError(400, 'У раунді немає переможця');
  const giveaway = await getGiveaway(db, raid.id, round.giveaway_id);
  await requireGiveawayOwner(db, raid, session, giveaway);
  const body = await readJson(request);
  if (typeof body.delivered !== 'boolean') throw new HttpError(400, 'delivered має бути true або false');
  await db.prepare('UPDATE raid_giveaway_rounds SET delivered = ? WHERE id = ?').bind(body.delivered ? 1 : 0, round.id).run();
  await insertAudit(db, raid.id, session.username, body.delivered ? 'giveaway_delivered' : 'giveaway_undelivered', {
    prize: prizeView(round),
    winner: round.winner_name
  });
  // Видача призу - підтвердження офіцера: стартує наступний раунд, якщо
  // інших невиданих призів немає.
  if (body.delivered && raid.status !== 'completed') {
    if (giveaway.status === 'active') {
      const rounds = await advanceGiveaway(db, giveaway);
      if (isWaitingForOfficer(giveaway, rounds) && !rounds.some((r) => r.status === 'done' && !r.delivered)) {
        await startNextRound(db, giveaway);
      }
    }
  }
  return jsonResponse(await giveawayState(db, raid, session));
}

// Наступний раунд вручну - коли видавати нічого (ніхто не кинув, приз
// перекинуто). Поки є невидані призи, кнопка не діє: спершу видача.
export async function handleNextGiveawayRound(request, env, raid, session) {
  const db = env.DB;
  await requireRaidOfficer(db, raid.id, raid, session);
  if (raid.status === 'completed') throw new HttpError(400, 'Рейд завершено');
  const giveaway = await getLatestGiveaway(db, raid.id);
  if (!giveaway || giveaway.status !== 'active') throw new HttpError(400, 'Зараз немає розіграшу');
  await requireGiveawayOwner(db, raid, session, giveaway);
  const rounds = await advanceGiveaway(db, giveaway);
  if (!isWaitingForOfficer(giveaway, rounds)) throw new HttpError(409, 'Раунд уже йде або призів не лишилось');
  if (rounds.some((r) => r.status === 'done' && !r.delivered)) {
    throw new HttpError(400, 'Спершу познач видачу призу переможцю');
  }
  await startNextRound(db, giveaway);
  return jsonResponse(await giveawayState(db, raid, session));
}
