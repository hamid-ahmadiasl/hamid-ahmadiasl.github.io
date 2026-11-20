/* Hamid Ahmadi Asl — personal site
   Three.js hero scene (turbine + gear + neural-network field), GSAP scroll reveals. */
import * as THREE from 'three';

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

/* ---------- Three.js hero ---------- */
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

function initScene() {
  const canvas = $('#scene');
  if (!webglAvailable()) { document.documentElement.classList.add('no-webgl'); return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSmall, alpha: true, powerPreference: 'low-power' });
  } catch (e) { document.documentElement.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const cyan = new THREE.Color(0x22d3ee), teal = new THREE.Color(0x2dd4bf);
  const lineMat = (c, o) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o });

  const root = new THREE.Group();          // follows mouse
  scene.add(root);
  const rig = new THREE.Group();           // placement (right side on desktop)
  root.add(rig);

  /* Turbine: hub + 3 twisted blades, inside a duct ring (nod to ducted wind-turbine research) */
  const turbine = new THREE.Group();
  const hub = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(.35, .35, .5, 18).rotateX(Math.PI / 2)), lineMat(cyan, .9));
  turbine.add(hub);
  const bladeCount = 3;
  for (let i = 0; i < bladeCount; i++) {
    const g = new THREE.BoxGeometry(.55, 2.5, .05, 3, 14, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {            // twist along the span
      const y = p.getY(k), x = p.getX(k), a = (y / 2.5) * 0.9;
      p.setX(k, x * Math.cos(a) - 0 * Math.sin(a));
      p.setZ(k, p.getZ(k) + x * Math.sin(a) * .9);
      p.setX(k, x * (1 - .35 * (y / 2.5 + .5)));   // taper
    }
    g.translate(0, 1.55, 0);
    const blade = new THREE.LineSegments(new THREE.WireframeGeometry(g), lineMat(i % 2 ? teal : cyan, .55));
    blade.rotation.z = (i / bladeCount) * Math.PI * 2;
    turbine.add(blade);
  }
  rig.add(turbine);
  const duct = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusGeometry(3.3, .09, 8, 72)), lineMat(teal, .45));
  rig.add(duct);

  /* Gear: extruded toothed profile, edges only */
  function makeGear(teeth, rOuter, rRoot, hole) {
    const s = new THREE.Shape(), n = teeth * 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = (i % 4 === 1 || i % 4 === 2) ? rOuter : rRoot;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i ? s.lineTo(x, y) : s.moveTo(x, y);
    }
    s.closePath();
    const h = new THREE.Path(); h.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(h);
    const geo = new THREE.ExtrudeGeometry(s, { depth: .3, bevelEnabled: false });
    geo.translate(0, 0, -.15);
    return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), lineMat(cyan, .5));
  }
  const gearA = makeGear(24, 4.75, 4.25, 3.9); gearA.position.z = -.6;
  rig.add(gearA);
  const gearB = makeGear(10, 1.55, 1.2, .5); gearB.position.set(4.9, -3.2, -.6);
  rig.add(gearB);

  /* Neural-network field: nodes + proximity edges */
  const nodeCount = isSmall ? 70 : 160;
  const pts = [];
  for (let i = 0; i < nodeCount; i++) {
    const r = 5 + Math.random() * 7, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pts.push(new THREE.Vector3(r * Math.sin(ph) * Math.cos(th) * 1.25, r * Math.sin(ph) * Math.sin(th) * .8, r * Math.cos(ph) * .6 - 3));
  }
  const nodeGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const nodes = new THREE.Points(nodeGeo, new THREE.PointsMaterial({ color: 0x7cf0ff, size: .09, transparent: true, opacity: .85, sizeAttenuation: true, depthWrite: false }));
  const segs = [];
  const maxD = 3.2, maxPer = 3;
  pts.forEach((a, i) => {
    let c = 0;
    for (let j = i + 1; j < pts.length && c < maxPer; j++) {
      if (a.distanceTo(pts[j]) < maxD) { segs.push(a.x, a.y, a.z, pts[j].x, pts[j].y, pts[j].z); c++; }
    }
  });
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  const edges = new THREE.LineSegments(edgeGeo, lineMat(teal, .22));
  const field = new THREE.Group(); field.add(nodes, edges);
  root.add(field);

  /* Layout / resize */
  function layout() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const narrow = w < 900;
    rig.position.set(narrow ? 0 : 3.9, narrow ? 2.2 : 0, 0);
    rig.scale.setScalar(narrow ? .62 : Math.min(.85, w / 1700 + .1));
  }
  layout();
  window.addEventListener('resize', layout);

  /* Mouse parallax */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!isSmall && !reduceMotion) {
    window.addEventListener('pointermove', e => {
      mouse.tx = (e.clientX / window.innerWidth - .5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - .5) * 2;
    }, { passive: true });
  }

  const clock = new THREE.Clock();
  let visible = true, raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * .05; mouse.y += (mouse.ty - mouse.y) * .05;
    turbine.rotation.z = -t * .35;
    gearA.rotation.z = t * .05;
    gearB.rotation.z = -t * .05 * (24 / 10) + .15;
    duct.rotation.z = t * .02;
    field.rotation.y = t * .02 + mouse.x * .12;
    field.rotation.x = mouse.y * .06;
    root.rotation.y = mouse.x * .22 + Math.sin(t * .2) * .08;
    root.rotation.x = mouse.y * .12;
    renderer.render(scene, camera);
  }
  const renderOnce = () => { turbine.rotation.z = .4; root.rotation.y = -.25; root.rotation.x = .1; renderer.render(scene, camera); };

  if (reduceMotion) {
    renderOnce();
    window.addEventListener('resize', renderOnce);
  } else {
    frame();
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !visible) { visible = true; raf = requestAnimationFrame(frame); }
      else if (!e.isIntersecting && visible) { visible = false; cancelAnimationFrame(raf); }
    }, { threshold: 0 }).observe(canvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); visible = false; }
      else if (!visible) { visible = true; raf = requestAnimationFrame(frame); }
    });
  }
  canvas.dataset.ready = 'true';
}

try { initScene(); } catch (e) { console.warn('3D scene disabled:', e); document.documentElement.classList.add('no-webgl'); }
