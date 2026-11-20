/* Training & Insights: shared card + filter code for insights.html (full list) and the homepage preview.
   Data: data/posts.json, each post { title, topic, description, date (YYYY-MM-DD, optional),
   url (LinkedIn link, optional), file (e.g. "files/guide.pdf", optional) }. */
const TOPIC_ORDER = ['AI Foundations', 'ML Fundamentals', 'Neural Networks', 'AI × CFD', 'AI Perspectives', 'CFD', 'Machine Learning', 'HPC', 'Python', 'Engineering Design'];
const LINKEDIN = 'http://www.linkedin.com/in/hamid-ahmadi-asl-bb3005ab';
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => { const x = new Date(d + 'T12:00:00'); return isNaN(x) ? '' : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
export const slug = t => String(t).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const topicOf = p => p.topic || 'General';
const emptyCard = msg => `<div class="card posts__empty"><p class="muted">${msg}</p><a class="btn" href="${LINKEDIN}" target="_blank" rel="noopener noreferrer">See my posts on LinkedIn ↗</a></div>`;

export async function loadPosts() {
  const r = await fetch('data/posts.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(r.status);
  const j = await r.json();
  const posts = (Array.isArray(j) ? j : (j.posts || [])).filter(p => p && p.title)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));          // newest first
  const topics = [...new Set(posts.map(topicOf))]
    .sort((a, b) => ((TOPIC_ORDER.indexOf(a) + 1) || 99) - ((TOPIC_ORDER.indexOf(b) + 1) || 99));
  return { posts, topics };
}

export function cardHTML(p, topics, linkTopics = false) {
  const topic = topicOf(p), btns = [], hue = topics.indexOf(topic) % 5;
  if (p.url) btns.push(`<a class="btn btn--primary" href="${esc(p.url)}"${p.url === '#' ? '' : ' target="_blank" rel="noopener noreferrer"'}>View on LinkedIn <span aria-hidden="true">↗</span></a>`);
  if (p.file) btns.push(`<a class="btn" href="${esc(p.file)}" download>Download <span aria-hidden="true">↓</span></a>`);
  const badge = linkTopics
    ? `<a class="post__topic" data-hue="${hue}" href="insights.html?topic=${slug(topic)}">${esc(topic)}</a>`
    : `<span class="post__topic" data-hue="${hue}">${esc(topic)}</span>`;
  return `<article class="card card--hover post" data-topic="${esc(topic)}">
      <div class="post__top">${badge}${p.date ? `<time class="muted" datetime="${esc(p.date)}">${fmtDate(p.date)}</time>` : ''}</div>
      <h3>${esc(p.title)}</h3>
      ${p.description ? `<p>${esc(p.description)}</p>` : ''}
      ${btns.length ? `<div class="post__actions">${btns.join('')}</div>` : ''}
    </article>`;
}

/* Homepage: the N latest posts (topic badges deep-link to insights.html?topic=…) */
export async function initPostsPreview(grid, { limit = 3 } = {}) {
  try {
    const { posts, topics } = await loadPosts();
    grid.innerHTML = posts.length ? posts.slice(0, limit).map(p => cardHTML(p, topics, true)).join('') : emptyCard('New training posts are coming soon.');
  } catch (e) { grid.innerHTML = emptyCard('Posts could not be loaded right now.'); }
}

/* insights.html: all posts + topic filter tabs, deep links via ?topic=<slug or name> */
export async function initPostsPage(grid, bar, { reduceMotion = false } = {}) {
  let posts, topics;
  try { ({ posts, topics } = await loadPosts()); }
  catch (e) { grid.innerHTML = emptyCard('Posts could not be loaded right now.'); bar.hidden = true; return; }
  if (!posts.length) { grid.innerHTML = emptyCard('New training posts are coming soon.'); bar.hidden = true; return; }
  grid.innerHTML = posts.map(p => cardHTML(p, topics)).join('') + `<div class="card posts__empty" hidden><p class="muted">No posts in this topic yet.</p></div>`;
  const all = ['All', ...topics];
  bar.innerHTML = all.map(t => `<button class="filter" role="tab" type="button" aria-selected="false" data-topic="${esc(t)}">${esc(t)}<span class="filter__n">${t === 'All' ? posts.length : posts.filter(p => topicOf(p) === t).length}</span></button>`).join('');
  const cards = $$('.post', grid), emptyEl = grid.querySelector('.posts__empty');
  const find = q => q ? topics.find(t => slug(t) === slug(q)) : null;
  let current = null;

  function select(topic, { animate = true, push = true } = {}) {
    topic = topic || 'All';
    if (topic === current) return;
    const first = current === null; current = topic;
    $$('.filter', bar).forEach(x => x.setAttribute('aria-selected', String(x.dataset.topic === topic)));
    if (push && !first) {
      const u = new URL(location.href);
      topic === 'All' ? u.searchParams.delete('topic') : u.searchParams.set('topic', slug(topic));
      history.replaceState(null, '', u);
    }
    const show = cards.filter(c => topic === 'All' || c.dataset.topic === topic);
    const apply = () => { cards.forEach(c => c.hidden = !show.includes(c)); emptyEl.hidden = show.length > 0; };
    const gsap = window.gsap;
    if (first || !animate || !gsap || reduceMotion) { apply(); return; }
    const visible = cards.filter(c => !c.hidden);
    gsap.killTweensOf(cards);
    gsap.to(visible, { opacity: 0, y: 12, scale: .97, duration: .18, ease: 'power1.in', stagger: .02,
      onComplete: () => { apply(); gsap.fromTo(show, { opacity: 0, y: 18, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .42, ease: 'power3.out', stagger: .05, clearProps: 'transform' });
        if (window.ScrollTrigger) window.ScrollTrigger.refresh(); } });
  }
  bar.addEventListener('click', e => { const b = e.target.closest('.filter'); if (b) select(b.dataset.topic); });
  select(find(new URLSearchParams(location.search).get('topic')) || 'All', { push: false });
}
