/* /assets/js/newsletter.js */
(() => {
  const form = document.getElementById("calmiqs-newsletter-form");
  if (!form) return;

  const emailInput = document.getElementById("n-email");
  const nameInput = document.getElementById("n-name");
  const hp = document.getElementById("hp_addr");
  const tsInput = document.getElementById("n-ts");
  const submitBtn = document.getElementById("n-submit");
  const errEl = document.getElementById("n-email-error");
  const successEl = document.getElementById("n-success");

  // RFC-5322-lite / practical email regex (reasonable balance)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // set timestamp on load (ISO)
  tsInput.value = new Date().toISOString();

  function showError(msg) {
    errEl.textContent = msg;
    errEl.classList.remove("sr-only");
    errEl.focus();
  }
  function clearError() {
    errEl.textContent = "";
    errEl.classList.add("sr-only");
  }
  function showSuccess() {
    successEl.classList.remove("hidden");
    successEl.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 360, easing: "ease-out" }
    );
    // optionally hide form
    form.classList.add("opacity-60", "pointer-events-none");
  }

  async function submitForm(e) {
    e.preventDefault();
    clearError();

    const email = emailInput.value.trim();
    const name = nameInput ? nameInput.value.trim() : "";
    const honeypot = hp ? hp.value : "";
    const ts = tsInput.value;

    // honeypot check
    if (honeypot) {
      // silent fail to block bots
      return;
    }

    // basic timestamp anti-bot: require >= 2s since form rendering (helps some bots)
    try {
      const started = new Date(ts).getTime();
      if (Date.now() - started < 1500) {
        showError("Submission too quick. Please wait a moment and try again.");
        return;
      }
    } catch (err) {}

    if (!email) {
      showError("Please enter your email address.");
      emailInput.focus();
      return;
    }
    if (!emailRegex.test(email)) {
      showError("Please enter a valid email address.");
      emailInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.setAttribute("aria-busy", "true");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, name }),
      });

      if (res.status === 201 || res.status === 200) {
        showSuccess();
      } else {
        const j = await res.json().catch(() => ({ message: "Request failed" }));
        showError(j.message || "Subscription failed — please try later.");
      }
    } catch (err) {
      showError("Network error — please try again later.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
    }
  }

  form.addEventListener("submit", submitForm);

  // Optional: Floating CTA opens modal of page's newsletter (if implemented)
  const floatBtn = document.getElementById("calmiqs-floating-cta");
  if (floatBtn) {
    floatBtn.classList.remove("hidden");
    floatBtn.addEventListener("click", () => {
      // scroll to newsletter section
      const section = document.querySelector('[aria-labelledby="newsletter-heading"]');
      if (section) section.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
})();
