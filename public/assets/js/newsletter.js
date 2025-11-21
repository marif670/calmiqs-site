// /assets/js/newsletter.js - Newsletter subscription handler

(() => {
  const form = document.getElementById("calmiqs-newsletter-form");
  if (!form) return;

  const emailInput = document.getElementById("n-email");
  const nameInput = document.getElementById("n-name");
  const submitBtn = document.getElementById("n-submit");
  const errorEl = document.getElementById("n-email-error");
  const successEl = document.getElementById("n-success");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove("sr-only");
  }

  function clearError() {
    errorEl.classList.add("sr-only");
    errorEl.textContent = "";
  }

  function showSuccess() {
    successEl.classList.remove("hidden");
    form.classList.add("opacity-50", "pointer-events-none");
  }

  async function onSubmit(e) {
    e.preventDefault();
    clearError();

    const email = emailInput.value.trim();
    const name = nameInput?.value?.trim() || "";

    if (!email || !emailRegex.test(email)) {
      emailInput.focus();
      return showError("Please enter a valid email address.");
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "⏳ Subscribing...";

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      const data = await response.json();

      if (response.ok || response.status === 201) {
        showSuccess();
        form.reset();
      } else {
        showError(data.error || "Subscription failed. Try again.");
      }
    } catch (err) {
      showError("Network error — please try later.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Subscribe";
    }
  }

  form.addEventListener("submit", onSubmit);
})();
