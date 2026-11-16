(() => {
  "use strict";

  const root = document.body;
  const hero = document.querySelector(".hero");
  const scene = document.querySelector(".scene-tilt");
  const canvas = document.querySelector("#network-canvas");
  const menu = document.querySelector(".mobile-menu");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const mobile = window.matchMedia("(max-width: 700px)");

  const watch = (query, callback) => {
    if (query.addEventListener) query.addEventListener("change", callback);
    else if (query.addListener) query.addListener(callback);
  };

  if (menu) {
    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => { menu.open = false; });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menu.open) {
        menu.open = false;
        const summary = menu.querySelector("summary");
        if (summary) summary.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
    watch(mobile, () => {
      if (!mobile.matches) menu.open = false;
    });
  }

  /*
   * CSS 애니메이션은 어떤 JS 초기화 클래스도 기다리지 않는다.
   * 아래 스크롤 효과 또한 콘텐츠를 미리 숨기지 않는다.
   */
  const revealTargets = Array.from(document.querySelectorAll("[data-reveal]"));
  const seen = new WeakSet();
  const runningReveals = new Set();
  let revealFrame = 0;
  let observer = null;

  const reveal = (element) => {
    if (seen.has(element) || reduced.matches || document.hidden) return;
    seen.add(element);
    runningReveals.add(element);
    element.classList.add("reveal-enter");
  };

  revealTargets.forEach((element) => {
    element.addEventListener("animationend", (event) => {
      if (event.target !== element) return;
      if (event.animationName !== "reveal-enter" && event.animationName !== "card-unfold") return;
      element.classList.remove("reveal-enter");
      runningReveals.delete(element);
    });
  });

  const checkReveals = () => {
    revealFrame = 0;
    if (reduced.matches || document.hidden) return;
    const limit = window.innerHeight * .94;
    revealTargets.forEach((element) => {
      if (seen.has(element)) return;
      const rect = element.getBoundingClientRect();
      if (rect.top < limit && rect.bottom > 0) reveal(element);
    });
  };

  const queueReveals = () => {
    if (!revealFrame && !document.hidden) {
      revealFrame = requestAnimationFrame(checkReveals);
    }
  };

  if ("IntersectionObserver" in window) {
    try {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || reduced.matches || document.hidden) return;
          reveal(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: .08 });
      revealTargets.forEach((element) => observer.observe(element));
    } catch {
      observer = null;
    }
  }

  /*
   * 직접 위치 검사도 병행한다.
   * Observer가 늦게 반응하거나 지원되지 않아도 진입 효과가 실행된다.
   */
  window.addEventListener("scroll", queueReveals, { passive: true });
  queueReveals();

  let context = null;
  if (canvas) {
    try {
      context = canvas.getContext("2d", { alpha: true });
    } catch {
      context = null;
    }
  }

  let width = 1;
  let height = 1;
  let particles = [];
  let frame = 0;
  let resizeFrame = 0;
  let lastTime = 0;
  let elapsed = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let lightX = 35;
  let lightY = 25;
  let currentLightX = 35;
  let currentLightY = 25;
  let pointerInside = false;
  let canvasFailed = false;

  const motionAllowed = () => !reduced.matches && !document.hidden;

  const heroOnScreen = () => {
    if (!hero) return false;
    const rect = hero.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  };

  const resetPointer = () => {
    pointerInside = false;
    targetX = 0;
    targetY = 0;
    lightX = 35;
    lightY = 25;
    if (!scene) return;
    if (reduced.matches || !finePointer.matches) {
      currentX = 0;
      currentY = 0;
      currentLightX = 35;
      currentLightY = 25;
      scene.style.removeProperty("--tilt-x");
      scene.style.removeProperty("--tilt-y");
      scene.style.removeProperty("--light-x");
      scene.style.removeProperty("--light-y");
    }
  };

  const sizeCanvas = () => {
    if (!context || !canvas || !hero || reduced.matches || canvasFailed) return;
    const rect = hero.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const ratio = Math.min(window.devicePixelRatio || 1, mobile.matches ? 1.25 : 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const count = Math.max(12, Math.min(
      mobile.matches ? 26 : 62,
      Math.round(width * height / (mobile.matches ? 21000 : 17500))
    ));

    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 13 + Math.random() * 13,
      phase: Math.random() * Math.PI * 2,
      radius: .7 + Math.random() * 1.1
    }));
  };

  const drawNetwork = (delta) => {
    if (!context || canvasFailed) return;
    context.clearRect(0, 0, width, height);
    const reach = mobile.matches ? 125 : 175;
    const reachSquared = reach * reach;

    particles.forEach((point) => {
      point.y -= point.speed * delta;
      point.x += (5 + Math.sin(elapsed * .45 + point.phase) * 6) * delta;
      if (point.y < -15) point.y = height + 15;
      if (point.x > width + 15) point.x = -15;
    });

    for (let i = 0; i < particles.length; i += 1) {
      const point = particles[i];
      for (let j = i + 1; j < particles.length; j += 1) {
        const other = particles[j];
        const dx = point.x - other.x;
        const dy = point.y - other.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > reachSquared) continue;
        const proximity = 1 - Math.sqrt(distanceSquared) / reach;
        context.strokeStyle = `rgba(187,226,212,${proximity * .25})`;
        context.lineWidth = .7;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(other.x, other.y);
        context.stroke();

        if ((i + j) % 7 === 0) {
          const progress = (elapsed * .22 + i * .13) % 1;
          context.fillStyle = `rgba(225,255,239,${proximity * .85})`;
          context.beginPath();
          context.arc(
            point.x + (other.x - point.x) * progress,
            point.y + (other.y - point.y) * progress,
            1.4, 0, Math.PI * 2
          );
          context.fill();
        }
      }

      context.fillStyle = `rgba(210,245,229,${.5 + Math.sin(elapsed * 1.2 + point.phase) * .2})`;
      context.beginPath();
      context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      context.fill();
    }

    if (hero) hero.classList.add("network-ready");
  };

  const updatePointer = (delta) => {
    if (!scene || !finePointer.matches) return;
    const ease = 1 - Math.exp(-6 * delta);
    currentX += (targetX - currentX) * ease;
    currentY += (targetY - currentY) * ease;
    currentLightX += (lightX - currentLightX) * ease;
    currentLightY += (lightY - currentLightY) * ease;
    scene.style.setProperty("--tilt-x", `${currentX.toFixed(2)}deg`);
    scene.style.setProperty("--tilt-y", `${currentY.toFixed(2)}deg`);
    scene.style.setProperty("--light-x", `${currentLightX.toFixed(2)}%`);
    scene.style.setProperty("--light-y", `${currentLightY.toFixed(2)}%`);
  };

  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  };

  const render = (timestamp) => {
    frame = 0;
    if (!motionAllowed() || !heroOnScreen()) {
      lastTime = 0;
      return;
    }

    const interval = mobile.matches ? 1000 / 30 : 1000 / 45;
    if (lastTime && timestamp - lastTime < interval) {
      frame = requestAnimationFrame(render);
      return;
    }

    const delta = lastTime ? Math.min((timestamp - lastTime) / 1000, .065) : 1 / 30;
    lastTime = timestamp;
    elapsed += delta;

    if (!canvasFailed) {
      try {
        drawNetwork(delta);
      } catch {
        canvasFailed = true;
        if (hero) hero.classList.remove("network-ready");
        if (context) context.clearRect(0, 0, width, height);
      }
    }
    updatePointer(delta);

    const pointerSettled =
      Math.abs(targetX - currentX) < .01 &&
      Math.abs(targetY - currentY) < .01 &&
      Math.abs(lightX - currentLightX) < .05 &&
      Math.abs(lightY - currentLightY) < .05;
    const hasCanvas = context && !canvasFailed;
    const needsPointer = finePointer.matches && (pointerInside || !pointerSettled);

    if (hasCanvas || needsPointer) frame = requestAnimationFrame(render);
  };

  const start = () => {
    if (!frame && motionAllowed() && heroOnScreen()) {
      frame = requestAnimationFrame(render);
    }
  };

  if (hero) {
    hero.addEventListener("pointermove", (event) => {
      if (!motionAllowed() || !finePointer.matches) return;
      const rect = hero.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      targetX = -(y - .5) * 7;
      targetY = (x - .5) * 11;
      lightX = x * 100;
      lightY = y * 100;
      pointerInside = true;
      start();
    }, { passive: true });

    hero.addEventListener("pointerleave", () => {
      resetPointer();
      start();
    }, { passive: true });
  }

  window.addEventListener("scroll", start, { passive: true });
  window.addEventListener("resize", () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      sizeCanvas();
      queueReveals();
      start();
    });
  }, { passive: true });

  const syncVisibility = () => {
    root.classList.toggle("page-hidden", document.hidden);
    if (document.hidden) {
      stop();
      if (revealFrame) cancelAnimationFrame(revealFrame);
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      revealFrame = 0;
      resizeFrame = 0;
    } else {
      sizeCanvas();
      queueReveals();
      start();
    }
  };

  document.addEventListener("visibilitychange", syncVisibility);
  window.addEventListener("pageshow", syncVisibility);

  watch(reduced, () => {
    stop();
    resetPointer();
    runningReveals.forEach((element) => element.classList.remove("reveal-enter"));
    runningReveals.clear();
    if (reduced.matches) {
      if (context) context.clearRect(0, 0, width, height);
      if (hero) hero.classList.remove("network-ready");
    } else {
      sizeCanvas();
      queueReveals();
      start();
    }
  });

  watch(finePointer, () => {
    resetPointer();
    start();
  });

  /*
   * 첫 화면은 Observer 콜백 없이 바로 시작한다.
   * Canvas가 실패해도 SVG 네트워크와 모든 CSS 애니메이션은 유지된다.
   */
  syncVisibility();
})();