async function init() {
  const status = document.getElementById('callbackStatus');
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const decodedState = state ? decodeURIComponent(state) : '';
  // Лише відносний шлях того ж origin — інакше state можна підмінити на
  // зовнішній URL і відкрити open-redirect одразу після легітимного логіну.
  const returnTo = /^\/(?!\/)/.test(decodedState) ? decodedState : '/account/';

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
