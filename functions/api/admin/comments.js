// functions/api/admin/comments.js
// Admin endpoint to manage all comments

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  "Content-Type": "application/json",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

function isAdmin(request, env) {
  const token = request.headers.get("X-Admin-Token");
  const ADMIN_SECRET =
    env.ADMIN_SECRET ||
    "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Hadia@2017_Ayesha@2007";
  return token && token === ADMIN_SECRET;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isAdmin(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    // GET /api/admin/comments - Get ALL comments (for dashboard)
    if (path === "/api/admin/comments" && request.method === "GET") {
      const allComments = [];
      const list = await env.CALMIQS_POSTS.list({ prefix: "comments:" });

      for (const key of list.keys) {
        const value = await env.CALMIQS_POSTS.get(key.name);
        if (value) {
          const comment = JSON.parse(value);
          allComments.push(comment);
        }
      }

      allComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
    }

    // POST /api/admin/comments/:postSlug/:commentId/approve
    if (
      path.match(/^\/api\/admin\/comments\/[^\/]+\/[^\/]+\/approve$/) &&
      request.method === "POST"
    ) {
      const parts = path.split("/");
      const postSlug = parts[4];
      const commentId = parts[5];

      const kvKey = `comments:${postSlug}:${commentId}`;
      const commentData = await env.CALMIQS_POSTS.get(kvKey);

      if (!commentData) {
        return jsonResponse({ error: "Comment not found" }, 404);
      }

      const comment = JSON.parse(commentData);
      comment.status = "approved";
      comment.moderatedAt = new Date().toISOString();

      await env.CALMIQS_POSTS.put(kvKey, JSON.stringify(comment));

      return jsonResponse(
        {
          success: true,
          status: "approved",
          message: "Comment approved",
        },
        200
      );
    }

    // POST /api/admin/comments/:postSlug/:commentId/reject
    if (
      path.match(/^\/api\/admin\/comments\/[^\/]+\/[^\/]+\/reject$/) &&
      request.method === "POST"
    ) {
      const parts = path.split("/");
      const postSlug = parts[4];
      const commentId = parts[5];

      const kvKey = `comments:${postSlug}:${commentId}`;
      const commentData = await env.CALMIQS_POSTS.get(kvKey);

      if (!commentData) {
        return jsonResponse({ error: "Comment not found" }, 404);
      }

      const comment = JSON.parse(commentData);
      comment.status = "rejected";
      comment.moderatedAt = new Date().toISOString();

      await env.CALMIQS_POSTS.put(kvKey, JSON.stringify(comment));

      return jsonResponse(
        {
          success: true,
          status: "rejected",
          message: "Comment rejected",
        },
        200
      );
    }

    // DELETE /api/admin/comments/:postSlug/:commentId
    if (
      path.match(/^\/api\/admin\/comments\/[^\/]+\/[^\/]+$/) &&
      request.method === "DELETE"
    ) {
      const parts = path.split("/");
      const postSlug = parts[4];
      const commentId = parts[5];

      const kvKey = `comments:${postSlug}:${commentId}`;
      await env.CALMIQS_POSTS.delete(kvKey);

      return jsonResponse(
        {
          success: true,
          message: "Comment deleted",
        },
        200
      );
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    console.error("Admin comments error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}
