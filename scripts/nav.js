if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primaryNav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      toggle.classList.toggle('is-active', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Делегування на document, а не статичний NodeList — щоб дропдауни,
  // додані в DOM пізніше (напр. auth-shared.js рендерить логін-дропдаун
  // асинхронно), теж відкривались/закривались без окремого коду.
  function closeAllDropdowns() {
    document.querySelectorAll('.nav__dropdown.is-open').forEach((dropdown) => {
      dropdown.classList.remove('is-open');
      dropdown.querySelector('.nav__dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    });
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.nav__dropdown-trigger');

    if (trigger) {
      event.stopPropagation();
      const dropdown = trigger.closest('.nav__dropdown');
      const willOpen = !dropdown.classList.contains('is-open');
      closeAllDropdowns();
      dropdown.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', String(willOpen));
      return;
    }

    if (!event.target.closest('.nav__dropdown')) closeAllDropdowns();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllDropdowns();
  });
});
