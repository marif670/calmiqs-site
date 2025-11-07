document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const passwordInput = document.getElementById("passwordInput");
  const authSection = document.getElementById("authSection");
  const editorSection = document.getElementById("editorSection");

  const PASSWORD = "Hadia@2017"; // Replace with your password

  // LOGIN
  loginBtn.addEventListener("click", (e) => {
    e.preventDefault(); // Prevent form submit / reload
    if (passwordInput.value.trim() === PASSWORD) {
      localStorage.setItem("isAdmin", "true");
      authSection.classList.add("hidden");
      editorSection.classList.remove("hidden");
      loadPosts?.(); // Load posts/editor content
    } else {
      alert("Incorrect password.");
    }
  });

  // LOGOUT
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("isAdmin");
    authSection.classList.remove("hidden");
    editorSection.classList.add("hidden");

    // Hide CMS button
    const cmsDesktop = document.querySelector("nav a[href='/admin/editor.html']");
    const cmsMobile = document.querySelector("#mobile-menu a[href='/admin/editor.html']");
    cmsDesktop?.classList.add("hidden");
    cmsMobile?.classList.add("hidden");
  });

  // AUTO-LOGIN if already admin
  if (localStorage.getItem("isAdmin") === "true") {
    authSection.classList.add("hidden");
    editorSection.classList.remove("hidden");
    loadPosts?.();
  }

  // CMS button visibility in header
  const cmsDesktop = document.querySelector("nav a[href='/admin/editor.html']");
  const cmsMobile = document.querySelector("#mobile-menu a[href='/admin/editor.html']");
  if (localStorage.getItem("isAdmin") === "true") {
    cmsDesktop?.classList.remove("hidden");
    cmsMobile?.classList.remove("hidden");
  }
});
