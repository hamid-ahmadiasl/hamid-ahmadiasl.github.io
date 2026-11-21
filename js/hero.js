/* Hero scene: the neural network IS the wind that drives the turbine.
   Layers of nodes span the hero left → right; connections are smooth CFD-like
   streamlines (bezier / Catmull-Rom), not straight edges. Signal pulses and a
   mix of thin glowing lines + 0/1 glyphs travel those curves, converge around
   the rotor on the right, and visibly drive its rotation. Gusts are activation
   bursts that propagate layer by layer. No solid output block.
   URL flags: ?streams=mixed|glyphs|lines  ?noadapt  ?gust=1 (hold a mid-gust). */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const rnd = Math.random;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

export async function initHero({ reduceMotion, isSmall }) {
  const tInit = performance.now();
  const canvas = document.getElementById('scene');
  if (!canvas || !webglAvailable()) throw new Error('no-webgl');
  const params = new URLSearchParams(location.search);
  const adaptive = !params.has('noadapt');
  const streamQ = (params.get('streams') || 'mixed').toLowerCase();
  const streamMode = streamQ === 'glyphs' || streamQ === 'lines' ? streamQ : 'mixed';
  const holdGust = params.has('gust');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  const BG = 0x01040c;
  renderer.setClearColor(BG, 1);
  let pixelRatio = Math.min(window.devicePixelRatio || 1, isSmall ? 1.25 : 1.5);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.014);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
  const stage = new THREE.Group(); scene.add(stage);

  const YAW = 0.32;
  const OMEGA = 1.32, XR = -0.22;
  let simT = 0, rotorAng = 0, rotorSpeed = OMEGA, gust = 0, wave = 0, nacellePulse = 0, flowE = 0.6;

  /* cyan → violet → pink along the span */
  const pal = [[.18, .82, 1.0], [.32, .55, 1.0], [.55, .34, 1.0], [.82, .26, .92], [.98, .28, .62], [1.0, .34, .50]];
  const rgb = [0, 0, 0];
  const palAt = (t, o) => { t = clamp(t, 0, 1); const f = t * (pal.length - 1), i = Math.min(pal.length - 2, Math.floor(f)), u = f - i;
    for (let c = 0; c < 3; c++) o[c] = pal[i][c] + (pal[i + 1][c] - pal[i][c]) * u; return o; };

  /* Dim the field behind the left text column (desktop). Mobile text sits under the CSS glow. */
  let zoneA = -2.2, zoneB = 0.85;
  const zoneK = x => isSmall ? 1 : (0.24 + 0.76 * smooth(zoneA, zoneB, x));

  /* ===== Glyph atlas (0/1) — instanced screen-space quads along a trail ===== */
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

  let N = isSmall ? 56 : 110;
  const K = isSmall ? 14 : 18;
  const P = {
    path: new Int16Array(N), s: new Float32Array(N), age: new Float32Array(N),
    life: new Float32Array(N), inten: new Float32Array(N), sp: new Float32Array(N), bit: new Float32Array(N)
  };
  const hist = new Float32Array(N * K * 3);
  const col = new Float32Array(N * K * 3);
  const bits = new Float32Array(N * K);
  const fade = new Float32Array(K);
  for (let k = 0; k < K; k++) fade[k] = k === K - 1 ? 0 : Math.pow(1 - k / (K - 1), 1.12);

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
      uPx: { value: isSmall ? 7.2 : 8.6 },
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
  streams.frustumCulled = false; streams.renderOrder = 4;
  stage.add(streams);
  let nAct = N;

  const nSeg = N * (K - 1);
  const linePos = new Float32Array(nSeg * 2 * 3);
  const lineCol = new Float32Array(nSeg * 2 * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3).setUsage(THREE.DynamicDrawUsage));
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1, fog: true });
  const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
  lineMesh.frustumCulled = false; lineMesh.renderOrder = 3;
  stage.add(lineMesh);

  /* ===== Turbine (procedural HAWT): brighter, still elegant — tower, nacelle, spinner, twisted blades ===== */
  const turb = new THREE.Group(); stage.add(turb);
  const shell = (fadeY, kk = 1) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uFade: { value: fadeY }, uK: { value: kk } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vY=position.y; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying float vY; uniform float uFade; uniform float uK;
      void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.85);
        vec3 rim=mix(vec3(.32,.86,1.),vec3(.70,.46,1.),clamp(f,0.,1.));
        vec3 fill=vec3(.05,.11,.20);
        float fd = uFade < -50. ? 1. : smoothstep(uFade, uFade+1.3, vY);
        gl_FragColor=vec4(fill+rim*(.26+f*2.15)*uK, (.70+.34*f)*fd); }`
  });
  const wireMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const wire = (pts, cols) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); const l = new THREE.LineSegments(g, wireMat); l.renderOrder = 8; return l; };
  const CY = [.40, .90, 1.0], VI = [.70, .46, 1.0], PK = [1.0, .36, .62];
  const mixc = (a, b, t, k) => [(a[0] + (b[0] - a[0]) * t) * k, (a[1] + (b[1] - a[1]) * t) * k, (a[2] + (b[2] - a[2]) * t) * k];
  function revolve(prof, seg, ringEvery) {
    const pos = [], idx = [], wp = [], wc = [];
    prof.forEach(([r, x]) => { for (let j = 0; j <= seg; j++) { const a = j / seg * 6.2832; pos.push(x, r * Math.cos(a), r * Math.sin(a)); } });
    for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const c = mixc(CY, VI, .3, 1.15);
    for (let j = 0; j < seg; j += 2) for (let i = 0; i < prof.length - 1; i++) { const a = (i * (seg + 1) + j) * 3, b = a + (seg + 1) * 3; wp.push(...pos.slice(a, a + 3), ...pos.slice(b, b + 3)); wc.push(...c, ...c); }
    for (let i = 0; i < prof.length; i += ringEvery) for (let j = 0; j < seg; j++) { const a = (i * (seg + 1) + j) * 3; wp.push(...pos.slice(a, a + 3), ...pos.slice(a + 3, a + 6)); wc.push(...c, ...c); }
    return [g, wire(wp, wc)];
  }
  const addShell = (g, fadeY = -100, kk = 1) => { const m = new THREE.Mesh(g, shell(fadeY, kk)); m.renderOrder = 7; return m; };
  const HT = 2.05, TX = XR + 0.3;
  { const g = new THREE.CylinderGeometry(0.036, 0.075, HT, 14, 1, true); const m = addShell(g, -HT / 2, 0.7); m.position.set(TX, -0.08 - HT / 2, 0); turb.add(m);
    const wp = [], wc = [];
    for (let j = 0; j < 8; j++) { const a = j / 8 * 6.2832, ca_ = Math.cos(a), sa_ = Math.sin(a);
      wp.push(TX + .075 * ca_, -0.08 - HT, .075 * sa_, TX + .036 * ca_, -0.08, .036 * sa_); wc.push(0, 0, 0, ...mixc(CY, VI, .2, .85)); }
    turb.add(wire(wp, wc)); }
  { const [g, w] = revolve([[0.0, XR + 0.03], [0.07, XR + 0.05], [0.086, XR + 0.14], [0.09, XR + 0.5], [0.078, XR + 0.64], [0.035, XR + 0.7], [0.0, XR + 0.71]], 16, 2);
    turb.add(addShell(g, -100, 1.02), w); }
  const rotor = new THREE.Group(); rotor.position.x = XR; turb.add(rotor);
  { const [g, w] = revolve([[0.0, -0.2], [0.03, -0.185], [0.055, -0.14], [0.072, -0.07], [0.08, 0.0], [0.078, 0.04]], 16, 2); rotor.add(addShell(g, -100, 1.05), w); }
  function blade() {
    const S = 14, C = 10, pos = [], idx = [], wp = [], wc = [], ring = [];
    for (let s = 0; s <= S; s++) {
      const u = s / S, rr = 0.06 + 0.92 * u;
      const chord = u < 0.18 ? 0.06 + 0.12 * smooth(0, 0.18, u) : 0.18 - 0.14 * Math.pow((u - 0.18) / 0.82, 0.8);
      const thick = u < 0.25 ? 0.5 - 0.38 * smooth(0, 0.25, u) : 0.12;
      const beta = 0.3 * Math.pow(1 - u, 1.5) + 0.03, dX = Math.sin(beta), dZ = -Math.cos(beta);
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
    for (let s = 0; s < S; s++) for (const k of [0, C / 2, C / 4, 3 * C / 4]) {
      const t = s / S, c0 = mixc(CY, VI, t, k === C / 2 ? 1.45 : .95), c1 = mixc(CY, VI, (s + 1) / S, k === C / 2 ? 1.45 : .95);
      wp.push(...P3(ring[s][k]), ...P3(ring[s + 1][k])); wc.push(...c0, ...c1); }
    for (const s of [2, 5, 8, 11, S]) for (let k = 0; k < C; k++) {
      const c = mixc(CY, VI, s / S, .7); wp.push(...P3(ring[s][k]), ...P3(ring[s][(k + 1) % C])); wc.push(...c, ...c); }
    return [g, wp, wc];
  }
  { const [g, wp, wc] = blade(), w = wire(wp, wc).geometry;
    for (let b = 0; b < 3; b++) { const grp = new THREE.Group(); grp.rotation.x = b * 2.0944; grp.add(addShell(g, -100, 1.08), new THREE.LineSegments(w, wireMat)); grp.children[1].renderOrder = 8; rotor.add(grp); } }
  { const pts = []; for (let j = 0; j < 96; j++) { const a = j / 96 * 6.2832, b = (j + 1) / 96 * 6.2832; pts.push(XR, Math.cos(a), Math.sin(a), XR, Math.cos(b), Math.sin(b)); }
    const c = []; for (let j = 0; j < 192; j++) c.push(.28, .22, .55); turb.add(wire(pts, c)); }

  const nacelleHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xb8d8ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })
  );
  nacelleHalo.position.set(XR + 0.36, 0.02, 0);
  nacelleHalo.renderOrder = 9;
  turb.add(nacelleHalo);

  /* ===== Network: layers of nodes across the hero. The rotor is the sink they converge into. ===== */
  const layers = isSmall ? [4, 5, 3] : [4, 6, 5, 4];
  const nLayers = layers.length;
  const layerIndex = [];
  const nodes = [], nCol = [], coreR = [], nPh = [], nLayer = [];
  for (let li = 0; li < nLayers; li++) {
    layerIndex.push(nodes.length);
    const n = layers[li];
    palAt(li / Math.max(1, nLayers - 1), rgb);
    for (let j = 0; j < n; j++) {
      nodes.push(new THREE.Vector3());
      nCol.push(rgb.slice());
      coreR.push(li === 0 ? 0.07 : li === nLayers - 1 ? 0.08 : 0.062);
      nPh.push(rnd() * 6.28);
      nLayer.push(li);
    }
  }
  const NN = nodes.length;
  const layerAct = new Float32Array(nLayers + 1);           // last slot = rotor arrival

  function placeNetwork(x0, x1, h0) {
    for (let li = 0; li < nLayers; li++) {
      const u = li / Math.max(1, nLayers - 1);
      // slightly more space on the left, tighter as streams converge
      const x = lerp(x0, x1, u * u * 0.18 + u * 0.82);
      const h = lerp(h0, h0 * 0.58, u);
      const n = layers[li], a0 = layerIndex[li];
      palAt(u, rgb);
      for (let j = 0; j < n; j++) {
        const y = (j - (n - 1) / 2) * (h / Math.max(1, n - 1));
        const z = ((li % 2) ? 0.16 : -0.14) + (j % 2 ? 0.07 : -0.06) + (j - (n - 1) / 2) * 0.03;
        nodes[a0 + j].set(x, y, z);
        nCol[a0 + j] = rgb.slice();
      }
    }
  }

  const tmpV = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();
  function rotPt(lx, y, z, out) {
    out.set(lx, y, z);
    turb.localToWorld(out);
    stage.worldToLocal(out);
    return out;
  }

  /* Persistent curved links (the visible "wiring" that is also the wind). */
  const pairs = [];
  function buildPairs() {
    pairs.length = 0;
    for (let li = 0; li < nLayers - 1; li++) {
      const a0 = layerIndex[li], aN = layers[li], b0 = layerIndex[li + 1], bN = layers[li + 1];
      for (let i = 0; i < aN; i++) {
        // two or three destinations of similar height — airy, not a fully-connected hairball
        const t = aN === 1 ? 0.5 : i / (aN - 1);
        const j0 = Math.round(t * (bN - 1));
        const set = new Set([j0, clamp(j0 - 1, 0, bN - 1), clamp(j0 + 1, 0, bN - 1)]);
        if (bN > 3 && i % 2 === 0) set.add((j0 + 2) % bN);
        for (const j of set) pairs.push([a0 + i, b0 + j, li]);
      }
    }
    // a few long skip links
    const skips = isSmall ? 3 : 5;
    for (let k = 0; k < skips && nLayers >= 3; k++) {
      const la = k % (nLayers - 2), lb = la + 2;
      pairs.push([layerIndex[la] + (k % layers[la]), layerIndex[lb] + ((k * 2 + 1) % layers[lb]), la]);
    }
  }
  buildPairs();

  const LINK_M = 20;
  const nLinkSeg = 512 * (LINK_M - 1);                      // capacity; count set in rebuildLinks
  let nLinkUsed = 0;
  const linkPos = new Float32Array(nLinkSeg * 2 * 3);
  const linkCol = new Float32Array(nLinkSeg * 2 * 3);
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3).setUsage(THREE.DynamicDrawUsage));
  linkGeo.setAttribute('color', new THREE.BufferAttribute(linkCol, 3).setUsage(THREE.DynamicDrawUsage));
  linkGeo.setDrawRange(0, 0);
  const linkMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const linkMesh = new THREE.LineSegments(linkGeo, linkMat);
  linkMesh.frustumCulled = false; linkMesh.renderOrder = 2;
  stage.add(linkMesh);

  function cubic(a, b, c, d, t, o) {
    const u = 1 - t, uu = u * u, tt = t * t, uuu = uu * u, ttt = tt * t;
    o.set(
      uuu * a.x + 3 * uu * t * b.x + 3 * u * tt * c.x + ttt * d.x,
      uuu * a.y + 3 * uu * t * b.y + 3 * u * tt * c.y + ttt * d.y,
      uuu * a.z + 3 * uu * t * b.z + 3 * u * tt * c.z + ttt * d.z
    );
    return o;
  }
  function crPoint(pts, t, o) {
    const n = pts.length - 1;
    const x = clamp(t, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(x));
    const f = x - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const f2 = f * f, f3 = f2 * f;
    o.set(
      0.5 * ((2 * p1.x) + (-p0.x + p2.x) * f + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f3),
      0.5 * ((2 * p1.y) + (-p0.y + p2.y) * f + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f3),
      0.5 * ((2 * p1.z) + (-p0.z + p2.z) * f + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * f2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * f3)
    );
    return o;
  }

  /* Sample a flowing cubic between two nodes (bowed like a streamline, not a straight chord). */
  function bowed(a, b, seed, samples, dest) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy, b.z - a.z) || 1;
    const bow = (0.18 + (seed % 7) * 0.04) * len * ((seed % 2) ? 1 : -1);
    const nz = ((seed % 5) - 2) * 0.07;
    tmpA.copy(a);
    tmpB.set(a.x + dx * 0.32, a.y + dy * 0.32 + bow, a.z + (b.z - a.z) * 0.32 + nz);
    tmpC.set(a.x + dx * 0.68, a.y + dy * 0.68 + bow * 0.35, a.z + (b.z - a.z) * 0.68 - nz * 0.4);
    tmpD.copy(b);
    for (let i = 0; i < samples; i++) dest.push(cubic(tmpA, tmpB, tmpC, tmpD, i / (samples - 1), new THREE.Vector3()).clone());
    return dest;
  }

  function rebuildLinks() {
    let s = 0;
    const pushSeg = (a, b, ka, kb) => {
      if (s + 6 > linkPos.length) return;
      palAt(storyU(a.x), rgb);
      const fa = zoneK(a.x) * ka;
      linkPos[s] = a.x; linkPos[s + 1] = a.y; linkPos[s + 2] = a.z;
      linkCol[s] = rgb[0] * fa; linkCol[s + 1] = rgb[1] * fa; linkCol[s + 2] = rgb[2] * fa;
      palAt(storyU(b.x), rgb);
      const fb = zoneK(b.x) * kb;
      linkPos[s + 3] = b.x; linkPos[s + 4] = b.y; linkPos[s + 5] = b.z;
      linkCol[s + 3] = rgb[0] * fb; linkCol[s + 4] = rgb[1] * fb; linkCol[s + 5] = rgb[2] * fb;
      s += 6;
    };
    const samples = LINK_M;
    const tmp = [];
    for (let p = 0; p < pairs.length; p++) {
      const [ia, ib, li] = pairs[p];
      tmp.length = 0;
      bowed(nodes[ia], nodes[ib], p * 13 + 3, samples, tmp);
      const base = 0.22 + 0.06 * (li === 0 ? 0 : 1);
      for (let i = 0; i < tmp.length - 1; i++) pushSeg(tmp[i], tmp[i + 1], base, base);
    }
    // drive curves: last layer → wrap / enter the rotor
    const last0 = layerIndex[nLayers - 1], lastN = layers[nLayers - 1];
    for (let j = 0; j < lastN; j++) {
      for (let arm = 0; arm < 2; arm++) {
        const wps = driveWaypoints(nodes[last0 + j], j, arm);
        const samp = [];
        for (let i = 0; i <= 24; i++) samp.push(crPoint(wps, i / 24, new THREE.Vector3()).clone());
        for (let i = 0; i < samp.length - 1; i++) {
          const fadeOut = 1 - smooth(0.72, 1, i / (samp.length - 1));
          pushSeg(samp[i], samp[i + 1], 0.38 * fadeOut, 0.38 * fadeOut);
        }
      }
    }
    nLinkUsed = s / 3;
    linkGeo.setDrawRange(0, nLinkUsed);
    linkGeo.attributes.position.needsUpdate = true;
    linkGeo.attributes.color.needsUpdate = true;
  }

  function driveWaypoints(src, j, arm) {
    const ang = (j / Math.max(1, layers[nLayers - 1]) + arm * 0.17) * Math.PI * 2;
    const rIn = arm === 0 ? 0.42 + (j % 3) * 0.12 : 0.92 + (j % 2) * 0.1;
    const swirl = arm === 0 ? 0.55 : 0.9;
    const a0 = ang, a1 = ang + swirl * 0.55, a2 = ang + swirl * 1.05;
    const p0 = src.clone();
    const mid = new THREE.Vector3(); rotPt(XR - 0.85, Math.cos(a0) * rIn * 0.85, Math.sin(a0) * rIn * 0.85, mid);
    mid.y = lerp(src.y, mid.y, 0.7); mid.z = lerp(src.z, mid.z, 0.7);
    const pA = new THREE.Vector3(); rotPt(XR - 0.15, Math.cos(a1) * rIn, Math.sin(a1) * rIn, pA);
    const pB = new THREE.Vector3(); rotPt(XR + 0.35, Math.cos(a2) * (rIn * (arm === 0 ? 0.7 : 1.08)), Math.sin(a2) * (rIn * (arm === 0 ? 0.7 : 1.08)), pB);
    const pC = new THREE.Vector3(); rotPt(XR + 0.95, Math.cos(a2 + 0.25) * rIn * 0.85, Math.sin(a2 + 0.25) * rIn * 0.85, pC);
    return [p0, mid, pA, pB, pC];
  }

  function storyU(x) {
    const tMin = nodes[0] ? nodes[0].x - 1.2 : -4;
    const tMax = turb.position.x + 0.4;
    return clamp((x - tMin) / Math.max(0.01, tMax - tMin), 0, 1);
  }

  /* Soft node cores + additive glow sprites. */
  const cores = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, fog: true }), NN);
  cores.renderOrder = 6; cores.frustumCulled = false; stage.add(cores);
  const dummy = new THREE.Object3D();
  const coreCol = new THREE.Color();
  function makePoints(n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute float aSize; attribute vec3 color; varying vec3 vC; uniform float uScale;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
          gl_PointSize=aSize*uScale/max(1.,-mv.z); }`,
      fragmentShader: `varying vec3 vC; void main(){ vec2 p=gl_PointCoord*2.-1.; float r=dot(p,p);
        if(r>1.) discard; float a=exp(-r*2.6); gl_FragColor=vec4(vC*a,1.); }`
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5; return pts;
  }
  const nodePts = makePoints(NN); stage.add(nodePts);

  /* A handful of faint background nodes (parallax depth). */
  const nBg = isSmall ? 6 : 10;
  const bgPts = makePoints(nBg); stage.add(bgPts);
  const bgPos = [];
  function placeBackground() {
    bgPos.length = 0;
    const x0 = nodes[0].x - 0.4, x1 = turb.position.x - 0.6;
    for (let i = 0; i < nBg; i++) {
      const u = (i + 0.5) / nBg;
      bgPos.push(new THREE.Vector3(lerp(x0, x1, u), (rnd() - 0.5) * 3.1, -2.1 - rnd() * 1.4));
    }
    const pos = bgPts.geometry.attributes.position.array;
    const c = bgPts.geometry.attributes.color.array;
    const sz = bgPts.geometry.attributes.aSize.array;
    for (let i = 0; i < nBg; i++) {
      pos[i * 3] = bgPos[i].x; pos[i * 3 + 1] = bgPos[i].y; pos[i * 3 + 2] = bgPos[i].z;
      palAt(storyU(bgPos[i].x), rgb);
      const k = 0.12 * zoneK(bgPos[i].x);
      c[i * 3] = rgb[0] * k; c[i * 3 + 1] = rgb[1] * k; c[i * 3 + 2] = rgb[2] * k;
      sz[i] = 0.09;
    }
    bgPts.geometry.attributes.position.needsUpdate = true;
    bgPts.geometry.attributes.color.needsUpdate = true;
    bgPts.geometry.attributes.aSize.needsUpdate = true;
  }

  /* Tracer paths: each is a Catmull-Rom through the inlet, a node in every layer, then a rotor wrap. */
  const PATHS = [];                                          // { pts:Vector3[], m, dim, glyph }
  function buildPaths() {
    PATHS.length = 0;
    const nMain = isSmall ? 18 : 28;
    const nDeep = isSmall ? 5 : 8;
    const make = (wps, dim, glyph) => {
      const m = isSmall ? 28 : 36;
      const pts = [];
      for (let i = 0; i <= m; i++) pts.push(crPoint(wps, i / m, new THREE.Vector3()).clone());
      PATHS.push({ pts, m: pts.length, dim, glyph });
    };
    const inletX = nodes[0].x - 1.35;
    for (let s = 0; s < nMain; s++) {
      const wps = [];
      const yJ = (s / Math.max(1, nMain - 1) - 0.5) * (isSmall ? 2.0 : 2.6) + (s % 3 - 1) * 0.12;
      const zJ = ((s % 4) - 1.5) * 0.18;
      wps.push(new THREE.Vector3(inletX, yJ, zJ));
      let y = yJ, z = zJ;
      for (let li = 0; li < nLayers; li++) {
        const a0 = layerIndex[li], n = layers[li];
        // node of similar height, with a small neighbour wander
        let best = 0, bestD = 1e9;
        for (let j = 0; j < n; j++) { const d = Math.abs(nodes[a0 + j].y - y); if (d < bestD) { bestD = d; best = j; } }
        if (s % 3 === li % 3) best = clamp(best + (s % 2 ? 1 : -1), 0, n - 1);
        const nd = nodes[a0 + best];
        const off = 0.05 * ((s + li) % 5 - 2);
        wps.push(new THREE.Vector3(nd.x - 0.02, nd.y + off * 0.15, nd.z + off * 0.08));
        y = nd.y; z = nd.z;
      }
      const arm = s % 2;
      const dwp = driveWaypoints(wps[wps.length - 1], s % layers[nLayers - 1], arm);
      for (let k = 1; k < dwp.length; k++) wps.push(dwp[k]);
      make(wps, s % 5 === 0 ? 0.55 : 1, s % 3 !== 2);
    }
    // deeper, dimmer parallax streams
    for (let s = 0; s < nDeep; s++) {
      const wps = [];
      const y = (s / Math.max(1, nDeep - 1) - 0.5) * 3.0;
      const z = -2.0 - (s % 3) * 0.35;
      wps.push(new THREE.Vector3(inletX - 0.4, y, z));
      wps.push(new THREE.Vector3(lerp(inletX, turb.position.x, 0.35), y * 0.85, z + 0.2));
      wps.push(new THREE.Vector3(lerp(inletX, turb.position.x, 0.7), y * 0.55, z));
      wps.push(new THREE.Vector3(turb.position.x + 0.2, y * 0.35, z + 0.15));
      make(wps, 0.28, false);
    }
  }

  function pathPos(path, s, o) {
    const pts = path.pts, m = path.m - 1;
    const u = clamp(s, 0, m);
    const i = Math.min(m - 1, Math.floor(u));
    const f = u - i;
    o.lerpVectors(pts[i], pts[i + 1], f);
    return o;
  }

  function spawn(i, anywhere) {
    const p = PATHS[i % Math.max(1, PATHS.length)];
    P.path[i] = i % Math.max(1, PATHS.length);
    P.life[i] = 3.8 + rnd() * 2.4;
    P.inten[i] = (0.7 + rnd() * 0.45) * (p.dim || 1);
    P.sp[i] = (p.m - 1) / P.life[i];
    P.bit[i] = rnd() < 0.5 ? 0 : 1;
    P.age[i] = 0;
    P.s[i] = anywhere ? rnd() * (p.m - 1) * 0.92 : 0;
  }

  function digitize(x, i) {
    if (streamMode === 'glyphs') return 1;
    if (streamMode === 'lines') return 0;
    const p = PATHS[P.path[i]];
    if (p && !p.glyph) return 0;
    const early = (i % 5 === 0) ? 0.35 : 0;                  // a few sparse bits even upstream
    return clamp(smooth(nodes[0] ? nodes[0].x + 0.8 : -1, turb.position.x - 1.8, x) * 1.0 + early, 0, 1);
  }

  const trailTmp = new THREE.Vector3();
  function stepParticles(dt) {
    const boost = 1 + 0.85 * gust + 0.55 * layerAct[nLayers];
    let energy = 0, nE = 0;
    for (let i = 0; i < nAct; i++) {
      const path = PATHS[P.path[i]];
      if (!path) continue;
      const liNear = clamp(Math.floor(storyU(pathPos(path, P.s[i], trailTmp).x) * nLayers), 0, nLayers - 1);
      const spd = P.sp[i] * boost * (1 + 0.65 * layerAct[liNear]);
      P.s[i] += spd * dt;
      P.age[i] += dt;
      if (P.s[i] >= path.m - 1 || P.age[i] > P.life[i] + 0.4) { spawn(i, false); }
      // write trail backwards along the path
      const ds = 0.7;
      for (let k = 0; k < K; k++) {
        pathPos(path, P.s[i] - k * ds, trailTmp);
        const o = (i * K + k) * 3;
        hist[o] = trailTmp.x; hist[o + 1] = trailTmp.y; hist[o + 2] = trailTmp.z;
        if (k === 0) { energy += zoneK(trailTmp.x); nE++; }
        bits[i * K + k] = ((P.bit[i] + k) & 1);
      }
    }
    flowE = nE ? energy / nE : 0.5;
    rotorSpeed += (OMEGA * (0.72 + 0.28 * clamp(flowE, 0, 1)) * (1 + 0.95 * layerAct[nLayers] + 0.28 * gust) - rotorSpeed) * Math.min(1, dt * 4.5);
    rotorAng += rotorSpeed * dt;
    simT += dt;
  }

  function writeColors() {
    const GAIN = 1.05;
    for (let i = 0; i < nAct; i++) {
      const inten = P.inten[i] * GAIN * (1 + 0.4 * gust);
      const b = i * K * 3;
      for (let k = 0; k < K; k++) {
        const o = b + k * 3;
        const x = hist[o];
        palAt(storyU(x), rgb);
        const f = fade[k] * inten * zoneK(x);
        const dig = digitize(x, i);
        const gA = streamMode === 'glyphs' ? 1 : streamMode === 'lines' ? 0 : dig;
        col[o] = rgb[0] * f * gA; col[o + 1] = rgb[1] * f * gA; col[o + 2] = rgb[2] * f * gA;
      }
      for (let k = 0; k < K - 1; k++) {
        const o = b + k * 3;
        const s = (i * (K - 1) + k) * 6;
        linePos[s] = hist[o]; linePos[s + 1] = hist[o + 1]; linePos[s + 2] = hist[o + 2];
        linePos[s + 3] = hist[o + 3]; linePos[s + 4] = hist[o + 4]; linePos[s + 5] = hist[o + 5];
        let l0, l1;
        if (streamMode === 'glyphs') { l0 = l1 = 0; }
        else if (streamMode === 'lines') { l0 = l1 = 1; }
        else { l0 = 1 - digitize(hist[o], i) * 0.88; l1 = 1 - digitize(hist[o + 3], i) * 0.88; }
        palAt(storyU(hist[o]), rgb);
        const f0 = fade[k] * inten * l0 * zoneK(hist[o]);
        lineCol[s] = rgb[0] * f0; lineCol[s + 1] = rgb[1] * f0; lineCol[s + 2] = rgb[2] * f0;
        palAt(storyU(hist[o + 3]), rgb);
        const f1 = fade[k + 1] * inten * l1 * zoneK(hist[o + 3]);
        lineCol[s + 3] = rgb[0] * f1; lineCol[s + 4] = rgb[1] * f1; lineCol[s + 5] = rgb[2] * f1;
      }
    }
    for (let i = nAct; i < N; i++) {
      for (let k = 0; k < K; k++) {
        const o = i * K * 3 + k * 3;
        col[o] = col[o + 1] = col[o + 2] = 0;
      }
      for (let k = 0; k < K - 1; k++) {
        const s = (i * (K - 1) + k) * 6;
        for (let c = 0; c < 6; c++) lineCol[s + c] = 0;
      }
    }
    hBuf.needsUpdate = true; cBuf.needsUpdate = true; bBuf.needsUpdate = true;
    lineGeo.attributes.position.needsUpdate = true; lineGeo.attributes.color.needsUpdate = true;
  }

  /* Pulse motes that ride the curved links (in addition to the longer tracer trails). */
  const NP = isSmall ? 22 : 36;
  const pulsePts = makePoints(NP); stage.add(pulsePts);
  const pulses = [];
  for (let i = 0; i < NP; i++) pulses.push({ path: i % 2, s: rnd(), v: 8 + rnd() * 6, live: true });

  function updatePulses(dt) {
    const pos = pulsePts.geometry.attributes.position.array;
    const c = pulsePts.geometry.attributes.color.array;
    const sz = pulsePts.geometry.attributes.aSize.array;
    const nP = PATHS.length;
    if (!nP) return;
    for (let i = 0; i < NP; i++) {
      const p = pulses[i];
      if (p.path >= nP) p.path = i % nP;
      const path = PATHS[p.path];
      const boost = 1 + 1.1 * gust + 0.8 * layerAct[clamp(Math.floor((p.s / (path.m - 1)) * nLayers), 0, nLayers)];
      p.s += p.v * dt * boost * 0.55;
      if (p.s >= path.m - 1) { p.path = (p.path + 3) % nP; p.s = 0; p.v = 8 + rnd() * 6; }
      pathPos(path, p.s, trailTmp);
      pos[i * 3] = trailTmp.x; pos[i * 3 + 1] = trailTmp.y; pos[i * 3 + 2] = trailTmp.z;
      palAt(storyU(trailTmp.x), rgb);
      const k = (0.55 + 0.7 * gust) * zoneK(trailTmp.x);
      c[i * 3] = rgb[0] * k; c[i * 3 + 1] = rgb[1] * k; c[i * 3 + 2] = rgb[2] * k;
      sz[i] = (isSmall ? 0.09 : 0.11) * (0.85 + 0.5 * gust);
    }
    pulsePts.geometry.attributes.position.needsUpdate = true;
    pulsePts.geometry.attributes.color.needsUpdate = true;
    pulsePts.geometry.attributes.aSize.needsUpdate = true;
  }

  function updateNodes(t) {
    const pos = nodePts.geometry.attributes.position.array;
    const c = nodePts.geometry.attributes.color.array;
    const sz = nodePts.geometry.attributes.aSize.array;
    for (let i = 0; i < NN; i++) {
      const nd = nodes[i], li = nLayer[i];
      const breath = 0.5 + 0.5 * Math.sin(t * 1.1 + nPh[i]);
      const act = layerAct[li];
      const k = zoneK(nd.x);
      const glow = (0.38 + 0.28 * breath + 0.7 * act) * k;
      palAt(li / Math.max(1, nLayers - 1), rgb);
      pos[i * 3] = nd.x; pos[i * 3 + 1] = nd.y; pos[i * 3 + 2] = nd.z;
      c[i * 3] = nCol[i][0] * glow * 1.2; c[i * 3 + 1] = nCol[i][1] * glow * 1.2; c[i * 3 + 2] = nCol[i][2] * glow * 1.2;
      sz[i] = (coreR[i] * 2.8) * (0.9 + 0.35 * act) * (0.75 + 0.25 * k);
      dummy.position.copy(nd);
      const sc = coreR[i] * (0.85 + 0.4 * act + 0.08 * breath);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      cores.setMatrixAt(i, dummy.matrix);
      coreCol.setRGB(nCol[i][0] * (0.35 + 0.65 * k), nCol[i][1] * (0.35 + 0.65 * k), nCol[i][2] * (0.35 + 0.65 * k));
      cores.setColorAt(i, coreCol);
    }
    cores.instanceMatrix.needsUpdate = true;
    if (cores.instanceColor) cores.instanceColor.needsUpdate = true;
    nodePts.geometry.attributes.position.needsUpdate = true;
    nodePts.geometry.attributes.color.needsUpdate = true;
    nodePts.geometry.attributes.aSize.needsUpdate = true;
  }

  /* Gusts: a wave of activation travels layer by layer, then speeds the rotor. */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, armed: false };
  function updateGust(dt, t) {
    const period = 9.2, dur = 2.35, delay = 6.5;
    const phase = t < delay ? period : (t - delay) % period;
    const periodic = (!reduceMotion && t >= delay && phase < dur) ? 1 : 0;
    const prog = periodic ? phase / dur : 0;
    let poke = 0;
    if (!isSmall && !reduceMotion) {
      poke = mouse.armed ? clamp(1 - Math.hypot(mouse.tx - 0.35, mouse.ty * 0.85) / 0.85, 0, 1) * 0.5 : 0;
    }
    const forced = (holdGust || (stats && stats.forceGust)) ? 1 : 0;
    const target = Math.max(periodic, poke > 0.2 ? poke : 0, forced);
    gust += (target - gust) * (target > gust ? 0.2 : 0.05);
    let waveT = forced ? 0.62 : (periodic ? prog : poke > 0.2 ? 0.45 : 0);
    if (forced) gust = Math.max(gust, 0.92);
    wave += (waveT - wave) * (forced ? 1 : 0.18);
    // layer activations: a bump travelling 0 → 1 (rotor)
    for (let li = 0; li <= nLayers; li++) {
      const pos = li / nLayers;
      const bump = Math.exp(-Math.pow((wave - pos) * 3.6, 2));
      layerAct[li] = gust * (0.15 + 0.85 * bump);
    }
    nacellePulse = layerAct[nLayers];
    if (nacelleHalo && nacelleHalo.material) {
      const k = Math.min(1, 0.12 + nacellePulse * 0.55 + gust * 0.12);
      nacelleHalo.material.opacity = 0.08 + 0.28 * k;
      nacelleHalo.scale.setScalar(1 + 0.45 * k);
    }
    // brighten persistent drive-link colours slightly with the wave (cheap: scale isn't needed every frame)
    stats.gust = gust; stats.wave = wave; stats.rotorSpeed = rotorSpeed; stats.flowE = flowE;
  }

  let composer = null, bloom = null, useBloom = true;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), isSmall ? 0.48 : 0.52, 0.42, 0.28);
    const bloomSetSize = bloom.setSize.bind(bloom);
    bloom.setSize = (w, h) => bloomSetSize(Math.max(1, w / 2), Math.max(1, h / 2));
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  } catch (e) { composer = null; useBloom = false; }

  let W = 1, H = 1, camZ = 12, lookX = 1.12;
  function layout() {
    W = canvas.clientWidth || canvas.parentElement.clientWidth || 1280;
    H = canvas.clientHeight || canvas.parentElement.clientHeight || 800;
    renderer.setSize(W, H, false);
    camera.aspect = W / Math.max(1, H); camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(pixelRatio); composer.setSize(W, H); }
    if (isSmall) {
      camZ = 17.2; lookX = 0.35;
      stage.position.set(0.05, 4.95, 0); stage.scale.setScalar(1);
      placeNetwork(-2.25, 1.25, 1.85);
      turb.position.set(2.18, 0.04, 0); turb.scale.setScalar(1.02);
    } else {
      const a = W / Math.max(1, H);
      camZ = 12.0; lookX = 1.12;
      stage.position.set(0, 0.1, 0);
      stage.scale.setScalar(clamp(a / 1.6, 0.84, 1.08));
      placeNetwork(-3.15, 3.2, 2.55);
      turb.position.set(4.82, 0.12, 0); turb.scale.setScalar(1.16);
    }
    turb.rotation.y = YAW;
    turb.updateMatrixWorld(true);
    stage.updateMatrixWorld(true);
    rebuildLinks();
    buildPaths();
    placeBackground();
    ribMat.uniforms.uRes.value.set(W * pixelRatio / 2, H * pixelRatio / 2);
    ribMat.uniforms.uPx.value = (isSmall ? 7.0 : 8.2) * pixelRatio / 2;
    const uScale = (H * pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    nodePts.material.uniforms.uScale.value = uScale;
    pulsePts.material.uniforms.uScale.value = uScale;
    bgPts.material.uniforms.uScale.value = uScale;
  }
  layout();
  window.addEventListener('resize', () => { layout(); if (!running) drawStatic(); });

  if (!isSmall && !reduceMotion) {
    window.addEventListener('pointermove', e => {
      mouse.armed = true; mouse.tx = (e.clientX / window.innerWidth - .5) * 2; mouse.ty = (e.clientY / window.innerHeight - .5) * 2;
    }, { passive: true });
  }

  const motionK = reduceMotion ? 0.28 : 1;
  function render() { (useBloom && composer) ? composer.render() : renderer.render(scene, camera); }
  function drawStatic() {
    camera.position.set(lookX, 0.15, camZ); camera.lookAt(lookX, -0.05, 0);
    rotor.rotation.x = rotorAng; updateNodes(2); updatePulses(0.016); writeColors(); render();
  }

  const stats = { rawSum: 0, rawN: 0, avgRawFrameMs: 0, frames: 0, sum: 0, jsSum: 0, win: 0, winSum: 0, level: 0, avgFrameMs: 0, avgJsMs: 0, streamMode, n: N, k: K, forceGust: 0, gust: 0 };
  window.__hero = stats;
  function degrade() {
    stats.level++;
    if (stats.level === 1) {
      pixelRatio = Math.min(pixelRatio, 1); nAct = Math.floor(N * 0.65); ribGeo.instanceCount = Math.max(1, nAct * K - 1); layout();
      if (bloom) bloom.resolution.set(W / 2, H / 2);
    } else if (stats.level === 2) {
      useBloom = false; nAct = Math.floor(N * 0.4); ribGeo.instanceCount = Math.max(1, nAct * K - 1);
      for (let i = nAct * K * 3; i < col.length; i++) col[i] = 0;
    }
    stats.nAct = nAct;
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
      camera.position.set(lookX, 0.15, camZ); camera.lookAt(lookX, -0.05, 0); stage.rotation.y = 0;
    } else {
      mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
      camera.position.set(lookX + Math.sin(t * 0.055) * 0.48 + mouse.x * 0.4, 0.12 + Math.sin(t * 0.042) * 0.24 - mouse.y * 0.24, camZ + Math.sin(t * 0.033) * 0.26);
      camera.lookAt(lookX + mouse.x * 0.16, -0.05 - mouse.y * 0.1, 0);
      stage.rotation.y = Math.sin(t * 0.045) * 0.025 + mouse.x * 0.016;
    }
    updateGust(dt, t);
    stepParticles(dt); rotor.rotation.x = rotorAng;
    if (rotor && rotor.children) {
      const shimmer = 0.016 * nacellePulse * Math.sin(t * 6);
      for (let b = 0; b < rotor.children.length; b++) {
        const ch = rotor.children[b];
        if (ch.children && ch.children.length) ch.rotation.z = shimmer * ((b % 2) ? 1 : -0.7);
      }
    }
    writeColors(); updateNodes(t); updatePulses(dt);
    const t1 = performance.now();
    render();
    stats.jsSum += (t1 - t0);
    if (stats.frames++ > 0) {
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

  if (PATHS.length === 0) { buildPaths(); }
  for (let i = 0; i < N; i++) spawn(i, true);
  const warm = reduceMotion ? 40 : 18;
  for (let s = 0; s < warm; s++) stepParticles(1 / 40);
  writeColors();
  stats.setupMs = Math.round(performance.now() - tInit);
  try { if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera); } catch (e) { /* compile lazily */ }
  const reveal = () => { canvas.classList.add('is-ready'); stats.firstFrameMs = Math.round(performance.now()); stats.initMs = Math.round(performance.now() - tInit); };
  start(); requestAnimationFrame(() => requestAnimationFrame(reveal));
  let inView = true;
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; (inView && !document.hidden) ? start() : stop(); }, { threshold: 0 }).observe(canvas);
  document.addEventListener('visibilitychange', () => { (!document.hidden && inView) ? start() : stop(); });
  canvas.dataset.ready = 'true';
}
