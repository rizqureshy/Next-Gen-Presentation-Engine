/* ============================================================
   ink.js — "Liquid Ink" theme (Three.js)

   Luminous ink drops blooming in dark water. A full-screen
   shader holds a pool of 12 drop slots; each drop is a
   noise-warped blot with feathered tendrils, a darker-bright
   rim, and granulation, that grows with an ease-out "bleed"
   from its birth time and then settles. Scenes are drop
   arrangements + palettes; transitions dissolve the old drops
   (color fades to the water) while the new ones bloom in,
   staggered like real ink.

   Scenes: drop · bloom:N · wash · collide · torrent · eruption
   ============================================================ */

import * as THREE from "three";
import { ThemeBase } from "../../engine/theme.js";

const SLOTS = 12;
const INK = {
  violet: "#7c5cff", blue: "#2b88ff", teal: "#18c8b6",
  pink: "#ff2ea6", gold: "#ffcf45", ice: "#e8ecff",
  indigo: "#4a3fd0", deepblue: "#1b4fd8",
};

/* scene presets: drop arrangements ({p:[x,y], s:scale, c:color, d:delay}) */
function scenePresets(name, arg) {
  const n = Math.max(2, Math.min(parseInt(arg) || 3, 6));
  const cyc = [INK.blue, INK.violet, INK.teal, INK.gold, INK.pink, INK.ice];
  switch (name) {
    case "drop":
      return [
        { p: [0, -0.05], s: 0.42, c: INK.violet, d: 0 },
        { p: [0.3, 0.18], s: 0.2, c: INK.blue, d: 0.35 },
        { p: [-0.34, -0.2], s: 0.15, c: INK.pink, d: 0.6 },
      ];
    case "bloom":
      return Array.from({ length: n }, (_, i) => ({
        p: [(i - (n - 1) / 2) * (1.3 / Math.max(n - 1, 1)), -0.24], s: 0.6 / n + 0.06,
        c: cyc[i % cyc.length], d: i * 0.14,
      }));
    case "wash":
      return [
        { p: [-0.62, 0.14], s: 0.38, c: INK.indigo, d: 0 },
        { p: [0.66, -0.18], s: 0.35, c: INK.deepblue, d: 0.25 },
        { p: [0.2, 0.34], s: 0.2, c: INK.violet, d: 0.5 },
      ];
    case "collide":
      return [
        { p: [-0.55, 0.02], s: 0.34, c: INK.blue, d: 0 },
        { p: [0.55, -0.02], s: 0.34, c: INK.pink, d: 0.18 },
        { p: [0, -0.3], s: 0.14, c: INK.ice, d: 0.8 },
      ];
    case "torrent":
      return Array.from({ length: 6 }, (_, i) => ({
        p: [-0.78 + i * 0.31, Math.sin(i * 1.7) * 0.1 - 0.16], s: 0.14 + (i % 2) * 0.05,
        c: i % 3 === 2 ? INK.teal : INK.blue, d: i * 0.12,
      }));
    case "eruption": {
      const arr = [{ p: [0, -0.06], s: 0.3, c: INK.gold, d: 0 }];
      const cols = [INK.pink, INK.violet, INK.teal, INK.gold, INK.ice, INK.blue, INK.pink, INK.violet];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.35;
        arr.push({ p: [Math.cos(a) * 0.52, Math.sin(a) * 0.32 - 0.04], s: 0.19, c: cols[i], d: 0.15 + i * 0.07 });
      }
      return arr;
    }
    default:
      return scenePresets("wash");
  }
}

export default class Ink extends ThemeBase {
  static id = "ink";
  static label = "Liquid Ink";
  static transition = { swapAt: 600, lock: 1450 };
  static vocabulary = ["drop", "bloom", "wash", "collide", "torrent", "eruption"];
  static defaultScene = "wash";

  static sceneFor(h) {
    if (h.role === "cover") return "drop";
    if (h.role === "closing") return "eruption";
    if (h.cards >= 2) return `bloom:${Math.min(h.cards, 6)}`;
    if (h.compare) return "collide";
    if (h.flow) return "torrent";
    return "wash";
  }

  constructor(canvas, ctx = {}) {
    super(canvas, ctx);
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerTarget = new THREE.Vector2(0, 0);
    this.cursor = 0;                    // round-robin slot allocator

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    this._buildWater();
    this._bindEvents();
    this.resize();
  }

  _buildWater() {
    this.uniforms = {
      uTime:    { value: 0 },
      uRes:     { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uSurge:   { value: 0 },
      uBg:      { value: new THREE.Color("#030309") },
      // xy = position, z = birth time, w = scale (0 = dead slot)
      uDrops:    { value: Array.from({ length: SLOTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uDropCols: { value: Array.from({ length: SLOTS }, () => new THREE.Color(0, 0, 0)) },
      uDropSeed: { value: Array.from({ length: SLOTS }, () => Math.random() * 100) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthWrite: false, depthTest: false,
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime, uSurge;
        uniform vec2 uRes, uPointer;
        uniform vec3 uBg;
        uniform vec4 uDrops[${SLOTS}];
        uniform vec3 uDropCols[${SLOTS}];
        uniform float uDropSeed[${SLOTS}];

        float hash(vec2 p){
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p){
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
          return v;
        }

        void main(){
          vec2 q = vUv - 0.5;
          q.x *= uRes.x / uRes.y;
          q += uPointer * 0.035;

          // shared warp fields — every drop borrows these (cheap tendrils)
          float F1 = fbm(q * 1.9 + vec2(0.0, uTime * 0.05));
          float F2 = fbm(q * 3.2 - vec2(uTime * 0.04, 0.0));
          float F3 = fbm(q * 5.6 + vec2(uTime * 0.06, -uTime * 0.03));  // fine feathering
          float grain = noise(q * 13.0);

          vec3 col = uBg + vec3(0.010, 0.012, 0.030) * F1 * 1.3;  // faint water haze

          for (int i = 0; i < ${SLOTS}; i++) {
            float sc = uDrops[i].w;
            if (sc <= 0.001) continue;
            float age = uTime - uDrops[i].z;
            if (age <= 0.0) continue;                    // staggered births
            float r = sc * (1.0 - exp(-age * 1.15));     // ease-out bleed
            vec2 d = q - uDrops[i].xy;
            float seed = uDropSeed[i];

            // irregular boundary: all noise-driven, nothing periodic.
            // "fingers" sample noise by direction (seamless around the
            // drop) so the bleed grows uneven tendrils like real ink.
            float wob = mix(F1, F2, fract(seed * 0.731)) - 0.5;
            float fine = F3 - 0.5;
            vec2 dir = d / max(length(d), 1e-4);
            float fingers = noise(dir * (2.6 + mod(seed, 2.0)) + seed * 3.7 + wob) - 0.5;
            float fingers2 = noise(dir * 6.3 + seed * 5.1 - wob) - 0.5;
            float dist = length(d) * (1.0 + wob * 0.4 + fingers * 0.7 + fingers2 * 0.25)
                       + fine * 0.22 * r;

            float edge = dist / max(r, 1e-4);
            float body = 1.0 - smoothstep(0.35, 0.95, edge);
            float halo = (1.0 - smoothstep(0.85, 1.45, edge)) * 0.22;   // outer bleed
            float rim = smoothstep(0.62, 0.9, edge) * (1.0 - smoothstep(0.9, 1.08, edge));
            float granul = 0.7 + 0.3 * smoothstep(0.2, 0.8, grain + wob * 0.5);
            float settle = 0.5 + 0.5 * exp(-age * 0.22);  // bright birth → calm

            float a = (body * 0.75 + rim * 0.85 + halo) * granul * settle;
            col += uDropCols[i] * a * (1.0 + uSurge * 0.5);
          }

          col = col / (1.0 + col * 0.35);                // soft highlight compression
          col *= mix(0.78, 1.0, smoothstep(1.3, 0.4, length(q)));
          col += (hash(vUv * uRes) - 0.5) * 0.03;

          gl_FragColor = vec4(col, 1.0);
        }`,
    });

    this.water = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.water.frustumCulled = false;
    this.scene.add(this.water);
  }

  /* ---------------- theme contract ---------------- */
  _applyScene(name, arg, over = {}) {
    const drops = scenePresets(name, arg);
    const g = this.gsap;
    const u = this.uniforms;
    const dissolve = this.reduced ? 0.4 : 1.5;

    // dissolve every live drop: color sinks into the water, then the slot dies
    for (let i = 0; i < SLOTS; i++) {
      const v = u.uDrops.value[i], c = u.uDropCols.value[i];
      if (v.w > 0.001) {
        g.killTweensOf(c);
        g.to(c, {
          r: c.r * 0.02, g: c.g * 0.02, b: c.b * 0.02,
          duration: dissolve, ease: "power2.in",
          onComplete: () => { v.w = 0; },
        });
      }
    }

    // bloom the new arrangement into fresh slots (round-robin)
    for (const d of drops) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % SLOTS;
      const v = u.uDrops.value[i], c = u.uDropCols.value[i];
      g.killTweensOf(c);
      v.set(d.p[0], d.p[1], this.elapsed + (this.reduced ? 0 : d.d), d.s);
      u.uDropSeed.value[i] = Math.random() * 100;
      const target = new THREE.Color(d.c);
      c.setRGB(0, 0, 0);
      g.to(c, {
        r: target.r, g: target.g, b: target.b,
        duration: this.reduced ? 0.4 : 0.9,
        ease: "power2.out",
        delay: this.reduced ? 0 : d.d,
      });
    }

    if (!this.reduced) {
      g.killTweensOf(u.uSurge);
      u.uSurge.value = 0;
      g.to(u.uSurge, { value: 1, duration: 0.45, ease: "power2.in" });
      g.to(u.uSurge, { value: 0, duration: 1.0, ease: "power2.out", delay: 0.45 });
    }
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
    this.uniforms.uRes.value.set(w, h);
  }

  start() {
    const tick = () => { this._frame(); this.renderer.render(this.scene, this.camera); this._raf = requestAnimationFrame(tick); };
    tick();
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this.water.geometry.dispose();
    this.water.material.dispose();
    this.renderer.dispose();
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt * (this.reduced ? 0.4 : 1);
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.05;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.05;
    this.uniforms.uTime.value = this.elapsed;
    this.uniforms.uPointer.value.set(this.pointer.x, -this.pointer.y);
  }
}
