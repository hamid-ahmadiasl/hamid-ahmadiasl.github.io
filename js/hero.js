/* Hero scene: a procedurally built 3-bladed wind turbine with a spinning rotor, CFD streamlines through
   the rotor disk into a swirling helical wake with tip vortices (advected particles with trails, velocity
   colormap) that dissolves into a breathing neural network with pulses,
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

  /* ===== Streamline particles with trails (first NTIP particles are tip-vortex tracers) ===== */
  let N = isSmall ? 420 : 1200;
  const K = isSmall ? 11 : 13;                                 // vertices per trail
  const NTIP = Math.round(N * 0.17);
  let X0 = -6, X1 = 6, YH = 3.2, ZH = 2.6, XC = 1.8;            // inlet / outlet / spawn extents (rig units), set in layout
  const T = new THREE.Vector3(3, -0.6, 0);                     // where the wake is drawn to (the network), rig units
  const P = {
    x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), age: new Float32Array(N), life: new Float32Array(N),
    inten: new Float32Array(N), sp: new Float32Array(N), wk: new Float32Array(N), psi: new Float32Array(N)
  };
  const hist = new Float32Array(N * K * 3);
  const col = new Float32Array(N * K * 3);
  const fade = new Float32Array(K);
  for (let k = 0; k < K; k++) fade[k] = k === K - 1 ? 0 : Math.pow(1 - k / (K - 1), 1.3);

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
    const b = i * K * 3;
    for (let k = 0; k < K; k++) { hist[b + k * 3] = x; hist[b + k * 3 + 1] = y; hist[b + k * 3 + 2] = z; }
  }

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
    uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uW: { value: isSmall ? 1.7 : 2.0 } },
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
  const GAIN = isSmall ? 0.55 : 0.44;
  let recAcc = 0, doShift = true;

  function stepParticles(dt) {
    simT += dt; rotorAng = OMEGA * simT;
    recAcc += dt; doShift = recAcc >= 0.1; if (doShift) recAcc = 0;
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
        const b = i * K * 3;
        if (doShift) hist.copyWithin(b + 3, b, b + (K - 1) * 3);
        hist[b] = x; hist[b + 1] = y; hist[b + 2] = z;
      }
      P.inten[i] = smooth(X0, X0 + 3.2, P.x[i]) * (1 - smooth(X1 - 1.6, X1, P.x[i])) *
                   smooth(0, 0.5, P.age[i]) * (1 - smooth(P.life[i] - 1.2, P.life[i], P.age[i]));
    }
  }
  function writeColors() {
    for (let i = 0; i < nAct; i++) {
      // free stream ~ bright cyan, slowed wake = cool deep blue/indigo, tip vortices = orange/red
      const cv = clamp((P.sp[i] / U - 0.35) / 0.75, 0, 1) * 0.58 + P.wk[i] * 0.48;
      cmap(clamp(cv, 0, 1), rgb);
      const g = P.inten[i] * GAIN * (0.8 + 1.3 * P.wk[i]), b = i * K * 3;
      for (let k = 0; k < K; k++) {
        const f = fade[k] * g, o = b + k * 3;
        col[o] = rgb[0] * f; col[o + 1] = rgb[1] * f; col[o + 2] = rgb[2] * f;
      }
    }
    hBuf.needsUpdate = true; cBuf.needsUpdate = true;
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


  /* ===== Neural network spread through the flow: nodes drift downstream with the stream; edges form
     and dissolve with distance (plus slow random rewiring), all in fixed-size buffers ===== */
  const net = new THREE.Group(); stage.add(net);
  const NN = isSmall ? 22 : 34;                                  // nodes (moderate for performance)
  let NB = { x0: -4.6, x1: 7.6, y: 3.7, z0: -2.2, z1: 1.0 };    // stage-space box the nodes live in (set in layout)
  const nodes = [], nVel = [], nPh = [], nCol = [], coreR = [];
  const pal = [[.05, .45, 1.0], [.20, .38, 1.0], [.42, .28, 1.0], [.66, .22, 1.0], [.90, .20, .78], [1.0, .22, .52]];   // electric blue → violet → magenta → hot pink
  const palAt = (t, o) => { t = clamp(t, 0, 1); const f = t * (pal.length - 1), i = Math.min(pal.length - 2, Math.floor(f)), u = f - i;
    for (let c = 0; c < 3; c++) o[c] = pal[i][c] + (pal[i + 1][c] - pal[i][c]) * u; return o; };
  const placeX = () => NB.x0 + (NB.x1 - NB.x0) * rnd();             // even spread (no bunching in the wake)
  for (let i = 0; i < NN; i++) {
    nodes.push(new THREE.Vector3(placeX(), (rnd() * 2 - 1) * NB.y, NB.z0 + rnd() * (NB.z1 - NB.z0)));
    nVel.push(0.12 + rnd() * 0.16); nPh.push(rnd() * 6.28); nCol.push([0, 0, 0]); coreR.push(0.07 + rnd() * 0.06);
  }
  const nAlpha = new Float32Array(NN);
  // per-node life cycle (staggered, period 4-10 s): lit & connected → slowly dims, edges fade → dark & isolated
  // → re-ignites with a brighter flash and reconnects. Lit ~65% of the cycle, so most nodes glow at any moment.
  const lifeP = new Float32Array(NN).map(() => 4 + rnd() * 6), lifeU = new Float32Array(NN).map(() => rnd()), life = new Float32Array(NN).fill(1);
  const ss = x => x * x * (3 - 2 * x);
  const lifeAt = u => u < .62 ? 1 : u < .78 ? 1 - ss((u - .62) / .16) : u < .84 ? 0 : u < .94 ? 1.3 * ss((u - .84) / .10) : 1.3 - .3 * ss((u - .94) / .06);
  // every node pair is a potential edge: fixed buffers, alpha eased towards a target each frame
  const pairs = []; for (let i = 0; i < NN; i++) for (let j = i + 1; j < NN; j++) pairs.push([i, j]);
  const pI = Int16Array.from(pairs, p => p[0]), pJ = Int16Array.from(pairs, p => p[1]);
  const NE = pairs.length, eAlpha = new Float32Array(NE), eGate = new Float32Array(NE).map(() => rnd() < 0.75 ? 1 : 0);
  const eGeo = new LineSegmentsGeometry().setPositions(new Float32Array(NE * 6)).setColors(new Float32Array(NE * 6));
  const ePosArr = eGeo.attributes.instanceStart.data.array, eColArr = eGeo.attributes.instanceColorStart.data.array;
  const edgeMat = new LineMaterial({ vertexColors: true, linewidth: isSmall ? 1.3 : 1.6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const eLines = new LineSegments2(eGeo, edgeMat); eLines.frustumCulled = false;
  eLines.renderOrder = 2; net.add(eLines);
  const LINK = isSmall ? 2.2 : 2.5;                             // connection distance threshold
  // solid cores (instanced spheres)
  const cores = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }), NN);
  cores.renderOrder = 6; net.add(cores);
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
  const nodePts = makePoints(NN, nPos); net.add(nodePts);          // soft halos
  const glow = new Float32Array(NN);
  const NP = isSmall ? 24 : 60;                                    // pulses (was 50 / 130)
  const pulses = []; for (let i = 0; i < NP; i++) pulses.push({ e: -1, t: 0, v: .45 + rnd() * .5, wait: rnd() * 2 });
  const pulsePts = makePoints(NP, new Float32Array(NP * 3)); net.add(pulsePts);
  const live = [], out = [];                                     // reused scratch arrays (no per-frame allocation)
  function pickEdge(from) {                                      // a live edge, preferably leaving `from`
    if (from >= 0) {
      out.length = 0; for (let k = 0; k < NE; k++) if (eAlpha[k] > .5 && (pI[k] === from || pJ[k] === from)) out.push(k);
      if (out.length) return out[(rnd() * out.length) | 0];
    }
    return live.length ? live[(rnd() * live.length) | 0] : -1;
  }
  let netT = 0;
  function updateNet(dt, t) {
    netT += dt;
    // nodes: drift downstream, bob gently, recycle at the outlet with a fade
    for (let i = 0; i < NN; i++) {
      const v = nodes[i];
      v.x += nVel[i] * dt; v.y += Math.sin(t * 0.35 + nPh[i]) * 0.06 * dt; v.z += Math.cos(t * 0.27 + nPh[i]) * 0.05 * dt;
      if (v.x > NB.x1) { v.x = NB.x0 - 0.3; v.y = (rnd() * 2 - 1) * NB.y; v.z = NB.z0 + rnd() * (NB.z1 - NB.z0); }
      const fx = smooth(NB.x0, NB.x0 + 1.2, v.x) * (1 - smooth(NB.x1 - 1.2, NB.x1, v.x));
      lifeU[i] = (lifeU[i] + dt / lifeP[i]) % 1; life[i] = lifeAt(lifeU[i]);
      // keep the turbine and its near wake clear: nodes are eased out of (and faded inside) an elongated zone round the rotor
      const RZ = rig.scale.x * zoneK, zx = v.x - rig.position.x, zy = v.y - rig.position.y + RZ * 0.15;
      const ex = zx > 0 ? zx / (RZ * 1.9) : zx / RZ, ey = zy / RZ, zd = Math.hypot(ex, ey);
      if (zd < 1.2) { const push = (1.2 - zd) * 1.4 * dt; v.y += (ey >= 0 ? 1 : -1) * push * RZ; v.x += (ex >= 0 ? 0.4 : -0.4) * push * RZ; }
      nAlpha[i] = fx * (0.45 + 0.55 * smooth(NB.x0, NB.x0 + (NB.x1 - NB.x0) * 0.45, v.x)) * life[i] * smooth(0.7, 1.15, zd);   // dimmer behind the text (left)
      palAt((v.x - NB.x0) / (NB.x1 - NB.x0), nCol[i]);
      v.toArray(nPos, i * 3);
      const r = coreR[i] * (0.3 + 0.7 * Math.min(1.15, nAlpha[i])) * (1 + 0.5 * glow[i]);
      m4.makeScale(r, r, r).setPosition(v); cores.setMatrixAt(i, m4);
      const k = 0.06 + 0.94 * nAlpha[i];
      cores.setColorAt(i, cc.setRGB((nCol[i][0] * .9 + .14) * k, (nCol[i][1] * .9 + .14) * k, (nCol[i][2] * .9 + .14) * k));
    }
    cores.instanceMatrix.needsUpdate = true; if (cores.instanceColor) cores.instanceColor.needsUpdate = true;
    // edges: proximity x random gate, eased so links fade in/out smoothly
    live.length = 0;
    const flip = dt * 0.06;
    for (let k = 0; k < NE; k++) {
      const i = pI[k], j = pJ[k], a = nodes[i], b = nodes[j];
      if (rnd() < flip) eGate[k] = 1 - eGate[k];                     // slow random rewiring
      const d = a.distanceTo(b);
      // tied to both endpoints' brightness: an edge fades out as either node dims, back in as both re-light
      const target = eGate[k] * (1 - smooth(LINK * 0.6, LINK, d)) * Math.min(1, nAlpha[i] * nAlpha[j] * 1.15);
      eAlpha[k] += (target - eAlpha[k]) * Math.min(1, dt * 2.2);
      if (eAlpha[k] > .5) live.push(k);
      const o = k * 6, ea = eAlpha[k] * 0.62;
      ePosArr[o] = a.x; ePosArr[o + 1] = a.y; ePosArr[o + 2] = a.z; ePosArr[o + 3] = b.x; ePosArr[o + 4] = b.y; ePosArr[o + 5] = b.z;
      eColArr[o] = nCol[i][0] * ea; eColArr[o + 1] = nCol[i][1] * ea; eColArr[o + 2] = nCol[i][2] * ea;
      eColArr[o + 3] = nCol[j][0] * ea; eColArr[o + 4] = nCol[j][1] * ea; eColArr[o + 5] = nCol[j][2] * ea;
    }
    eGeo.attributes.instanceStart.data.needsUpdate = true; eGeo.attributes.instanceColorStart.data.needsUpdate = true;
    // halos
    const sA = nodePts.geometry.attributes.aSize, cA = nodePts.geometry.attributes.aColor;
    for (let i = 0; i < NN; i++) {
      glow[i] *= Math.pow(0.15, dt);
      const g = glow[i], b = (0.75 + 0.2 * Math.sin(t * 1.3 + i * 1.7)) * nAlpha[i], c = nCol[i];
      sA.array[i] = coreR[i] * 5 + 0.25 * g;
      for (let q = 0; q < 3; q++) cA.array[i * 3 + q] = c[q] * (.3 + .4 * g) * b;
    }
    nodePts.geometry.attributes.position.needsUpdate = true; sA.needsUpdate = true; cA.needsUpdate = true;
    // pulses ride live edges only
    const pp = pulsePts.geometry.attributes.position, ps = pulsePts.geometry.attributes.aSize, pc = pulsePts.geometry.attributes.aColor;
    pulses.forEach((p, n) => {
      if (p.e < 0 || eAlpha[p.e] < .15) { p.wait -= dt; if (p.wait <= 0) { p.e = pickEdge(-1); p.t = 0; p.dir = rnd() < .5; p.wait = .3 + rnd(); } }
      else {
        p.t += dt * p.v;
        if (p.t >= 1) { const end = p.dir ? pI[p.e] : pJ[p.e]; glow[end] = Math.min(1.6, glow[end] + 0.8 * Math.min(1, life[end]));
          const ne = pickEdge(end); if (ne >= 0) { p.dir = pJ[ne] === end; } p.e = ne; p.t = 0; }
      }
      if (p.e < 0) { ps.array[n] = 0; return; }
      const a = p.dir ? pJ[p.e] : pI[p.e], b = p.dir ? pI[p.e] : pJ[p.e];
      const A_ = nodes[a], B_ = nodes[b], f = Math.max(0, Math.sin(clamp(p.t, 0, 1) * Math.PI)) * eAlpha[p.e];
      pp.array[n * 3] = A_.x + (B_.x - A_.x) * p.t; pp.array[n * 3 + 1] = A_.y + (B_.y - A_.y) * p.t; pp.array[n * 3 + 2] = A_.z + (B_.z - A_.z) * p.t;
      ps.array[n] = 0.22;
      for (let c = 0; c < 3; c++) pc.array[n * 3 + c] = ((nCol[a][c] + (nCol[b][c] - nCol[a][c]) * p.t) * .8 + .25) * f * 1.2;
    });
    pp.needsUpdate = true; ps.needsUpdate = true; pc.needsUpdate = true;
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
      X0 = -4.6; X1 = 4.6; YH = 3.0; ZH = 2.2; XC = 1.4; netAt.set(1.6, -1.0, -1.2);
      NB = { x0: -3.4, x1: 3.6, y: 2.6, z0: -1.5, z1: 0.8 };
    } else {
      camZ = 10.5; const a = W / H;                              // keep the right-hand composition on wide/narrow desktops
      stage.position.set(clamp((a - 1.6) * 2.2, -0.8, 2.2), 0, 0); stage.scale.setScalar(clamp(a / 1.6, 0.78, 1.15));
      rig.position.set(2.75, 0.75, 0); rig.scale.setScalar(1.45); zoneK = 1.3;
      X0 = -6; X1 = 6; YH = 3.0; ZH = 2.4; XC = 1.6; netAt.set(6.4, -0.6, -1.6);
      NB = { x0: -4.6, x1: 7.6, y: 3.7, z0: -2.2, z1: 1.0 };
    }
    for (const v of nodes) if (v.x < NB.x0 - .3 || v.x > NB.x1 || Math.abs(v.y) > NB.y) {   // re-scatter into the new box
      v.set(placeX(), (rnd() * 2 - 1) * NB.y, NB.z0 + rnd() * (NB.z1 - NB.z0)); }
    rig.rotation.y = YAW; rig.updateMatrix();
    T.copy(netAt).applyMatrix4(rig.matrix.clone().invert());       // network centre in the turbine frame
    ribMat.uniforms.uRes.value.set(W * pixelRatio / 2, H * pixelRatio / 2); ribMat.uniforms.uW.value = (isSmall ? 1.7 : 2.0) * pixelRatio;
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
    rotor.rotation.x = rotorAng; updateNet(0.016, 2); writeColors(); render();
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
    stepParticles(dtReal); rotor.rotation.x = rotorAng; writeColors(); updateNet(dtReal, t);
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
  const warm = reduceMotion ? 120 : 16;
  for (let s = 0; s < warm; s++) stepParticles(1 / 40);         // ~ms of work: no need to yield
  stats.setupMs = Math.round(performance.now() - tInit);
  try { if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera); } catch (e) { /* compile lazily */ }
  const reveal = () => { canvas.classList.add('is-ready'); stats.firstFrameMs = Math.round(performance.now()); stats.initMs = Math.round(performance.now() - tInit); };
  if (reduceMotion) {
    drawStatic(); reveal();
  } else {
    start(); requestAnimationFrame(() => requestAnimationFrame(reveal));
    let inView = true;
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; (inView && !document.hidden) ? start() : stop(); }, { threshold: 0 }).observe(canvas);
    document.addEventListener('visibilitychange', () => { (!document.hidden && inView) ? start() : stop(); });
  }
  canvas.dataset.ready = 'true';
}
