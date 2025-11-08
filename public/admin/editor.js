document.addEventListener("DOMContentLoaded", () => {
  // --- CONFIG ---
  const PASSWORD = "yourAdminPassword"; // Replace with real password
  const loginBtn = document.getElementById("loginBtn");
  const passwordInput = document.getElementById("passwordInput");
  const authSection = document.getElementById("authSection");
  const editorSection = document.getElementById("editorSection");
  const logoutBtn = document.getElementById("logoutBtn");
  const cmsBtn = document.getElementById("cmsBtn");

  // --- CMS BUTTON (DESKTOP/MOBILE) ---
  function showCMSButton(show) {
    if (cmsBtn) cmsBtn.classList.toggle("hidden", !show);
    const mobileCMS = document.querySelector("#mobile-menu a[href='/admin/editor.html']");
    if (mobileCMS) mobileCMS.classList.toggle("hidden", !show);
  }

  // --- LOGIN ---
  function login() {
    if (passwordInput.value.trim() === PASSWORD) {
      sessionStorage.setItem("calmiqsAuth", "true");
      authSection.classList.add("hidden");
      editorSection.classList.remove("hidden");
      showCMSButton(true);
      loadPosts(); // your existing KV load function
    } else {
      alert("Incorrect password.");
    }
  }

  loginBtn.addEventListener("click", login);

  // --- LOGOUT ---
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("calmiqsAuth");
      authSection.classList.remove("hidden");
      editorSection.classList.add("hidden");
      showCMSButton(false);
      passwordInput.value = "";
    });
  }

  // --- AUTO LOGIN IF SESSION ACTIVE ---
  if (sessionStorage.getItem("calmiqsAuth") === "true") {
    authSection.classList.add("hidden");
    editorSection.classList.remove("hidden");
    showCMSButton(true);
    loadPosts();
  }

  // --- FORMATTER BUTTONS ---
  document.querySelectorAll(".format-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const command = btn.dataset.command;
      const value = btn.dataset.value || null;
      if (command === "createLink") {
        const url = prompt("Enter URL:");
        if (url) document.execCommand(command, false, url);
      } else {
        document.execCommand(command, false, value);
      }
    });
  });

  // --- INLINE IMAGE UPLOAD & INSERT ---
  const insertInlineBtn = document.getElementById("insertInlineBtn");
  const inlineFileInput = document.getElementById("inlineImageFile");
  const contentDiv = document.getElementById("content");
  const inlineControls = document.getElementById("inlineControls");
  const inlineWidth = document.getElementById("inlineWidth");
  const inlineAlign = document.getElementById("inlineAlign");
  const applyInlineFormat = document.getElementById("applyInlineFormat");

  insertInlineBtn?.addEventListener("click", () => {
    const file = inlineFileInput.files[0];
    if (!file) return alert("Select an image first!");
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.maxWidth = "100%";
      img.classList.add("mb-3");
      contentDiv.appendChild(img);
      inlineControls.classList.remove("hidden");
      img.dataset.inserted = "true";
      img.dataset.width = "100%";
      img.dataset.align = "none";
      img.id = "lastInsertedInline";
    };
    reader.readAsDataURL(file);
  });

  applyInlineFormat?.addEventListener("click", () => {
    const img = document.getElementById("lastInsertedInline");
    if (!img) return;
    img.style.width = inlineWidth.value + "px";
    img.style.display =
      inlineAlign.value === "center"
        ? "block"
        : inlineAlign.value === "none"
        ? "inline-block"
        : "inline";
    img.style.marginLeft =
      inlineAlign.value === "center" ? "auto" : inlineAlign.value === "left" ? "0" : "auto";
    img.style.marginRight =
      inlineAlign.value === "center" ? "auto" : inlineAlign.value === "right" ? "0" : "auto";
  });

  // --- HERO IMAGE UPLOAD ---
  const uploadHeroBtn = document.getElementById("uploadHeroBtn");
  const heroFileInput = document.getElementById("heroImageFile");
  const heroImgInput = document.getElementById("image");

  uploadHeroBtn?.addEventListener("click", () => {
    const file = heroFileInput.files[0];
    if (!file) return alert("Select a hero image first!");
    const reader = new FileReader();
    reader.onload = (e) => {
      heroImgInput.value = e.target.result;
      alert("Hero image loaded successfully!");
    };
    reader.readAsDataURL(file);
  });

  // --- DUMMY POST FUNCTIONS (replace with KV functions) ---
  const loadBtn = document.getElementById("loadBtn");
  loadBtn?.addEventListener("click", () => {
    alert("loadPosts() function should fetch posts from KV");
  });

  const saveBtn = document.getElementById("saveBtn");
  saveBtn?.addEventListener("click", () => {
    alert("savePost() function should save current post to KV");
  });

  const deleteBtn = document.getElementById("deleteBtn");
  deleteBtn?.addEventListener("click", () => {
    alert("deletePost() function should remove post from KV");
  });
});
