/* ============================================================
   scene.js — Morphing particle field (Three.js)

   A single GPU particle system (~7k points) that flies between
   formations per slide:
     0  orb        — a glowing particle sphere (the "AI" core)
     1  time-ring  — particles settle into a slow orbital ring
     2  clusters   — they split into four week constellations
     3  burst      — gather into a chest, then erupt like treasure

   Restrained palette: mostly cool white/violet with sparse
   accent pops. Morphs are eased + arc-displaced so particles
   visibly "come and go" between shapes (Framer-style).
   ============================================================ */

import * as THREE from "three";

const C = {
  violet: new THREE.Color("#6b5bff"),
  iris:   new THREE.Color("#8b7bff"),
  blue:   new THREE.Color("#2b88ff"),
  teal:   new THREE.Color("#18c8b6"),
  pink:   new THREE.Color("#e3008c"),
  gold:   new THREE.Color("#ffcf45"),
  white:  new THREE.Color("#dfe4ff"),
};
const ACCENTS = [C.violet, C.blue, C.teal, C.pink];
const lerp = (a, b, t) => a + (b - a) * t;
const GA = Math.PI * (3 - Math.sqrt(5)); // golden angle

export class Cosmos {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerTarget = new THREE.Vector2(0, 0);
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.N = this.reduced ? 5000 : 13000;

    this._initRenderer();
    this._initScene();
    this._buildStars();
    this._buildNebula();
    this._buildParticles();

    this._bindEvents();
    this.resize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, alpha: true, powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 160);
    this.camera.position.set(0, 0, 13);
    this.camBase = { x: 0, y: 0, z: 13 };
  }

  /* ---------------- faint background starfield ---------------- */
  _buildStars() {
    const N = this.reduced ? 700 : 1500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 40 + Math.random() * 60;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      pos[i * 3 + 2] = r * Math.cos(p) - 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xcdd4ff, size: 0.7, sizeAttenuation: true,
      transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  _glowTexture(color) {
    const s = 256, cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const ctx = cv.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    const c = color.getStyle();
    g.addColorStop(0, c); g.addColorStop(0.3, c); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
  }

  _buildNebula() {
    this.nebula = new THREE.Group();
    [
      { c: C.violet, x: -15, y: 7,  z: -34, s: 40, o: 0.13 },
      { c: C.blue,   x: 16,  y: -6, z: -36, s: 34, o: 0.10 },
    ].forEach((d) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._glowTexture(d.c), blending: THREE.AdditiveBlending,
        depthWrite: false, opacity: d.o, transparent: true }));
      sp.position.set(d.x, d.y, d.z); sp.scale.set(d.s, d.s, 1);
      sp.userData = { baseY: d.y, ph: Math.random() * 6.28 };
      this.nebula.add(sp);
    });
    this.scene.add(this.nebula);
  }

  /* ============================================================
     The morphing particle field
     ============================================================ */
  _buildParticles() {
    const N = this.N;
    this.aFrom = new Float32Array(N * 3);
    this.aTo = new Float32Array(N * 3);
    this.cFrom = new Float32Array(N * 3);
    this.cTo = new Float32Array(N * 3);
    const aRand = new Float32Array(N);
    const aSize = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      aRand[i] = Math.random();
      aSize[i] = 0.42 + Math.random() * 1.05;
    }

    // initial formation = orb
    const t0 = this._formOrb();
    this.aFrom.set(t0.pos); this.aTo.set(t0.pos);
    this.cFrom.set(t0.col); this.cTo.set(t0.col);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.aTo, 3)); // required slot
    geo.setAttribute("aFrom", new THREE.BufferAttribute(this.aFrom, 3));
    geo.setAttribute("aTo", new THREE.BufferAttribute(this.aTo, 3));
    geo.setAttribute("cFrom", new THREE.BufferAttribute(this.cFrom, 3));
    geo.setAttribute("cTo", new THREE.BufferAttribute(this.cTo, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(aRand, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uMix: { value: 1 },
      uPix: { value: this.renderer.getPixelRatio() },
      uArc: { value: 1.3 },
      uSpin: { value: 0.0 },
      uSwirl: { value: 2.4 },   // whirlwind: extra rotation that peaks mid-transition
      uForward: { value: 6.2 }, // depth surge toward the camera, peaks mid-transition
      uFade: { value: 1.0 },    // global field brightness — dipped to mask the layer hand-off
    };

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: this.uniforms,
      vertexShader: `
        uniform float uTime, uMix, uPix, uArc, uSpin, uSwirl, uForward;
        attribute vec3 aFrom; attribute vec3 aTo;
        attribute vec3 cFrom; attribute vec3 cTo;
        attribute float aRand; attribute float aSize;
        varying vec3 vCol;
        void main(){
          float m = clamp(uMix, 0.0, 1.0);
          float e = m*m*(3.0-2.0*m);                 // smoothstep ease
          vec3 pos = mix(aFrom, aTo, e);

          // arc displacement mid-flight -> particles "fly" between shapes
          float arc = sin(e*3.14159265);
          vec3 dir = vec3(sin(aRand*6.2831), cos(aRand*5.137), sin(aRand*9.42));
          pos += dir * arc * uArc * (0.4 + aRand);

          // idle sway around Y + gentle bob (alive at rest),
          // plus a whirlwind: arc-enveloped spin that peaks mid-transition
          // and is zero at rest. Higher particles swirl a touch more (vortex).
          float a = sin(uTime*0.12)*0.35 + uSpin*uTime + arc*uSwirl*(1.0 + 0.15*pos.y);
          float s = sin(a), c = cos(a);
          pos = vec3(pos.x*c - pos.z*s, pos.y, pos.x*s + pos.z*c);
          pos.y += sin(uTime*0.7 + aRand*6.2831)*0.07 + arc*0.6*sin(aRand*30.0); // lift + scatter mid-swirl
          pos.x += cos(uTime*0.5 + aRand*6.2831)*0.05;
          // surge toward the camera mid-transition so the dance comes forward
          // and obscures the slide, then recedes back (arc = 0 at rest)
          pos.z += arc * uForward;

          vec4 mv = modelViewMatrix * vec4(pos,1.0);
          gl_PointSize = aSize * (165.0 / -mv.z) * uPix * (0.7 + 0.3*sin(uTime*2.0 + aRand*30.0));
          gl_Position = projectionMatrix * mv;
          vCol = mix(cFrom, cTo, e);
        }`,
      fragmentShader: `
        varying vec3 vCol;
        uniform float uFade;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          // brighter, radiant core
          vec3 col = vCol * (1.15 + 0.5 * (1.0 - d * 2.0));
          gl_FragColor = vec4(col, a*0.85*uFade);
        }`,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  /* ---------------- formation generators ---------------- */
  _alloc() { return { pos: new Float32Array(this.N * 3), col: new Float32Array(this.N * 3) }; }
  _setCol(col, i, c, jitter = 0.0) {
    col[i * 3] = c.r * (1 - jitter + Math.random() * jitter * 2);
    col[i * 3 + 1] = c.g * (1 - jitter + Math.random() * jitter * 2);
    col[i * 3 + 2] = c.b * (1 - jitter + Math.random() * jitter * 2);
  }

  _formOrb() {
    const { pos, col } = this._alloc(), N = this.N, R = 3.0;
    const tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * GA;
      const rad = R + (Math.random() - 0.5) * 0.5;
      const px = Math.cos(phi) * rr * rad;
      const py = y * rad;
      const pz = Math.sin(phi) * rr * rad;
      pos[i * 3] = px; pos[i * 3 + 1] = py + 0.3; pos[i * 3 + 2] = pz;
      // cool gradient by height; sparse pink
      const tcol = Math.random() < 0.05 ? C.pink : tmp.copy(C.violet).lerp(C.blue, (y + 1) / 2);
      this._setCol(col, i, tcol, 0.08);
    }
    return { pos, col };
  }

  _formRing() {
    const { pos, col } = this._alloc(), N = this.N, R = 3.2, r = 0.42;
    const tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI * 2;
      const x = (R + r * Math.cos(v)) * Math.cos(u);
      const z = (R + r * Math.cos(v)) * Math.sin(u);
      const y = r * Math.sin(v);
      // tilt the ring slightly for an "orbit" read; offset right
      pos[i * 3] = x + 3.4;
      pos[i * 3 + 1] = y + x * 0.18 + 0.3;
      pos[i * 3 + 2] = z;
      const tcol = Math.random() < 0.06 ? C.teal : tmp.copy(C.iris).lerp(C.blue, Math.random());
      this._setCol(col, i, tcol, 0.06);
    }
    return { pos, col };
  }

  _formClusters(n = 4, y = -3.4) {
    const { pos, col } = this._alloc(), N = this.N;
    const palette = [C.blue, C.violet, C.teal, C.gold, C.iris, C.pink];
    const spacing = n <= 3 ? 3.7 : 3.0;
    for (let i = 0; i < N; i++) {
      const g = i % n;
      const cx = (g - (n - 1) / 2) * spacing;
      const rx = (Math.random() - 0.5) * 1.7;
      const ry = (Math.random() - 0.5) * 1.7;
      const rz = (Math.random() - 0.5) * 1.0;
      pos[i * 3] = cx + rx;
      pos[i * 3 + 1] = y + ry;
      pos[i * 3 + 2] = rz;
      this._setCol(col, i, palette[g], 0.12);
    }
    return { pos, col };
  }

  // bright, dense little sphere — the "core". offsetX shifts it aside.
  _formCore(offsetX = 3.3) {
    const { pos, col } = this._alloc(), N = this.N, R = 2.0;
    const tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = Math.random() * Math.PI * 2;
      const ct = 2 * Math.random() - 1;
      const st = Math.sqrt(Math.max(0, 1 - ct * ct));
      const rad = R * (0.45 + 0.55 * Math.random());        // fill the volume a bit
      const px = Math.cos(u) * st * rad;
      const py = ct * rad;
      const pz = Math.sin(u) * st * rad;
      pos[i * 3] = px + offsetX;
      pos[i * 3 + 1] = py + 0.2;
      pos[i * 3 + 2] = pz;
      const near = rad < R * 0.7;
      const tcol = near ? C.white : tmp.copy(C.violet).lerp(C.blue, Math.random());
      this._setCol(col, i, tcol, 0.08);
    }
    return { pos, col };
  }

  // two distinct clouds — the "two sides / trust boundary" duality
  _formSplit() {
    const { pos, col } = this._alloc(), N = this.N;
    for (let i = 0; i < N; i++) {
      const side = i % 2;
      const cx = side ? 3.1 : -3.1;
      const rx = (Math.random() - 0.5) * 2.2;
      const ry = (Math.random() - 0.5) * 3.0;
      const rz = (Math.random() - 0.5) * 1.2;
      pos[i * 3] = cx + rx;
      pos[i * 3 + 1] = ry + 0.2;
      pos[i * 3 + 2] = rz;
      this._setCol(col, i, side ? C.violet : C.blue, 0.1);
    }
    return { pos, col };
  }

  // a lattice plane — the "scan across the content estate"
  _formGrid() {
    const { pos, col } = this._alloc(), N = this.N;
    const cols = Math.round(Math.sqrt(N * 1.7));
    const rows = Math.ceil(N / cols);
    const W = 12, H = 6.5;
    const tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const c = i % cols, r = (i / cols) | 0;
      const x = (c / (cols - 1) - 0.5) * W;
      const y = (r / (rows - 1) - 0.5) * H + 0.3;
      const z = Math.sin(c * 0.6) * 0.35 + (Math.random() - 0.5) * 0.25;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      const tcol = Math.random() < 0.08 ? C.gold : tmp.copy(C.teal).lerp(C.blue, c / cols);
      this._setCol(col, i, tcol, 0.06);
    }
    return { pos, col };
  }

  // a horizontal flowing band — the "Build › Validate › Publish › Field" pipeline
  _formStream() {
    const { pos, col } = this._alloc(), N = this.N;
    const tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = Math.random();
      const x = (u - 0.5) * 13.5;
      const wave = Math.sin(u * Math.PI * 2.4) * 0.7;
      pos[i * 3] = x;
      pos[i * 3 + 1] = wave - 0.4 + (Math.random() - 0.5) * 0.9;
      pos[i * 3 + 2] = Math.cos(u * Math.PI * 2.0) * 0.6 + (Math.random() - 0.5) * 0.5;
      const tcol = Math.random() < 0.07 ? C.gold : tmp.copy(C.blue).lerp(C.teal, u);
      this._setCol(col, i, tcol, 0.07);
    }
    return { pos, col };
  }

  _formBurst() {
    const { pos, col } = this._alloc(), N = this.N;
    for (let i = 0; i < N; i++) {
      // exploding shell — the celebratory finale
      const dirx = (Math.random() - 0.5) * 2;
      const diry = Math.random();             // bias up
      const dirz = (Math.random() - 0.5) * 2;
      const len = Math.sqrt(dirx * dirx + diry * diry + dirz * dirz) || 1;
      const rad = 1.5 + Math.random() * 5.0;
      pos[i * 3] = (dirx / len) * rad;
      pos[i * 3 + 1] = (diry / len) * rad - 1.0;
      pos[i * 3 + 2] = (dirz / len) * rad;
      const r = Math.random();
      const tcol = r < 0.18 ? ACCENTS[(r * 100 | 0) % ACCENTS.length] : (r < 0.6 ? C.gold : C.white);
      this._setCol(col, i, tcol, 0.1);
    }
    return { pos, col };
  }

  /* ---------------- morph driver ---------------- */
  _morphTo(form, opts = {}) {
    const gsap = this.gsap;
    // bake currently-displayed mix into aFrom so fast skips don't pop
    const e = (() => { const m = Math.min(Math.max(this.uniforms.uMix.value, 0), 1); return m * m * (3 - 2 * m); })();
    for (let i = 0; i < this.aFrom.length; i++) {
      this.aFrom[i] = lerp(this.aFrom[i], this.aTo[i], e);
      this.cFrom[i] = lerp(this.cFrom[i], this.cTo[i], e);
    }
    this.aTo.set(form.pos);
    this.cTo.set(form.col);
    const geo = this.points.geometry;
    geo.attributes.aFrom.needsUpdate = true;
    geo.attributes.aTo.needsUpdate = true;
    geo.attributes.cFrom.needsUpdate = true;
    geo.attributes.cTo.needsUpdate = true;

    this.uniforms.uMix.value = 0;
    gsap.killTweensOf(this.uniforms.uMix);
    gsap.killTweensOf(this.uniforms.uArc);
    this.uniforms.uArc.value = opts.arc ?? 1.4;
    gsap.to(this.uniforms.uMix, { value: 1, duration: opts.dur ?? 1.7, ease: opts.ease ?? "power3.inOut" });
    gsap.to(this.uniforms.uSpin, { value: opts.spin ?? 0.0, duration: 1.5, ease: "power2.out" });
  }

  /* ============================================================
     Formation registry — the platform's public vocabulary.
     Each entry: make(arg) -> {pos,col}, a default camera [x,y,z],
     and default morph opts. Slides select one via HTML:
        <section class="slide" data-formation="clusters:3">
     ============================================================ */
  get _registry() {
    return {
      orb:          { make: () => this._formOrb(),               cam: [0, 0.5, 13.0],  opts: { spin: 0.05, arc: 1.5 } },
      core:         { make: () => this._formCore(3.3),           cam: [-0.6, 0.1, 12.8], opts: { spin: 0.0, arc: 1.3 } },
      "core-center":{ make: () => this._formCore(0),             cam: [0, 0.2, 12.8],  opts: { spin: 0.0, arc: 1.3 } },
      clusters:     { make: (n) => this._formClusters(Math.max(2, parseInt(n) || 3), -3.6),
                                                                 cam: [0, 0.3, 14.2],  opts: { spin: 0.0, arc: 1.8, dur: 1.9 } },
      split:        { make: () => this._formSplit(),             cam: [0, 0.2, 13.6],  opts: { spin: 0.0, arc: 1.6, dur: 1.8 } },
      ring:         { make: () => this._formRing(),              cam: [-0.5, 0.1, 12.8], opts: { spin: 0.10, arc: 1.2 } },
      grid:         { make: () => this._formGrid(),              cam: [0, 0.2, 13.8],  opts: { spin: 0.0, arc: 1.4, dur: 1.9 } },
      stream:       { make: () => this._formStream(),            cam: [0, 0.1, 13.4],  opts: { spin: 0.0, arc: 1.3, dur: 1.8 } },
      burst:        { make: () => this._formBurst(),             cam: [0, 0.0, 13.0],  opts: { spin: 0.06, arc: 2.6, dur: 1.7, ease: "power2.out" } },
    };
  }

  /**
   * Public, data-driven entry point. Called once per slide.
   * @param {string} spec   formation name, optionally "name:arg" (e.g. "clusters:4")
   * @param {object} gsap   the GSAP instance
   * @param {object} over   optional overrides: { cam:[x,y,z], spin, arc, dur, ease }
   */
  applyFormation(spec, gsap, over = {}) {
    this.gsap = gsap;
    const [nameRaw, arg] = String(spec || "orb").trim().split(":");
    const def = this._registry[nameRaw] || this._registry.orb;
    this._morphTo(def.make(arg), { ...def.opts, ...over });
    const cam = over.cam || def.cam;
    this._camTo(cam[0], cam[1], cam[2]);
  }

  /** List available formation names (handy for tooling/docs). */
  get formationNames() { return Object.keys(this._registry); }

  _camTo(x, y, z) {
    this.camBase = { x, y, z };
    this.gsap.to(this.camera.position, { x, y, z, duration: 1.4, ease: "power3.inOut" });
  }

  /* ---------------- events / loop ---------------- */
  _bindEvents() {
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("pointermove", (e) => {
      this.pointerTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointerTarget.y = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.uniforms) this.uniforms.uPix.value = this.renderer.getPixelRatio();
  }

  start() {
    const tick = () => { this._frame(); this.renderer.render(this.scene, this.camera); this._raf = requestAnimationFrame(tick); };
    tick();
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed = (this.elapsed || 0) + dt;
    const t = this.elapsed;

    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.05;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.05;
    this.camera.position.x = this.camBase.x + this.pointer.x * 0.8 + Math.sin(t * 0.1) * 0.2;
    this.camera.position.y = this.camBase.y - this.pointer.y * 0.6 + Math.cos(t * 0.12) * 0.15;
    this.camera.lookAt(0, this.camBase.y * 0.2, 0);

    if (this.uniforms) this.uniforms.uTime.value = t;
    if (this.stars) this.stars.rotation.y = t * 0.008;
    if (this.nebula) {
      this.nebula.children.forEach((s) => { s.position.y = s.userData.baseY + Math.sin(t * 0.25 + s.userData.ph) * 0.4; });
    }
  }
}
