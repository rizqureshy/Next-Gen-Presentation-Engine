/* ============================================================
   aurora.js — "Aurora Silk" theme (Three.js)

   A full-screen domain-warped fbm shader: silk-gradient curtains
   that drift and breathe, plus a slow-rising dust layer for
   depth. Each scene is a mood — a palette + motion preset — and
   transitions tween the palette while a "surge" envelope briefly
   intensifies the warp and brightness mid-morph (zero at rest),
   mirroring the Cosmos whirlwind choreography.

   Scenes: dawn · drift · veil · dusk · nova
   ============================================================ */

import * as THREE from "three";
import { ThemeBase } from "../../engine/theme.js";

/* mood presets — palette, motion, and focal light per scene */
const SCENES = {
  dawn:  { a: "#6b5bff", b: "#ff4db8", c: "#ffb86b", bg: "#070312", warp: 1.5,  speed: 0.16, bright: 1.05, focus: [0.0, -0.12], curtain: 0.0 },
  drift: { a: "#2b88ff", b: "#18c8b6", c: "#8b7bff", bg: "#04060f", warp: 1.15, speed: 0.11, bright: 0.95, focus: [0.3, 0.05],  curtain: 0.0 },
  veil:  { a: "#8b7bff", b: "#6b5bff", c: "#e3e8ff", bg: "#060310", warp: 1.9,  speed: 0.07, bright: 0.9,  focus: [0.0, 0.05],  curtain: 0.85 },
  dusk:  { a: "#4a3fd0", b: "#9b4dff", c: "#2b88ff", bg: "#040208", warp: 0.95, speed: 0.06, bright: 0.75, focus: [-0.3, -0.1], curtain: 0.0 },
  nova:  { a: "#ff4db8", b: "#ffcf45", c: "#8b7bff", bg: "#0a0414", warp: 2.4,  speed: 0.22, bright: 1.2,  focus: [0.0, 0.0],   curtain: 0.0 },
};

export default class Aurora extends ThemeBase {
  static id = "aurora";
  static label = "Aurora Silk";
  static transition = { swapAt: 560, lock: 1350 };
  static vocabulary = Object.keys(SCENES);
  static defaultScene = "drift";

  static sceneFor(h) {
    if (h.role === "cover") return "dawn";
    if (h.role === "closing") return "nova";
    if (h.moves || h.compare) return "veil";
    if (h.flow) return "dusk";
    return "drift";
  }

  constructor(canvas, ctx = {}) {
    super(canvas, ctx);
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerTarget = new THREE.Vector2(0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    this._buildSky();
    this._buildDust();
    this._bindEvents();
    this.resize();
  }

  /* ---------------- the silk shader ---------------- */
  _buildSky() {
    const s0 = SCENES.dusk; // boot from the quietest mood; first applyScene fades in
    this.uniforms = {
      uTime:    { value: 0 },
      uRes:     { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uColA:    { value: new THREE.Color(s0.a) },
      uColB:    { value: new THREE.Color(s0.b) },
      uColC:    { value: new THREE.Color(s0.c) },
      uBg:      { value: new THREE.Color(s0.bg) },
      uWarp:    { value: s0.warp },
      uSpeed:   { value: s0.speed },
      uBright:  { value: 0.0 },   // faded up by the first applyScene
      uCurtain: { value: 0.0 },
      uFocus:   { value: new THREE.Vector2(0, 0) },
      uSurge:   { value: 0.0 },   // transition envelope, zero at rest
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthWrite: false,
      depthTest: false,
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime, uWarp, uSpeed, uSurge, uBright, uCurtain;
        uniform vec2 uRes, uPointer, uFocus;
        uniform vec3 uColA, uColB, uColC, uBg;

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
          for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
          return v;
        }

        void main(){
          vec2 q = vUv - 0.5;
          q.x *= uRes.x / uRes.y;
          q += uPointer * 0.045;                    // mouse parallax
          float t = uTime * uSpeed;

          // double domain warp — the silk
          vec2 w1 = vec2(fbm(q * 1.3 + vec2(0.0, t)),
                         fbm(q * 1.3 + vec2(5.2, -t * 0.8)));
          vec2 w2 = vec2(fbm(q * 2.1 + 3.0 * w1 + vec2(1.7, 9.2) + t * 0.6),
                         fbm(q * 2.1 + 3.0 * w1 + vec2(8.3, 2.8) - t * 0.4));
          float warp = uWarp * (1.0 + uSurge * 1.6);
          vec2 p = q + warp * 0.35 * (w2 - 0.5);

          float silk = fbm(vec2(p.x * 1.6, p.y * 2.6) + w2 * 1.2);

          vec3 col = uBg;
          col = mix(col, uColA, smoothstep(0.18, 0.72, silk));
          col = mix(col, uColB, 0.75 * smoothstep(0.45, 0.95, fbm(p * 2.2 - w1 + t * 0.5)));
          col += uColC * 0.55 * pow(smoothstep(0.55, 1.0, fbm(p * 3.0 + w2 - t * 0.4)), 2.0);

          // focal light — a soft bloom the content sits against
          float d = length(q - uFocus);
          col += (uColC * 0.5 + 0.14) * exp(-d * d * 3.2) * (0.5 + uSurge * 0.8);

          // optional vertical curtain concentration (veil mood)
          col *= mix(1.0, 0.35 + 0.65 * exp(-q.x * q.x * 3.5), uCurtain);

          col *= uBright * (1.0 + uSurge * 0.4);

          // vignette + grain
          col *= mix(0.72, 1.0, smoothstep(1.3, 0.35, length(q)));
          col += (hash(vUv * uRes + fract(uTime) * vec2(17.0, 31.0)) - 0.5) * 0.035;

          gl_FragColor = vec4(col, 1.0);
        }`,
    });

    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  /* ---------------- slow-rising dust for depth ---------------- */
  _buildDust() {
    const N = this.reduced ? 60 : 170;
    const pos = new Float32Array(N * 3);
    this.dustSpeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 1.05;
      pos[i * 3 + 1] = Math.random() * 2 - 1;
      pos[i * 3 + 2] = 0;
      this.dustSpeed[i] = 0.008 + Math.random() * 0.03;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xcdd4ff, size: 2.4, sizeAttenuation: false,
      transparent: true, opacity: 0.35, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.dust = new THREE.Points(geo, mat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  /* ---------------- theme contract ---------------- */
  _applyScene(name, arg, over = {}) {
    const s = SCENES[name] || SCENES[Aurora.defaultScene];
    const g = this.gsap, u = this.uniforms;
    const dur = this.reduced ? 0.6 : (over.dur ?? 2.0);
    const ease = "power2.inOut";

    for (const [uni, hex] of [[u.uColA, s.a], [u.uColB, s.b], [u.uColC, s.c], [u.uBg, s.bg]]) {
      const c = new THREE.Color(hex);
      g.to(uni.value, { r: c.r, g: c.g, b: c.b, duration: dur, ease });
    }
    g.to(u.uWarp,    { value: s.warp,    duration: dur, ease });
    g.to(u.uSpeed,   { value: s.speed,   duration: dur, ease });
    g.to(u.uBright,  { value: s.bright,  duration: dur, ease });
    g.to(u.uCurtain, { value: s.curtain, duration: dur, ease });
    g.to(u.uFocus.value, { x: s.focus[0], y: s.focus[1], duration: dur, ease });

    // surge — peaks mid-transition, always returns to zero
    if (!this.reduced) {
      g.killTweensOf(u.uSurge);
      u.uSurge.value = 0;
      g.to(u.uSurge, { value: 1, duration: dur * 0.32, ease: "power2.in" });
      g.to(u.uSurge, { value: 0, duration: dur * 0.68, ease: "power2.out", delay: dur * 0.32 });
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
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.dust.geometry.dispose();
    this.dust.material.dispose();
    this.renderer.dispose();
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.05;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.05;
    this.uniforms.uTime.value = this.elapsed;
    this.uniforms.uPointer.value.set(this.pointer.x, -this.pointer.y);

    if (!this.reduced) {
      const pos = this.dust.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * this.dustSpeed[i] * (1 + this.uniforms.uSurge.value * 6);
        if (y > 1.05) y = -1.05;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      this.dust.position.x = this.pointer.x * 0.045;
      this.dust.position.y = -this.pointer.y * 0.035;
    }
  }
}
