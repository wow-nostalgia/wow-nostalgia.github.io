let lastFocusedCard = null;
let currentIndex = 0;
let galleryItems = [];

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

    galleryItems = items;

    galleryGrid.innerHTML = items.map((item, index) => `
      <button
        class="gallery-card"
        type="button"
        data-index="${index}"
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
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const backdrop = document.querySelector('[data-close-lightbox]');
  const galleryGrid = document.getElementById('galleryGrid');

  if (
    !lightbox ||
    !lightboxImage ||
    !lightboxCaption ||
    !lightboxClose ||
    !lightboxPrev ||
    !lightboxNext ||
    !backdrop ||
    !galleryGrid
  ) {
    console.error('Елементи lightbox не знайдено в DOM');
    return;
  }

  function renderLightbox(index) {
    const item = galleryItems[index];
    if (!item) return;

    currentIndex = index;
    lightboxImage.src = item.src;
    lightboxImage.alt = item.alt || item.title || 'Скріншот галереї';
    lightboxCaption.textContent = item.title || '';
  }

  function openLightbox(index, card) {
    lastFocusedCard = card || null;
    renderLightbox(index);
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

  function showPrev() {
    const prevIndex = currentIndex === 0 ? galleryItems.length - 1 : currentIndex - 1;
    renderLightbox(prevIndex);
  }

  function showNext() {
    const nextIndex = currentIndex === galleryItems.length - 1 ? 0 : currentIndex + 1;
    renderLightbox(nextIndex);
  }

  galleryGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.gallery-card');
    if (!card) return;

    const index = Number(card.dataset.index);
    openLightbox(index, card);
  });

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', showPrev);
  lightboxNext.addEventListener('click', showNext);
  backdrop.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (event) => {
    if (!lightbox.classList.contains('is-open')) return;

    if (event.key === 'Escape') {
      closeLightbox();
    }

    if (event.key === 'ArrowLeft') {
      showPrev();
    }

    if (event.key === 'ArrowRight') {
      showNext();
    }
  });
}

loadGallery();