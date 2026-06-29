import { HttpError, bearerToken } from './util.js';
import { getClaimToken } from './db.js';

export function isOfficer(request, raid) {
  const token = bearerToken(request);
  return Boolean(token) && token === raid.officer_token;
}

export function requireOfficer(request, raid) {
  if (!isOfficer(request, raid)) {
    throw new HttpError(403, 'Потрібен officer token');
  }
}

// Для self-дій гравця: дозволяє, якщо officer, або якщо claim token збігається
// з уже застовпленим іменем. allowMint=true — для першого софту під новим
// ім'ям (де claim ще не існує) дозволяємо пройти далі, щоб роут сам видав
// новий токен. allowMint=false (видалення/тогл існуючого резерву) — без
// підтвердженого claim і без officer-токена доступу нема.
export async function checkPlayerAccess(db, request, raid, playerName, { allowMint = false } = {}) {
  if (isOfficer(request, raid)) return { officer: true, claim: null, shouldMint: false };

  const token = bearerToken(request);
  const claim = await getClaimToken(db, raid.id, playerName);

  if (!claim) {
    if (allowMint) return { officer: false, claim: null, shouldMint: true };
    throw new HttpError(403, `Немає прав на дії гравця "${playerName}"`);
  }

  if (!token || token !== claim.token) {
    throw new HttpError(403, `Ім'я "${playerName}" вже застовплене в цьому рейді іншим браузером`);
  }

  return { officer: false, claim, shouldMint: false };
}
