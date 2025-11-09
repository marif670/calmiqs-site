// /assets/js/header-loader.js
(async function () {
  try {
    // --- HEADER ---
    const headerRes = await fetch("/assets/components/header.html");
    if (!headerRes.ok) throw new Error("Failed to load header");
    const headerHtml = await headerRes.text();
    const headerContainer = document.getElementById("navbar-container");
    headerContainer.innerHTML = headerHtml;

    // Mobile menu toggle
    const toggle = headerContainer.querySelector("#mobile-menu-toggle");
    const menu = headerContainer.querySelector("#mobile-menu");
    toggle?.addEventListener("click", () => menu.classList.toggle("hidden"));

    // CMS buttons logic
    const cmsButtons = headerContainer.querySelectorAll(".cmsBtn");
    const isAdmin =
      localStorage.getItem("isAdmin") === "true" ||
      sessionStorage.getItem("calmiqsAuth") === "true";

    if (isAdmin) cmsButtons.forEach((btn) => btn.classList.remove("hidden"));

    // Observe dynamically added buttons
    const observer = new MutationObserver(() => {
      if (isAdmin) cmsButtons.forEach((btn) => btn.classList.remove("hidden"));
    });
    observer.observe(headerContainer, { childList: true, subtree: true });

    // --- FOOTER ---
    const footerRes = await fetch("/assets/components/footer.html");
    if (!footerRes.ok) throw new Error("Failed to load footer");
    const footerHtml = await footerRes.text();
    const footerContainer = document.getElementById("footer-container");
    footerContainer.innerHTML = footerHtml;
  } catch (err) {
    console.error("Header/Footer load failed:", err);
  }
})();
