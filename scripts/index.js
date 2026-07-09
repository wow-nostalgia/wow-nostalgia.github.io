document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.info-tabs');
  if (!container) return;

  const blocks = Array.from(container.querySelectorAll('.collapsible'));
  blocks.forEach((b) => b.classList.remove('open'));

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

  blocks.forEach((block) => {
    const heading = block.querySelector('.heading');
    if (!heading) return;
    heading.addEventListener('click', () => activateBlock(block));
  });

  const targetBlock = blocks.find((b) => b.id === window.location.hash.slice(1));
  if (targetBlock) {
    activateBlock(targetBlock);
    const heading = targetBlock.querySelector('.heading');
    if (heading) heading.scrollIntoView({ block: 'start' });
  } else if (blocks[0]) {
    activateBlock(blocks[0]);
  }
});
