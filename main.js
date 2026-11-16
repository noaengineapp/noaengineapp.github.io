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
   * 기존 콘텐츠는 항상 표시한다.
   * 진입 효과만 추가하고 첫 화면의 동작은 유지한다.
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
   * 하루마감 전용 3D 카드 덱.
   * JS가 없으면 기본 CSS의 전체 화면 목록을 그대로 사용한다.
   * reduced-motion 변경 시 즉시 기본 목록으로 돌아간다.
   */
  const showcase = document.querySelector("#haru .haru-showcase");

  if (showcase) {
    const gallery = showcase.querySelector(".haru-stage");
    const screens = Array.from(showcase.querySelectorAll(".haru-screen"));
    const controls = showcase.querySelector(".haru-controls");
    const dots = Array.from(showcase.querySelectorAll(".haru-dot"));
    const play = showcase.querySelector(".haru-play");
    const help = showcase.querySelector(".haru-gallery-help");
    const announcement = showcase.querySelector(".haru-announcement");
    const names = ["01 홈", "02 보고서", "03 캘린더"];
    const dwell = 5600;
    const turnDuration = 1100;

    if (gallery && screens.length === 3 && controls && dots.length === 3 && play && help) {
      let active = 0;
      let enabled = false;
      let inView = false;
      let hovered = false;
      let focused = false;
      let userPaused = false;
      let changing = false;
      let autoTimer = 0;
      let turnTimer = 0;
      let visibilityFrame = 0;
      let galleryObserver = null;

      const clearAuto = () => {
        window.clearTimeout(autoTimer);
        autoTimer = 0;
      };

      const cleanTransition = () => {
        window.clearTimeout(turnTimer);
        turnTimer = 0;
        changing = false;
        screens.forEach((screen) => {
          screen.classList.remove("haru-turning", "haru-arriving");
        });
      };

      const canRun = () =>
        enabled && inView && !document.hidden && !reduced.matches &&
        !hovered && !focused && !userPaused;

      const paint = () => {
        screens.forEach((screen, index) => {
          const offset = (index - active + screens.length) % screens.length;
          screen.dataset.position = ["front", "next", "back"][offset];
          if (enabled && index !== active) screen.setAttribute("aria-hidden", "true");
          else screen.removeAttribute("aria-hidden");
        });
        dots.forEach((dot, index) => {
          dot.setAttribute("aria-pressed", String(index === active));
        });
      };

      const schedule = () => {
        clearAuto();
        if (!canRun() || changing) return;
        autoTimer = window.setTimeout(() => {
          autoTimer = 0;
          if (canRun()) select((active + 1) % screens.length, false);
        }, dwell);
      };

      const syncPlayback = () => {
        showcase.classList.toggle("haru-paused", !canRun());
        play.textContent = userPaused ? "자동 전환 재생" : "자동 전환 일시정지";
        play.setAttribute("aria-pressed", String(userPaused));
        schedule();
      };

      const select = (index, manual) => {
        if (!enabled || reduced.matches || changing) return;
        if (index === active) {
          schedule();
          return;
        }

        clearAuto();
        cleanTransition();
        const outgoing = screens[active];
        active = index;
        changing = true;
        paint();

        outgoing.classList.add("haru-turning");
        screens[active].classList.add("haru-arriving");

        if (manual && announcement) {
          announcement.textContent = `${names[active]} 예시 화면을 표시합니다.`;
        }

        turnTimer = window.setTimeout(() => {
          cleanTransition();
          syncPlayback();
        }, turnDuration);
      };

      const enable = () => {
        if (enabled || reduced.matches) return;
        enabled = true;
        paint();
        controls.hidden = false;
        help.hidden = false;
        showcase.classList.add("haru-deck");
        showcase.classList.add("haru-paused");
        syncPlayback();
      };

      const disable = () => {
        clearAuto();
        cleanTransition();
        enabled = false;
        showcase.classList.remove("haru-deck", "haru-paused");
        controls.hidden = true;
        help.hidden = true;
        screens.forEach((screen) => {
          screen.removeAttribute("aria-hidden");
          delete screen.dataset.position;
        });
        if (announcement) announcement.textContent = "";
      };

      const measureVisibility = () => {
        visibilityFrame = 0;
        const rect = gallery.getBoundingClientRect();
        const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
        const next = visibleHeight > Math.min(rect.height, window.innerHeight) * .25;
        if (inView !== next) {
          inView = next;
          if (!inView) cleanTransition();
          syncPlayback();
        }
      };

      const queueVisibility = () => {
        if (!visibilityFrame) {
          visibilityFrame = requestAnimationFrame(measureVisibility);
        }
      };

      dots.forEach((dot, index) => {
        dot.addEventListener("click", () => select(index, true));
      });

      play.addEventListener("click", () => {
        userPaused = !userPaused;
        syncPlayback();
      });

      showcase.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "mouse" || !finePointer.matches) return;
        hovered = true;
        syncPlayback();
      });

      showcase.addEventListener("pointerleave", (event) => {
        if (event.pointerType !== "mouse") return;
        hovered = false;
        syncPlayback();
      });

      showcase.addEventListener("focusin", () => {
        focused = true;
        syncPlayback();
      });

      showcase.addEventListener("focusout", () => {
        window.setTimeout(() => {
          focused = showcase.contains(document.activeElement);
          syncPlayback();
        }, 0);
      });

      controls.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        userPaused = true;
        syncPlayback();
      });

      if ("IntersectionObserver" in window) {
        try {
          galleryObserver = new IntersectionObserver(() => {
            measureVisibility();
          }, { threshold: [0, .25, .5, .75, 1] });
          galleryObserver.observe(gallery);
        } catch {
          galleryObserver = null;
        }
      }

      window.addEventListener("scroll", queueVisibility, { passive: true });
      window.addEventListener("resize", queueVisibility, { passive: true });
      window.addEventListener("pageshow", () => {
        measureVisibility();
        syncPlayback();
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          clearAuto();
          cleanTransition();
          showcase.classList.add("haru-paused");
        } else {
          measureVisibility();
          syncPlayback();
        }
      });

      watch(finePointer, () => {
        hovered = false;
        syncPlayback();
      });

      watch(reduced, () => {
        if (reduced.matches) disable();
        else {
          enable();
          measureVisibility();
        }
      });

      if (!reduced.matches) enable();
      measureVisibility();
    }
  }

  /*
   * 첫 화면은 Observer 콜백 없이 바로 시작한다.
   * Canvas가 실패해도 SVG 네트워크와 CSS 애니메이션은 유지한다.
   */
  syncVisibility();
})();