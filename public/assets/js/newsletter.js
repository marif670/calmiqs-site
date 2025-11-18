/* assets/js/newsletter.js */

(() => {
  const form = document.getElementById("calmiqs-newsletter-form");
  if (!form) return;

  // Worker API base (no custom domain yet)
  const API_BASE = "https://calmiqs-images-worker.techaipet.workers.dev";

  const emailInput = document.getElementById("n-email");
  const nameInput = document.getElementById("n-name");
  const hp = document.getElementById("hp_addr");
  const tsInput = document.getElementById("n-ts");
  const submitBtn = document.getElementById("n-submit");
  const errEl = document.getElementById("n-email-error");
  const successEl = document.getElementById("n-success");

  // Email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Set timestamp for basic bot-protection
  tsInput.value = new Date().toISOString();

  function showError(msg) {
    errEl.textContent = msg;
    errEl.classList.remove("sr-only");
    errEl.focus();
  }

  function clearError() {
    errEl.classList.add("sr-only");
    errEl.textContent = "";
  }

  function showSuccess() {
    successEl.classList.remove("hidden");
    successEl.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 350, easing: "ease-out" }
    );
    form.classList.add("opacity-50", "pointer-events-none");
  }

  async function onSubmit(e) {
    e.preventDefault();
    clearError();

    const email = emailInput.value.trim();
    const name = nameInput?.value?.trim() || "";
    const honeypot = hp.value;

    // Honeypot trigger
    if (honeypot) return;

    // Timestamp gate — prevent instant bot submissions
    const submitTime = new Date(tsInput.value);
    if (Date.now() - submitTime.getTime() < 1200) {
      return showError("You're too quick — try again.");
    }

    if (!email || !emailRegex.test(email)) {
      emailInput.focus();
      return showError("Please enter a valid email address.");
    }

    submitBtn.disabled = true;
    submitBtn.setAttribute("aria-busy", "true");

    try {
      const res = await fetch(`${API_BASE}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 201 || res.status === 200) {
        showSuccess();
      } else {
        showError(data.error || "Subscription failed. Try again.");
      }
    } catch (err) {
      showError("Network error — please try later.");
    }

    submitBtn.disabled = false;
    submitBtn.removeAttribute("aria-busy");
  }

  form.addEventListener("submit", onSubmit);
})();
