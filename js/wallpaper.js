/* Wallpaper motion: glowing pulses travel along the wallpaper's streamlines (same paths as
   assets/wallpaper.svg, from assets/wallpaper-flow.json) and the vortex swirls slowly rotate.
   One canvas inside .wallpaper, so it shares the wallpaper's opacity, drift and cover-fit.
   ~30 fps, paused while the tab is hidden or the hero covers the screen; static under reduced motion. */
export async function initWallpaper({ reduceMotion = false } = {}) {
  const host = document.querySelector('.wallpaper');
  if (!host) return;
  const res = await fetch('assets/wallpaper-flow.json?v=9');
  if (!res.ok) throw new Error('wallpaper-flow ' + res.status);
  const data = await res.json();
  const canvas = document.createElement('canvas');
  canvas.className = 'wallpaper__flow';
  host.prepend(canvas);
  const ctx = canvas.getContext('2d');

  // polylines with cumulative arc length
  const lines = data.lines.map(a => {
    const n = a.length / 2, x = new Float32Array(n), y = new Float32Array(n), L = new Float32Array(n);
    for (let i = 0; i < n; i++) { x[i] = a[2 * i]; y[i] = a[2 * i + 1]; if (i) L[i] = L[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]); }
    return { x, y, L, len: L[n - 1] };
  }).filter(l => l.len > 80);
  const rnd = Math.random;
  const pulses = [];
  lines.forEach((l, i) => {
    const k = l.len > 1400 ? 2 : 1;
    for (let j = 0; j < k; j++) pulses.push({ l, s: rnd() * l.len, v: 55 + rnd() * 110, len: 70 + rnd() * 90 });
  });
  const stops = [[0, [22, 159, 235]], [.45, [42, 182, 237]], [.75, [123, 92, 255]], [1, [224, 75, 160]]];
  const colAt = u => {
    u = Math.min(1, Math.max(0, u));
    for (let i = 1; i < stops.length; i++) if (u <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i], f = (u - a[0]) / (b[0] - a[0]);
      return a[1].map((c, k) => Math.round(c + (b[1][k] - c) * f));
    }
    return stops[3][1];
  };
  const W = data.w, H = data.h;
  let s = 1, ox = 0, oy = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cw = host.clientWidth, ch = host.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    s = Math.max(cw / W, ch / H); ox = (cw - W * s) / 2; oy = (ch - H * s) / 2;   // same fit as the CSS background
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
  }
  function pointAt(l, d, out) {             // position at arc length d (binary search)
    let lo = 0, hi = l.L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; (l.L[m] < d) ? lo = m : hi = m; }
    const f = (d - l.L[lo]) / ((l.L[hi] - l.L[lo]) || 1);
    out[0] = l.x[lo] + (l.x[hi] - l.x[lo]) * f; out[1] = l.y[lo] + (l.y[hi] - l.y[lo]) * f; return lo;
  }
  const P = [0, 0], Q = [0, 0];
  function drawSwirls(t) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 0.9; ctx.globalAlpha = 0.55;
    for (const [vx, vy, c, sgn, col] of data.swirls) {
      const rot = reduceMotion ? 0 : sgn * t * 0.5;
      ctx.beginPath();
      for (let k = 0; k < 70; k++) {
        const a = sgn * k * 0.22 + rot, r = c * 0.15 + k * c * 0.022;
        const x = vx + r * Math.cos(a), y = vy + r * Math.sin(a);
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = col; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawPulses(dt) {
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const p of pulses) {
      p.s += p.v * dt;
      if (p.s - p.len > p.l.len) { p.s = 0; p.v = 55 + rnd() * 110; }
      const head = Math.min(p.s, p.l.len), tail = Math.max(0, p.s - p.len);
      if (head - tail < 2) continue;
      const i0 = pointAt(p.l, tail, Q), i1 = pointAt(p.l, head, P);
      const c = colAt(P[0] / W), g = ctx.createLinearGradient(Q[0], Q[1], P[0], P[1]);
      g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(1, `rgba(${c},1)`);
      ctx.beginPath(); ctx.moveTo(Q[0], Q[1]);
      for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(p.l.x[i], p.l.y[i]);
      ctx.lineTo(P[0], P[1]);
      ctx.strokeStyle = g;
      ctx.lineWidth = 4.5; ctx.globalAlpha = 0.28; ctx.stroke();      // soft glow
      ctx.lineWidth = 1.7; ctx.globalAlpha = 1; ctx.stroke();         // bright core
      ctx.fillStyle = `rgba(${c},.9)`; ctx.beginPath(); ctx.arc(P[0], P[1], 1.9, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function clear() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore(); }

  resize();
  let t = 0;
  const draw = dt => { clear(); drawSwirls(t); if (!reduceMotion) drawPulses(dt); };
  window.addEventListener('resize', () => { resize(); draw(0); });
  if (reduceMotion) { draw(0); return; }
  for (const p of pulses) p.s = rnd() * (p.l.len + p.len);   // spread pulses on first paint
  draw(0);
  let raf = 0, last = performance.now(), acc = 0;
  const hero = document.querySelector('.hero');
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1); last = now; acc += dt;
    if (acc < 1 / 32) return;                                   // ~30 fps is plenty for a background
    const step = acc; acc = 0;
    if (hero && hero.getBoundingClientRect().bottom > innerHeight * 0.98) return;   // fully hidden behind the hero
    t += step; draw(step);
  }
  const start = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', () => document.hidden ? cancelAnimationFrame(raf) : start());
  start();
  window.__wallpaper = { pulses: pulses.length, lines: lines.length };
}
