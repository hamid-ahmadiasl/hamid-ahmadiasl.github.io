/* Interactive journal / book covers on research.html.
   Desktop (fine pointer): hover or keyboard focus opens a 3D page-turn; click locks it open.
   Touch / narrow: tap opens a vertical sheet; close button, backdrop tap or Escape closes it.
   prefers-reduced-motion: a simple fade, no rotateY. */
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const narrow = () => window.matchMedia('(max-width: 760px)').matches;

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
    if (!tomes.some((t) => t.classList.contains('is-open'))) {
      document.body.classList.remove('tome-open');
    }
  };

  const setOpen = (tome, open) => {
    if (open) closeAll(tome);
    tome.classList.toggle('is-open', open);
    document.body.classList.toggle('tome-open', open && narrow());
    const btn = tome.querySelector('.tome__hit');
    if (btn) btn.setAttribute('aria-expanded', String(open));
    if (open) {
      const stage = tome.querySelector('.tome__stage');
      if (stage) stage.scrollTop = 0;
      const closer = tome.querySelector('.tome__close');
      if (closer) closer.focus({ preventScroll: true });
    }
  };

  tomes.forEach((tome) => {
    const hit = tome.querySelector('.tome__hit');
    const close = tome.querySelector('.tome__close');
    const onOpenToggle = (e) => {
      // Ignore clicks on links or the close button (those have their own handlers).
      if (e.target.closest && e.target.closest('.tome__close, .tome__links, a, button:not(.tome__hit)')) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(tome, !tome.classList.contains('is-open'));
    };
    // Bind on the tome itself so a tap still works if an overlay steals events from .tome__hit.
    tome.addEventListener('click', (e) => {
      if (tome.classList.contains('is-open')) return; // open sheet: only close button / backdrop close it
      if (e.target.closest && e.target.closest('.tome__close, .tome__links, a')) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(tome, true);
    });
    if (hit) {
      hit.addEventListener('pointerup', (e) => {
        if (tome.classList.contains('is-open')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        setOpen(tome, true);
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
    const open = tomes.find((t) => t.classList.contains('is-open'));
    if (!open) return;
    // On the mobile sheet, a tap on the dimmed backdrop (the .tome itself outside the stage) closes.
    if (narrow() && e.target === open) { setOpen(open, false); return; }
    if (!e.target.closest('.tome')) closeAll();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });

  window.addEventListener('resize', () => {
    const open = tomes.find((t) => t.classList.contains('is-open'));
    document.body.classList.toggle('tome-open', !!(open && narrow()));
  });

  void finePointer;
}
