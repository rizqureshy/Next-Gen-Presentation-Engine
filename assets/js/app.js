/* ============================================================
   app.js — Slide controller + Framer-style flows (GSAP)
   ============================================================ */

import { Cosmos } from "./scene.js";

const gsap = window.gsap;

const bgCanvas = document.getElementById("bg-canvas");
const cosmos = new Cosmos(bgCanvas);
cosmos.start();

const slides = Array.from(document.querySelectorAll(".slide"));
const total = slides.length;
let current = 0;
let animating = false;

/* ---- chrome refs ---- */
const dotsWrap = document.getElementById("dots");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const bar = document.getElementById("bar");
const counterNow = document.getElementById("c-now");
const counterTot = document.getElementById("c-tot");

/* build dots */
slides.forEach((_, i) => {
  const b = document.createElement("button");
  b.className = "dot-btn";
  b.setAttribute("aria-label", `Go to slide ${i + 1}`);
  b.addEventListener("click", () => go(i));
  dotsWrap.appendChild(b);
});
const dots = Array.from(dotsWrap.children);
counterTot.textContent = String(total).padStart(2, "0");

/* ---- per-slide intro animations ---- */
function animateIn(slide) {
  const items = slide.querySelectorAll(".reveal");
  gsap.killTweensOf(items);
  gsap.fromTo(
    items,
    { y: 54, z: -120, opacity: 0, rotateX: -28, filter: "blur(10px)", transformPerspective: 1000 },
    {
      y: 0, z: 0, opacity: 1, rotateX: 0, filter: "blur(0px)",
      duration: 1.1, ease: "back.out(1.4)",
      stagger: 0.09, delay: 0.18,
    }
  );

  // cards / panels cascade in with depth + tilt
  const wks = slide.querySelectorAll(".pop");
  if (wks.length) {
    gsap.fromTo(
      wks,
      { y: 64, z: -180, opacity: 0, rotateX: -32, rotateY: 10, transformPerspective: 900 },
      { y: 0, z: 0, opacity: 1, rotateX: 0, rotateY: 0, duration: 1.05, ease: "back.out(1.5)", stagger: 0.085, delay: 0.4 }
    );
  }
}

function animateOut(slide) {
  const items = slide.querySelectorAll(".reveal");
  return gsap.to(items, {
    y: -40, z: -80, opacity: 0, rotateX: 18, filter: "blur(8px)",
    duration: 0.45, ease: "power2.in", stagger: 0.03,
  });
}

/* ---- navigation ----
   The field stays behind the slide at all times (no layer flip). On a
   change it morphs + swirls + surges forward while the current slide
   DISSOLVES — so the big bright whirl is all that's visible (it reads as
   the dance coming forward and obscuring) — then the next slide fades
   back in as the field recedes. Pure opacity + motion = no snap. */
function go(index) {
  if (index < 0 || index >= total || index === current || animating) return;
  animating = true;
  const prevSlide = slides[current];
  const nextSlide = slides[index];
  const prevFade = prevSlide.querySelectorAll(".slide-inner, .eq-credit");
  const nextFade = nextSlide.querySelectorAll(".slide-inner, .eq-credit");

  applyScene(nextSlide);                 // morph + swirl + forward surge (behind)
  gsap.to(prevFade, { opacity: 0, duration: 0.5, ease: "power2.in" });
  animateOut(prevSlide);
  current = index;
  updateChrome();

  // swap at the obscured peak; reveal the next slide as the field recedes
  setTimeout(() => {
    prevSlide.classList.remove("is-active");
    nextSlide.classList.add("is-active");
    gsap.set(nextFade, { opacity: 0 });
    animateIn(nextSlide);
    gsap.to(nextFade, { opacity: 1, duration: 0.7, ease: "power2.out" });
  }, 620);
  setTimeout(() => (animating = false), 1500);
}

function next() { go(current + 1); }
function prev() { go(current - 1); }

/* Read a slide's particle declaration and drive the engine.
   data-formation="orb|core|clusters:3|split|ring|grid|stream|burst|…"
   data-cam="x,y,z"  (optional camera override) */
function applyScene(slide) {
  const spec = slide.dataset.formation || "orb";
  const over = {};
  if (slide.dataset.cam) over.cam = slide.dataset.cam.split(",").map(Number);
  cosmos.applyFormation(spec, gsap, over);
}

function updateChrome() {
  dots.forEach((d, i) => d.classList.toggle("is-active", i === current));
  prevBtn.disabled = current === 0;
  nextBtn.disabled = current === total - 1;
  bar.style.width = `${((current) / (total - 1)) * 100}%`;
  counterNow.textContent = String(current + 1).padStart(2, "0");
}

prevBtn.addEventListener("click", prev);
nextBtn.addEventListener("click", next);

/* keyboard */
window.addEventListener("keydown", (e) => {
  if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); next(); }
  else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); prev(); }
  else if (e.key === "Home") go(0);
  else if (e.key === "End") go(total - 1);
});

/* wheel (debounced) */
let wheelLock = false;
window.addEventListener("wheel", (e) => {
  if (wheelLock || animating) return;
  if (Math.abs(e.deltaY) < 18) return;
  wheelLock = true;
  e.deltaY > 0 ? next() : prev();
  setTimeout(() => (wheelLock = false), 900);
}, { passive: true });

/* touch swipe */
let touchY = null, touchX = null;
window.addEventListener("touchstart", (e) => {
  touchY = e.touches[0].clientY; touchX = e.touches[0].clientX;
}, { passive: true });
window.addEventListener("touchend", (e) => {
  if (touchY === null) return;
  const dy = e.changedTouches[0].clientY - touchY;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dy) > 50 || Math.abs(dx) > 50) {
    (dy < 0 || dx < 0) ? next() : prev();
  }
  touchY = touchX = null;
}, { passive: true });

/* ---- boot ---- */
function boot() {
  applyScene(slides[0]);
  slides[0].classList.add("is-active");
  animateIn(slides[0]);
  updateChrome();
  const loader = document.getElementById("loader");
  loader.classList.add("hidden");
}

// Boot on DOM-ready (not window.load) so a slow/blocked font never
// stalls the intro. The module is deferred, so the DOM is already parsed.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 350));
} else {
  setTimeout(boot, 350);
}
