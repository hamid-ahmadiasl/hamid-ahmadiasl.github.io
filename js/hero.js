/* Hero scene: CFD streamlines (advected particles with trails, velocity colormap) around a Joukowski
   airfoil, its structured O-grid mesh (refined near the wall) and a neural network with pulses,
   merged in depth and lifted by UnrealBloom. Loaded lazily by main.js; failure falls back to CSS. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const rnd = Math.random;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

export function initHero({ reduceMotion, isSmall }) {
  const canvas = document.getElementById('scene');
  if (!canvas || !webglAvailable()) throw new Error('no-webgl');
  const params = new URLSearchParams(location.search);
  const adaptive = !params.has('noadapt');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  const BG = 0x01040c;                                          // near-black navy (sampled from the LinkedIn cover)
  renderer.setClearColor(BG, 1);
  let pixelRatio = Math.min(window.devicePixelRatio || 1, isSmall ? 1.25 : 1.75);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
  const stage = new THREE.Group(); scene.add(stage);           // everything lives here (offset right of the text on desktop)
  const rig = new THREE.Group(); stage.add(rig);               // airfoil frame (z-plane), rotated so the free stream is horizontal

  /* ===== Joukowski airfoil + potential flow with Kutta condition ===== */
  const c0x = -0.10, c0y = 0.09;                               // circle centre in the ζ-plane
  const A = Math.hypot(1 - c0x, -c0y);                         // circle radius (passes through ζ=1, the trailing edge)
  const delta = Math.atan2(-c0y, 1 - c0x);
  const alpha = 0.15;                                          // angle of attack (rad)
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  const gam = 2 * A * Math.sin(alpha - delta);                 // Γ / 2π from the Kutta condition
  const A2 = A * A;
  const toZ = (xi, eta) => { const m = xi * xi + eta * eta; return [xi + xi / m, eta - eta / m]; };

  let vx = 0, vy = 0, speed = 0, wake = 0;                     // scratch outputs of flowAt (dζ/dt, |V|, vortex-induced |V|)
  /* Kármán vortex street shed from the trailing edge (z-plane, free stream along e^{iα}) */
  const vort = []; let shedAcc = 0, shedSign = 1;
  const FLOW = 2.0, SHED_T = 0.42, TEX = 2.0;                              // shedding period (s), trailing edge at z = 2
  function shedVortex() {
    const off = 0.3 * shedSign, d = 0.25;
    vort.push({ x: TEX + d * ca - off * sa, y: d * sa + off * ca, g: -shedSign * 3.4, age: 0 });
    shedSign = -shedSign; if (vort.length > 22) vort.shift();
  }
  function stepVortices(dt) {
    shedAcc += dt; while (shedAcc > SHED_T) { shedAcc -= SHED_T; shedVortex(); }
    for (const v of vort) {
      let ux = 0.8 * ca * FLOW, uy = 0.8 * sa * FLOW;
      for (const w of vort) if (w !== v) {
        const dx = v.x - w.x, dy = v.y - w.y, r2 = dx * dx + dy * dy + 0.25;
        ux -= w.g * dy / (6.283 * r2) * 0.4; uy += w.g * dx / (6.283 * r2) * 0.4;
      }
      v.x += ux * dt; v.y += uy * dt; v.age += dt;
    }
  }
  function flowAt(xi, eta) {
    const wx = xi - c0x, wy = eta - c0y, w2 = wx * wx + wy * wy;
    const sx = wx * wx - wy * wy, sy = 2 * wx * wy;           // (ζ-ζ0)^2
    const s2 = sx * sx + sy * sy;
    // a² e^{iα} / (ζ-ζ0)²
    const tx = A2 * (ca * sx + sa * sy) / s2, ty = A2 * (sa * sx - ca * sy) / s2;
    // W'(ζ) = e^{-iα} - t + iΓ/2π /(ζ-ζ0)
    const Wr = ca - tx + gam * wy / w2, Wi = -sa - ty + gam * wx / w2;
    // z'(ζ) = 1 - 1/ζ²
    const qx = xi * xi - eta * eta, qy = 2 * xi * eta, q2 = qx * qx + qy * qy;
    const zpr = 1 - qx / q2, zpi = qy / q2, zp2 = zpr * zpr + zpi * zpi;
    // V = W' / z'
    const Vr = (Wr * zpr + Wi * zpi) / zp2, Vi = (Wi * zpr - Wr * zpi) / zp2;
    speed = Math.hypot(Vr, Vi);
    // vortex street contribution (evaluated in the z-plane)
    const mz = xi * xi + eta * eta, zx = xi + xi / mz, zy = eta - eta / mz;
    let ux = 0, uy = 0;
    for (let k = 0; k < vort.length; k++) {
      const v = vort[k], ex = zx - v.x, ey = zy - v.y, q = ex * ex + ey * ey;
      const core = 0.06 + v.age * 0.08;
      const f = v.g / 6.283 * (1 - Math.exp(-q / core)) / (q + 1e-5) * Math.exp(-v.age * 0.18) * smooth(0, 0.35, v.age);
      ux -= f * ey; uy += f * ex;
    }
    wake = Math.hypot(ux, uy);
    speed = Math.hypot(Vr + ux, -Vi + uy);
    // dz/dt = conj(V) + u_vortex;  dζ/dt = (dz/dt) / z'
    const dr = Vr + ux, di = -Vi + uy;
    vx = (dr * zpr + di * zpi) / zp2; vy = (di * zpr - dr * zpi) / zp2;
  }
  function invZ(zr, zi) {                                      // exterior inverse of z = ζ + 1/ζ
    const ar = zr * zr - zi * zi - 4, ai = 2 * zr * zi;
    const mod = Math.hypot(ar, ai), ang = Math.atan2(ai, ar) / 2, sm = Math.sqrt(mod);
    const sr = sm * Math.cos(ang), si = sm * Math.sin(ang);
    const x1 = (zr + sr) / 2, y1 = (zi + si) / 2, x2 = (zr - sr) / 2, y2 = (zi - si) / 2;
    return (x1 * x1 + y1 * y1 >= x2 * x2 + y2 * y2) ? [x1, y1] : [x2, y2];
  }

  /* ===== Streamline particles with trails ===== */
  let N = isSmall ? 1000 : 2600;
  const K = isSmall ? 14 : 16;                                // vertices per trail
  // domain in the horizontal (rig) frame; set from the viewport by setDomain() and refreshed in layout()
  let XH0 = -13, XH1 = 5.2, YH = 6.0, YT = -1.2;                // YT: height the wake is drawn towards (the network)
  const RIG_S_DESK = 0.6, RIG_S_NARROW = 0.34;
  const RIG_DESK = [0.95, 0.75], NET_DESK = [5.5, -0.1];
  const RIG_NARROW = [-1.3, 0.35], NET_NARROW = [1.75, 0.0];
  function setDomain(isNarrow) {
    const s = isNarrow ? RIG_S_NARROW : RIG_S_DESK, r = isNarrow ? RIG_NARROW : RIG_DESK, n = isNarrow ? NET_NARROW : NET_DESK;
    XH0 = isNarrow ? -9 : -19; XH1 = (n[0] - r[0]) / s - (isNarrow ? 0.6 : 0.4);
    YH = isNarrow ? 9 : 8.5; YT = (n[1] - r[1]) / s;
  }
  { const w0 = canvas.clientWidth || innerWidth, h0 = canvas.clientHeight || innerHeight; setDomain(w0 / h0 < 0.95 || w0 < 760); }
  const P = {
    xi: new Float32Array(N), eta: new Float32Array(N), zoff: new Float32Array(N),
    age: new Float32Array(N), life: new Float32Array(N), inten: new Float32Array(N), sp: new Float32Array(N), wk: new Float32Array(N)
  };
  const hist = new Float32Array(N * K * 3);
  const col = new Float32Array(N * K * 3);
  const fade = new Float32Array(K);
  for (let k = 0; k < K; k++) fade[k] = k === K - 1 ? 0 : Math.pow(1 - k / (K - 1), 1.3);

  function spawn(i, anywhere) {
    for (let tries = 0; tries < 6; tries++) {
      const xh = anywhere ? XH0 + rnd() * (XH1 - XH0) : XH0 - rnd() * 0.8;
      const yh = rnd() < 0.2 ? (rnd() + rnd() - 1) * 2.2 : (rnd() + rnd() - 1) * YH;   // dense band around the body
      const zr = xh * ca - yh * sa, zi = xh * sa + yh * ca;
      const [xi, eta] = invZ(zr, zi);
      if (Math.hypot(xi - c0x, eta - c0y) < A * 1.01) continue;
      P.xi[i] = xi; P.eta[i] = eta; break;
    }
    P.zoff[i] = (rnd() - 0.5) * 3.4;
    P.age[i] = 0; P.life[i] = 14 + rnd() * 10;
    const [zx, zy] = toZ(P.xi[i], P.eta[i]);
    const b = i * K * 3;
    for (let k = 0; k < K; k++) { hist[b + k * 3] = zx; hist[b + k * 3 + 1] = zy; hist[b + k * 3 + 2] = P.zoff[i]; }
  }
  for (let i = 0; i < N; i++) spawn(i, true);

  /* Trails drawn as screen-space ribbons: one instanced quad per trail segment, reading the
     history buffer directly (instance j = point j -> point j+1; the segment bridging two particles
     has a zero-colour end and is collapsed in the shader). */
  const ribGeo = new THREE.InstancedBufferGeometry();
  ribGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  const hBuf = new THREE.InstancedInterleavedBuffer(hist, 3, 1).setUsage(THREE.DynamicDrawUsage);
  const cBuf = new THREE.InstancedInterleavedBuffer(col, 3, 1).setUsage(THREE.DynamicDrawUsage);
  ribGeo.setAttribute('iA', new THREE.InterleavedBufferAttribute(hBuf, 3, 0));
  ribGeo.setAttribute('iB', new THREE.InterleavedBufferAttribute(hBuf, 3, 3));
  ribGeo.setAttribute('cA', new THREE.InterleavedBufferAttribute(cBuf, 3, 0));
  ribGeo.setAttribute('cB', new THREE.InterleavedBufferAttribute(cBuf, 3, 3));
  ribGeo.instanceCount = N * K - 1;
  const ribMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uW: { value: isSmall ? 1.7 : 2.1 } },
    vertexShader: `attribute vec3 iA; attribute vec3 iB; attribute vec3 cA; attribute vec3 cB;
      uniform vec2 uRes; uniform float uW; varying vec3 vC; varying float vS;
      void main(){
        float mA=max(cA.r,max(cA.g,cA.b)), mB=max(cB.r,max(cB.g,cB.b));
        if(min(mA,mB) < 1e-4){ gl_Position=vec4(2.,2.,2.,1.); vC=vec3(0.); vS=0.; return; }
        vec4 a=projectionMatrix*modelViewMatrix*vec4(iA,1.), b=projectionMatrix*modelViewMatrix*vec4(iB,1.);
        vec2 sa=a.xy/a.w*uRes, sb=b.xy/b.w*uRes, d=sb-sa; float l=length(d);
        vec2 n = l>1e-4 ? vec2(-d.y,d.x)/l : vec2(0.,1.);
        vec4 p=mix(a,b,position.x);
        float w=uW*(0.55+0.6*clamp(max(mA,mB)*2.5,0.,1.));
        p.xy += n*position.y*w/uRes*p.w;
        gl_Position=p; vC=mix(cA,cB,position.x); vS=position.y;
      }`,
    fragmentShader: `varying vec3 vC; varying float vS; void main(){ float e=1.-vS*vS; gl_FragColor=vec4(vC*e,1.); }`
  });
  const streams = new THREE.Mesh(ribGeo, ribMat);
  streams.frustumCulled = false; streams.renderOrder = 3;
  rig.add(streams);
  let nAct = N;

  // velocity colormap: slow indigo -> blue -> teal -> warm white (fast)
  const stops = [[0, .05, .12, .62], [.22, .05, .42, 1.0], [.45, .10, .86, 1.0], [.62, .90, .97, 1.0], [.80, 1.0, .55, .12], [1, 1.0, .14, .10]];
  function cmap(t, out) {
    for (let s = 1; s < stops.length; s++) {
      if (t <= stops[s][0]) {
        const a = stops[s - 1], b = stops[s], f = (t - a[0]) / (b[0] - a[0]);
        out[0] = a[1] + (b[1] - a[1]) * f; out[1] = a[2] + (b[2] - a[2]) * f; out[2] = a[3] + (b[3] - a[3]) * f; return;
      }
    }
    out[0] = 1; out[1] = .14; out[2] = .1;
  }
  const rgb = [0, 0, 0];
  const GAIN = isSmall ? 0.6 : 0.5;
  let recAcc = 0, doShift = true;

  function stepParticles(dt) {
    stepVortices(dt);
    const h = dt * FLOW;
    recAcc += dt; doShift = recAcc >= 0.09; if (doShift) recAcc = 0;
    for (let i = 0; i < nAct; i++) {
      let xi = P.xi[i], eta = P.eta[i];
      flowAt(xi, eta);
      let dx = vx * h, dy = vy * h;
      {                                                         // past the wake: streamlines converge on the network
        const mz = xi * xi + eta * eta, zx0 = xi + xi / mz, zy0 = eta - eta / mz;
        const xh0 = zx0 * ca + zy0 * sa, yh0 = -zx0 * sa + zy0 * ca;
        const k = smooth(3.0, XH1, xh0) * 0.45;
        if (k > 0) { const gy = (YT - yh0) * k * h, gx = 0.3 * k * h; dx += gx * ca - gy * sa; dy += gx * sa + gy * ca; P.zoff[i] *= (1 - 0.6 * k * dt); }
      }
      const m = Math.hypot(dx, dy);
      if (m > 0.1) { dx *= 0.1 / m; dy *= 0.1 / m; }
      xi += dx; eta += dy;
      const sp = speed;
      P.xi[i] = xi; P.eta[i] = eta; P.sp[i] = sp; P.wk[i] += (wake - P.wk[i]) * 0.25;
      P.age[i] += dt;
      const mm = xi * xi + eta * eta;
      const zx = xi + xi / mm, zy = eta - eta / mm;
      const xh = zx * ca + zy * sa, yh = -zx * sa + zy * ca;
      if (!(mm > 0) || xh > XH1 || Math.abs(yh) > YH * 1.6 || P.age[i] > P.life[i] ||
          (xi - c0x) * (xi - c0x) + (eta - c0y) * (eta - c0y) < A2 * 1.0004) { spawn(i, false); }
      else {
        const b = i * K * 3;
        if (doShift) hist.copyWithin(b + 3, b, b + (K - 1) * 3);
        hist[b] = zx; hist[b + 1] = zy; hist[b + 2] = P.zoff[i];
      }
      // intensity: fade in at inlet/out at outlet, ease at birth/death
      P.inten[i] = smooth(XH0, XH0 + 2.6, xh) * (1 - smooth(XH1 - 2.4, XH1, xh)) *
                   smooth(0, 0.8, P.age[i]) * (1 - smooth(P.life[i] - 1.2, P.life[i], P.age[i]));
    }
  }
  function writeColors() {
    for (let i = 0; i < nAct; i++) {
      const cv = clamp((P.sp[i] - 0.7) / 1.4, 0, 1) * 0.75 + clamp(P.wk[i] * 1.2, 0, 0.8);
      cmap(clamp(cv, 0, 1), rgb);
      const g = P.inten[i] * GAIN * (0.8 + 0.5 * clamp(P.wk[i], 0, 1)), b = i * K * 3;
      for (let k = 0; k < K; k++) {
        const f = fade[k] * g, o = b + k * 3;
        col[o] = rgb[0] * f; col[o + 1] = rgb[1] * f; col[o + 2] = rgb[2] * f;
      }
    }
    hBuf.needsUpdate = true; cBuf.needsUpdate = true;
  }

  /* ===== Body (airfoil) + O-grid mesh refined near the wall ===== */
  const NT = isSmall ? 120 : 200;
  const surf = [];
  for (let j = 0; j <= 240; j++) { const th = (j / 240) * Math.PI * 2; surf.push(toZ(c0x + A * Math.cos(th), c0y + A * Math.sin(th))); }
  const shape = new THREE.Shape(surf.map(p => new THREE.Vector2(p[0], p[1])));
  const body = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0x070c18 }));
  body.position.z = -0.02; body.renderOrder = 1; rig.add(body);
  const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(surf.map(p => new THREE.Vector3(p[0], p[1], 0.02))),
    new THREE.LineBasicMaterial({ color: 0x5ff2ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  outline.renderOrder = 4; rig.add(outline);

  const NR = isSmall ? 16 : 20, NS = isSmall ? 80 : 120;
  const th0 = Math.atan2(0 - c0y, 1 - c0x);                  // trailing-edge angle
  const clusterK = 0.55;
  const rr = [];                                               // geometric wall-normal spacing
  let r = 0; const h0 = 0.03, gr = isSmall ? 1.2 : 1.15;
  for (let i = 0; i <= NR; i++) { rr.push(r); r += h0 * Math.pow(gr, i); }
  const maxR = rr[NR];
  const meshPts = (i, th) => { const q = A + rr[i]; return toZ(c0x + q * Math.cos(th), c0y + q * Math.sin(th)); };
  const thetaOf = (u) => th0 + Math.PI * 2 * (u - clusterK * Math.sin(4 * Math.PI * u) / (4 * Math.PI));
  const mp = [], mR = [];
  for (let i = 1; i <= NR; i++) {                              // rings
    for (let j = 0; j < NT; j++) {
      const a = meshPts(i, thetaOf(j / NT)), b = meshPts(i, thetaOf((j + 1) / NT));
      mp.push(a[0], a[1], 0, b[0], b[1], 0); mR.push(rr[i] / maxR, rr[i] / maxR);
    }
  }
  for (let j = 0; j < NS; j++) {                               // spokes
    const th = thetaOf(j / NS);
    for (let i = 0; i < NR; i++) {
      const a = meshPts(i, th), b = meshPts(i + 1, th);
      mp.push(a[0], a[1], 0, b[0], b[1], 0); mR.push(rr[i] / maxR, rr[i + 1] / maxR);
    }
  }
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
  mGeo.setAttribute('aR', new THREE.Float32BufferAttribute(mR, 1));
  const mMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aR; varying float vR; void main(){ vR=aR; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying float vR; uniform float uTime;
      void main(){
        float base = 0.05 + 0.3*pow(1.0-vR, 2.0);
        float w = fract(uTime*0.11); float d = (vR - w)/0.07;
        float pulse = 0.22*exp(-d*d)*(1.0-vR);
        float f = (base + pulse) * smoothstep(1.0, 0.82, vR);
        gl_FragColor = vec4(vec3(0.14,0.55,0.9)*f, 1.0);
      }`
  });
  const meshLines = new THREE.LineSegments(mGeo, mMat); meshLines.renderOrder = 2; meshLines.frustumCulled = false;
  rig.add(meshLines);

  /* ===== Neural network (right): glowing 3D layers in blue → violet → magenta/pink, with pulses ===== */
  const net = new THREE.Group(); stage.add(net);
  const sizes = isSmall ? [4, 6, 7, 6, 4] : [5, 7, 9, 9, 7, 4];
  const nodes = [], layerOf = [], nCol = [];
  const NL = sizes.length, NW = 4.6;
  const pal = [[.05, .45, 1.0], [.20, .38, 1.0], [.42, .28, 1.0], [.66, .22, 1.0], [.90, .20, .78], [1.0, .22, .52]];   // electric blue → violet → magenta → hot pink
  const palAt = (t, o) => { const f = t * (pal.length - 1), i = Math.min(pal.length - 2, Math.floor(f)), u = f - i;
    for (let c = 0; c < 3; c++) o[c] = pal[i][c] + (pal[i + 1][c] - pal[i][c]) * u; return o; };
  sizes.forEach((n, L) => {
    const x = -NW / 2 + L / (NL - 1) * NW, rad = 1.1 + Math.sin((L + .5) / NL * Math.PI) * 1.5;
    for (let j = 0; j < n; j++) {
      const ang = (j / n) * Math.PI * 2 + L * 0.9, rr = rad * (0.6 + 0.4 * rnd());
      nodes.push(new THREE.Vector3(x + (rnd() - .5) * .45, Math.sin(ang) * rr * 1.2, Math.cos(ang) * rr * 0.9));
      layerOf.push(L); nCol.push(palAt(L / (NL - 1), [0, 0, 0]));
    }
  });
  const edges = [];
  nodes.forEach((A_, i) => {
    const nxt = nodes.map((B_, j) => j).filter(j => layerOf[j] === layerOf[i] + 1).sort((p, q) => A_.distanceTo(nodes[p]) - A_.distanceTo(nodes[q]));
    nxt.slice(0, 3).forEach(j => edges.push([i, j]));
  });
  const ePos = [], eCol = [];
  edges.forEach(([i, j]) => { ePos.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z); eCol.push(...nCol[i], ...nCol[j]); });
  const eGeo = new LineSegmentsGeometry().setPositions(ePos).setColors(eCol.map(v => v * 0.6));
  const edgeMat = new LineMaterial({ vertexColors: true, linewidth: isSmall ? 1.3 : 1.6, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const eLines = new LineSegments2(eGeo, edgeMat); eLines.frustumCulled = false;
  eLines.renderOrder = 2; net.add(eLines);
  // solid cores (instanced spheres, HDR colour so bloom catches them)
  const cores = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }), nodes.length);
  const coreR = nodes.map(() => 0.09 + rnd() * 0.07), m4 = new THREE.Matrix4(), cc = new THREE.Color();
  nodes.forEach((v, i) => { m4.makeScale(coreR[i], coreR[i], coreR[i]).setPosition(v); cores.setMatrixAt(i, m4);
    cores.setColorAt(i, cc.setRGB(nCol[i][0] * .9 + .14, nCol[i][1] * .9 + .14, nCol[i][2] * .9 + .14)); });
  cores.renderOrder = 6; net.add(cores);

  const pointMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 500 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC; uniform float uScale;
      void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=max(1.0,aSize*uScale/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ float r=length(gl_PointCoord-.5)*2.; if(r>1.) discard; float a=pow(1.-r,2.4); gl_FragColor=vec4(vC*a,1.); }`
  });
  function makePoints(n, positions) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const p = new THREE.Points(g, pointMat); p.frustumCulled = false; p.renderOrder = 5; return p;
  }
  const nPos = new Float32Array(nodes.length * 3); nodes.forEach((v, i) => v.toArray(nPos, i * 3));
  const nodePts = makePoints(nodes.length, nPos); net.add(nodePts);          // soft halos
  const glow = new Float32Array(nodes.length);
  const NP = isSmall ? 50 : 130;
  const pulses = [];
  const outgoing = nodes.map((_, i) => edges.map((e, k) => e[0] === i ? k : -1).filter(k => k >= 0));
  for (let i = 0; i < NP; i++) pulses.push({ e: Math.floor(rnd() * edges.length), t: rnd(), v: .35 + rnd() * .45 });
  const pulsePts = makePoints(NP, new Float32Array(NP * 3)); net.add(pulsePts);
  function updateNet(dt, t) {
    const sA = nodePts.geometry.attributes.aSize, cA = nodePts.geometry.attributes.aColor;
    for (let i = 0; i < nodes.length; i++) {
      glow[i] *= Math.pow(0.15, dt);
      const g = glow[i], b = 0.75 + 0.2 * Math.sin(t * 1.3 + i * 1.7), c = nCol[i];
      sA.array[i] = coreR[i] * 5 + 0.25 * g;
      cA.array[i * 3] = c[0] * (.3 + .4 * g) * b; cA.array[i * 3 + 1] = c[1] * (.3 + .4 * g) * b; cA.array[i * 3 + 2] = c[2] * (.3 + .4 * g) * b;
    }
    sA.needsUpdate = true; cA.needsUpdate = true;
    const pp = pulsePts.geometry.attributes.position, ps = pulsePts.geometry.attributes.aSize, pc = pulsePts.geometry.attributes.aColor;
    pulses.forEach((p, i) => {
      p.t += dt * p.v;
      if (p.t >= 1) {
        const dst = edges[p.e][1]; glow[dst] = Math.min(1.6, glow[dst] + 0.8);
        const out = outgoing[dst];
        p.e = out.length ? out[Math.floor(rnd() * out.length)] : Math.floor(rnd() * edges.length);
        p.t = 0;
      }
      const [a, b] = edges[p.e], A_ = nodes[a], B_ = nodes[b], ca_ = nCol[a], cb = nCol[b], f = Math.max(0, Math.sin(clamp(p.t, 0, 1) * Math.PI));
      pp.array[i * 3] = A_.x + (B_.x - A_.x) * p.t; pp.array[i * 3 + 1] = A_.y + (B_.y - A_.y) * p.t; pp.array[i * 3 + 2] = A_.z + (B_.z - A_.z) * p.t;
      ps.array[i] = 0.22;
      for (let c = 0; c < 3; c++) pc.array[i * 3 + c] = ((ca_[c] + (cb[c] - ca_[c]) * p.t) * .8 + .25) * f * 1.2;
    });
    pp.needsUpdate = true; ps.needsUpdate = true; pc.needsUpdate = true;
    net.rotation.y = Math.sin(t * 0.11) * 0.45 + t * 0.03;
    net.rotation.x = Math.sin(t * 0.08) * 0.08;
  }

  // faint depth dust
  const ND = isSmall ? 60 : 140, dPos = new Float32Array(ND * 3);
  for (let i = 0; i < ND; i++) { dPos[i * 3] = (rnd() - .5) * 34; dPos[i * 3 + 1] = (rnd() - .5) * 18; dPos[i * 3 + 2] = -14 + rnd() * 18; }
  const dust = makePoints(ND, dPos);
  for (let i = 0; i < ND; i++) { const b = .12 + rnd() * .25; dust.geometry.attributes.aSize.array[i] = .05 + rnd() * .05; dust.geometry.attributes.aColor.array.set([b * .6, b * .9, b], i * 3); }
  stage.add(dust);

  /* ===== Post-processing ===== */
  let composer = null, bloom = null, useBloom = true;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), isSmall ? 0.55 : 0.6, 0.45, 0.25);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  } catch (e) { composer = null; useBloom = false; }

  /* ===== Layout / resize ===== */
  let W = 1, H = 1, camZ = 10.5, narrow = false;
  function layout() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    narrow = W / H < 0.95 || W < 760;
    renderer.setPixelRatio(pixelRatio); renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(pixelRatio); composer.setSize(W, H); }
    camera.aspect = W / H; camera.updateProjectionMatrix();
    setDomain(narrow);
    if (narrow) {
      camZ = 15.5; stage.position.set(0, 3.7, 0); stage.scale.setScalar(1);
      rig.position.set(RIG_NARROW[0], RIG_NARROW[1], 0); rig.scale.setScalar(RIG_S_NARROW);
      net.position.set(NET_NARROW[0], NET_NARROW[1], 0); net.scale.setScalar(0.5);
    } else {
      camZ = 10.5; const a = W / H;                              // keep the right-hand composition on wide/narrow desktops
      stage.position.set(clamp((a - 1.6) * 2.2, -0.8, 2.2), 0, 0); stage.scale.setScalar(clamp(a / 1.6, 0.78, 1.15));
      rig.position.set(RIG_DESK[0], RIG_DESK[1], 0); rig.scale.setScalar(RIG_S_DESK);
      net.position.set(NET_DESK[0], NET_DESK[1], 0); net.scale.setScalar(0.68);
    }
    rig.rotation.z = -alpha;
    ribMat.uniforms.uRes.value.set(W * pixelRatio / 2, H * pixelRatio / 2); ribMat.uniforms.uW.value = (isSmall ? 1.7 : 2.1) * pixelRatio;
    edgeMat.resolution.set(W * pixelRatio, H * pixelRatio);
    pointMat.uniforms.uScale.value = (H * pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }
  layout();
  window.addEventListener('resize', () => { layout(); if (reduceMotion) drawStatic(); });

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!isSmall && !reduceMotion) {
    window.addEventListener('pointermove', e => {
      mouse.tx = (e.clientX / window.innerWidth - .5) * 2; mouse.ty = (e.clientY / window.innerHeight - .5) * 2;
    }, { passive: true });
  }

  function render() { (useBloom && composer) ? composer.render() : renderer.render(scene, camera); }
  function drawStatic() {
    camera.position.set(0.6, 0.2, camZ); camera.lookAt(0, 0, 0);
    mMat.uniforms.uTime.value = 1.4; updateNet(0.016, 2); writeColors(); render();
  }

  /* ===== Adaptive quality & stats ===== */
  const stats = { rawSum: 0, rawN: 0, avgRawFrameMs: 0, frames: 0, sum: 0, jsSum: 0, win: 0, winSum: 0, level: 0, avgFrameMs: 0, avgJsMs: 0 };
  window.__hero = stats;
  function degrade() {
    stats.level++;
    if (stats.level === 1) {
      pixelRatio = Math.min(pixelRatio, 1); nAct = Math.floor(N * 0.65); layout();
      if (bloom) bloom.resolution.set(W / 2, H / 2);
    } else if (stats.level === 2) {
      useBloom = false; nAct = Math.floor(N * 0.4);
      for (let i = nAct * K * 3; i < col.length; i++) col[i] = 0;
    }
  }

  const clock = { last: performance.now(), t: 0 };
  let raf = 0, running = false;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const rawMs = now - clock.last; stats.rawSum += rawMs; stats.rawN++; stats.avgRawFrameMs = stats.rawSum / stats.rawN;
    const dtReal = Math.min(rawMs / 1000, 0.05); clock.last = now;
    const t0 = performance.now();
    clock.t += dtReal; const t = clock.t;
    mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
    camera.position.set(Math.sin(t * 0.07) * 1.1 + mouse.x * 0.9, Math.sin(t * 0.05) * 0.45 - mouse.y * 0.55, camZ + Math.sin(t * 0.04) * 0.5);
    camera.lookAt(mouse.x * 0.3, -mouse.y * 0.2, 0);
    stage.rotation.y = Math.sin(t * 0.06) * 0.05 + mouse.x * 0.04;
    mMat.uniforms.uTime.value = t;
    stepParticles(dtReal); writeColors(); updateNet(dtReal, t);
    const t1 = performance.now();
    render();
    stats.jsSum += (t1 - t0);
    if (stats.frames++ > 0) {                                  // skip first (compile) frame
      stats.sum += dtReal * 1000; stats.win++; stats.winSum += dtReal * 1000;
      stats.avgFrameMs = stats.sum / (stats.frames - 1); stats.avgJsMs = stats.jsSum / stats.frames;
      if (adaptive && stats.win >= 90) {
        const avg = stats.winSum / stats.win; stats.win = 0; stats.winSum = 0;
        if (avg > 24 && stats.level < 2) degrade();
      }
    }
  }
  function start() { if (!running) { running = true; clock.last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  if (reduceMotion) {
    for (let s = 0; s < 420; s++) stepParticles(1 / 40);       // pre-advect so the still frame shows developed streamlines
    drawStatic();
  } else {
    for (let s = 0; s < 300; s++) stepParticles(1 / 40);        // trails already formed on first paint
    start();
    let inView = true;
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; (inView && !document.hidden) ? start() : stop(); }, { threshold: 0 }).observe(canvas);
    document.addEventListener('visibilitychange', () => { (!document.hidden && inView) ? start() : stop(); });
  }
  canvas.dataset.ready = 'true';
}
