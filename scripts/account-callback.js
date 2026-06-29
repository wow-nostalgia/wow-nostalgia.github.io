async function init() {
  const status = document.getElementById('callbackStatus');
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const returnTo = state ? decodeURIComponent(state) : '/account/';

  if (!code) {
    status.textContent = 'Discord не повернув код авторизації.';
    return;
  }

  try {
    const res = await fetch(`${AUTH_API_BASE}/auth/discord/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri: accountCallbackUrl() })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    setSessionToken(data.sessionToken);
    window.location.href = returnTo;
  } catch (err) {
    status.textContent = `Помилка входу: ${err.message}`;
  }
}

init();
