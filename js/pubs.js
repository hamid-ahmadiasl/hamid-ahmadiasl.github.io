/* Interactive journal / book covers on research.html.
   Desktop: hover or keyboard focus opens a 3D page-turn.
   Touch: tap to open, close button or a second tap (or Escape) to close.
   prefers-reduced-motion: a simple fade, no rotateY. */

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function initPubs() {
  const shelf = document.getElementById('pubShelf');
  if (!shelf) return;

  const tomes = [...shelf.querySelectorAll('.tome')];

  const closeAll = (except) => {
    tomes.forEach((t) => {
      if (t !== except) {
        t.classList.remove('is-open');
        const btn = t.querySelector('.tome__hit');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });
  };

  const setOpen = (tome, open) => {
    if (open) closeAll(tome);
    tome.classList.toggle('is-open', open);
    const btn = tome.querySelector('.tome__hit');
    if (btn) btn.setAttribute('aria-expanded', String(open));
  };

  tomes.forEach((tome) => {
    const hit = tome.querySelector('.tome__hit');
    const close = tome.querySelector('.tome__close');
    if (hit) {
      hit.addEventListener('click', (e) => {
        // On fine pointers, hover already opens; a click locks it open / toggles.
        e.preventDefault();
        setOpen(tome, !tome.classList.contains('is-open'));
      });
    }
    if (close) {
      close.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(tome, false);
        if (hit) hit.focus();
      });
    }
    tome.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(tome, false);
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tome')) closeAll();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });

  // Touch devices: hover is unreliable; is-open is the source of truth.
  void finePointer;
}
