// functions/api/comments/[postSlug].js

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestGet(context) {
  const { params, env } = context;
  const postSlug = params.postSlug;

  try {
    const comments = [];
    const list = await env.CALMIQS_POSTS.list({
      prefix: `comments:${postSlug}:`,
    });

    for (const key of list.keys) {
      const value = await env.CALMIQS_POSTS.get(key.name);
      if (value) {
        const comment = JSON.parse(value);
        // ONLY return approved comments to public
        if (comment.status === "approved") {
          comments.push({
            id: comment.id,
            name: comment.name,
            comment: comment.comment,
            createdAt: comment.createdAt,
            // Don't return email or IP
          });
        }
      }
    }

    // Sort newest first
    comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return jsonResponse({ comments }, 200);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { postSlug, name, email, comment } = body;

    // Validation
    if (!postSlug || !name || !email || !comment) {
      return jsonResponse(
        {
          error: "Missing required fields: postSlug, name, email, comment",
        },
        400
      );
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Invalid email address" }, 400);
    }

    // Sanitize
    const sanitize = (str) => {
      return String(str)
        .replace(/[<>]/g, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+=/gi, "")
        .trim()
        .slice(0, 1000);
    };

    // Generate unique comment ID
    const commentId = `${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const commentData = {
      id: commentId,
      postSlug,
      name: sanitize(name),
      email, // stored but not displayed
      comment: sanitize(comment),
      status: "pending", // pending, approved, rejected
      createdAt: new Date().toISOString(),
      ip: request.headers.get("CF-Connecting-IP") || "unknown",
    };

    // Store in KV
    const kvKey = `comments:${postSlug}:${commentId}`;
    await env.CALMIQS_POSTS.put(kvKey, JSON.stringify(commentData));

    return jsonResponse(
      {
        success: true,
        commentId,
        message: "Comment submitted for review",
      },
      201
    );
  } catch (error) {
    console.error("Error submitting comment:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}
