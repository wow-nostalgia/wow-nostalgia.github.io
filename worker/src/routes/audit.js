import { HttpError, jsonResponse } from '../util.js';
import { getRaid, listAudit } from '../db.js';

export async function handleListAudit(request, env, raidId) {
  const raid = await getRaid(env.DB, raidId);
  if (!raid) throw new HttpError(404, 'Рейд не знайдено');

  const entries = await listAudit(env.DB, raidId);
  return jsonResponse(
    entries.map((e) => ({ ...e, detail: JSON.parse(e.detail_json) }))
  );
}
