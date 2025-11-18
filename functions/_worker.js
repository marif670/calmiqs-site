// functions/_worker.js - Updated with Comments API

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

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
          return new Response("Unauthorized", {
            status: 401,
            headers: corsHeaders,
          });
        return handleSavePost(request, env, corsHeaders);
      }

      if (path.startsWith("/posts/") && request.method === "GET") {
        const slug = path.replace("/posts/", "");
        return handleGetPost(slug, env, corsHeaders);
      }

      if (path.startsWith("/posts/") && request.method === "DELETE") {
        if (!isAdmin())
          return new Response("Unauthorized", {
            status: 401,
            headers: corsHeaders,
          });
        const slug = path.replace("/posts/", "");
        return handleDeletePost(slug, env, corsHeaders);
      }

      // ========== COMMENTS API ==========

      // Get comments for a post
      if (path.match(/^\/comments\/[^\/]+$/) && request.method === "GET") {
        const postSlug = path.split("/")[2];
        return handleGetComments(postSlug, env, corsHeaders);
      }

      // Add a new comment
      if (path === "/comments" && request.method === "POST") {
        return handleAddComment(request, env, corsHeaders);
      }

      // Delete a comment (admin only)
      if (
        path.match(/^\/comments\/[^\/]+\/[^\/]+$/) &&
        request.method === "DELETE"
      ) {
        if (!isAdmin())
          return new Response("Unauthorized", {
            status: 401,
            headers: corsHeaders,
          });
        const [, , postSlug, commentId] = path.split("/");
        return handleDeleteComment(postSlug, commentId, env, corsHeaders);
      }

      // Approve/reject comment (admin only)
      if (
        path.match(/^\/comments\/[^\/]+\/[^\/]+\/moderate$/) &&
        request.method === "POST"
      ) {
        if (!isAdmin())
          return new Response("Unauthorized", {
            status: 401,
            headers: corsHeaders,
          });
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
          return new Response("Unauthorized", {
            status: 401,
            headers: corsHeaders,
          });
        return handleGetPendingComments(env, corsHeaders);
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};

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

  return new Response(JSON.stringify(posts), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetPost(slug, env, corsHeaders) {
  const post = await env.CALMIQS_POSTS.get(`post:${slug}`);

  if (!post) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  return new Response(post, {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSavePost(request, env, corsHeaders) {
  const { slug, data } = await request.json();

  if (!slug || !data) {
    return new Response(JSON.stringify({ error: "Missing slug or data" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  data.updatedAt = new Date().toISOString();
  if (!data.createdAt) data.createdAt = data.updatedAt;

  await env.CALMIQS_POSTS.put(`post:${slug}`, JSON.stringify(data));

  return new Response(JSON.stringify({ success: true, slug }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ========== COMMENTS HANDLERS ==========

async function handleGetComments(postSlug, env, corsHeaders) {
  const comments = [];
  const list = await env.CALMIQS_POSTS.list({
    prefix: `comments:${postSlug}:`,
  });

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

  // Sort by date (newest first)
  comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return new Response(JSON.stringify({ comments }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleAddComment(request, env, corsHeaders) {
  const body = await request.json();
  const { postSlug, name, email, comment, parentId } = body;

  // Validation
  if (!postSlug || !name || !email || !comment) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email address" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Sanitize inputs
  const sanitizedName = sanitizeInput(name);
  const sanitizedComment = sanitizeInput(comment);

  // Generate unique comment ID
  const commentId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
  await env.CALMIQS_POSTS.put(
    `comments:${postSlug}:${commentId}`,
    JSON.stringify(commentData)
  );

  return new Response(
    JSON.stringify({
      success: true,
      commentId,
      message: "Comment submitted for review",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleDeleteComment(postSlug, commentId, env, corsHeaders) {
  await env.CALMIQS_POSTS.delete(`comments:${postSlug}:${commentId}`);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleModerateComment(
  postSlug,
  commentId,
  request,
  env,
  corsHeaders
) {
  const { action } = await request.json(); // action: 'approve' or 'reject'

  const key = `comments:${postSlug}:${commentId}`;
  const commentData = await env.CALMIQS_POSTS.get(key);

  if (!commentData) {
    return new Response("Comment not found", {
      status: 404,
      headers: corsHeaders,
    });
  }

  const comment = JSON.parse(commentData);
  comment.status = action === "approve" ? "approved" : "rejected";
  comment.moderatedAt = new Date().toISOString();

  await env.CALMIQS_POSTS.put(key, JSON.stringify(comment));

  return new Response(
    JSON.stringify({ success: true, status: comment.status }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
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

  return new Response(JSON.stringify({ comments: pendingComments }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
