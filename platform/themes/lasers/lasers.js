/* ============================================================
   lasers.js — "Neon Lasers" theme (Three.js)

   A dark stage cut by a pooled fleet of neon beams: each beam is
   two crossed additive planes with a hot white core and a soft
   colored falloff (a classic cheap volumetric laser — no
   post-processing needed), over a fogged grid floor. Scenes
   re-stage the fleet; a flash envelope peaks mid-transition and
   is zero at rest, synced with the engine's slide swap.

   Scenes: gate · pillars:N · sweep · tunnel · weave · strike
   ============================================================ */

import * as THREE from "three";
import { ThemeBase } from "../../engine/theme.js";

const COL = {
  violet: "#7c5cff", blue: "#2b88ff", teal: "#18c8b6",
  pink: "#ff2ea6", gold: "#ffcf45", white: "#e8ecff",
};
const POOL = 28;                       // beam fleet size (max any scene uses)
const CAMS = {
  gate: [0, -0.4, 14], pillars: [0, 0, 15], sweep: [0, 0, 14],
  tunnel: [0, 0.5, 13], weave: [0, 0, 14.5], strike: [0, 0, 13],
};

export default class Lasers extends ThemeBase {
  static id = "lasers";
  static label = "Neon Lasers";
  static transition = { swapAt: 600, lock: 1450 };
  static vocabulary = ["gate", "pillars", "sweep", "tunnel", "weave", "strike"];
  static defaultScene = "sweep";

  static sceneFor(h) {
    if (h.role === "cover") return "gate";
    if (h.role === "closing") return "strike";
    if (h.cards >= 2) return `pillars:${Math.min(h.cards, 6)}`;
    if (h.flow) return "tunnel";
    if (h.compare) return "weave";
    return "sweep";
  }

  constructor(canvas, ctx = {}) {
    super(canvas, ctx);
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerTarget = new THREE.Vector2(0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x030109);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x030109, 16, 60);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 160);
    this.camera.position.set(0, 0, 14);
    this.camBase = { x: 0, y: 0, z: 14 };

    this._buildStage();
    this._buildBeams();
    this._bindEvents();
    this.resize();
  }

  /* ---------------- stage: grid floor + horizon glow ---------------- */
  _buildStage() {
    const grid = new THREE.GridHelper(90, 56, 0x6b5bff, 0x201a4d);
    grid.position.y = -5.6;
    grid.material.transparent = true;
    grid.material.opacity = 0.32;
    this.scene.add(grid);

    const glow = (color) => {
      const s = 256, cv = document.createElement("canvas");
      cv.width = cv.height = s;
      const g2 = cv.getContext("2d").createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g2.addColorStop(0, color); g2.addColorStop(1, "rgba(0,0,0,0)");
      const ctx2 = cv.getContext("2d"); ctx2.fillStyle = g2; ctx2.fillRect(0, 0, s, s);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    this.horizon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow("rgba(124,92,255,0.85)"), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.4,
    }));
    this.horizon.position.set(0, -5.4, -18);
    this.horizon.scale.set(46, 10, 1);
    this.scene.add(this.horizon);

    // center core flare — bright in gate/strike, dim elsewhere
    this.core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow("rgba(232,236,255,0.9)"), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0,
    }));
    this.core.position.set(0, 0, -3);
    this.core.scale.set(10, 10, 1);
    this.scene.add(this.core);
  }

  /* ---------------- the beam fleet ---------------- */
  _buildBeams() {
    this.flash = { value: 0 };          // shared surge uniform (all beams)
    this.beams = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);           // pivot at the beam base

    for (let i = 0; i < POOL; i++) {
      const uniforms = {
        uColor: { value: new THREE.Color(COL.violet) },
        uIntensity: { value: 0 },
        uFlash: this.flash,
      };
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide, uniforms,
        vertexShader: `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          varying vec2 vUv;
          uniform vec3 uColor;
          uniform float uIntensity, uFlash;
          void main(){
            float d = abs(vUv.x - 0.5) * 2.0;
            float core = pow(max(0.0, 1.0 - d), 7.0);
            float glow = pow(max(0.0, 1.0 - d), 2.2) * 0.55;
            float ends = smoothstep(0.0, 0.10, vUv.y) * (1.0 - smoothstep(0.90, 1.0, vUv.y));
            float k = (core + glow) * uIntensity * (1.0 + uFlash * 1.6) * ends;
            vec3 col = mix(uColor, vec3(1.0), core * 0.65);
            gl_FragColor = vec4(col * k, k);
          }`,
      });
      const g = new THREE.Group();
      const p1 = new THREE.Mesh(geo, mat);
      const p2 = new THREE.Mesh(geo, mat);
      p2.rotation.y = Math.PI / 2;      // crossed planes read as a volume
      g.add(p1, p2);
      g.scale.set(0.1, 8, 0.1);
      g.userData = {
        mat,
        base: { rx: 0, ry: 0, rz: 0 },
        anim: { sway: 0, speed: 0, phase: 0 },
      };
      this.beams.push(g);
      this.scene.add(g);
    }
  }

  /* ---------------- scene presets ----------------
     Each returns an array of beam targets:
     { pos, rot, len, thick, color, intensity, anim:{sway,speed,phase} } */
  _scenes() {
    const { violet: V, blue: B, teal: T, pink: P, gold: G, white: W } = COL;
    return {
      gate: () => {
        const arr = [];
        const n = 9;
        for (let i = 0; i < n; i++) {
          const a = (i / (n - 1) - 0.5) * Math.PI * 0.92;
          arr.push({
            pos: [0, -5.4, -2], rot: [0, 0, -a], len: 17,
            thick: 0.09 + 0.05 * Math.abs(Math.sin(a)),
            color: i % 3 === 0 ? B : V, intensity: 0.8,
            anim: { sway: 0.09, speed: 0.32, phase: i * 1.1 },
          });
        }
        arr.push({ pos: [-8.6, -5.4, -4], rot: [0, 0, 0.12], len: 15, thick: 0.17, color: T, intensity: 0.7, anim: { sway: 0.05, speed: 0.2, phase: 1 } });
        arr.push({ pos: [8.6, -5.4, -4], rot: [0, 0, -0.12], len: 15, thick: 0.17, color: P, intensity: 0.7, anim: { sway: 0.05, speed: 0.22, phase: 2 } });
        return arr;
      },

      pillars: (nArg) => {
        const n = Math.max(2, Math.min(parseInt(nArg) || 3, 6));
        const cols = [B, V, T, G, P, W];
        const spacing = 15 / n;
        const arr = [];
        for (let i = 0; i < n; i++) {
          const x = (i - (n - 1) / 2) * spacing;
          const anim = { sway: 0.015, speed: 0.5, phase: i * 1.7 };
          arr.push({ pos: [x, -6, -3], rot: [0, 0, 0], len: 13.5, thick: 0.3, color: cols[i % cols.length], intensity: 0.95, anim });
          arr.push({ pos: [x, -6, -3.2], rot: [0, 0, 0], len: 13.5, thick: 1.0, color: cols[i % cols.length], intensity: 0.16, anim });
        }
        return arr;
      },

      sweep: () => [
        { pos: [-9, -5.6, -4], rot: [0, 0, -0.5], len: 20, thick: 0.5, color: B, intensity: 0.5, anim: { sway: 0.42, speed: 0.17, phase: 0 } },
        { pos: [9, -5.6, -4], rot: [0, 0, 0.5], len: 20, thick: 0.5, color: V, intensity: 0.5, anim: { sway: 0.42, speed: 0.14, phase: 2.2 } },
        { pos: [0, -5.6, -7], rot: [0, 0, 0], len: 18, thick: 0.26, color: T, intensity: 0.35, anim: { sway: 0.55, speed: 0.11, phase: 4.1 } },
      ],

      tunnel: () => {
        const arr = [];
        for (let i = 0; i < 6; i++) {
          const s = i / 5;
          const anim = { sway: 0.02, speed: 0.3, phase: i };
          arr.push({ pos: [-7 + s * 5.4, -3.6 + s * 0.9, -2 - s * 6.5], rot: [0, 0, Math.PI / 2 + 0.26 - s * 0.1], len: 15 - s * 4, thick: 0.12, color: s < 0.5 ? B : T, intensity: 0.62 - s * 0.24, anim },
          { pos: [7 - s * 5.4, -3.6 + s * 0.9, -2 - s * 6.5], rot: [0, 0, -Math.PI / 2 - 0.26 + s * 0.1], len: 15 - s * 4, thick: 0.12, color: s < 0.5 ? V : P, intensity: 0.62 - s * 0.24, anim: { ...anim, phase: i + 3 } });
        }
        return arr;
      },

      weave: () => {
        const arr = [];
        const cols = [B, V, T, P, G];
        for (let i = 0; i < 5; i++) {
          const x = (i - 2) * 4.2;
          arr.push({ pos: [x - 3, -7.5, -4], rot: [0, 0, -0.62], len: 19, thick: 0.11, color: cols[i], intensity: 0.55, anim: { sway: 0.05, speed: 0.24, phase: i } });
          arr.push({ pos: [x + 3, -7.5, -4.5], rot: [0, 0, 0.62], len: 19, thick: 0.11, color: cols[(i + 2) % 5], intensity: 0.55, anim: { sway: 0.05, speed: 0.2, phase: i + 2.5 } });
        }
        return arr;
      },

      strike: () => {
        const arr = [];
        const cols = [G, P, W, V];
        for (let i = 0; i < 16; i++) {
          arr.push({
            pos: [0, 0, -2], rot: [0, 0, (i / 16) * Math.PI * 2], len: 13,
            thick: 0.12, color: cols[i % cols.length], intensity: 0.85,
            anim: { sway: 0.03, speed: 0.6, phase: i * 0.7 },
          });
        }
        return arr;
      },
    };
  }

  /* per-scene sprite dressing */
  _dress(name) {
    const g = this.gsap;
    const coreTargets = { gate: 0.35, strike: 0.8, pillars: 0.08, sweep: 0.06, tunnel: 0.12, weave: 0.06 };
    g.to(this.core.material, { opacity: coreTargets[name] ?? 0.08, duration: 1.4, ease: "power2.inOut" });
    g.to(this.horizon.material, { opacity: name === "tunnel" ? 0.6 : 0.4, duration: 1.4, ease: "power2.inOut" });
  }

  /* ---------------- theme contract ---------------- */
  _applyScene(name, arg, over = {}) {
    const make = this._scenes()[name] || this._scenes().sweep;
    const targets = make(arg);
    const g = this.gsap;
    const dur = this.reduced ? 0.5 : (over.dur ?? 1.5);
    const ease = "power3.inOut";

    this.beams.forEach((beam, i) => {
      const t = targets[i];
      const u = beam.userData;
      if (t) {
        g.to(beam.position, { x: t.pos[0], y: t.pos[1], z: t.pos[2], duration: dur, ease });
        g.to(u.base, { rx: t.rot[0], ry: t.rot[1], rz: t.rot[2], duration: dur, ease });
        g.to(beam.scale, { x: t.thick, y: t.len, z: t.thick, duration: dur, ease });
        const c = new THREE.Color(t.color);
        g.to(u.mat.uniforms.uColor.value, { r: c.r, g: c.g, b: c.b, duration: dur, ease });
        g.to(u.mat.uniforms.uIntensity, { value: t.intensity, duration: dur, ease: "power2.inOut" });
        u.anim = t.anim || { sway: 0, speed: 0, phase: 0 };
      } else {
        g.to(u.mat.uniforms.uIntensity, { value: 0, duration: dur * 0.6, ease: "power2.in" });
      }
    });

    this._dress(name);

    // flash — peaks mid-transition, zero at rest
    if (!this.reduced) {
      g.killTweensOf(this.flash);
      this.flash.value = 0;
      g.to(this.flash, { value: 1, duration: dur * 0.3, ease: "power2.in" });
      g.to(this.flash, { value: 0, duration: dur * 0.7, ease: "power2.out", delay: dur * 0.3 });
    }

    const cam = over.cam || CAMS[name] || [0, 0, 14];
    this._camTo(cam[0], cam[1], cam[2]);
  }

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
  }

  start() {
    const tick = () => { this._frame(); this.renderer.render(this.scene, this.camera); this._raf = requestAnimationFrame(tick); };
    tick();
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this.beams.forEach((b) => b.userData.mat.dispose());
    this.renderer.dispose();
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    const t = this.elapsed;

    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.05;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.05;
    this.camera.position.x = this.camBase.x + this.pointer.x * 0.7;
    this.camera.position.y = this.camBase.y - this.pointer.y * 0.5;
    this.camera.lookAt(0, this.camBase.y * 0.2, 0);

    if (!this.reduced) {
      for (const beam of this.beams) {
        const { base, anim } = beam.userData;
        beam.rotation.set(base.rx, base.ry, base.rz + Math.sin(t * anim.speed + anim.phase) * anim.sway);
      }
    } else {
      for (const beam of this.beams) {
        const { base } = beam.userData;
        beam.rotation.set(base.rx, base.ry, base.rz);
      }
    }
  }
}
