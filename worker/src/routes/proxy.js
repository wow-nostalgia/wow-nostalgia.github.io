import { HttpError } from '../util.js';

const ALLOWED_HOST = 'uwu-logs.xyz';

export async function handleProxy(request, env) {
  const secret = request.headers.get('X-Proxy-Secret');
  if (!secret || secret !== env.PROXY_SECRET) throw new HttpError(401, 'Unauthorized');

  const targetUrl = new URL(request.url).searchParams.get('url');
  if (!targetUrl) throw new HttpError(400, 'Missing url param');

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new HttpError(400, 'Invalid url');
  }
  if (parsed.hostname !== ALLOWED_HOST) throw new HttpError(403, `Only ${ALLOWED_HOST} URLs allowed`);

  const browserHeaders = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'uk-UA,uk;q=0.9,en;q=0.8',
    'referer': 'https://uwu-logs.xyz/'
  };

  // Visit main page first to acquire any session cookies
  const mainPage = await fetch('https://uwu-logs.xyz/', { headers: browserHeaders });
  const cookies = [];
  for (const [name, value] of mainPage.headers.entries()) {
    if (name.toLowerCase() === 'set-cookie') cookies.push(value.split(';')[0].trim());
  }

  const upstream = await fetch(targetUrl, {
    headers: {
      ...browserHeaders,
      ...(cookies.length ? { cookie: cookies.join('; ') } : {})
    }
  });

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
