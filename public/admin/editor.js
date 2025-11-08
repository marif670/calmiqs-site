// === CONFIG ===
const PASSWORD = "Hadia@2017";
const KV_URL = "/posts";
const IMAGE_UPLOAD_URL = "/images/upload";

// --- Global Variables ---
let posts = {};
let currentInlineImage = null;

// --- DOM References ---
const authSection = document.getElementById("authSection");
const editorSection = document.getElementById("editorSection");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const postSelect = document.getElementById("postSelect");
const saveBtn = document.getElementById("saveBtn");
const deleteBtn = document.getElementById("deleteBtn");

const titleInput = document.getElementById("title");
const dateInput = document.getElementById("date");
const imageInput = document.getElementById("image");
const imageAltInput = document.getElementById("imageAlt");
const contentDiv = document.getElementById("content");
const preview = document.getElementById("previewContent");
const seoWarnings = document.getElementById("seoWarnings");

const inlineFileInput = document.getElementById("inlineImageFile");
const insertInlineBtn = document.getElementById("insertInlineBtn");
const inlineControls = document.getElementById("inlineControls");
const inlineWidthInput = document.getElementById("inlineWidth");
const inlineAlignSelect = document.getElementById("inlineAlign");
const applyInlineBtn = document.getElementById("applyInlineFormat");

// --- AUTHENTICATION ---
loginBtn.addEventListener("click", () => {
  if (passwordInput.value.trim() === PASSWORD) {
    sessionStorage.setItem("calmiqsAuth", "true");
    authSection.classList.add("hidden");
    editorSection.classList.remove("hidden");
    loadPosts();
  } else alert("Incorrect password.");
});

if (sessionStorage.getItem("calmiqsAuth") === "true") {
  authSection.classList.add("hidden");
  editorSection.classList.remove("hidden");
  loadPosts();
}

// --- KV POSTS ---
async function loadPosts() {
  try {
    const res = await fetch(KV_URL);
    if (!res.ok) throw new Error("Could not load posts from KV");
    posts = await res.json();
    populateSelect();
  } catch (err) {
    console.error(err);
    alert("❌ Could not load posts from KV.");
  }
}

function populateSelect() {
  postSelect.innerHTML =
    '<option value="">➕ New Post</option>' +
    Object.keys(posts)
      .map((key) => `<option value="${key}">${key}</option>`)
      .join("");
}

postSelect.addEventListener("change", () => {
  const key = postSelect.value;
  if (!key) return clearForm();
  const post = posts[key];
  document.getElementById("key").value = key;
  ["title", "date", "image", "imageAlt", "excerpt"].forEach((id) => {
    document.getElementById(id).value = post[id] || "";
  });
  contentDiv.innerHTML = post.content || "";
  updatePreview();
});

function clearForm() {
  document.getElementById("key").value = "";
  ["title", "date", "image", "imageAlt", "excerpt"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
  contentDiv.innerHTML = "";
  updatePreview();
}

// --- SAVE / DELETE POSTS ---
async function savePost() {
  const key = document.getElementById("key").value.trim();
  if (!key) return alert("Provide a key (slug)");
  const data = ["title", "date", "image", "excerpt"].reduce((obj, id) => {
    obj[id] = document.getElementById(id).value.trim();
    return obj;
  }, {});
  data.imageAlt = document.getElementById("imageAlt").value.trim();
  data.content = contentDiv.innerHTML;
  try {
    const res = await fetch(KV_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, data }),
    });
    const result = await res.json();
    if (result.success) {
      alert("✅ Post saved!");
      loadPosts();
    } else alert("⚠️ " + (result.error || "Unknown error"));
  } catch (err) {
    console.error(err);
    alert("❌ Failed to save post.");
  }
}

async function deletePost() {
  const key = postSelect.value;
  if (!key) return alert("Select a post");
  if (!confirm(`Delete '${key}'?`)) return;
  try {
    const res = await fetch(`${KV_URL}?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    const result = await res.json();
    if (result.success) {
      alert("🗑️ Post deleted");
      clearForm();
      loadPosts();
    } else alert("⚠️ " + (result.error || "Unknown error"));
  } catch (err) {
    console.error(err);
    alert("❌ Failed to delete post.");
  }
}

// --- HERO IMAGE UPLOAD ---
document.getElementById("uploadHeroBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("heroImageFile");
  const altInput = document.getElementById("imageAlt");
  if (!fileInput.files[0]) return alert("Select a file");

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  formData.append("alt", altInput.value || generateAltText(fileInput.files[0].name));

  try {
    const res = await fetch(IMAGE_UPLOAD_URL, { method: "POST", body: formData });
    const result = await res.json();
    if (result.success) {
      document.getElementById("image").value = result.url;
      document.getElementById("imageAlt").value = result.meta.alt || "";
      alert("✅ Hero image uploaded");
      updatePreview();
    } else alert("❌ Failed to upload image: " + (result.error || "Unknown error"));
  } catch (err) {
    console.error(err);
    alert("❌ Failed to upload image.");
  }
});

// --- INLINE IMAGE UPLOAD / DRAG & DROP ---
insertInlineBtn.addEventListener("click", () => handleInlineFiles(inlineFileInput.files));

contentDiv.addEventListener("dragover", (e) => e.preventDefault());
contentDiv.addEventListener("dragenter", () => contentDiv.classList.add("dragover"));
contentDiv.addEventListener("dragleave", () => contentDiv.classList.remove("dragover"));
contentDiv.addEventListener("drop", async (e) => {
  e.preventDefault();
  contentDiv.classList.remove("dragover");
  if (!e.dataTransfer.files[0]) return;
  handleInlineFiles(e.dataTransfer.files);
});

async function handleInlineFiles(fileList) {
  for (let file of fileList) {
    await insertInlineImage(file);
  }
}

async function insertInlineImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("alt", generateAltText(file.name));

  try {
    const res = await fetch(IMAGE_UPLOAD_URL, { method: "POST", body: formData });
    const result = await res.json();
    if (result.success) {
      const template = `<img src="${result.url}" alt="${result.meta.alt}" class="my-4 rounded-lg shadow-md w-full" />`;
      insertAtCursor(contentDiv, template);
      updatePreview();

      currentInlineImage = result.url;
      inlineControls.classList.remove("hidden");
      inlineWidthInput.value = 800;
      inlineAlignSelect.value = "none";
      alert("✅ Inline image inserted");
    } else alert("❌ Failed to insert image: " + (result.error || "Unknown error"));
  } catch (err) {
    console.error(err);
    alert("❌ Failed to insert image.");
  }
}

// --- APPLY INLINE IMAGE FORMATTING ---
applyInlineBtn.addEventListener("click", () => {
  if (!currentInlineImage) return;
  const imgs = contentDiv.querySelectorAll(`img[src="${currentInlineImage}"]`);
  imgs.forEach((img) => {
    img.style.width = inlineWidthInput.value ? inlineWidthInput.value + "px" : "";
    img.style.float = inlineAlignSelect.value !== "none" ? inlineAlignSelect.value : "";
    if (inlineAlignSelect.value === "center") img.style.display = "block";
    else img.style.display = "";
  });
  updatePreview();
});

// --- UTILITY FUNCTIONS ---
function insertAtCursor(editableDiv, html) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const frag = document.createRange().createContextualFragment(html);
  range.insertNode(frag);
  sel.removeAllRanges();
  sel.addRange(range);
}

function generateAltText(filename) {
  return filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") || "Blog image";
}

// --- LIVE PREVIEW & SEO CHECKS ---
function updatePreview() {
  const title = titleInput.value || "Untitled Post";
  const date = dateInput.value || "No date set";
  const image = imageInput.value || "https://via.placeholder.com/800x400?text=Preview";
  const imageAlt = imageAltInput.value || "Preview image";
  const content = contentDiv.innerHTML || "<p>Start typing...</p>";

  preview.innerHTML = `
    <img src="${image}" alt="${imageAlt}" class="rounded-xl mb-4 shadow-md w-full max-h-96 object-cover" />
    <h3 class="text-3xl font-bold mb-2 text-primary">${title}</h3>
    <p class="text-gray-500 mb-6">${date}</p>
    <div class="text-gray-800 leading-relaxed">${content}</div>
  `;

  // --- SEO/Accessibility Warnings ---
  let warnings = [];
  const imgs = preview.querySelectorAll("img");
  imgs.forEach((img) => {
    if (!img.alt || img.alt.trim() === "") warnings.push(`Image missing alt text: ${img.src}`);
  });
  seoWarnings.innerHTML = warnings.join("<br>") || "✅ No SEO/Accessibility issues detected";
}

// --- FORMAT BUTTONS ---
document.querySelectorAll(".format-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const command = btn.dataset.command;
    const value = btn.dataset.value || null;
    document.execCommand(command, false, value);
    contentDiv.focus();
  });
});

// --- AUTOSAVE DRAFTS ---
setInterval(() => {
  localStorage.setItem(
    "calmiqsDraft",
    JSON.stringify({
      title: titleInput.value,
      date: dateInput.value,
      image: imageInput.value,
      imageAlt: imageAltInput.value,
      excerpt: document.getElementById("excerpt").value,
      content: contentDiv.innerHTML,
    })
  );
}, 5000);

// Restore draft if exists
const draft = localStorage.getItem("calmiqsDraft");
if (draft) {
  const d = JSON.parse(draft);
  titleInput.value = d.title || "";
  dateInput.value = d.date || "";
  imageInput.value = d.image || "";
  imageAltInput.value = d.imageAlt || "";
  document.getElementById("excerpt").value = d.excerpt || "";
  contentDiv.innerHTML = d.content || "";
  updatePreview();
}

// --- BUTTON EVENTS ---
document.getElementById("loadBtn").addEventListener("click", loadPosts);
saveBtn.addEventListener("click", savePost);
deleteBtn.addEventListener("click", deletePost);

// Update preview on input
[titleInput, dateInput, imageInput, imageAltInput, contentDiv].forEach((el) => {
  el.addEventListener("input", updatePreview);
});
updatePreview();
