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
