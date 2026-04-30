let lastFocusedCard = null;

async function loadGallery() {
  const galleryGrid = document.getElementById('galleryGrid');

  if (!galleryGrid) {
    console.error('Елемент #galleryGrid не знайдено');
    return;
  }

  try {
    const response = await fetch('./images/gallery/gallery.json', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Не вдалося завантажити gallery.json: ${response.status}`);
    }

    const items = await response.json();

    if (!Array.isArray(items)) {
      throw new Error('gallery.json має містити масив');
    }

    if (items.length === 0) {
      galleryGrid.innerHTML = '<p>Галерея поки порожня.</p>';
      return;
    }

    galleryGrid.innerHTML = items.map((item) => `
      <button
        class="gallery-card"
        type="button"
        data-image="${item.src}"
        data-title="${item.title || ''}"
      >
        <img
          src="${item.src}"
          alt="${item.alt || item.title || 'Скріншот галереї'}"
          loading="lazy"
          width="1600"
          height="900"
        >
      </button>
    `).join('');

    initLightbox();
  } catch (error) {
    galleryGrid.innerHTML = '<p>Не вдалося завантажити галерею.</p>';
    console.error('Помилка завантаження галереї:', error);
  }
}

function initLightbox() {
  const lightbox = document.getElementById('galleryLightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxClose = document.getElementById('lightboxClose');
  const backdrop = document.querySelector('[data-close-lightbox]');
  const galleryGrid = document.getElementById('galleryGrid');

  if (!lightbox || !lightboxImage || !lightboxCaption || !lightboxClose || !backdrop || !galleryGrid) {
    console.error('Елементи lightbox не знайдено в DOM');
    return;
  }

  function openLightbox(card) {
    const src = card.dataset.image;
    const title = card.dataset.title || '';
    const img = card.querySelector('img');
    const alt = img ? img.alt : title;

    lastFocusedCard = card;
    lightboxImage.src = src;
    lightboxImage.alt = alt || 'Скріншот галереї';
    lightboxCaption.textContent = title;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImage.src = '';
    lightboxImage.alt = '';
    lightboxCaption.textContent = '';
    document.body.style.overflow = '';

    if (lastFocusedCard) {
      lastFocusedCard.focus();
    }
  }

  galleryGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.gallery-card');
    if (!card) {
      return;
    }

    openLightbox(card);
  });

  lightboxClose.addEventListener('click', closeLightbox);
  backdrop.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox.classList.contains('is-open')) {
      closeLightbox();
    }
  });
}

loadGallery();