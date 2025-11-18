// functions/api/comments.js
// Handles POST /api/comments (submit new comment)

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sanitize(str) {
  return String(str)
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim()
    .slice(0, 1000);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  console.log("POST /api/comments - Adding new comment");

  try {
    const body = await request.json();
    console.log("Request body:", body);

    const { postSlug, name, email, comment, parentId } = body;

    // Validation
    if (!postSlug || !name || !email || !comment) {
      console.log("Validation failed - missing fields");
      return jsonResponse(
        {
          error: "Missing required fields",
          received: { postSlug, name, email, hasComment: !!comment },
        },
        400
      );
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log("Validation failed - invalid email");
      return jsonResponse(
        {
          error: "Invalid email address",
        },
        400
      );
    }

    // Generate unique comment ID
    const commentId = `${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log("Generated comment ID:", commentId);

    const commentData = {
      id: commentId,
      postSlug,
      name: sanitize(name),
      email,
      comment: sanitize(comment),
      parentId: parentId || null,
      status: "pending",
      createdAt: new Date().toISOString(),
      ip: request.headers.get("CF-Connecting-IP") || "unknown",
    };

    // Store in KV
    const kvKey = `comments:${postSlug}:${commentId}`;
    console.log("Storing to KV:", kvKey);

    await env.CALMIQS_POSTS.put(kvKey, JSON.stringify(commentData));

    console.log("Comment stored successfully");

    return jsonResponse(
      {
        success: true,
        commentId,
        message: "Comment submitted for review",
      },
      200
    );
  } catch (error) {
    console.error("Error in POST /api/comments:", error);
    return jsonResponse(
      {
        error: error.message,
        stack: error.stack,
      },
      500
    );
  }
}

// Handle GET /api/comments (list all pending - admin only)
export async function onRequestGet(context) {
  const { request, env } = context;

  // Check admin token
  const token = request.headers.get("X-Admin-Token");
  const ADMIN_SECRET =
    env.ADMIN_SECRET ||
    "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Hadia@2017_Ayesha@2007";

  if (!token || token !== ADMIN_SECRET) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
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

    pendingComments.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return jsonResponse({ comments: pendingComments }, 200);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
