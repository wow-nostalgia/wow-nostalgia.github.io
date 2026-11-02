document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.info-tabs');
  if (!container) return;

  const blocks = Array.from(container.querySelectorAll('.collapsible'));
  blocks.forEach((b) => b.classList.remove('open'));

  // Закритий блок — hidden="until-found", а не display: none: пошук браузера
  // (Ctrl+F) знаходить текст і в закритих блоках і сам їх розкриває (подія
  // beforematch нижче). Де until-found не підтримується (Safari), атрибут
  // працює як звичайний hidden — блок просто закритий, як і раніше.
  function activateBlock(targetBlock) {
    blocks.forEach((b) => {
      b.classList.remove('open');
      b.querySelector('.hider')?.setAttribute('hidden', 'until-found');
      const h = b.querySelector('.heading');
      if (h) h.setAttribute('aria-expanded', 'false');
    });
    targetBlock.classList.add('open');
    targetBlock.querySelector('.hider')?.removeAttribute('hidden');
    const heading = targetBlock.querySelector('.heading');
    if (heading) heading.setAttribute('aria-expanded', 'true');
  }

  container.addEventListener('beforematch', (event) => {
    const block = event.target.closest('.collapsible');
    if (block) activateBlock(block);
  });

  blocks.forEach((block) => {
    const heading = block.querySelector('.heading');
    if (!heading) return;
    heading.addEventListener('click', () => activateBlock(block));
  });

  const targetBlock = blocks.find((b) => b.id === window.location.hash.slice(1));
  if (targetBlock) {
    activateBlock(targetBlock);
  } else if (blocks[0]) {
    activateBlock(blocks[0]);
  }

  // Посилання на блок з цієї ж сторінки (напр. з підказки "Софт-рол") —
  // сторінка не перезавантажується, тож відкриваємо блок тут.
  window.addEventListener('hashchange', () => {
    const block = blocks.find((b) => b.id === window.location.hash.slice(1));
    if (!block) return;
    activateBlock(block);
    block.querySelector('.heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
