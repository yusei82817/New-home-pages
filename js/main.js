/* =========================================================
   RHYTHMOS STUDIO — INTERACTION ENGINE
   Lightweight vanilla JavaScript
========================================================= */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector("header");
  const sections = [...document.querySelectorAll("main section[id]")];
  const navLinks = [...document.querySelectorAll('nav a[href^="#"]')];


  // Ambient fireworks canvas (single layer, capped particle count and frame rate)
  if (!reduceMotion) {
    const canvas = document.createElement("canvas");
    canvas.id = "fireworks-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("role", "presentation");
    document.body.prepend(canvas);

    const ctx = canvas.getContext("2d", { alpha: true });
    if (ctx) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      let width = 0;
      let height = 0;
      let particles = [];
      let lastFrame = 0;
      let lastLaunch = 0;
      let nextLaunch = 900;
      let frameId = 0;
      const maxParticles = window.innerWidth < 600 ? 115 : 210;
      const hues = [258, 270, 285, 220, 300];

      const resizeCanvas = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas, { passive: true });

      const launchFirework = () => {
        if (particles.length >= maxParticles - 42) return;
        const x = width * (0.12 + Math.random() * 0.76);
        const y = height * (0.12 + Math.random() * 0.48);
        const hue = hues[Math.floor(Math.random() * hues.length)];
        const count = window.innerWidth < 600 ? 24 : 38;
        for (let i = 0; i < count && particles.length < maxParticles; i++) {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.12;
          const speed = 0.7 + Math.random() * 2.15;
          particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 48 + Math.random() * 28,
            maxLife: 76,
            size: 0.8 + Math.random() * 1.25,
            hue: hue + (Math.random() * 16 - 8)
          });
        }
      };

      const drawFrame = (time) => {
        frameId = 0;
        if (document.hidden) return;
        if (time - lastFrame < 33) {
          frameId = requestAnimationFrame(drawFrame);
          return;
        }
        lastFrame = time;
        ctx.clearRect(0, 0, width, height);

        if (time - lastLaunch > nextLaunch) {
          launchFirework();
          lastLaunch = time;
          nextLaunch = 1250 + Math.random() * 1700;
        }

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.985;
          p.vy = p.vy * 0.985 + 0.012;
          p.life -= 1;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          const alpha = Math.min(1, p.life / 22) * 0.72;
          ctx.beginPath();
          ctx.fillStyle = `hsla(${p.hue}, 88%, 82%, ${alpha})`;
          ctx.shadowBlur = 9;
          ctx.shadowColor = `hsla(${p.hue}, 90%, 76%, ${alpha})`;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        frameId = requestAnimationFrame(drawFrame);
      };

      const startAnimation = () => {
        if (!document.hidden && !frameId) {
          lastFrame = 0;
          frameId = requestAnimationFrame(drawFrame);
        }
      };
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          if (frameId) cancelAnimationFrame(frameId);
          frameId = 0;
          particles = [];
          ctx.clearRect(0, 0, width, height);
        } else {
          startAnimation();
        }
      });
      startAnimation();
    }
  }

  // Automatic copyright year
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Scroll progress indicator
  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.append(progress);

  // Back-to-top control
  const topButton = document.createElement("button");
  topButton.className = "back-to-top";
  topButton.type = "button";
  topButton.setAttribute("aria-label", "ページの先頭へ戻る");
  topButton.innerHTML = '<span aria-hidden="true">↑</span>';
  document.body.append(topButton);

  topButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  let scrollTicking = false;
  const updateScrollUI = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const amount = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    progress.style.transform = `scaleX(${amount})`;
    topButton.classList.toggle("is-visible", window.scrollY > 480);
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
    scrollTicking = false;
  };

  window.addEventListener("scroll", () => {
    if (!scrollTicking) {
      window.requestAnimationFrame(updateScrollUI);
      scrollTicking = true;
    }
  }, { passive: true });
  updateScrollUI();

  // Reveal sections as they enter the viewport
  const revealTargets = document.querySelectorAll(
    ".hero, .content-section, .contact-section, .booth-promo, footer"
  );

  if ("IntersectionObserver" in window && !reduceMotion) {
    revealTargets.forEach((element) => element.classList.add("reveal-ready"));
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -45px 0px" });

    revealTargets.forEach((element) => revealObserver.observe(element));
  }

  // Highlight the navigation item for the current section
  if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const active = link.getAttribute("href") === `#${entry.target.id}`;
          link.classList.toggle("is-active", active);
          if (active) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      });
    }, {
      rootMargin: "-25% 0px -60% 0px",
      threshold: 0
    });
    sections.forEach((section) => sectionObserver.observe(section));
  }

  // Subtle pointer tilt on project cards (desktop pointer only)
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (canHover && !reduceMotion) {
    document.querySelectorAll(".project-card").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const rotateY = (x - 0.5) * 5;
        const rotateX = (0.5 - y) * 5;
        card.style.setProperty("--pointer-x", `${x * 100}%`);
        card.style.setProperty("--pointer-y", `${y * 100}%`);
        card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
      });
      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
      });
    });
  }

  // Close the mobile navigation naturally after selecting a section
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const target = document.querySelector(link.getAttribute("href"));
      if (target) target.setAttribute("tabindex", "-1");
    });
  });
})();
