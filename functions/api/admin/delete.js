// functions/api/admin/delete.js
// Delete a comment

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

// POST /api/admin/delete
// Body: { postSlug, commentId }
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAdmin(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { postSlug, commentId } = await request.json();

    console.log("Deleting comment:", { postSlug, commentId });

    if (!postSlug || !commentId) {
      return jsonResponse(
        {
          error: "Missing required fields",
        },
        400
      );
    }

    const kvKey = `comments:${postSlug}:${commentId}`;
    await env.CALMIQS_POSTS.delete(kvKey);

    console.log("Comment deleted:", kvKey);

    return jsonResponse(
      {
        success: true,
        commentId,
        postSlug,
      },
      200
    );
  } catch (error) {
    console.error("Error deleting comment:", error);
    return jsonResponse(
      {
        error: error.message,
      },
      500
    );
  }
}
