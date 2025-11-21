// functions/api/comments/[postSlug].js
// GET - Fetch approved comments for a post
// POST - Submit new comment

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function sanitizeInput(str) {
  return String(str)
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim()
    .slice(0, 1000);
}

export async function onRequestGet(context) {
  const { params, env } = context;
  const postSlug = params.postSlug;

  try {
    console.log(`[GET] Fetching approved comments for post: ${postSlug}`);

    const comments = [];
    const list = await env.CALMIQS_POSTS.list({
      prefix: `comments:${postSlug}:`,
    });

    console.log(
      `[GET] Found ${list.keys.length} total comment keys for ${postSlug}`
    );

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
            // Don't expose email or IP
          });
        }
      }
    }

    // Sort newest first
    comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`[GET] Returning ${comments.length} approved comments`);
    return jsonResponse({ comments }, 200);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const postSlug = params.postSlug;

  try {
    const body = await request.json();
    const { name, email, comment, parentId } = body;

    console.log(`[POST] Received comment for post: ${postSlug}`);

    // Validation
    if (!name || !email || !comment) {
      return jsonResponse(
        {
          error: "Missing required fields: name, email, comment",
        },
        400
      );
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Invalid email address" }, 400);
    }

    // Generate unique comment ID
    const commentId = `${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const commentData = {
      id: commentId,
      postSlug,
      name: sanitizeInput(name),
      email, // stored but not displayed publicly
      comment: sanitizeInput(comment),
      parentId: parentId || null,
      status: "pending", // pending, approved, rejected
      createdAt: new Date().toISOString(),
      ip: request.headers.get("CF-Connecting-IP") || "unknown",
    };

    // Store in KV
    const kvKey = `comments:${postSlug}:${commentId}`;
    await env.CALMIQS_POSTS.put(kvKey, JSON.stringify(commentData));

    console.log(`[POST] Comment stored: ${kvKey}`);

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

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
