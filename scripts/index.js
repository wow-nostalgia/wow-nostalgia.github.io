document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.info-tabs');
  if (!container) return;

  const blocks = Array.from(container.querySelectorAll('.collapsible'));
  blocks.forEach((b) => b.classList.remove('open'));
  if (blocks[0]) blocks[0].classList.add('open');

  function activateBlock(targetBlock) {
    blocks.forEach((b) => {
      b.classList.remove('open');
      const h = b.querySelector('.heading');
      if (h) h.setAttribute('aria-expanded', 'false');
    });
    targetBlock.classList.add('open');
    const heading = targetBlock.querySelector('.heading');
    if (heading) heading.setAttribute('aria-expanded', 'true');
  }

  blocks.forEach((block, i) => {
    const heading = block.querySelector('.heading');
    if (!heading) return;
    heading.setAttribute('aria-expanded', i === 0 ? 'true' : 'false');
    heading.addEventListener('click', () => activateBlock(block));
  });
});
