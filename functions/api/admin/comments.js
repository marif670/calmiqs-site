// functions/api/admin/comments.js
// Admin endpoint to get ALL comments (including pending)

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

// GET /api/admin/comments - Get ALL comments with status
export async function onRequestGet(context) {
  const { request, env } = context;

  console.log("Admin: Getting all comments");

  if (!isAdmin(request, env)) {
    console.log("Admin: Unauthorized access attempt");
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const allComments = [];
    const list = await env.CALMIQS_POSTS.list({ prefix: "comments:" });

    console.log("Admin: Found total keys:", list.keys.length);

    for (const key of list.keys) {
      const value = await env.CALMIQS_POSTS.get(key.name);
      if (value) {
        try {
          const comment = JSON.parse(value);

          // Extract post slug from key: comments:postSlug:commentId
          const keyParts = key.name.split(":");
          if (keyParts.length >= 2) {
            comment.postSlug = keyParts[1];
          }

          allComments.push(comment);
        } catch (e) {
          console.error("Failed to parse comment:", key.name, e);
        }
      }
    }

    // Sort by date (newest first)
    allComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log("Admin: Returning comments:", allComments.length);
    console.log(
      "Admin: Pending:",
      allComments.filter((c) => c.status === "pending").length
    );
    console.log(
      "Admin: Approved:",
      allComments.filter((c) => c.status === "approved").length
    );

    return jsonResponse(
      {
        comments: allComments,
        stats: {
          total: allComments.length,
          pending: allComments.filter((c) => c.status === "pending").length,
          approved: allComments.filter((c) => c.status === "approved").length,
          rejected: allComments.filter((c) => c.status === "rejected").length,
        },
      },
      200
    );
  } catch (error) {
    console.error("Admin: Error getting comments:", error);
    return jsonResponse(
      {
        error: error.message,
        stack: error.stack,
      },
      500
    );
  }
}
