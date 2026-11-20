/* Hamid Ahmadi Asl — personal site
   Shared by every page: nav, GSAP scroll reveals, optional wallpaper motion and posts;
   the Three.js hero (js/hero.js) loads only on pages that have a #scene canvas. */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = window.matchMedia('(max-width: 760px)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- Navigation ---------- */
const nav = $('#nav'), toggle = $('#navToggle'), links = $('#navLinks'), backdrop = $('#navBackdrop');

const onScroll = () => { if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 24); };
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

function setNav(open) {
  if (!links || !toggle) return;
  links.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('nav-open', open);
  if (backdrop) backdrop.hidden = !open;
}

if (toggle) {
  toggle.addEventListener('click', () => setNav(!links.classList.contains('is-open')));
}
if (backdrop) backdrop.addEventListener('click', () => setNav(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setNav(false);
});
if (links) {
  $$('a', links).forEach((a) => a.addEventListener('click', () => setNav(false)));
}

/* ---------- GSAP animations ---------- */
function initAnimations() {
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger || reduceMotion) {
    $$('.stat').forEach((s) => { if (s.dataset.count) s.textContent = s.dataset.count; });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.lagSmoothing(0);   // keep intro timing honest even if the first frames are slow (heavy WebGL start-up)

  // hero text is shown immediately (no intro fade) so the first paint is instant

  $$('.reveal').forEach((el) => {
    gsap.from(el, {
      opacity: 0, y: 36, duration: .8, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });
  $$('.chips').forEach((ul) => {
    gsap.from($$('li', ul), {
      opacity: 0, scale: .85, duration: .4, stagger: .05, ease: 'back.out(1.6)',
      scrollTrigger: { trigger: ul, start: 'top 92%', once: true }
    });
  });
  $$('.stat').forEach((s) => {
    const end = +s.dataset.count, o = { v: 0 };
    gsap.to(o, {
      v: end, duration: 1.4, ease: 'power2.out',
      onUpdate: () => { s.textContent = Math.round(o.v); },
      scrollTrigger: { trigger: s, start: 'top 92%', once: true }
    });
  });
}
window.addEventListener('load', initAnimations);
if (document.readyState === 'complete') initAnimations();

/* ---------- Training & Insights (shared module js/posts.js) ---------- */
{
  const full = $('#posts'), preview = $('#postsPreview');
  if (full || preview) {
    import('./posts.js?v=12').then((m) =>
      full
        ? m.initPostsPage(full, $('#postFilters'), { reduceMotion })
        : m.initPostsPreview(preview, { limit: 3 })
    ).catch((e) => console.warn('posts unavailable:', e && e.message));
  }
}

/* ---------- Wallpaper motion (homepage only; subpages use a dimmer static wallpaper) ---------- */
if (!document.body.classList.contains('page--sub')) {
  import('./wallpaper.js?v=12')
    .then((m) => m.initWallpaper({ reduceMotion: false }))
    .catch((e) => console.warn('wallpaper motion disabled:', e && e.message));
}

/* ---------- Three.js hero (lazy, see js/hero.js) ---------- */
if ($('#scene')) {
  import('./hero.js?v=12')
    .then((m) => m.initHero({ reduceMotion: false, isSmall }))
    .catch((e) => {
      console.warn('3D hero disabled:', e && e.message);
      document.documentElement.classList.add('no-webgl');
    });
}
