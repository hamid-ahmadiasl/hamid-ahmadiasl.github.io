/* Hamid Ahmadi Asl — personal site
   Hero scene is in js/hero.js (Three.js), GSAP scroll reveals. */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = window.matchMedia('(max-width: 760px)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

$('#year').textContent = new Date().getFullYear();

/* ---------- Navigation ---------- */
const nav = $('#nav'), toggle = $('#navToggle'), links = $('#navLinks');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
toggle.addEventListener('click', () => {
  const open = links.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(open));
});
$$('a', links).forEach(a => a.addEventListener('click', () => {
  links.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false');
}));
const spy = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) $$('a', links).forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]').forEach(s => spy.observe(s));

/* ---------- GSAP animations ---------- */
function initAnimations() {
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger || reduceMotion) { $$('.stat').forEach(s => s.textContent = s.dataset.count); return; }
  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.lagSmoothing(0);   // keep intro timing honest even if the first frames are slow (heavy WebGL start-up)

  // gentle scroll parallax on the wallpaper illustrations
  $$('.wp').forEach(el => {
    const sp = parseFloat(el.dataset.speed || '0.4');
    gsap.fromTo(el, { y: -sp * 90 }, { y: sp * 90, ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  gsap.from('.hero-anim', { opacity: 0, y: 28, duration: .9, ease: 'power3.out', stagger: .12, delay: .15 });

  $$('.reveal').forEach(el => {
    gsap.from(el, { opacity: 0, y: 36, duration: .8, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  $$('.chips').forEach(ul => {
    gsap.from($$('li', ul), { opacity: 0, scale: .85, duration: .4, stagger: .05, ease: 'back.out(1.6)',
      scrollTrigger: { trigger: ul, start: 'top 92%', once: true } });
  });
  $$('.stat').forEach(s => {
    const end = +s.dataset.count, o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.4, ease: 'power2.out', onUpdate: () => s.textContent = Math.round(o.v),
      scrollTrigger: { trigger: s, start: 'top 92%', once: true } });
  });
}
window.addEventListener('load', initAnimations);
if (document.readyState === 'complete') initAnimations();

/* ---------- Training & Insights (data/posts.json) ---------- */
// Each post: { title, topic, description, date (YYYY-MM-DD, optional), url (LinkedIn link, optional), file (e.g. "files/guide.pdf", optional) }
const TOPIC_ORDER = ['AI Foundations', 'ML Fundamentals', 'Neural Networks', 'AI × CFD', 'AI Perspectives', 'CFD', 'Machine Learning', 'HPC', 'Python', 'Engineering Design'];
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => { const x = new Date(d + 'T12:00:00'); return isNaN(x) ? '' : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
async function initPosts() {
  const grid = $('#posts'), bar = $('#postFilters');
  if (!grid) return;
  const empty = (msg) => `<div class="card posts__empty"><p class="muted">${msg}</p><a class="btn" href="http://www.linkedin.com/in/hamid-ahmadi-asl-bb3005ab" target="_blank" rel="noopener noreferrer">See my posts on LinkedIn ↗</a></div>`;
  let posts = [];
  try {
    const r = await fetch('data/posts.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json(); posts = Array.isArray(j) ? j : (j.posts || []);
  } catch (e) { grid.innerHTML = empty('Posts could not be loaded right now.'); bar.hidden = true; return; }
  posts = posts.filter(p => p && p.title).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  if (!posts.length) { grid.innerHTML = empty('New training posts are coming soon.'); bar.hidden = true; return; }
  const topics = [...new Set(posts.map(p => p.topic || 'General'))]
    .sort((a, b) => ((TOPIC_ORDER.indexOf(a) + 1) || 99) - ((TOPIC_ORDER.indexOf(b) + 1) || 99));
  const hue = t => topics.indexOf(t) % 5;
  grid.innerHTML = posts.map(p => {
    const topic = p.topic || 'General', btns = [];
    if (p.url) btns.push(`<a class="btn btn--primary" href="${esc(p.url)}"${p.url === '#' ? '' : ' target="_blank" rel="noopener noreferrer"'}>View on LinkedIn <span aria-hidden="true">↗</span></a>`);
    if (p.file) btns.push(`<a class="btn" href="${esc(p.file)}" download>Download <span aria-hidden="true">↓</span></a>`);
    return `<article class="card card--hover post" data-topic="${esc(topic)}">
      <div class="post__top"><span class="post__topic" data-hue="${hue(topic)}">${esc(topic)}</span>${p.date ? `<time class="muted" datetime="${esc(p.date)}">${fmtDate(p.date)}</time>` : ''}</div>
      <h3>${esc(p.title)}</h3>
      ${p.description ? `<p>${esc(p.description)}</p>` : ''}
      ${btns.length ? `<div class="post__actions">${btns.join('')}</div>` : ''}
    </article>`;
  }).join('') + `<div class="card posts__empty" hidden><p class="muted">No posts in this topic yet.</p></div>`;
  const all = ['All', ...topics];
  bar.innerHTML = all.map((t, i) => `<button class="filter" role="tab" type="button" aria-selected="${i === 0}" data-topic="${esc(t)}">${esc(t)}<span class="filter__n">${t === 'All' ? posts.length : posts.filter(p => (p.topic || 'General') === t).length}</span></button>`).join('');
  const cards = $$('.post', grid), emptyEl = $('.posts__empty', grid);
  let current = 'All';
  bar.addEventListener('click', e => {
    const b = e.target.closest('.filter'); if (!b || b.dataset.topic === current) return;
    current = b.dataset.topic;
    $$('.filter', bar).forEach(x => x.setAttribute('aria-selected', String(x === b)));
    const show = cards.filter(c => current === 'All' || c.dataset.topic === current);
    const hide = cards.filter(c => !show.includes(c));
    const apply = () => { hide.forEach(c => c.hidden = true); show.forEach(c => c.hidden = false); emptyEl.hidden = show.length > 0; };
    const gsap = window.gsap;
    if (!gsap || reduceMotion) { apply(); return; }
    const visible = cards.filter(c => !c.hidden);
    gsap.killTweensOf(cards);
    gsap.to(visible, { opacity: 0, y: 12, scale: .97, duration: .18, ease: 'power1.in', stagger: .02,
      onComplete: () => { apply(); gsap.fromTo(show, { opacity: 0, y: 18, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .42, ease: 'power3.out', stagger: .05, clearProps: 'transform' });
        if (window.ScrollTrigger) window.ScrollTrigger.refresh(); } });
  });
}
initPosts();

/* ---------- Three.js hero (lazy, see js/hero.js) ---------- */
import('./hero.js?v=3')
  .then(m => m.initHero({ reduceMotion, isSmall }))
  .catch(e => { console.warn('3D hero disabled:', e && e.message); document.documentElement.classList.add('no-webgl'); });
