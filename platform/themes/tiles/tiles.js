/* ============================================================
   tiles.js — "Kinetic Tiles" theme (Three.js)

   A wall of ~1,200 rounded 3D tiles (one InstancedMesh — a
   single draw call) that breathes idly and, on every slide
   change, flips in a ripple: a wavefront expands from the
   center, each tile pops toward the camera and rotates 180°
   as the front passes, swapping to the next scene's palette
   mid-flip. Real lights + standard material give the tiles
   dimensional shading.

   Scenes: wall · wave · columns:N · checker · spiral · cascade
   ============================================================ */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ThemeBase } from "../../engine/theme.js";

const COLS = 46, ROWS = 26, SIZE = 0.62, GAP = 0.14;
const STEP = SIZE + GAP;
const COUNT = COLS * ROWS;

const C = {
  deep:   new THREE.Color("#12102e"),
  navy:   new THREE.Color("#0d1530"),
  slate:  new THREE.Color("#1a1f45"),
  violet: new THREE.Color("#6b5bff"),
  blue:   new THREE.Color("#2b88ff"),
  teal:   new THREE.Color("#18c8b6"),
  pink:   new THREE.Color("#ff2ea6"),
  gold:   new THREE.Color("#ffcf45"),
  ice:    new THREE.Color("#aebbff"),
};
const ACCENTS = [C.blue, C.violet, C.teal, C.gold, C.pink, C.ice];
const CAMS = {
  wall: [0, 0, 17], wave: [0, -0.5, 16.5], columns: [0, 0, 17.5],
  checker: [0, 0, 16], spiral: [0, 0, 17], cascade: [0, 0, 15.5],
};

export default class Tiles extends ThemeBase {
  static id = "tiles";
  static label = "Kinetic Tiles";
  static transition = { swapAt: 620, lock: 1500 };
  static vocabulary = ["wall", "wave", "columns", "checker", "spiral", "cascade"];
  static defaultScene = "wave";

  static sceneFor(h) {
    if (h.role === "cover") return "wall";
    if (h.role === "closing") return "cascade";
    if (h.cards >= 2) return `columns:${Math.min(h.cards, 6)}`;
    if (h.flow) return "wave";
    if (h.compare) return "checker";
    if (h.moves) return "spiral";
    return "wave";
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
    this.renderer.setClearColor(0x05040e);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x05040e, 18, 34);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    this.camera.position.set(0, 0, 17);
    this.camBase = { x: 0, y: 0, z: 17 };

    this._buildLights();
    this._buildWall();
    this._bindEvents();
    this.resize();
  }

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0x8890ff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(4, 6, 8);
    this.scene.add(dir);
    const pt = new THREE.PointLight(0x7c5cff, 60, 50);
    pt.position.set(0, 3, 8);
    this.scene.add(pt);
  }

  _buildWall() {
    const geo = new RoundedBoxGeometry(SIZE, SIZE, 0.26, 2, 0.07);
    const mat = new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.4 });
    this.mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.mesh);

    this.dummy = new THREE.Object3D();
    this.tiles = [];
    const cx = (COLS - 1) / 2, cy = (ROWS - 1) / 2;
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++, i++) {
        const x = (c - cx) * STEP;
        const y = (r - cy) * STEP;
        this.tiles.push({
          x, y, col: c, row: r,
          dist: Math.hypot(x, y),
          rnd: Math.random(),
          from: C.deep.clone(),
          to: C.deep.clone(),
        });
        this.dummy.position.set(x, y, 0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        this.mesh.setColorAt(i, C.deep);
      }
    }
    this.mesh.instanceColor.needsUpdate = true;

    this.front = { value: 1 };            // ripple progress: 1 = settled
    this.maxDist = Math.hypot((COLS / 2) * STEP, (ROWS / 2) * STEP);
    this.idle = this._idles().wave;
    this._booted = false;
  }

  /* ---------------- palettes + idle motion per scene ---------------- */
  _palettes() {
    const tmp = new THREE.Color();
    return {
      wall: (t2) => t2.rnd < 0.07
        ? ACCENTS[(t2.rnd * 1000 | 0) % ACCENTS.length]
        : tmp.copy(C.deep).lerp(C.slate, t2.rnd * 0.7),
      wave: (t2) => t2.rnd < 0.04
        ? C.teal
        : tmp.copy(C.navy).lerp(C.slate, (t2.col / COLS) * 0.9 + t2.rnd * 0.2),
      columns: (t2, n) => {
        const band = Math.floor((t2.col / COLS) * n);
        const inBand = Math.abs((t2.col / COLS) * n - band - 0.5) < 0.3;
        return inBand
          ? tmp.copy(ACCENTS[band % ACCENTS.length]).multiplyScalar(0.35 + t2.rnd * 0.35)
          : tmp.copy(C.deep).lerp(C.navy, t2.rnd);
      },
      checker: (t2) => (t2.col + t2.row) % 2
        ? tmp.copy(C.violet).multiplyScalar(0.22 + t2.rnd * 0.15)
        : tmp.copy(C.blue).multiplyScalar(0.12 + t2.rnd * 0.1),
      spiral: (t2) => {
        const ring = Math.floor(t2.dist / 2.2) % 3;
        return tmp.copy([C.violet, C.slate, C.blue][ring]).multiplyScalar(ring === 1 ? 1 : 0.3 + t2.rnd * 0.2);
      },
      cascade: (t2) => {
        const diag = (t2.col + t2.row) % 9;
        return diag < 2
          ? tmp.copy(diag ? C.gold : C.pink).multiplyScalar(0.4 + t2.rnd * 0.4)
          : tmp.copy(C.deep).lerp(C.slate, t2.rnd * 0.5);
      },
    };
  }

  _idles() {
    return {
      wall:    (t2, t) => ({ z: 0.22 * Math.sin(t * 0.6 + (t2.x + t2.y) * 0.32 + t2.rnd * 2), rx: 0, ry: 0 }),
      wave:    (t2, t) => ({ z: 0.45 * Math.sin(t * 0.9 + t2.x * 0.5), rx: 0, ry: 0 }),
      columns: (t2, t) => ({ z: 0.3 * Math.sin(t * 1.1 + t2.col * 0.9), rx: 0, ry: 0 }),
      checker: (t2, t) => ({ z: 0.12 * Math.sin(t + t2.rnd * 6), rx: 0, ry: 0.16 * Math.sin(t * 0.7 + (t2.col + t2.row)) }),
      spiral:  (t2, t) => ({ z: 0.4 * Math.sin(t * 1.2 - t2.dist * 0.85), rx: 0, ry: 0 }),
      cascade: (t2, t) => ({ z: 0.5 * Math.sin(t * 1.3 - (t2.col + t2.row) * 0.28), rx: 0, ry: 0 }),
    };
  }

  /* ---------------- theme contract ---------------- */
  _applyScene(name, arg, over = {}) {
    const n = Math.max(2, Math.min(parseInt(arg) || 3, 6));
    const palette = this._palettes()[name] || this._palettes().wave;
    const idle = this._idles()[name] || this._idles().wave;
    const g = this.gsap;

    for (const t2 of this.tiles) {
      t2.from.copy(t2.to);
      t2.to.copy(palette(t2, n));
    }

    if (!this._booted || this.reduced) {
      // first paint (or reduced motion): no flip, settle instantly-ish
      this._booted = true;
      this.front.value = 1;
      this.idle = idle;
      for (let i = 0; i < COUNT; i++) this.mesh.setColorAt(i, this.tiles[i].to);
      this.mesh.instanceColor.needsUpdate = true;
    } else {
      this.idle = idle;
      g.killTweensOf(this.front);
      this.front.value = 0;
      g.to(this.front, { value: 1, duration: over.dur ?? 1.7, ease: "power2.inOut" });
    }

    const cam = over.cam || CAMS[name] || [0, 0, 17];
    this.camBase = { x: cam[0], y: cam[1], z: cam[2] };
    g.to(this.camera.position, { z: cam[2], duration: 1.5, ease: "power3.inOut" });
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
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.renderer.dispose();
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    const t = this.elapsed;

    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.05;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.05;
    this.camera.position.x = this.camBase.x + this.pointer.x * 1.1;
    this.camera.position.y = this.camBase.y - this.pointer.y * 0.8;
    this.camera.lookAt(0, 0, 0);

    const transitioning = this.front.value < 1;
    const frontDist = this.front.value * (this.maxDist + 4);
    const W = 3.2;                         // ripple band width
    const still = this.reduced;

    for (let i = 0; i < COUNT; i++) {
      const t2 = this.tiles[i];
      const m = still ? { z: 0, rx: 0, ry: 0 } : this.idle(t2, t);
      let rotX = m.rx, z = m.z;

      if (transitioning) {
        const p = Math.min(Math.max((frontDist - t2.dist) / W, 0), 1);
        rotX += p * Math.PI;               // full flip — lands flat again
        z += Math.sin(p * Math.PI) * 1.35; // pop toward the camera mid-flip
        this.mesh.setColorAt(i, p < 0.5 ? t2.from : t2.to);
      }

      this.dummy.position.set(t2.x, t2.y, z);
      this.dummy.rotation.set(rotX, m.ry, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (transitioning) this.mesh.instanceColor.needsUpdate = true;
  }
}
