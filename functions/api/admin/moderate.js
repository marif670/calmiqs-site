// functions/api/admin/moderate.js
// Approve or reject a comment

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAdmin(request, env) {
  const token = request.headers.get("X-Admin-Token");
  const ADMIN_SECRET =
    env.ADMIN_SECRET ||
    "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Hadia@2017_Ayesha@2007";
  return token && token === ADMIN_SECRET;
}

// POST /api/admin/moderate
// Body: { postSlug, commentId, action: 'approve' | 'reject' }
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAdmin(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { postSlug, commentId, action } = await request.json();

    console.log("Moderating comment:", { postSlug, commentId, action });

    if (!postSlug || !commentId || !action) {
      return jsonResponse(
        {
          error: "Missing required fields",
          received: { postSlug, commentId, action },
        },
        400
      );
    }

    const kvKey = `comments:${postSlug}:${commentId}`;
    console.log("KV key:", kvKey);

    const commentData = await env.CALMIQS_POSTS.get(kvKey);

    if (!commentData) {
      console.log("Comment not found:", kvKey);
      return jsonResponse({ error: "Comment not found" }, 404);
    }

    const comment = JSON.parse(commentData);
    comment.status = action === "approve" ? "approved" : "rejected";
    comment.moderatedAt = new Date().toISOString();

    await env.CALMIQS_POSTS.put(kvKey, JSON.stringify(comment));

    console.log("Comment moderated:", comment.status);

    return jsonResponse(
      {
        success: true,
        status: comment.status,
        commentId,
        postSlug,
      },
      200
    );
  } catch (error) {
    console.error("Error moderating comment:", error);
    return jsonResponse(
      {
        error: error.message,
        stack: error.stack,
      },
      500
    );
  }
}
