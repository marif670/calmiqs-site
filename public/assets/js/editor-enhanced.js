// Enhanced Content Editor for Calmiqs
(function () {
  "use strict";

  const WORKER_BASE = "https://calmiqs-images-worker.techaipet.workers.dev";
  const AUTOSAVE_INTERVAL = 30000; // 30 seconds

  // DOM Elements
  const elements = {
    title: document.getElementById("postTitle"),
    editor: document.getElementById("contentEditor"),
    excerpt: document.getElementById("postExcerpt"),
    category: document.getElementById("postCategory"),
    tagsInput: document.getElementById("tagsInput"),
    tagsList: document.getElementById("tagsList"),
    metaDesc: document.getElementById("metaDescription"),
    focusKeyword: document.getElementById("focusKeyword"),
    status: document.getElementById("postStatus"),
    visibility: document.getElementById("visibility"),
    scheduleDate: document.getElementById("scheduleDate"),
    scheduleSection: document.getElementById("scheduleSection"),
    featuredImage: document.getElementById("featuredImageInput"),
    featuredPreview: document.getElementById("featuredImagePreview"),
    featuredAlt: document.getElementById("featuredImageAlt"),
    slugPreview: document.getElementById("slugPreview"),
    wordCount: document.getElementById("wordCount"),
    metaCharCount: document.getElementById("metaCharCount"),
    scoreValue: document.getElementById("scoreValue"),
    seoSuggestions: document.getElementById("seoSuggestions"),
    htmlView: document.getElementById("htmlView"),
    htmlTextarea: document.getElementById("htmlTextarea"),
  };

  // State
  let currentPost = {
    slug: "",
    title: "",
    content: "",
    excerpt: "",
    category: "",
    tags: [],
    metaDescription: "",
    focusKeyword: "",
    status: "draft",
    visibility: "public",
    scheduleDate: null,
    featuredImage: null,
    featuredImageAlt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let autosaveTimer;
  let isDirty = false;

  // Initialize
  function init() {
    setupToolbar();
    setupEventListeners();
    setupDragDrop();
    setupAutosave();
    loadDraft();
    updateWordCount();
  }

  // Setup Toolbar
  function setupToolbar() {
    document.querySelectorAll("[data-cmd]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;

        if (cmd === "createLink") {
          const url = prompt("Enter URL:");
          if (url) {
            document.execCommand(cmd, false, url);
          }
        } else if (cmd === "formatBlock") {
          // Handled by select change
        } else {
          document.execCommand(cmd, false, null);
        }

        elements.editor.focus();
      });
    });

    // Format block select
    document.querySelector('[data-cmd="formatBlock"]').addEventListener("change", (e) => {
      document.execCommand("formatBlock", false, e.target.value);
      elements.editor.focus();
    });
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Title -> Slug
    elements.title.addEventListener(
      "input",
      debounce(() => {
        currentPost.title = elements.title.value;
        currentPost.slug = generateSlug(elements.title.value);
        elements.slugPreview.textContent = currentPost.slug || "auto-generated";
        markDirty();
      }, 300)
    );

    // Content changes
    elements.editor.addEventListener(
      "input",
      debounce(() => {
        currentPost.content = elements.editor.innerHTML;
        updateWordCount();
        calculateSEOScore();
        markDirty();
      }, 500)
    );

    // Meta description
    elements.metaDesc.addEventListener("input", () => {
      currentPost.metaDescription = elements.metaDesc.value;
      elements.metaCharCount.textContent = elements.metaDesc.value.length;
      calculateSEOScore();
      markDirty();
    });

    // Focus keyword
    elements.focusKeyword.addEventListener(
      "input",
      debounce(() => {
        currentPost.focusKeyword = elements.focusKeyword.value;
        calculateSEOScore();
        markDirty();
      }, 300)
    );

    // Tags
    elements.tagsInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(elements.tagsInput.value.trim());
        elements.tagsInput.value = "";
      }
    });

    // Status changes
    elements.status.addEventListener("change", () => {
      currentPost.status = elements.status.value;
      elements.scheduleSection.classList.toggle("hidden", elements.status.value !== "scheduled");
      markDirty();
    });

    // Featured image
    elements.featuredImage.addEventListener("change", handleFeaturedImage);
    document.getElementById("selectFeaturedBtn").addEventListener("click", () => {
      elements.featuredImage.click();
    });

    // Action buttons
    document.getElementById("saveBtn").addEventListener("click", savePost);
    document.getElementById("publishBtn").addEventListener("click", publishPost);
    document.getElementById("previewBtn").addEventListener("click", previewPost);
    document.getElementById("loadPostBtn").addEventListener("click", loadPost);
    document.getElementById("deletePostBtn").addEventListener("click", deletePost);
    document.getElementById("duplicateBtn").addEventListener("click", duplicatePost);

    // Image insertion
    document.getElementById("insertImageBtn").addEventListener("click", openImageLibrary);

    // Table insertion
    document.getElementById("insertTableBtn").addEventListener("click", showTableModal);
    document.getElementById("insertTableConfirm").addEventListener("click", insertTable);
    document.getElementById("closeTableBtn").addEventListener("click", () => {
      document.getElementById("tableModal").classList.add("hidden");
    });

    // Code block
    document.getElementById("insertCodeBtn").addEventListener("click", insertCodeBlock);

    // HTML view
    document.getElementById("htmlViewBtn").addEventListener("click", toggleHTMLView);
    document.getElementById("applyHtmlBtn").addEventListener("click", applyHTML);

    // Fullscreen
    document.getElementById("fullscreenBtn").addEventListener("click", toggleFullscreen);

    // Slug editing
    document.getElementById("editSlug").addEventListener("click", editSlug);
  }

  // Setup Drag & Drop
  function setupDragDrop() {
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      elements.editor.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ["dragenter", "dragover"].forEach((eventName) => {
      elements.editor.addEventListener(
        eventName,
        () => {
          elements.editor.classList.add("drag-over");
        },
        false
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      elements.editor.addEventListener(
        eventName,
        () => {
          elements.editor.classList.remove("drag-over");
        },
        false
      );
    });

    elements.editor.addEventListener("drop", handleDrop, false);
  }

  async function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
      for (let file of files) {
        if (file.type.startsWith("image/")) {
          await uploadAndInsertImage(file);
        }
      }
    }
  }

  // Setup Autosave
  function setupAutosave() {
    autosaveTimer = setInterval(() => {
      if (isDirty) {
        saveDraft();
      }
    }, AUTOSAVE_INTERVAL);
  }

  // Utility Functions
  function generateSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function markDirty() {
    isDirty = true;
    currentPost.updatedAt = new Date().toISOString();
  }

  function updateWordCount() {
    const text = elements.editor.textContent || "";
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    elements.wordCount.textContent = words.length;
  }

  // SEO Score Calculation
  function calculateSEOScore() {
    let score = 0;
    const suggestions = [];

    // Title length (50-60 chars ideal)
    if (currentPost.title.length >= 50 && currentPost.title.length <= 60) {
      score += 20;
    } else {
      suggestions.push("💡 Title should be 50-60 characters");
    }

    // Meta description (150-160 chars)
    if (currentPost.metaDescription.length >= 150 && currentPost.metaDescription.length <= 160) {
      score += 20;
    } else if (currentPost.metaDescription.length === 0) {
      suggestions.push("💡 Add a meta description");
    } else {
      suggestions.push("💡 Meta description should be 150-160 characters");
    }

    // Focus keyword
    if (currentPost.focusKeyword) {
      score += 15;

      // Keyword in title
      if (currentPost.title.toLowerCase().includes(currentPost.focusKeyword.toLowerCase())) {
        score += 15;
      } else {
        suggestions.push("💡 Include focus keyword in title");
      }

      // Keyword in content
      const content = elements.editor.textContent.toLowerCase();
      if (content.includes(currentPost.focusKeyword.toLowerCase())) {
        score += 15;
      } else {
        suggestions.push("💡 Include focus keyword in content");
      }
    } else {
      suggestions.push("💡 Choose a focus keyword");
    }

    // Content length (300+ words)
    const wordCount = parseInt(elements.wordCount.textContent);
    if (wordCount >= 300) {
      score += 15;
    } else {
      suggestions.push(`💡 Add ${300 - wordCount} more words (300+ recommended)`);
    }

    // Update UI
    elements.scoreValue.textContent = score;
    elements.scoreValue.className =
      score >= 80 ? "score-good" : score >= 50 ? "score-ok" : "score-poor";

    elements.seoSuggestions.innerHTML =
      suggestions.length > 0
        ? suggestions.map((s) => `<p>${s}</p>`).join("")
        : '<p class="text-green-600">✓ Great SEO optimization!</p>';
  }

  // Tags Management
  function addTag(tagText) {
    if (!tagText || currentPost.tags.includes(tagText)) return;

    currentPost.tags.push(tagText);
    renderTags();
    markDirty();
  }

  function removeTag(tagText) {
    currentPost.tags = currentPost.tags.filter((t) => t !== tagText);
    renderTags();
    markDirty();
  }

  function renderTags() {
    elements.tagsList.innerHTML = currentPost.tags
      .map(
        (tag) => `
      <span class="tag-pill">
        ${tag}
        <button onclick="window.editorRemoveTag('${tag}')">&times;</button>
      </span>
    `
      )
      .join("");
  }

  window.editorRemoveTag = removeTag;

  // Featured Image
  async function handleFeaturedImage(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await authFetch(`${WORKER_BASE}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        currentPost.featuredImage = data.url || `${WORKER_BASE}/files/${data.metadata.r2Key}`;
        elements.featuredPreview.innerHTML = `<img src="${currentPost.featuredImage}" alt="Featured" class="w-full h-full object-cover" />`;
        markDirty();
      } else {
        alert("Failed to upload image: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image");
    }
  }

  // Image Library
  async function openImageLibrary() {
    const modal = document.getElementById("imageLibraryModal");
    modal.classList.remove("hidden");
    await loadImageLibrary();
  }

  async function loadImageLibrary() {
    const grid = document.getElementById("imageGrid");
    grid.innerHTML = '<div class="col-span-3 text-center py-8">Loading...</div>';

    try {
      const response = await authFetch(`${WORKER_BASE}/list`);
      const data = await response.json();

      if (response.ok && data.images && data.images.length > 0) {
        grid.innerHTML = data.images
          .map((img) => {
            const url = `${WORKER_BASE}/files/${encodeURIComponent(img.r2Key || img.id)}`;
            return `
            <div class="image-item" onclick="window.editorInsertImage('${url}', '${
              img.alt || ""
            }')">
              <img src="${url}" alt="${img.alt || img.title || ""}" />
            </div>
          `;
          })
          .join("");
      } else {
        grid.innerHTML =
          '<div class="col-span-3 text-center py-8 text-gray-500">No images yet</div>';
      }
    } catch (error) {
      console.error("Failed to load images:", error);
      grid.innerHTML =
        '<div class="col-span-3 text-center py-8 text-red-600">Failed to load images</div>';
    }
  }

  window.editorInsertImage = function (url, alt) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = alt;
    img.style.maxWidth = "100%";
    insertAtCursor(img);
    document.getElementById("imageLibraryModal").classList.add("hidden");
    markDirty();
  };

  document.getElementById("closeLibraryBtn").addEventListener("click", () => {
    document.getElementById("imageLibraryModal").classList.add("hidden");
  });

  document.getElementById("uploadImagesBtn").addEventListener("click", () => {
    document.getElementById("uploadImageInput").click();
  });

  document.getElementById("uploadImageInput").addEventListener("change", async (e) => {
    const files = e.target.files;
    for (let file of files) {
      await uploadAndInsertImage(file);
    }
    await loadImageLibrary();
  });

  async function uploadAndInsertImage(file) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await authFetch(`${WORKER_BASE}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        const url = data.url || `${WORKER_BASE}/files/${data.metadata.r2Key}`;
        window.editorInsertImage(url, data.metadata?.alt || file.name);
      }
    } catch (error) {
      console.error("Upload error:", error);
    }
  }

  // Table Insertion
  function showTableModal() {
    document.getElementById("tableModal").classList.remove("hidden");
  }

  function insertTable() {
    const rows = parseInt(document.getElementById("tableRows").value);
    const cols = parseInt(document.getElementById("tableCols").value);

    const table = document.createElement("table");
    const tbody = document.createElement("tbody");

    // Header row
    const headerRow = document.createElement("tr");
    for (let c = 0; c < cols; c++) {
      const th = document.createElement("th");
      th.textContent = `Header ${c + 1}`;
      headerRow.appendChild(th);
    }
    tbody.appendChild(headerRow);

    // Data rows
    for (let r = 1; r < rows; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        td.textContent = "Cell";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    insertAtCursor(table);
    document.getElementById("tableModal").classList.add("hidden");
    markDirty();
  }

  // Code Block
  function insertCodeBlock() {
    const code = prompt("Enter your code:");
    if (!code) return;

    const pre = document.createElement("pre");
    const codeEl = document.createElement("code");
    codeEl.textContent = code;
    pre.appendChild(codeEl);
    insertAtCursor(pre);
    markDirty();
  }

  // Insert at Cursor
  function insertAtCursor(element) {
    const selection = window.getSelection();
    if (!selection.rangeCount) {
      elements.editor.appendChild(element);
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(element);
    range.setStartAfter(element);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // HTML View Toggle
  function toggleHTMLView() {
    const isVisible = !elements.htmlView.classList.contains("hidden");

    if (isVisible) {
      elements.htmlView.classList.add("hidden");
    } else {
      elements.htmlTextarea.value = elements.editor.innerHTML;
      elements.htmlView.classList.remove("hidden");
    }
  }

  function applyHTML() {
    elements.editor.innerHTML = elements.htmlTextarea.value;
    elements.htmlView.classList.add("hidden");
    markDirty();
  }

  // Fullscreen
  function toggleFullscreen() {
    document.body.classList.toggle("fullscreen-mode");
  }

  // Slug Editing
  function editSlug() {
    const newSlug = prompt("Enter custom slug:", currentPost.slug);
    if (newSlug) {
      currentPost.slug = generateSlug(newSlug);
      elements.slugPreview.textContent = currentPost.slug;
      markDirty();
    }
  }

  // Save/Load Functions
  async function savePost() {
    collectPostData();

    try {
      const response = await authFetch(`${WORKER_BASE}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentPost),
      });

      if (response.ok) {
        showNotification("Post saved successfully!", "success");
        isDirty = false;
        localStorage.removeItem("calmiqs_draft");
      } else {
        const data = await response.json();
        showNotification("Failed to save: " + (data.error || "Unknown error"), "error");
      }
    } catch (error) {
      console.error("Save error:", error);
      showNotification("Failed to save post", "error");
    }
  }

  async function publishPost() {
    currentPost.status = "published";
    elements.status.value = "published";
    await savePost();
  }

  function previewPost() {
    collectPostData();
    const previewWindow = window.open("", "_blank");
    previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${currentPost.title}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          h1 { color: #4FA49A; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <h1>${currentPost.title}</h1>
        <p><em>${currentPost.excerpt}</em></p>
        <hr>
        <div>${currentPost.content}</div>
      </body>
      </html>
    `);
  }

  async function loadPost() {
    const slug = prompt("Enter post slug to load:");
    if (!slug) return;

    try {
      const response = await authFetch(`${WORKER_BASE}/posts/${encodeURIComponent(slug)}`);

      if (response.ok) {
        const post = await response.json();
        loadPostData(post);
        showNotification("Post loaded successfully!", "success");
      } else {
        showNotification("Post not found", "error");
      }
    } catch (error) {
      console.error("Load error:", error);
      showNotification("Failed to load post", "error");
    }
  }

  async function deletePost() {
    if (!currentPost.slug) {
      showNotification("No post to delete", "error");
      return;
    }

    if (!confirm(`Delete post "${currentPost.title}"?`)) return;

    try {
      const response = await authFetch(
        `${WORKER_BASE}/posts/${encodeURIComponent(currentPost.slug)}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        showNotification("Post deleted", "success");
        resetForm();
      } else {
        showNotification("Failed to delete post", "error");
      }
    } catch (error) {
      console.error("Delete error:", error);
      showNotification("Failed to delete post", "error");
    }
  }

  function duplicatePost() {
    currentPost.slug = currentPost.slug + "-copy";
    currentPost.title = currentPost.title + " (Copy)";
    elements.title.value = currentPost.title;
    elements.slugPreview.textContent = currentPost.slug;
    markDirty();
    showNotification("Post duplicated. Remember to save!", "info");
  }

  // Data Collection
  function collectPostData() {
    currentPost.title = elements.title.value;
    currentPost.content = elements.editor.innerHTML;
    currentPost.excerpt = elements.excerpt.value;
    currentPost.category = elements.category.value;
    currentPost.metaDescription = elements.metaDesc.value;
    currentPost.focusKeyword = elements.focusKeyword.value;
    currentPost.status = elements.status.value;
    currentPost.visibility = elements.visibility.value;
    currentPost.featuredImageAlt = elements.featuredAlt.value;

    if (elements.status.value === "scheduled") {
      currentPost.scheduleDate = elements.scheduleDate.value;
    }
  }

  function loadPostData(post) {
    currentPost = { ...post };
    elements.title.value = post.title || "";
    elements.editor.innerHTML = post.content || "";
    elements.excerpt.value = post.excerpt || "";
    elements.category.value = post.category || "";
    elements.tagsInput.value = "";
    elements.metaDesc.value = post.metaDescription || "";
    elements.focusKeyword.value = post.focusKeyword || "";
    elements.status.value = post.status || "draft";
    elements.visibility.value = post.visibility || "public";
    elements.featuredAlt.value = post.featuredImageAlt || "";
    elements.slugPreview.textContent = post.slug || "auto-generated";

    if (post.tags) {
      currentPost.tags = post.tags;
      renderTags();
    }

    if (post.featuredImage) {
      elements.featuredPreview.innerHTML = `<img src="${post.featuredImage}" alt="Featured" class="w-full h-full object-cover" />`;
    }

    updateWordCount();
    calculateSEOScore();
  }

  function resetForm() {
    currentPost = {
      slug: "",
      title: "",
      content: "",
      excerpt: "",
      category: "",
      tags: [],
      metaDescription: "",
      focusKeyword: "",
      status: "draft",
      visibility: "public",
      scheduleDate: null,
      featuredImage: null,
      featuredImageAlt: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    elements.title.value = "";
    elements.editor.innerHTML = "";
    elements.excerpt.value = "";
    elements.category.value = "";
    elements.tagsInput.value = "";
    elements.tagsList.innerHTML = "";
    elements.metaDesc.value = "";
    elements.focusKeyword.value = "";
    elements.status.value = "draft";
    elements.visibility.value = "public";
    elements.featuredPreview.innerHTML = '<span class="text-gray-400">No image selected</span>';
    elements.featuredAlt.value = "";
    elements.slugPreview.textContent = "auto-generated";

    isDirty = false;
  }

  // Draft Management
  function saveDraft() {
    collectPostData();
    localStorage.setItem("calmiqs_draft", JSON.stringify(currentPost));
    showNotification("Draft saved", "info");
    isDirty = false;
  }

  function loadDraft() {
    const draft = localStorage.getItem("calmiqs_draft");
    if (draft) {
      try {
        const post = JSON.parse(draft);
        if (confirm("Load saved draft?")) {
          loadPostData(post);
        }
      } catch (error) {
        console.error("Failed to load draft:", error);
      }
    }
  }

  // Notifications
  function showNotification(message, type = "info") {
    // Create notification element if it doesn't exist
    let notification = document.getElementById("autosaveIndicator");
    if (!notification) {
      notification = document.createElement("div");
      notification.id = "autosaveIndicator";
      document.body.appendChild(notification);
    }

    const colors = {
      success: "#10b981",
      error: "#ef4444",
      info: "#3b82f6",
    };

    notification.textContent = message;
    notification.style.background = colors[type] || colors.info;
    notification.classList.add("show");

    setTimeout(() => {
      notification.classList.remove("show");
    }, 3000);
  }

  // Auth Fetch Helper
  async function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (window.CALMIQS_ADMIN_TOKEN) {
      options.headers["X-Admin-Token"] = window.CALMIQS_ADMIN_TOKEN;
    }
    return fetch(url, options);
  }

  // Cleanup
  window.addEventListener("beforeunload", (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      return e.returnValue;
    }
  });

  // Initialize on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
