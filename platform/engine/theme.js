/* ============================================================
   theme.js — the Theme contract every effect theme implements.

   A theme owns the background canvas and its visual language.
   The engine drives it exclusively through this interface:

     const theme = new SomeTheme(canvas, { gsap });
     theme.start();
     theme.applyScene("drift", { cam: [0, 0.2, 14] });  // per slide

   "Scenes" are the theme's public vocabulary — what a slide can
   ask its background to be. Cosmos calls them formations
   ("orb", "clusters:3"); Aurora calls them moods ("dawn",
   "nova"). Authors pick one with data-scene on the <section>,
   or let the theme choose via sceneFor(hints).
   ============================================================ */

export class ThemeBase {
  /* -------- identity (override in subclasses) -------- */
  static id = "base";
  static label = "Untitled theme";

  /* Engine choreography: when to swap slide DOM mid-transition
     and how long navigation stays locked (both ms). Themes with
     faster or slower morphs tune these to their motion. */
  static transition = { swapAt: 620, lock: 1500 };

  /* The theme's scene vocabulary + the scene used when a spec
     is missing or unknown. */
  static vocabulary = [];
  static defaultScene = "";

  /**
   * Art-direct a slide the author didn't annotate.
   * @param {object} hints { index, total, role, cards, flow, moves, compare }
   *                 role: "cover" | "content" | "closing"
   * @returns {string} a scene spec from this theme's vocabulary
   */
  static sceneFor(hints) { return this.defaultScene; }

  constructor(canvas, ctx = {}) {
    this.canvas = canvas;
    this.gsap = ctx.gsap || window.gsap;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* -------- lifecycle (engine → theme) -------- */
  start() {}
  resize() {}
  destroy() {}

  /**
   * Apply a scene spec: "name" or "name:arg" (e.g. "clusters:4").
   * Unknown names fall back to the theme's default scene.
   * @param {object} over per-slide overrides, e.g. { cam:[x,y,z], dur }
   */
  applyScene(spec, over = {}) {
    const [raw, arg] = String(spec || "").trim().split(":");
    const name = this.constructor.vocabulary.includes(raw)
      ? raw
      : this.constructor.defaultScene;
    this._applyScene(name, arg, over);
  }

  /* Each theme implements the actual scene change. */
  _applyScene(name, arg, over) {
    throw new Error(`${this.constructor.name} must implement _applyScene()`);
  }
}
