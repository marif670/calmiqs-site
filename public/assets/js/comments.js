// /assets/js/comments.js - Client-side comments functionality

// Use relative API path (same domain)
const COMMENTS_API = "/api/comments";

class CommentsSystem {
  constructor(postSlug, containerId) {
    this.postSlug = postSlug;
    this.container = document.getElementById(containerId);
    this.comments = [];
    this.init();
  }

  async init() {
    if (!this.container) {
      console.error("Comments container not found");
      return;
    }

    await this.loadComments();
    this.render();
    this.attachEventListeners();
  }

  async loadComments() {
    try {
      const response = await fetch(`${COMMENTS_API}/${this.postSlug}`);
      const data = await response.json();
      this.comments = data.comments || [];
    } catch (error) {
      console.error("Failed to load comments:", error);
      this.comments = [];
    }
  }

  render() {
    const commentCount = this.comments.length;

    this.container.innerHTML = `
      <div class="comments-section bg-white rounded-2xl shadow-lg p-6 md:p-8">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <h3 class="text-2xl font-bold text-gray-800">
            💬 Comments <span class="text-primary">(${commentCount})</span>
          </h3>
        </div>

        <!-- Comment Form -->
        <div class="comment-form mb-8">
          <h4 class="text-lg font-semibold mb-4 text-gray-700">Leave a Comment</h4>
          <form id="commentForm" class="space-y-4">
            <input type="hidden" id="parentId" value="">
            
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Name <span class="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  id="commentName" 
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition"
                  placeholder="Your name"
                >
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Email <span class="text-red-500">*</span>
                </label>
                <input 
                  type="email" 
                  id="commentEmail" 
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition"
                  placeholder="your@email.com"
                >
                <p class="text-xs text-gray-500 mt-1">
                  Your email will not be published
                </p>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Comment <span class="text-red-500">*</span>
              </label>
              <textarea 
                id="commentText" 
                required
                rows="4"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition resize-none"
                placeholder="Share your thoughts..."
              ></textarea>
            </div>

            <div id="replyingTo" class="hidden bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <span class="text-sm text-blue-700">
                💬 Replying to <strong id="replyingToName"></strong>
              </span>
              <button type="button" id="cancelReply" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                Cancel
              </button>
            </div>

            <div class="flex items-start gap-3">
              <button 
                type="submit" 
                class="bg-primary hover:bg-accent text-white px-6 py-2.5 rounded-lg font-medium transition shadow-md hover:shadow-lg"
              >
                📤 Submit Comment
              </button>
              <div id="formMessage" class="text-sm mt-2"></div>
            </div>
          </form>
        </div>

        <!-- Comments List -->
        <div id="commentsList" class="space-y-6">
          ${this.renderCommentsList()}
        </div>
      </div>
    `;
  }

  renderCommentsList() {
    if (this.comments.length === 0) {
      return `
        <div class="text-center py-12 text-gray-500">
          <div class="text-5xl mb-3">💭</div>
          <p class="text-lg font-medium">No comments yet</p>
          <p class="text-sm">Be the first to share your thoughts!</p>
        </div>
      `;
    }

    // Separate top-level and replies
    const topLevel = this.comments.filter((c) => !c.parentId);
    const replies = this.comments.filter((c) => c.parentId);

    return topLevel
      .map((comment) => {
        const commentReplies = replies.filter((r) => r.parentId === comment.id);
        return this.renderComment(comment, commentReplies);
      })
      .join("");
  }

  renderComment(comment, replies = []) {
    const timeAgo = this.getTimeAgo(comment.createdAt);
    const initials = this.getInitials(comment.name);

    return `
      <div class="comment-item border border-gray-200 rounded-lg p-4 hover:border-primary transition" data-comment-id="${
        comment.id
      }">
        <div class="flex gap-4">
          <!-- Avatar -->
          <div class="flex-shrink-0">
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg shadow-md">
              ${initials}
            </div>
          </div>
          
          <!-- Comment Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <span class="font-semibold text-gray-800">${this.escapeHtml(comment.name)}</span>
              <span class="text-gray-400 text-sm">•</span>
              <span class="text-gray-500 text-sm">${timeAgo}</span>
            </div>
            
            <p class="text-gray-700 leading-relaxed mb-3">
              ${this.escapeHtml(comment.comment)}
            </p>
            
            <button 
              class="reply-btn text-primary hover:text-accent text-sm font-medium transition"
              data-comment-id="${comment.id}"
              data-comment-name="${this.escapeHtml(comment.name)}"
            >
              💬 Reply
            </button>
          </div>
        </div>

        <!-- Replies -->
        ${
          replies.length > 0
            ? `
          <div class="replies ml-16 mt-4 space-y-4 pl-4 border-l-2 border-gray-200">
            ${replies
              .map(
                (reply) => `
              <div class="reply-item bg-gray-50 rounded-lg p-3" data-comment-id="${reply.id}">
                <div class="flex gap-3">
                  <div class="flex-shrink-0">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-tech to-primary flex items-center justify-center text-white font-bold text-sm shadow">
                      ${this.getInitials(reply.name)}
                    </div>
                  </div>
                  
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-semibold text-gray-800 text-sm">${this.escapeHtml(
                        reply.name
                      )}</span>
                      <span class="text-gray-400 text-xs">•</span>
                      <span class="text-gray-500 text-xs">${this.getTimeAgo(reply.createdAt)}</span>
                    </div>
                    <p class="text-gray-700 text-sm leading-relaxed">
                      ${this.escapeHtml(reply.comment)}
                    </p>
                  </div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  attachEventListeners() {
    const form = document.getElementById("commentForm");
    const cancelReplyBtn = document.getElementById("cancelReply");

    // Form submission
    if (form) {
      form.addEventListener("submit", (e) => this.handleSubmit(e));
    }

    // Reply buttons
    this.container.addEventListener("click", (e) => {
      if (e.target.classList.contains("reply-btn") || e.target.closest(".reply-btn")) {
        const btn = e.target.classList.contains("reply-btn")
          ? e.target
          : e.target.closest(".reply-btn");
        this.handleReply(btn.dataset.commentId, btn.dataset.commentName);
      }
    });

    // Cancel reply
    if (cancelReplyBtn) {
      cancelReplyBtn.addEventListener("click", () => this.cancelReply());
    }
  }

  handleReply(commentId, commentName) {
    document.getElementById("parentId").value = commentId;
    document.getElementById("replyingToName").textContent = commentName;
    document.getElementById("replyingTo").classList.remove("hidden");
    document.getElementById("commentText").focus();
  }

  cancelReply() {
    document.getElementById("parentId").value = "";
    document.getElementById("replyingTo").classList.add("hidden");
  }

  async handleSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const message = document.getElementById("formMessage");

    const formData = {
      postSlug: this.postSlug,
      name: document.getElementById("commentName").value.trim(),
      email: document.getElementById("commentEmail").value.trim(),
      comment: document.getElementById("commentText").value.trim(),
      parentId: document.getElementById("parentId").value || null,
    };

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = "⏳ Submitting...";
    message.textContent = "";

    try {
      const response = await fetch(COMMENTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      // Check if response has content
      const contentType = response.headers.get("content-type");
      let result;

      if (contentType && contentType.includes("application/json")) {
        const text = await response.text();
        if (text) {
          result = JSON.parse(text);
        } else {
          throw new Error("Empty response from server");
        }
      } else {
        const text = await response.text();
        throw new Error(`Unexpected response: ${text || "Empty response"}`);
      }

      if (response.ok) {
        message.className = "text-sm mt-2 text-green-600";
        message.textContent = "✅ Comment submitted! It will appear after moderation.";

        // Reset form
        e.target.reset();
        this.cancelReply();

        // Reload comments after a delay
        setTimeout(() => {
          this.loadComments().then(() => {
            this.render();
            this.attachEventListeners();
          });
        }, 1500);
      } else {
        throw new Error(result.error || "Failed to submit comment");
      }
    } catch (error) {
      console.error("Comment submission error:", error);
      message.className = "text-sm mt-2 text-red-600";
      message.textContent = `❌ ${error.message}`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "📤 Submit Comment";
    }
  }

  // Utility functions
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  getInitials(name) {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
}

// Auto-initialize if on post page
window.initComments = function (postSlug, containerId = "commentsContainer") {
  new CommentsSystem(postSlug, containerId);
};
