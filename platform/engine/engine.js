/* ============================================================
   engine.js — deck runtime: slide controller, navigation,
   chrome, and Framer-style DOM flows (GSAP).

   Theme-agnostic. A deck page boots with:

     import { mountDeck } from ".../platform/engine/engine.js";
     import Aurora from ".../platform/themes/aurora/aurora.js";
     mountDeck(Aurora);

   mountDeck also accepts a theme id string ("cosmos") and will
   dynamic-import ../themes/<id>/<id>.js relative to this file.

   Slides declare their background with data-scene (data-formation
   is honored as a legacy alias). Slides without a declaration are
   art-directed by the theme via ThemeClass.sceneFor(hints).
   ============================================================ */

export async function mountDeck(theme, opts = {}) {
  const ThemeClass = typeof theme === "string"
    ? (await import(`../themes/${theme}/${theme}.js`)).default
    : theme;
  const gsap = opts.gsap || window.gsap;

  const canvas = document.getElementById("bg-canvas");
  const themeInst = new ThemeClass(canvas, { gsap });
  themeInst.start();

  const slides = Array.from(document.querySelectorAll(".slide"));
  const total = slides.length;
  const { swapAt, lock } = ThemeClass.transition;
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

  /* ---- scene resolution ---- */
  function hintsFor(slide, i) {
    return {
      index: i,
      total,
      role: slide.classList.contains("cover")
        ? "cover"
        : i === total - 1 ? "closing" : "content",
      cards: slide.querySelectorAll(".card").length,
      flow: !!slide.querySelector(".flow"),
      moves: !!slide.querySelector(".moves"),
      compare: !!slide.querySelector(".compare"),
    };
  }

  function applyScene(slide, i) {
    const spec = slide.dataset.scene
      || slide.dataset.formation
      || ThemeClass.sceneFor(hintsFor(slide, i));
    const over = {};
    if (slide.dataset.cam) over.cam = slide.dataset.cam.split(",").map(Number);
    themeInst.applyScene(spec, over);
  }

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
     The background stays behind the slide at all times. On a change
     the theme transitions (morph/swirl/surge) while the current
     slide DISSOLVES, the DOM swaps at the obscured peak (swapAt),
     and the next slide fades back in as the effect recedes. */
  function go(index) {
    if (index < 0 || index >= total || index === current || animating) return;
    animating = true;
    const prevSlide = slides[current];
    const nextSlide = slides[index];
    const prevFade = prevSlide.querySelectorAll(".slide-inner, .eq-credit");
    const nextFade = nextSlide.querySelectorAll(".slide-inner, .eq-credit");

    applyScene(nextSlide, index);          // theme transition (behind)
    gsap.to(prevFade, { opacity: 0, duration: 0.5, ease: "power2.in" });
    animateOut(prevSlide);
    current = index;
    updateChrome();

    // swap at the obscured peak; reveal as the effect recedes
    setTimeout(() => {
      prevSlide.classList.remove("is-active");
      nextSlide.classList.add("is-active");
      gsap.set(nextFade, { opacity: 0 });
      animateIn(nextSlide);
      gsap.to(nextFade, { opacity: 1, duration: 0.7, ease: "power2.out" });
    }, swapAt);
    setTimeout(() => (animating = false), lock);
  }

  function next() { go(current + 1); }
  function prev() { go(current - 1); }

  function updateChrome() {
    dots.forEach((d, i) => d.classList.toggle("is-active", i === current));
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === total - 1;
    bar.style.width = `${(current / (total - 1)) * 100}%`;
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
    applyScene(slides[0], 0);
    slides[0].classList.add("is-active");
    animateIn(slides[0]);
    updateChrome();
    const loader = document.getElementById("loader");
    loader.classList.add("hidden");
  }

  // Boot on DOM-ready (not window.load) so a slow/blocked font never
  // stalls the intro. Module scripts are deferred, so the DOM is parsed.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 350));
  } else {
    setTimeout(boot, 350);
  }

  return {
    theme: themeInst,
    slides,
    go, next, prev,
    get current() { return current; },
  };
}
