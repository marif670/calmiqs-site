// functions/_worker.js - Debug version with extensive logging

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    console.log("Request received:", {
      method: request.method,
      path: path,
      headers: Object.fromEntries(request.headers),
    });

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Admin authentication helper
    const isAdmin = () => {
      const token = request.headers.get("X-Admin-Token");
      return token && token === env.ADMIN_SECRET;
    };

    try {
      // ========== POSTS API ==========
      if (path === "/posts" && request.method === "GET") {
        return handleGetPosts(env, corsHeaders);
      }

      if (path === "/posts" && request.method === "POST") {
        if (!isAdmin())
          return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
        return handleSavePost(request, env, corsHeaders);
      }

      if (path.startsWith("/posts/") && request.method === "GET") {
        const slug = path.replace("/posts/", "");
        return handleGetPost(slug, env, corsHeaders);
      }

      if (path.startsWith("/posts/") && request.method === "DELETE") {
        if (!isAdmin())
          return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
        const slug = path.replace("/posts/", "");
        return handleDeletePost(slug, env, corsHeaders);
      }

      // ========== COMMENTS API ==========

      // Get comments for a post
      if (path.match(/^\/comments\/[^\/]+$/) && request.method === "GET") {
        const postSlug = path.split("/")[2];
        console.log("Getting comments for post:", postSlug);
        return handleGetComments(postSlug, env, corsHeaders);
      }

      // Add a new comment
      if (path === "/comments" && request.method === "POST") {
        console.log("Adding new comment");
        return handleAddComment(request, env, corsHeaders);
      }

      // Delete a comment (admin only)
      if (
        path.match(/^\/comments\/[^\/]+\/[^\/]+$/) &&
        request.method === "DELETE"
      ) {
        if (!isAdmin())
          return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
        const [, , postSlug, commentId] = path.split("/");
        return handleDeleteComment(postSlug, commentId, env, corsHeaders);
      }

      // Approve/reject comment (admin only)
      if (
        path.match(/^\/comments\/[^\/]+\/[^\/]+\/moderate$/) &&
        request.method === "POST"
      ) {
        if (!isAdmin())
          return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
        const [, , postSlug, commentId] = path.split("/");
        return handleModerateComment(
          postSlug,
          commentId,
          request,
          env,
          corsHeaders
        );
      }

      // Get all pending comments (admin only)
      if (path === "/comments/pending" && request.method === "GET") {
        if (!isAdmin())
          return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
        return handleGetPendingComments(env, corsHeaders);
      }

      console.log("No route matched");
      return jsonResponse({ error: "Not Found", path }, 404, corsHeaders);
    } catch (error) {
      console.error("Worker error:", error);
      return jsonResponse(
        {
          error: error.message,
          stack: error.stack,
          path,
        },
        500,
        corsHeaders
      );
    }
  },
};

// Helper function for JSON responses
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// ========== POSTS HANDLERS ==========

async function handleGetPosts(env, corsHeaders) {
  const posts = {};
  const list = await env.CALMIQS_POSTS.list({ prefix: "post:" });

  for (const key of list.keys) {
    const value = await env.CALMIQS_POSTS.get(key.name);
    if (value) {
      const slug = key.name.replace("post:", "");
      posts[slug] = JSON.parse(value);
    }
  }

  return jsonResponse(posts, 200, corsHeaders);
}

async function handleGetPost(slug, env, corsHeaders) {
  const post = await env.CALMIQS_POSTS.get(`post:${slug}`);

  if (!post) {
    return jsonResponse({ error: "Not found" }, 404, corsHeaders);
  }

  return jsonResponse(JSON.parse(post), 200, corsHeaders);
}

async function handleSavePost(request, env, corsHeaders) {
  const { slug, data } = await request.json();

  if (!slug || !data) {
    return jsonResponse({ error: "Missing slug or data" }, 400, corsHeaders);
  }

  data.updatedAt = new Date().toISOString();
  if (!data.createdAt) data.createdAt = data.updatedAt;

  await env.CALMIQS_POSTS.put(`post:${slug}`, JSON.stringify(data));

  return jsonResponse({ success: true, slug }, 200, corsHeaders);
}

async function handleDeletePost(slug, env, corsHeaders) {
  await env.CALMIQS_POSTS.delete(`post:${slug}`);

  // Also delete associated comments
  const commentsList = await env.CALMIQS_POSTS.list({
    prefix: `comments:${slug}:`,
  });
  for (const key of commentsList.keys) {
    await env.CALMIQS_POSTS.delete(key.name);
  }

  return jsonResponse({ success: true }, 200, corsHeaders);
}

// ========== COMMENTS HANDLERS ==========

async function handleGetComments(postSlug, env, corsHeaders) {
  console.log("handleGetComments called for:", postSlug);

  const comments = [];
  const list = await env.CALMIQS_POSTS.list({
    prefix: `comments:${postSlug}:`,
  });

  console.log("Found comment keys:", list.keys.length);

  for (const key of list.keys) {
    const value = await env.CALMIQS_POSTS.get(key.name);
    if (value) {
      const comment = JSON.parse(value);
      // Only return approved comments to public
      if (comment.status === "approved") {
        comments.push(comment);
      }
    }
  }
  // Send email to admin
  await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SENDGRID_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: "noreply@calmiqs.com" },
      to: [{ email: "admin@calmiqs.com" }],
      subject: "New Comment Pending Review",
      content: [
        {
          type: "text/plain",
          value: `New comment from ${name} on ${postSlug}`,
        },
      ],
    }),
  });
  // Sort by date (newest first)
  comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  console.log("Returning comments:", comments.length);
  return jsonResponse({ comments }, 200, corsHeaders);
}

async function handleAddComment(request, env, corsHeaders) {
  console.log("handleAddComment called");

  try {
    const body = await request.json();
    console.log("Request body:", body);

    const { postSlug, name, email, comment, parentId } = body;

    // Validation
    if (!postSlug || !name || !email || !comment) {
      console.log("Missing required fields");
      return jsonResponse(
        {
          error: "Missing required fields",
          received: { postSlug, name, email, comment: comment?.length },
        },
        400,
        corsHeaders
      );
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log("Invalid email");
      return jsonResponse({ error: "Invalid email address" }, 400, corsHeaders);
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedComment = sanitizeInput(comment);

    // Generate unique comment ID
    const commentId = `${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log("Generated comment ID:", commentId);

    const commentData = {
      id: commentId,
      postSlug,
      name: sanitizedName,
      email, // Store but never expose publicly
      comment: sanitizedComment,
      parentId: parentId || null,
      status: "pending", // pending, approved, rejected
      createdAt: new Date().toISOString(),
      ip: request.headers.get("CF-Connecting-IP") || "unknown",
    };

    // Store comment
    const kvKey = `comments:${postSlug}:${commentId}`;
    console.log("Storing to KV key:", kvKey);

    await env.CALMIQS_POSTS.put(kvKey, JSON.stringify(commentData));

    console.log("Comment stored successfully");

    return jsonResponse(
      {
        success: true,
        commentId,
        message: "Comment submitted for review",
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("Error in handleAddComment:", error);
    return jsonResponse(
      {
        error: error.message,
        stack: error.stack,
      },
      500,
      corsHeaders
    );
  }
}

async function handleDeleteComment(postSlug, commentId, env, corsHeaders) {
  await env.CALMIQS_POSTS.delete(`comments:${postSlug}:${commentId}`);
  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function handleModerateComment(
  postSlug,
  commentId,
  request,
  env,
  corsHeaders
) {
  try {
    const { action } = await request.json();

    const key = `comments:${postSlug}:${commentId}`;
    const commentData = await env.CALMIQS_POSTS.get(key);

    if (!commentData) {
      return jsonResponse({ error: "Comment not found" }, 404, corsHeaders);
    }

    const comment = JSON.parse(commentData);
    comment.status = action === "approve" ? "approved" : "rejected";
    comment.moderatedAt = new Date().toISOString();

    await env.CALMIQS_POSTS.put(key, JSON.stringify(comment));

    return jsonResponse(
      { success: true, status: comment.status },
      200,
      corsHeaders
    );
  } catch (error) {
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function handleGetPendingComments(env, corsHeaders) {
  const pendingComments = [];
  const list = await env.CALMIQS_POSTS.list({ prefix: "comments:" });

  for (const key of list.keys) {
    const value = await env.CALMIQS_POSTS.get(key.name);
    if (value) {
      const comment = JSON.parse(value);
      if (comment.status === "pending") {
        pendingComments.push(comment);
      }
    }
  }

  // Sort by date (newest first)
  pendingComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return jsonResponse({ comments: pendingComments }, 200, corsHeaders);
}

// Helper: Sanitize user input
function sanitizeInput(str) {
  return String(str)
    .replace(/[<>]/g, "") // Remove HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim()
    .slice(0, 1000); // Limit length
}
// Add custom validation
if (comment.includes("spam")) {
  return new Response("Blocked", { status: 403 });
}
