/* Shared decorative pop-ups for Education (graduation cap / UNIMIB logo)
   and Patents (stylized certificate). Pointer-events stay off the pop-up
   so it never blocks the page. Touch toggles; fine pointers use hover. */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const CAP_SVG = `
<svg class="flourish__art flourish__art--cap" viewBox="0 0 220 180" aria-hidden="true">
  <defs>
    <linearGradient id="flCap" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5fd0f5"/><stop offset=".55" stop-color="#8f86ff"/><stop offset="1" stop-color="#ed599a"/>
    </linearGradient>
    <linearGradient id="flCapHat" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7b8bff"/><stop offset="1" stop-color="#2ab6ed"/>
    </linearGradient>
    <filter id="flGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g class="flourish__sparkles" fill="#e8eef8">
    <circle class="sp sp--1" cx="22" cy="36" r="2.2"/>
    <circle class="sp sp--2" cx="198" cy="28" r="1.8"/>
    <circle class="sp sp--3" cx="30" cy="150" r="1.6"/>
    <circle class="sp sp--4" cx="200" cy="120" r="2"/>
    <circle class="sp sp--5" cx="110" cy="14" r="1.5"/>
    <path class="sp sp--6" d="M52 18l1.4 3.2 3.2 1.4-3.2 1.4-1.4 3.2-1.4-3.2-3.2-1.4 3.2-1.4Z"/>
    <path class="sp sp--7" d="M176 150l1.2 2.6 2.6 1.2-2.6 1.2-1.2 2.6-1.2-2.6-2.6-1.2 2.6-1.2Z"/>
  </g>
  <g class="flourish__cap" filter="url(#flGlow)">
    <polygon points="110,28 24,68 110,96 196,68" fill="url(#flCapHat)" stroke="url(#flCap)" stroke-width="2"/>
    <polygon points="110,28 196,68 110,78" fill="rgba(255,255,255,.18)"/>
    <rect x="72" y="90" width="76" height="28" rx="4" fill="#1a2a58" stroke="#8f86ff" stroke-width="1.4"/>
    <path d="M72 96h76" stroke="rgba(95,208,245,.45)" stroke-width="1"/>
    <g class="flourish__tassel" transform="translate(168 68)">
      <line x1="0" y1="0" x2="0" y2="38" stroke="#ed599a" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="0" cy="0" r="4.2" fill="#ffd27a"/>
      <path d="M0 38c-6 8 6 12 0 18" fill="none" stroke="#ed599a" stroke-width="2" stroke-linecap="round"/>
      <circle cx="0" cy="58" r="3.4" fill="url(#flCap)"/>
    </g>
  </g>
  <g class="flourish__diploma" filter="url(#flGlow)">
    <rect x="48" y="118" width="92" height="36" rx="5" transform="rotate(-18 94 136)" fill="#eef4ff" stroke="#a493ff" stroke-width="1.6"/>
    <rect x="52" y="124" width="84" height="6" rx="2" transform="rotate(-18 94 136)" fill="#cfd8ff"/>
    <rect x="56" y="134" width="70" height="3.5" rx="1.5" transform="rotate(-18 94 136)" fill="#b7c3f0"/>
    <path d="M86 148c8 10 28 8 34-2" fill="none" stroke="#e04ba0" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M96 152c6 8 18 6 22-2" fill="none" stroke="#7b5cff" stroke-width="3.2" stroke-linecap="round"/>
    <circle cx="118" cy="148" r="4" fill="#ffd27a" stroke="#e04ba0" stroke-width="1"/>
  </g>
</svg>`;

function certificateSVG(title, meta) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const t = esc(title);
  // wrap long titles roughly
  return `
  <div class="flourish__cert">
    <svg class="flourish__guilloche" viewBox="0 0 320 220" aria-hidden="true">
      <defs>
        <linearGradient id="flGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffe7a3"/><stop offset=".5" stop-color="#e0b24a"/><stop offset="1" stop-color="#f3d27a"/>
        </linearGradient>
        <filter id="flCertGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect x="8" y="8" width="304" height="204" rx="10" fill="none" stroke="url(#flGold)" stroke-width="2.2"/>
      <rect x="16" y="16" width="288" height="188" rx="7" fill="none" stroke="rgba(164,147,255,.55)" stroke-width="1.1"/>
      <g fill="none" stroke="rgba(95,208,245,.22)" stroke-width="0.7">
        <ellipse cx="160" cy="110" rx="128" ry="82"/>
        <ellipse cx="160" cy="110" rx="112" ry="70"/>
        <ellipse cx="160" cy="110" rx="96" ry="58"/>
        <circle cx="160" cy="110" r="54"/>
        <circle cx="160" cy="110" r="40"/>
      </g>
    </svg>
    <div class="flourish__cert-body">
      <p class="flourish__cert-kicker">Certificate of Patent</p>
      <h4 class="flourish__cert-title">${t}</h4>
      <p class="flourish__cert-meta">${esc(meta)}</p>
      <div class="flourish__seal" aria-hidden="true">
        <span class="flourish__seal-disc">★</span>
        <span class="flourish__ribbon flourish__ribbon--l"></span>
        <span class="flourish__ribbon flourish__ribbon--r"></span>
      </div>
    </div>
    <span class="flourish__spark sp--a"></span>
    <span class="flourish__spark sp--b"></span>
    <span class="flourish__spark sp--c"></span>
  </div>`;
}

const UNIMIB_HTML = `
  <figure class="flourish__logo">
    <img src="assets/edu/unimib-logo.png" width="160" height="172" alt="Università degli Studi di Milano-Bicocca official logo">
  </figure>`;

let host = null, hideTimer = 0, current = null;

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.id = 'flourish';
  host.className = 'flourish';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  return host;
}

function fill(type, el) {
  const h = ensureHost();
  if (type === 'cap') h.innerHTML = CAP_SVG;
  else if (type === 'unimib') h.innerHTML = UNIMIB_HTML;
  else if (type === 'patent') {
    h.innerHTML = certificateSVG(el.getAttribute('data-title') || '', el.getAttribute('data-meta') || '');
  } else h.innerHTML = '';
  h.dataset.type = type;
}

function place(anchor) {
  const h = ensureHost();
  h.classList.add('is-measuring');
  const w = h.offsetWidth || 280;
  const ht = h.offsetHeight || 200;
  h.classList.remove('is-measuring');
  const r = anchor.getBoundingClientRect();
  let left, top;
  if (r.width > window.innerWidth * 0.55) {
    // Wide education cards: mostly in the timeline gutter, slight overlap of the card
    left = r.left - w + 56;
  } else {
    left = r.left + r.width * 0.55;
    if (left + w > window.innerWidth - 12) left = r.left + r.width / 2 - w / 2;
  }
  left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
  top = r.top + r.height / 2 - ht / 2;
  top = Math.max(12, Math.min(top, window.innerHeight - ht - 12));
  h.style.left = `${Math.round(left)}px`;
  h.style.top = `${Math.round(top)}px`;
}

function show(el) {
  const type = el.getAttribute('data-flourish');
  if (!type) return;
  clearTimeout(hideTimer);
  const h = ensureHost();
  if (current !== el) fill(type, el);
  current = el;
  place(el);
  h.classList.add('is-on');
  if (reduceMotion) h.classList.add('is-static');
  else h.classList.remove('is-static');
}

function hide() {
  if (!host) return;
  host.classList.remove('is-on');
  current = null;
}

function hideSoon() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, 80);
}

export function initFlourish() {
  const cards = [...document.querySelectorAll('[data-flourish]')];
  if (!cards.length) return;
  ensureHost();

  cards.forEach((el) => {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.classList.add('flourish-anchor');
    if (finePointer) {
      el.addEventListener('mouseenter', () => show(el));
      el.addEventListener('mouseleave', hideSoon);
      el.addEventListener('focus', () => show(el));
      el.addEventListener('blur', hideSoon);
    } else {
      el.addEventListener('click', (e) => {
        // don't hijack genuine links inside the card
        if (e.target.closest('a')) return;
        e.preventDefault();
        if (current === el && host.classList.contains('is-on')) hide();
        else show(el);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    }
  });

  if (!finePointer) {
    document.addEventListener('click', (e) => {
      if (current && !e.target.closest('[data-flourish]')) hide();
    });
  }
  window.addEventListener('scroll', () => { if (current) place(current); }, { passive: true });
  window.addEventListener('resize', () => { if (current) place(current); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}
