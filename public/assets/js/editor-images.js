// /assets/js/editor-images.js - Calmiqs editor image integration
const WORKER_BASE = "https://calmiqs-images-worker.techaipet.workers.dev";
const LIST_URL = `${WORKER_BASE}/list`;
const UPLOAD_URL = `${WORKER_BASE}/upload`;
const UPDATE_URL = `${WORKER_BASE}/update`;

// helper auth fetch using window token
async function authFetch(url, opts = {}) {
  opts.headers = opts.headers || {};
  if (window.CALMIQS_ADMIN_TOKEN) opts.headers["X-Admin-Token"] = window.CALMIQS_ADMIN_TOKEN;
  // don't override body/other headers
  return fetch(url, opts);
}

// === Insert the modal HTML insertion trigger in editor.html (see next section) ===
// Wire existing file input and buttons
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("inlineImageFile"); // existing input
  const selectBtn = document.getElementById("selectImageBtn"); // new "Select from Library" button
  const insertBtn = document.getElementById("insertInlineBtn"); // optional "Upload & Insert" button

  // When file is selected, auto-enable upload button
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      // optionally auto-upload or enable insert button
      // here we auto-attempt upload to show flow
      // but you can also require clicking insertBtn to confirm
      // We'll do auto-upload on selection:
      if (fileInput.files && fileInput.files[0]) {
        uploadAndInsertInline(fileInput.files[0]);
      }
    });
  }

  if (selectBtn) {
    selectBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openLibraryModal();
    });
  }

  if (insertBtn) {
    insertBtn.addEventListener("click", async () => {
      if (!fileInput || !fileInput.files[0]) return alert("Choose a file first");
      await uploadAndInsertInline(fileInput.files[0]);
    });
  }
});

// Upload file then insert at caret
async function uploadAndInsertInline(file) {
  try {
    const form = new FormData();
    form.append("file", file);

    const res = await authFetch(UPLOAD_URL, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");

    // data.url is the Worker-served file URL
    insertImageAtCursor(data.url, file.name);
  } catch (err) {
    console.error(err);
    alert("Image upload failed: " + (err.message || err));
  }
}

function insertImageAtCursor(url, alt) {
  const editor = document.querySelector("#content") || document.querySelector("#blogContent");
  if (!editor) {
    alert("Editor element not found");
    return;
  }
  const img = document.createElement("img");
  img.src = url;
  img.alt = alt || "";
  img.className = "inline-img rounded-lg shadow-sm";
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  // insert at caret
  insertAtCursor(editor, img);
  // attach click handler for toolbar (optional)
  img.addEventListener("click", () => showInlineToolbar(img));
}

function insertAtCursor(editor, node) {
  // If node is element, convert to fragment
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    editor.appendChild(node);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  // move caret after inserted node
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ========== Image library modal ==========
function openLibraryModal() {
  const modal = document.getElementById("imageLibrary");
  const grid = document.getElementById("libraryGrid");
  modal.classList.remove("hidden");
  grid.innerHTML = '<div class="col-span-4 text-center py-8">Loading…</div>';
  loadLibrary();
}

async function loadLibrary() {
  try {
    const res = await authFetch(LIST_URL);
    const data = await res.json();
    const grid = document.getElementById("libraryGrid");
    grid.innerHTML = "";
    if (!data.images || data.images.length === 0) {
      grid.innerHTML = '<div class="col-span-4 text-center py-8">No images yet</div>';
      return;
    }
    data.images.forEach((img) => {
      // Each img has r2Key stored as metadata.r2Key
      const thumbUrl = `${WORKER_BASE}/files/${encodeURIComponent(img.r2Key)}`;
      const el = document.createElement("div");
      el.className = "p-2";
      const image = document.createElement("img");
      image.src = thumbUrl;
      image.alt = img.alt || img.title || "";
      image.className = "w-full h-32 object-cover rounded cursor-pointer";
      image.addEventListener("click", () => {
        insertImageAtCursor(thumbUrl, img.alt || img.filename);
        document.getElementById("imageLibrary").classList.add("hidden");
      });
      el.appendChild(image);
      const cap = document.createElement("div");
      cap.className = "text-xs mt-1";
      cap.innerText = img.title || img.filename;
      el.appendChild(cap);
      grid.appendChild(el);
    });
  } catch (err) {
    console.error("Library load failed", err);
    document.getElementById("libraryGrid").innerHTML =
      '<div class="text-red-600">Failed to load library</div>';
  }
}

// Modal close button
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "closeLibraryBtn") {
    document.getElementById("imageLibrary").classList.add("hidden");
  }
});

// small inline toolbar placeholder
function showInlineToolbar(img) {
  // implement as needed: align, resize, edit meta
  img.classList.toggle("selected");
}
