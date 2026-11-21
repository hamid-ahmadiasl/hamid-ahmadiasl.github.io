/* Hero scene: a procedurally built 3-bladed wind turbine with a spinning rotor, CFD streamlines of
   tiny binary 0/1 glyphs through the rotor disk into a swirling helical wake with tip vortices
   (advected particles, cyan/blue, fading along each trail) that dissolve into a breathing neural
   network with pulses, merged in depth and lifted by UnrealBloom. Loaded lazily by main.js; failure
   falls back to CSS. */
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

const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

export async function initHero({ reduceMotion, isSmall }) {
  const tInit = performance.now();
  const canvas = document.getElementById('scene');
  if (!canvas || !webglAvailable()) throw new Error('no-webgl');
  const params = new URLSearchParams(location.search);
  const adaptive = !params.has('noadapt');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  const BG = 0x01040c;                                          // near-black navy (sampled from the LinkedIn cover)
  renderer.setClearColor(BG, 1);
  let pixelRatio = Math.min(window.devicePixelRatio || 1, isSmall ? 1.25 : 1.5);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
  const stage = new THREE.Group(); scene.add(stage);           // everything lives here (offset right of the text on desktop)
  const rig = new THREE.Group(); stage.add(rig);               // turbine frame: x = wind axis, hub at the origin, rotor radius = 1
  const YAW = 0.5;                                            // 3/4 view of the rotor disk

  /* ===== Turbine flow (cheap analytic model): actuator-disk induction with streamtube expansion,
     a counter-rotating wake swirl, and tip vortices shed from the blade tips along helices ===== */
  const U = 0.75, AIND = 0.3, OMEGA = 1.45, CX = 0.25, XR = -0.22;   // free stream, induction, rotor rad/s, rotor plane x
  let simT = 0, rotorAng = 0;
  let vx = 0, vy = 0, vz = 0, speed = 0;                        // scratch outputs of flowAt
  const wakeR = x => { const d = x - XR, s = d / Math.sqrt(d * d + CX), rec = Math.exp(-Math.max(0, d) / 7);
    return Math.sqrt((1 - AIND) / (1 - AIND * (1 + s) * rec)); };
  function flowAt(x, y, z) {
    const d = x - XR, q = d * d + CX, s = d / Math.sqrt(q), rec = Math.exp(-Math.max(0, d) / 7);
    const ind = AIND * (1 + s) * rec, Rw = Math.sqrt((1 - AIND) / (1 - ind));
    const r = Math.hypot(y, z) + 1e-6, g = 1 - smooth(0.86 * Rw, 1.14 * Rw, r);
    const dud = U * AIND * rec * CX / (q * Math.sqrt(q));       // axial deceleration gradient -> radial expansion
    const ua = U * (1 - ind * g) + U * 0.06 * (1 - g) * smooth(-1, 1, d) * Math.exp(-(r - Rw) * (r - Rw) * 2);
    const ur = r < Rw ? 0.5 * r * dud : 0.5 * Rw * Rw / r * dud;
    const wt = -0.34 * U * (r / Rw) * g * smooth(-0.1, 0.5, d) * Math.exp(-Math.max(0, d) / 9);   // swirl opposite to the rotor
    vx = ua; vy = (ur * y - wt * z) / r; vz = (ur * z + wt * y) / r; speed = Math.hypot(ua, ur, wt);
  }

  /* ===== Streamline particles with trails of tiny binary glyphs (first NTIP are tip-vortex tracers).
     0/1 are pre-rendered into a 2-cell canvas atlas and drawn as screen-space quads, tinted cyan/blue
     and faded along each trail. Fewer, denser streams than the old line ribbons; fewer still on mobile. ===== */
  let N = isSmall ? 80 : 170;
  const K = isSmall ? 20 : 28;                                 // glyphs per trail (dense packing)
  const NTIP = Math.round(N * 0.17);
  let X0 = -6, X1 = 6, YH = 3.2, ZH = 2.6, XC = 1.8;            // inlet / outlet / spawn extents (rig units), set in layout
  const T = new THREE.Vector3(3, -0.6, 0);                     // where the wake is drawn to (the network), rig units
  const P = {
    x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), age: new Float32Array(N), life: new Float32Array(N),
    inten: new Float32Array(N), sp: new Float32Array(N), wk: new Float32Array(N), psi: new Float32Array(N)
  };
  const hist = new Float32Array(N * K * 3);
  const col = new Float32Array(N * K * 3);
  const bits = new Float32Array(N * K);
  const fade = new Float32Array(K);
  for (let k = 0; k < K; k++) fade[k] = k === K - 1 ? 0 : Math.pow(1 - k / (K - 1), 1.15);

  function spawn(i, anywhere) {
    let x, y, z;
    if (i < NTIP) {                                            // released at a blade tip as it sweeps past -> helical loci
      const a = anywhere ? rnd() * 4 : 0, b = (rnd() * 3) | 0;
      x = XR + 0.03 + a * U * 0.5;
      const th = rotorAng - OMEGA * a + b * 2.0944 + (rnd() - 0.5) * 0.04, rr = wakeR(x) * (0.97 + rnd() * 0.05);
      y = rr * Math.cos(th); z = rr * Math.sin(th);
      P.age[i] = a; P.life[i] = 5 + rnd() * 3; P.psi[i] = rnd() * 6.28;
    } else {
      x = anywhere ? X0 + rnd() * (X1 - X0) : X0 - rnd() * 0.6;
      if (rnd() < 0.5) { const rr = 1.35 * Math.sqrt(rnd()), th = rnd() * 6.28; y = rr * Math.cos(th); z = rr * Math.sin(th); }
      else { y = (rnd() * 2 - 1) * YH; z = (rnd() * 2 - 1) * ZH; }
      P.age[i] = 0; P.life[i] = 14 + rnd() * 10;
    }
    P.x[i] = x; P.y[i] = y; P.z[i] = z;
    const b = i * K * 3, bb = i * K;
    for (let k = 0; k < K; k++) {
      hist[b + k * 3] = x; hist[b + k * 3 + 1] = y; hist[b + k * 3 + 2] = z;
      bits[bb + k] = rnd() < 0.5 ? 0 : 1;
    }
  }

  function makeGlyphAtlas() {
    const cell = 64, c = document.createElement('canvas');
    c.width = cell * 2; c.height = cell;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#fff';
    ctx.font = '700 54px ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(140, 210, 255, 0.9)';
    ctx.shadowBlur = 8;
    ctx.fillText('0', cell * 0.5, cell * 0.54);
    ctx.fillText('1', cell * 1.5, cell * 0.54);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }
  const glyphAtlas = makeGlyphAtlas();

  /* One screen-space glyph quad per trail point, oriented along the local segment and sized in CSS pixels. */
  const ribGeo = new THREE.InstancedBufferGeometry();
  ribGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  const hBuf = new THREE.InstancedInterleavedBuffer(hist, 3, 1).setUsage(THREE.DynamicDrawUsage);
  const cBuf = new THREE.InstancedInterleavedBuffer(col, 3, 1).setUsage(THREE.DynamicDrawUsage);
  const bBuf = new THREE.InstancedBufferAttribute(bits, 1).setUsage(THREE.DynamicDrawUsage);
  ribGeo.setAttribute('iA', new THREE.InterleavedBufferAttribute(hBuf, 3, 0));
  ribGeo.setAttribute('iB', new THREE.InterleavedBufferAttribute(hBuf, 3, 3));
  ribGeo.setAttribute('cA', new THREE.InterleavedBufferAttribute(cBuf, 3, 0));
  ribGeo.setAttribute('aBit', bBuf);
  ribGeo.instanceCount = N * K - 1;
  const ribMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uRes: { value: new THREE.Vector2(1, 1) },
      uPx: { value: isSmall ? 7.0 : 8.0 },
      uAtlas: { value: glyphAtlas }
    },
    vertexShader: `attribute vec3 iA; attribute vec3 iB; attribute vec3 cA; attribute float aBit;
      uniform vec2 uRes; uniform float uPx; varying vec2 vUv; varying vec3 vC;
      void main(){
        float mA=max(cA.r,max(cA.g,cA.b));
        if(mA < 1e-4){ gl_Position=vec4(2.,2.,2.,1.); vC=vec3(0.); vUv=vec2(0.); return; }
        vec4 a=projectionMatrix*modelViewMatrix*vec4(iA,1.);
        vec4 b=projectionMatrix*modelViewMatrix*vec4(iB,1.);
        vec2 sa=a.xy/a.w*uRes, sb=b.xy/b.w*uRes, d=sb-sa; float l=length(d);
        vec2 tn = l>1e-4 ? d/l : vec2(1.,0.);
        vec2 nn = vec2(-tn.y, tn.x);
        a.xy += (tn*position.x*uPx + nn*position.y*uPx*0.82)/uRes*a.w;
        gl_Position=a;
        vUv=vec2(aBit*0.5 + (position.x*0.5+0.5)*0.5, position.y*0.5+0.5);
        vC=cA;
      }`,
    fragmentShader: `uniform sampler2D uAtlas; varying vec2 vUv; varying vec3 vC;
      void main(){ float a=texture2D(uAtlas,vUv).a; if(a<0.04) discard; gl_FragColor=vec4(vC*a,1.); }`
  });
  const streams = new THREE.Mesh(ribGeo, ribMat);
  streams.frustumCulled = false; streams.renderOrder = 3;
  rig.add(streams);
  let nAct = N;

  // velocity colormap stays in cyan / blue (deep indigo -> blue -> bright cyan)
  const stops = [[0, .06, .18, .55], [.35, .06, .48, .98], [.68, .18, .82, 1.0], [1, .62, .96, 1.0]];
  function cmap(t, out) {
    for (let s = 1; s < stops.length; s++) {
      if (t <= stops[s][0]) {
        const a = stops[s - 1], b = stops[s], f = (t - a[0]) / (b[0] - a[0]);
        out[0] = a[1] + (b[1] - a[1]) * f; out[1] = a[2] + (b[2] - a[2]) * f; out[2] = a[3] + (b[3] - a[3]) * f; return;
      }
    }
    out[0] = .62; out[1] = .96; out[2] = 1;
  }
  const rgb = [0, 0, 0];
  const GAIN = isSmall ? 1.15 : 1.05;
  let recAcc = 0, doShift = true;

  function stepParticles(dt) {
    simT += dt; rotorAng = OMEGA * simT;
    recAcc += dt; doShift = recAcc >= 0.032; if (doShift) recAcc = 0;
    for (let i = 0; i < nAct; i++) {
      let x = P.x[i], y = P.y[i], z = P.z[i];
      flowAt(x, y, z);
      let dx = vx, dy = vy, dz = vz, wk = 0;
      if (i < NTIP) {                                          // tip vortex: tracers loop round the core in the meridional plane
        const a = P.age[i], om = -5.5 * Math.exp(-a / 5), rho = 0.03 + 0.06 * (1 - Math.exp(-a / 2));
        P.psi[i] += om * dt;
        const r = Math.hypot(y, z) + 1e-6, ox = -rho * om * Math.sin(P.psi[i]), orr = rho * om * Math.cos(P.psi[i]);
        dx += ox; dy += orr * y / r; dz += orr * z / r;
        wk = Math.exp(-a / 3.2) * smooth(0, 0.25, a);
      }
      x += dx * dt; y += dy * dt; z += dz * dt;
      const k = smooth(XC, X1 - 0.6, x) * 0.9;                 // far wake: the flow is drawn into the network
      if (k > 0) { y += (T.y - y) * k * dt; z += (T.z - z) * k * dt; }
      P.x[i] = x; P.y[i] = y; P.z[i] = z; P.sp[i] = speed; P.wk[i] += (wk - P.wk[i]) * 0.3;
      P.age[i] += dt;
      if (x > X1 || Math.abs(y) > YH * 1.6 || Math.abs(z) > ZH * 1.8 || P.age[i] > P.life[i]) spawn(i, false);
      else {
        const b = i * K * 3, bb = i * K;
        if (doShift) {
          hist.copyWithin(b + 3, b, b + (K - 1) * 3);
          bits.copyWithin(bb + 1, bb, bb + K - 1);
          bits[bb] = rnd() < 0.5 ? 0 : 1;
        }
        hist[b] = x; hist[b + 1] = y; hist[b + 2] = z;
      }
      P.inten[i] = smooth(X0, X0 + 3.2, P.x[i]) * (1 - smooth(X1 - 1.6, X1, P.x[i])) *
                   smooth(0, 0.5, P.age[i]) * (1 - smooth(P.life[i] - 1.2, P.life[i], P.age[i]));
    }
  }
  function writeColors() {
    for (let i = 0; i < nAct; i++) {
      // free stream ~ bright cyan, slowed wake = deeper blue; tip vortices stay in the same cyan/blue range
      const cv = clamp((P.sp[i] / U - 0.35) / 0.75, 0, 1) * 0.7 + P.wk[i] * 0.3;
      cmap(clamp(cv, 0, 1), rgb);
      const g = P.inten[i] * GAIN * (0.85 + 0.55 * P.wk[i]), b = i * K * 3;
      for (let k = 0; k < K; k++) {
        const f = fade[k] * g, o = b + k * 3;
        col[o] = rgb[0] * f; col[o + 1] = rgb[1] * f; col[o + 2] = rgb[2] * f;
      }
    }
    hBuf.needsUpdate = true; cBuf.needsUpdate = true; bBuf.needsUpdate = true;
  }

  /* ===== Wind turbine, built procedurally (low-poly): tapered tower, nacelle, spinner, three tapered,
     twisted blades. Translucent shell with a fresnel edge glow + fine glowing wireframe. ===== */
  const turb = new THREE.Group(); rig.add(turb);
  const shell = (fadeY, kk = 1) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uFade: { value: fadeY }, uK: { value: kk } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vY=position.y; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying float vY; uniform float uFade; uniform float uK;
      void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.2);
        vec3 rim=mix(vec3(.18,.78,1.),vec3(.58,.40,1.),f);
        float fd = uFade < -50. ? 1. : smoothstep(uFade, uFade+1.3, vY);
        gl_FragColor=vec4(vec3(.03,.07,.15)+rim*(.12+f*2.2)*uK,(.55+.45*f)*fd); }`
  });
  const wireMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const wire = (pts, cols) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); const l = new THREE.LineSegments(g, wireMat); l.renderOrder = 8; return l; };
  const CY = [.30, .85, 1.0], VI = [.55, .40, 1.0];
  const mixc = (a, b, t, k) => [(a[0] + (b[0] - a[0]) * t) * k, (a[1] + (b[1] - a[1]) * t) * k, (a[2] + (b[2] - a[2]) * t) * k];
  // surface of revolution about the x axis from a [radius, x] profile (+ matching wireframe)
  function revolve(prof, seg, ringEvery) {
    const pos = [], idx = [], wp = [], wc = [];
    prof.forEach(([r, x]) => { for (let j = 0; j <= seg; j++) { const a = j / seg * 6.2832; pos.push(x, r * Math.cos(a), r * Math.sin(a)); } });
    for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const c = mixc(CY, VI, .3, .8);
    for (let j = 0; j < seg; j += 2) for (let i = 0; i < prof.length - 1; i++) { const a = (i * (seg + 1) + j) * 3, b = a + (seg + 1) * 3; wp.push(...pos.slice(a, a + 3), ...pos.slice(b, b + 3)); wc.push(...c, ...c); }
    for (let i = 0; i < prof.length; i += ringEvery) for (let j = 0; j < seg; j++) { const a = (i * (seg + 1) + j) * 3; wp.push(...pos.slice(a, a + 3), ...pos.slice(a + 3, a + 6)); wc.push(...c, ...c); }
    return [g, wire(wp, wc)];
  }
  const addShell = (g, fadeY = -100, kk = 1) => { const m = new THREE.Mesh(g, shell(fadeY, kk)); m.renderOrder = 7; return m; };
  // tower (tapered, fades out towards the ground)
  const HT = 2.05, TX = XR + 0.3;
  { const g = new THREE.CylinderGeometry(0.036, 0.075, HT, 14, 1, true); const m = addShell(g, -HT / 2, 0.5); m.position.set(TX, -0.08 - HT / 2, 0); turb.add(m);
    const wp = [], wc = [];
    for (let j = 0; j < 8; j++) { const a = j / 8 * 6.2832, ca_ = Math.cos(a), sa_ = Math.sin(a);
      wp.push(TX + .075 * ca_, -0.08 - HT, .075 * sa_, TX + .036 * ca_, -0.08, .036 * sa_); wc.push(0, 0, 0, ...mixc(CY, VI, .2, .55)); }
    turb.add(wire(wp, wc)); }
  // nacelle (fixed) and spinner (rotates with the rotor)
  { const [g, w] = revolve([[0.0, XR + 0.03], [0.07, XR + 0.05], [0.086, XR + 0.14], [0.09, XR + 0.5], [0.078, XR + 0.64], [0.035, XR + 0.7], [0.0, XR + 0.71]], 16, 2);
    turb.add(addShell(g), w); }
  const rotor = new THREE.Group(); rotor.position.x = XR; turb.add(rotor);
  { const [g, w] = revolve([[0.0, -0.2], [0.03, -0.185], [0.055, -0.14], [0.072, -0.07], [0.08, 0.0], [0.078, 0.04]], 16, 2); rotor.add(addShell(g), w); }
  // blade: span along +y, chord in the rotor plane (leading edge towards +z, the direction of rotation), twisted
  function blade() {
    const S = 14, C = 10, pos = [], idx = [], wp = [], wc = [], ring = [];
    for (let s = 0; s <= S; s++) {
      const u = s / S, rr = 0.06 + 0.92 * u;
      const chord = u < 0.18 ? 0.06 + 0.12 * smooth(0, 0.18, u) : 0.18 - 0.14 * Math.pow((u - 0.18) / 0.82, 0.8);
      const thick = u < 0.25 ? 0.5 - 0.38 * smooth(0, 0.25, u) : 0.12;
      const beta = 0.3 * Math.pow(1 - u, 1.5) + 0.03, dX = Math.sin(beta), dZ = -Math.cos(beta);   // LE -> TE direction
      const r0 = [];
      for (let k = 0; k < C; k++) {
        const a = k / C * 6.2832, cc = 0.5 * Math.cos(a), tt = 0.5 * Math.sin(a) * thick * (1.15 - 0.6 * (cc + 0.5));
        const along = (cc + 0.5 - 0.3) * chord, nrm = tt * chord;
        pos.push(along * dX + nrm * -dZ, rr, along * dZ + nrm * dX); r0.push(pos.length / 3 - 1);
      }
      ring.push(r0);
    }
    pos.push(0, 0.995, 0); const tip = pos.length / 3 - 1;
    for (let s = 0; s < S; s++) for (let k = 0; k < C; k++) { const a = ring[s][k], b = ring[s][(k + 1) % C], c = ring[s + 1][k], d = ring[s + 1][(k + 1) % C]; idx.push(a, c, b, b, c, d); }
    for (let k = 0; k < C; k++) idx.push(ring[S][k], tip, ring[S][(k + 1) % C]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const P3 = v => pos.slice(v * 3, v * 3 + 3);
    for (let s = 0; s < S; s++) for (const k of [0, C / 2, C / 4, 3 * C / 4]) {           // trailing/leading edges + two surface lines
      const t = s / S, c0 = mixc(CY, VI, t, k === C / 2 ? 1.2 : .7), c1 = mixc(CY, VI, (s + 1) / S, k === C / 2 ? 1.2 : .7);
      wp.push(...P3(ring[s][k]), ...P3(ring[s + 1][k])); wc.push(...c0, ...c1); }
    for (const s of [2, 5, 8, 11, S]) for (let k = 0; k < C; k++) {                          // chord ribs
      const c = mixc(CY, VI, s / S, .5); wp.push(...P3(ring[s][k]), ...P3(ring[s][(k + 1) % C])); wc.push(...c, ...c); }
    return [g, wp, wc];
  }
  { const [g, wp, wc] = blade(), w = wire(wp, wc).geometry;
    for (let b = 0; b < 3; b++) { const grp = new THREE.Group(); grp.rotation.x = b * 2.0944; grp.add(addShell(g), new THREE.LineSegments(w, wireMat)); grp.children[1].renderOrder = 8; rotor.add(grp); } }
  // faint rotor-disk ring (tip path) to help the 3/4 view read
  { const pts = []; for (let j = 0; j < 96; j++) { const a = j / 96 * 6.2832, b = (j + 1) / 96 * 6.2832; pts.push(XR, Math.cos(a), Math.sin(a), XR, Math.cos(b), Math.sin(b)); }
    const c = []; for (let j = 0; j < 192; j++) c.push(.12, .09, .26); turb.add(wire(pts, c)); }


  /* ===== Layered neural surrogate on the right ('engineering meets AI').
     A clearly structured MLP (input → hidden → output) sits in the turbine wake.
     Flow is drawn into the input layer; pulses travel as a forward pass; a faint
     tensor grid, data packets and a light attention web sit around it. The left
     (text) side stays calm. ===== */
  const net = new THREE.Group(); stage.add(net);
  const ann = new THREE.Group(); net.add(ann);

  const pal = [[.12, .72, 1.0], [.28, .48, 1.0], [.50, .32, 1.0], [.72, .24, .96], [.92, .22, .70], [1.0, .28, .52]];
  const palAt = (t, o) => { t = clamp(t, 0, 1); const f = t * (pal.length - 1), i = Math.min(pal.length - 2, Math.floor(f)), u = f - i;
    for (let c = 0; c < 3; c++) o[c] = pal[i][c] + (pal[i + 1][c] - pal[i][c]) * u; return o; };

  const layers = isSmall ? [4, 6, 3] : [5, 7, 6, 3];
  const layerGap = isSmall ? 1.12 : 1.39;               // ~1.65x wider layer spacing
  const layerH = isSmall ? 2.05 : 2.55;
  const layerIndex = [];
  const nodes = [], nCol = [], coreR = [], nPh = [];
  for (let li = 0; li < layers.length; li++) {
    layerIndex.push(nodes.length);
    const n = layers[li], x = (li - (layers.length - 1) / 2) * layerGap;
    const col = []; palAt(li / Math.max(1, layers.length - 1), col);
    for (let j = 0; j < n; j++) {
      const y = (j - (n - 1) / 2) * (layerH / Math.max(1, n - 1));
      const z = ((li % 2) ? 0.07 : -0.07) + (j % 2 ? 0.03 : -0.03);
      nodes.push(new THREE.Vector3(x, y, z));
      nCol.push(col.slice());
      coreR.push(li === 0 || li === layers.length - 1 ? 0.078 : 0.062);
      nPh.push(rnd() * 6.28);
    }
  }
  const NN = nodes.length;
  const inputFrom = 0, inputTo = layers[0];
  const rest = new THREE.Vector3();

  // directed edges: fully connected between adjacent layers, plus a few skip/attention links
  const pairs = [];
  for (let li = 0; li < layers.length - 1; li++) {
    const a0 = layerIndex[li], a1 = a0 + layers[li], b0 = layerIndex[li + 1], b1 = b0 + layers[li + 1];
    for (let i = a0; i < a1; i++) for (let j = b0; j < b1; j++) pairs.push([i, j]);
  }
  const layerEdges = pairs.length;
  if (!isSmall) {
    // a handful of skip connections (attention-style) from layer 0 → 2 and 1 → last
    const addSkip = (la, lb, count) => {
      const a0 = layerIndex[la], b0 = layerIndex[lb];
      for (let k = 0; k < count; k++) pairs.push([a0 + (k * 3) % layers[la], b0 + (k * 5 + 1) % layers[lb]]);
    };
    if (layers.length >= 3) addSkip(0, 2, 3);
    if (layers.length >= 4) addSkip(1, 3, 3);
  }
  const pI = Int16Array.from(pairs, p => p[0]), pJ = Int16Array.from(pairs, p => p[1]);
  const NE = pairs.length, eAlpha = new Float32Array(NE);
  for (let k = 0; k < NE; k++) eAlpha[k] = k < layerEdges ? 0.55 : 0.28;
  const eGeo = new LineSegmentsGeometry().setPositions(new Float32Array(NE * 6)).setColors(new Float32Array(NE * 6));
  const ePosArr = eGeo.attributes.instanceStart.data.array, eColArr = eGeo.attributes.instanceColorStart.data.array;
  const edgeMat = new LineMaterial({ vertexColors: true, linewidth: isSmall ? 1.2 : 1.55, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const eLines = new LineSegments2(eGeo, edgeMat); eLines.frustumCulled = false;
  eLines.renderOrder = 2; ann.add(eLines);

  const cores = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), NN);
  cores.renderOrder = 6; ann.add(cores);
  const m4 = new THREE.Matrix4(), cc = new THREE.Color();

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
  const nPos = new Float32Array(NN * 3);
  const nodePts = makePoints(NN, nPos); ann.add(nodePts);
  const glow = new Float32Array(NN);
  const nAlpha = new Float32Array(NN).fill(1);

  const NP = isSmall ? 18 : 42;
  const pulses = []; for (let i = 0; i < NP; i++) pulses.push({ e: -1, t: 0, v: .55 + rnd() * .55, wait: rnd() * 1.6, dir: true });
  const pulsePts = makePoints(NP, new Float32Array(NP * 3)); ann.add(pulsePts);

  function outgoing(from, onlyForward) {
    const out = [];
    for (let k = 0; k < NE; k++) {
      if (eAlpha[k] < .15) continue;
      if (pI[k] === from) out.push(k);
      else if (!onlyForward && pJ[k] === from) out.push(k);
    }
    return out.length ? out[(rnd() * out.length) | 0] : -1;
  }

  /* Faint tensor / matrix grid behind the network, with a slowly scrolling binary field. */
  const gridW = isSmall ? 4.2 : 5.5, gridH = isSmall ? 2.4 : 3.0;
  { const pts = [], cols = [];
    const nx = isSmall ? 6 : 8, ny = isSmall ? 5 : 7;
    const pushLine = (x0, y0, x1, y1, a) => {
      pts.push(x0, y0, 0.55, x1, y1, 0.55);
      const c = [0.25 * a, 0.55 * a, 1.0 * a]; cols.push(...c, ...c);
    };
    for (let i = 0; i <= nx; i++) { const x = -gridW / 2 + (i / nx) * gridW; pushLine(x, -gridH / 2, x, gridH / 2, i === 0 || i === nx ? 0.22 : 0.12); }
    for (let j = 0; j <= ny; j++) { const y = -gridH / 2 + (j / ny) * gridH; pushLine(-gridW / 2, y, gridW / 2, y, j === 0 || j === ny ? 0.22 : 0.12); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
    const lines = new THREE.LineSegments(g, m); lines.renderOrder = 1; ann.add(lines);
  }
  const mtxCanvas = document.createElement('canvas'); mtxCanvas.width = 256; mtxCanvas.height = 192;
  const mtxCtx = mtxCanvas.getContext('2d');
  const mtxTex = new THREE.CanvasTexture(mtxCanvas); mtxTex.minFilter = THREE.LinearFilter; mtxTex.magFilter = THREE.LinearFilter;
  let mtxTick = 0, mtxAcc = 0;
  function paintMatrix(t) {
    const w = mtxCanvas.width, h = mtxCanvas.height;
    mtxCtx.fillStyle = 'rgba(2,8,20,0.22)'; mtxCtx.fillRect(0, 0, w, h);
    mtxCtx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    const cols = 16, rows = 10;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const u = (c * 13 + r * 7 + mtxTick) % 17;
      const bit = ((c + r + mtxTick) % 3 === 0) ? (Math.sin(t * 0.7 + c * 0.4 + r) > 0 ? '1' : '0') : (u / 16).toFixed(2).slice(1);
      const heat = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.6 + c * 0.5 + r * 0.3));
      mtxCtx.fillStyle = `rgba(${Math.round(80 + 140 * heat)},${Math.round(160 + 40 * heat)},255,${0.28 + 0.35 * heat})`;
      mtxCtx.fillText(bit, 8 + c * 15, 16 + r * 17);
    }
    mtxTex.needsUpdate = true;
  }
  paintMatrix(0);
  { const g = new THREE.PlaneGeometry(gridW * 0.92, gridH * 0.92);
    const m = new THREE.MeshBasicMaterial({ map: mtxTex, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(g, m); plane.position.z = 0.54; plane.renderOrder = 1; ann.add(plane);
  }

  /* Data packets: small glyphs that fly from the incoming wake into the input layer. */
  const NKIT = isSmall ? 8 : 16;
  const kits = [];
  for (let i = 0; i < NKIT; i++) kits.push({ t: 0, wait: rnd() * 2, a: new THREE.Vector3(), b: 0, live: false });
  const kitMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.055, 0.055, 0.055),
    new THREE.MeshBasicMaterial({ color: 0x7ad7ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    NKIT
  );
  kitMesh.renderOrder = 7; kitMesh.frustumCulled = false; ann.add(kitMesh);
  const kitCol = new THREE.Color();
  function spawnKit(k) {
    const target = (rnd() * (inputTo - inputFrom)) | 0;
    const start = kits[k].a;
    start.set(-layerGap * (layers.length - 1) / 2 - 0.85 - rnd() * 0.5, (rnd() - 0.5) * layerH * 0.9, (rnd() - 0.5) * 0.4);
    kits[k].b = target; kits[k].t = 0; kits[k].live = true; kits[k].wait = 0;
  }

  function updateNet(dt, t) {
    // nodes breathe in place (no drift across the text)
    for (let i = 0; i < NN; i++) {
      const base = nodes[i];
      const bx = base.x, by = base.y + Math.sin(t * 0.9 + nPh[i]) * 0.028, bz = base.z + Math.cos(t * 0.7 + nPh[i]) * 0.02;
      rest.set(bx, by, bz);
      rest.toArray(nPos, i * 3);
      glow[i] *= Math.pow(0.18, dt);
      nAlpha[i] = 0.85 + 0.15 * Math.sin(t * 1.1 + i * 0.6);
      const r = coreR[i] * (0.85 + 0.25 * nAlpha[i]) * (1 + 0.55 * glow[i]);
      m4.makeScale(r, r, r).setPosition(bx, by, bz); cores.setMatrixAt(i, m4);
      const k = 0.22 + 0.78 * nAlpha[i] + 0.35 * glow[i], c = nCol[i];
      cores.setColorAt(i, cc.setRGB((c[0] * .85 + .15) * k, (c[1] * .85 + .15) * k, (c[2] * .85 + .15) * k));
    }
    cores.instanceMatrix.needsUpdate = true; if (cores.instanceColor) cores.instanceColor.needsUpdate = true;

    // edges, using the breathing node positions
    for (let k = 0; k < NE; k++) {
      const i = pI[k], j = pJ[k];
      const ax = nPos[i * 3], ay = nPos[i * 3 + 1], az = nPos[i * 3 + 2];
      const bx = nPos[j * 3], by = nPos[j * 3 + 1], bz = nPos[j * 3 + 2];
      const o = k * 6;
      ePosArr[o] = ax; ePosArr[o + 1] = ay; ePosArr[o + 2] = az; ePosArr[o + 3] = bx; ePosArr[o + 4] = by; ePosArr[o + 5] = bz;
      const atten = k >= layerEdges ? 0.38 : 0.7;
      const ea = eAlpha[k] * atten * (0.75 + 0.25 * Math.sin(t * 1.4 + k * 0.2));
      eColArr[o] = nCol[i][0] * ea; eColArr[o + 1] = nCol[i][1] * ea; eColArr[o + 2] = nCol[i][2] * ea;
      eColArr[o + 3] = nCol[j][0] * ea; eColArr[o + 4] = nCol[j][1] * ea; eColArr[o + 5] = nCol[j][2] * ea;
    }
    eGeo.attributes.instanceStart.data.needsUpdate = true; eGeo.attributes.instanceColorStart.data.needsUpdate = true;

    const sA = nodePts.geometry.attributes.aSize, cA = nodePts.geometry.attributes.aColor;
    for (let i = 0; i < NN; i++) {
      const g = glow[i], c = nCol[i], b = (0.7 + 0.3 * nAlpha[i]);
      sA.array[i] = coreR[i] * 5.4 + 0.3 * g;
      for (let q = 0; q < 3; q++) cA.array[i * 3 + q] = c[q] * (.28 + .5 * g) * b;
    }
    nodePts.geometry.attributes.position.needsUpdate = true; sA.needsUpdate = true; cA.needsUpdate = true;

    // forward-pass pulses: ride directed edges input → output, then wrap
    const pp = pulsePts.geometry.attributes.position, ps = pulsePts.geometry.attributes.aSize, pc = pulsePts.geometry.attributes.aColor;
    pulses.forEach((p, n) => {
      if (p.e < 0) {
        p.wait -= dt;
        if (p.wait <= 0) {
          // start on an outgoing edge from a random input node
          const src = inputFrom + ((rnd() * (inputTo - inputFrom)) | 0);
          p.e = outgoing(src, true); p.t = 0; p.wait = 0.2 + rnd() * 0.5;
        }
      } else {
        p.t += dt * p.v;
        if (p.t >= 1) {
          const end = pJ[p.e];
          glow[end] = Math.min(1.7, glow[end] + (reduceMotion ? 0.28 : 0.85));
          const ne = outgoing(end, true);
          p.e = ne; p.t = 0;
          if (ne < 0) p.wait = 0.15 + rnd() * 0.4;
        }
      }
      if (p.e < 0) { ps.array[n] = 0; return; }
      const a = pI[p.e], b = pJ[p.e], tt = clamp(p.t, 0, 1);
      const f = Math.sin(tt * Math.PI) * 0.95;
      pp.array[n * 3] = nPos[a * 3] + (nPos[b * 3] - nPos[a * 3]) * tt;
      pp.array[n * 3 + 1] = nPos[a * 3 + 1] + (nPos[b * 3 + 1] - nPos[a * 3 + 1]) * tt;
      pp.array[n * 3 + 2] = nPos[a * 3 + 2] + (nPos[b * 3 + 2] - nPos[a * 3 + 2]) * tt;
      ps.array[n] = 0.26;
      for (let c = 0; c < 3; c++) pc.array[n * 3 + c] = ((nCol[a][c] + nCol[b][c]) * 0.5 * .75 + .3) * f * 1.25;
    });
    pp.needsUpdate = true; ps.needsUpdate = true; pc.needsUpdate = true;

    // data packets flying into the input layer
    for (let i = 0; i < NKIT; i++) {
      const k = kits[i];
      if (!k.live) { k.wait -= dt; if (k.wait <= 0) spawnKit(i); }
      if (!k.live) { m4.makeScale(0, 0, 0).setPosition(0, 0, 0); kitMesh.setMatrixAt(i, m4); continue; }
      k.t += dt * 0.85;
      const tt = clamp(k.t, 0, 1), s = tt * tt * (3 - 2 * tt);
      const tx = nPos[k.b * 3], ty = nPos[k.b * 3 + 1], tz = nPos[k.b * 3 + 2];
      const x = k.a.x + (tx - k.a.x) * s, y = k.a.y + (ty - k.a.y) * s, z = k.a.z + (tz - k.a.z) * s;
      const sc = 0.8 + 0.5 * Math.sin(tt * Math.PI);
      m4.makeScale(sc, sc, sc).setPosition(x, y, z); kitMesh.setMatrixAt(i, m4);
      const hue = 0.55 + 0.45 * tt;
      kitMesh.setColorAt(i, kitCol.setRGB(0.3 + 0.5 * hue, 0.75, 1.0));
      if (k.t >= 1) { glow[k.b] = Math.min(1.7, glow[k.b] + 1.0); k.live = false; k.wait = 0.3 + rnd() * 1.1; }
    }
    kitMesh.instanceMatrix.needsUpdate = true; if (kitMesh.instanceColor) kitMesh.instanceColor.needsUpdate = true;

    mtxAcc += dt;
    if (mtxAcc > 0.18) { mtxAcc = 0; mtxTick++; paintMatrix(t); }
  }

  // faint depth dust
  const ND = isSmall ? 60 : 140, dPos = new Float32Array(ND * 3);
  for (let i = 0; i < ND; i++) { dPos[i * 3] = (rnd() - .5) * 34; dPos[i * 3 + 1] = (rnd() - .5) * 18; dPos[i * 3 + 2] = -14 + rnd() * 18; }
  const dust = makePoints(ND, dPos);
  for (let i = 0; i < ND; i++) { const b = .12 + rnd() * .25; dust.geometry.attributes.aSize.array[i] = .05 + rnd() * .05; dust.geometry.attributes.aColor.array.set([b * .6, b * .9, b], i * 3); }
  stage.add(dust);

  await nextFrame();                                           // spread setup over frames
  /* ===== Post-processing ===== */
  let composer = null, bloom = null, useBloom = true;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), isSmall ? 0.6 : 0.65, 0.45, 0.25);
    const bloomSetSize = bloom.setSize.bind(bloom);
    bloom.setSize = (w, h) => bloomSetSize(Math.max(1, w / 2), Math.max(1, h / 2));   // bloom chain at half the usual resolution
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  } catch (e) { composer = null; useBloom = false; }

  /* ===== Layout / resize ===== */
  let W = 1, H = 1, camZ = 10.5, narrow = false, zoneK = 1.3; const netAt = new THREE.Vector3();
  function layout() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    narrow = W / H < 0.95 || W < 760;
    renderer.setPixelRatio(pixelRatio); renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(pixelRatio); composer.setSize(W, H); }
    camera.aspect = W / H; camera.updateProjectionMatrix();
    if (narrow) {
      camZ = 15.5; stage.position.set(0, 3.7, 0); stage.scale.setScalar(1);
      rig.position.set(-0.45, 0.2, 0); rig.scale.setScalar(1.45); zoneK = 0.95;
      X0 = -4.6; X1 = 4.6; YH = 3.0; ZH = 2.2; XC = 1.4; netAt.set(1.15, -1.0, -1.2);
    } else {
      camZ = 10.5; const a = W / H;                              // keep the right-hand composition on wide/narrow desktops
      stage.position.set(clamp((a - 1.6) * 2.2, -0.8, 2.2), 0, 0); stage.scale.setScalar(clamp(a / 1.6, 0.78, 1.15));
      rig.position.set(2.75, 0.75, 0); rig.scale.setScalar(1.45); zoneK = 1.3;
      X0 = -6; X1 = 6; YH = 3.0; ZH = 2.4; XC = 1.6; netAt.set(4.7, -0.5, -1.55);
    }
    // pin the layered network in the wake, to the right of the turbine (and of the text)
    ann.position.copy(netAt);
    ann.scale.setScalar(narrow ? 0.88 : 1);
    rig.rotation.y = YAW; rig.updateMatrix();
    T.copy(netAt).applyMatrix4(rig.matrix.clone().invert());       // network centre in the turbine frame
    ribMat.uniforms.uRes.value.set(W * pixelRatio / 2, H * pixelRatio / 2); ribMat.uniforms.uPx.value = (isSmall ? 7.0 : 8.0) * pixelRatio / 2;
    edgeMat.resolution.set(W * pixelRatio, H * pixelRatio);
    pointMat.uniforms.uScale.value = (H * pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }
  layout();
  window.addEventListener('resize', () => { layout(); if (!running) drawStatic(); });

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!isSmall && !reduceMotion) {
    window.addEventListener('pointermove', e => {
      mouse.tx = (e.clientX / window.innerWidth - .5) * 2; mouse.ty = (e.clientY / window.innerHeight - .5) * 2;
    }, { passive: true });
  }

  const motionK = reduceMotion ? 0.28 : 1;                   // Windows "Animation effects off" still gets a slow drift
  function render() { (useBloom && composer) ? composer.render() : renderer.render(scene, camera); }
  function drawStatic() {
    camera.position.set(0.6, 0.2, camZ); camera.lookAt(0, 0, 0);
    rotor.rotation.x = rotorAng; updateNet(0.016, 2); writeColors(); render();
  }

  /* ===== Adaptive quality & stats ===== */
  const stats = { rawSum: 0, rawN: 0, avgRawFrameMs: 0, frames: 0, sum: 0, jsSum: 0, win: 0, winSum: 0, level: 0, avgFrameMs: 0, avgJsMs: 0 };
  window.__hero = stats;
  function degrade() {
    stats.level++;
    if (stats.level === 1) {
      pixelRatio = Math.min(pixelRatio, 1); nAct = Math.floor(N * 0.65); ribGeo.instanceCount = nAct * K - 1; layout();
      if (bloom) bloom.resolution.set(W / 2, H / 2);
    } else if (stats.level === 2) {
      useBloom = false; nAct = Math.floor(N * 0.4); ribGeo.instanceCount = Math.max(1, nAct * K - 1);
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
    const dt = dtReal * motionK;
    clock.t += dt; const t = clock.t;
    if (reduceMotion) {
      camera.position.set(0.6, 0.2, camZ); camera.lookAt(0, 0, 0); stage.rotation.y = 0;
    } else {
      mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
      camera.position.set(Math.sin(t * 0.07) * 1.1 + mouse.x * 0.9, Math.sin(t * 0.05) * 0.45 - mouse.y * 0.55, camZ + Math.sin(t * 0.04) * 0.5);
      camera.lookAt(mouse.x * 0.3, -mouse.y * 0.2, 0);
      stage.rotation.y = Math.sin(t * 0.06) * 0.05 + mouse.x * 0.04;
    }
    stepParticles(dt); rotor.rotation.x = rotorAng; writeColors(); updateNet(dt, t);
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

  // cheap warm-up: seed the particles (tip tracers already laid out along their helices) and advect a few steps
  for (let i = 0; i < N; i++) spawn(i, true);
  const warm = reduceMotion ? 40 : 16;
  for (let s = 0; s < warm; s++) stepParticles(1 / 40);         // ~ms of work: no need to yield
  stats.setupMs = Math.round(performance.now() - tInit);
  try { if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera); } catch (e) { /* compile lazily */ }
  const reveal = () => { canvas.classList.add('is-ready'); stats.firstFrameMs = Math.round(performance.now()); stats.initMs = Math.round(performance.now() - tInit); };
  // Always run the loop. Under prefers-reduced-motion (including Windows "Animation
  // effects off") we keep a slow, non-flashing drift of the binary streams instead of a freeze.
  start(); requestAnimationFrame(() => requestAnimationFrame(reveal));
  let inView = true;
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; (inView && !document.hidden) ? start() : stop(); }, { threshold: 0 }).observe(canvas);
  document.addEventListener('visibilitychange', () => { (!document.hidden && inView) ? start() : stop(); });
  canvas.dataset.ready = 'true';
}
