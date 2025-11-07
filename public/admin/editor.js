// --- ELEMENTS ---
const loginBtn = document.getElementById("loginBtn");
const passwordInput = document.getElementById("passwordInput");
const authSection = document.getElementById("authSection");
const editorSection = document.getElementById("editorSection");
const logoutBtn = document.getElementById("logoutBtn");

// --- CONFIG ---
const PASSWORD = "YourAdminPasswordHere"; // <-- replace with your actual password

// --- LOGIN ---
loginBtn.addEventListener("click", (e) => {
  e.preventDefault(); // Prevent form submission / page reload

  const enteredPassword = passwordInput.value.trim();
  if (enteredPassword === PASSWORD) {
    // Set admin in localStorage
    localStorage.setItem("isAdmin", "true");

    // Show editor, hide login
    authSection.classList.add("hidden");
    editorSection.classList.remove("hidden");

    // Load posts or editor content
    loadPosts();
  } else {
    alert("Incorrect password.");
  }
});

// --- PAGE LOAD: Check if already logged in ---
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("isAdmin") === "true") {
    authSection.classList.add("hidden");
    editorSection.classList.remove("hidden");
    loadPosts();
  }

  // CMS button visibility in header
  const cmsDesktop = document.querySelector("nav a[href='/admin/editor.html']");
  const cmsMobile = document.querySelector("#mobile-menu a[href='/admin/editor.html']");
  if (localStorage.getItem("isAdmin") === "true") {
    cmsDesktop?.classList.remove("hidden");
    cmsMobile?.classList.remove("hidden");
  }
});

// --- LOGOUT ---
logoutBtn.addEventListener("click", (e) => {
  e.preventDefault();
  localStorage.removeItem("isAdmin");

  authSection.classList.remove("hidden");
  editorSection.classList.add("hidden");

  // Optionally hide CMS button again
  const cmsDesktop = document.querySelector("nav a[href='/admin/editor.html']");
  const cmsMobile = document.querySelector("#mobile-menu a[href='/admin/editor.html']");
  cmsDesktop?.classList.add("hidden");
  cmsMobile?.classList.add("hidden");
});
