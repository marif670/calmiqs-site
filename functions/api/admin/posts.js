// functions/api/admin/posts.js
// Admin endpoint to manage posts

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
    // GET /api/admin/posts - List all posts
    if (path === "/api/admin/posts" && request.method === "GET") {
      const posts = [];
      const list = await env.CALMIQS_POSTS.list({ prefix: "post:" });

      for (const key of list.keys) {
        const post = await env.CALMIQS_POSTS.get(key.name);
        if (post) {
          posts.push(JSON.parse(post));
        }
      }

      posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return jsonResponse(
        {
          success: true,
          posts,
          total: posts.length,
        },
        200
      );
    }

    // POST /api/admin/posts - Create/Update post
    if (path === "/api/admin/posts" && request.method === "POST") {
      const body = await request.json();
      const {
        slug,
        title,
        content,
        excerpt,
        image,
        imageAlt,
        category,
        tags,
        author,
        date,
      } = body;

      if (!slug || !title) {
        return jsonResponse({ error: "Missing slug or title" }, 400);
      }

      const post = {
        slug,
        title,
        content: content || "",
        excerpt: excerpt || "",
        image: image || "",
        imageAlt: imageAlt || "",
        category: category || "blog",
        tags: Array.isArray(tags) ? tags : [],
        author: author || "Calmiqs Team",
        date: date || new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await env.CALMIQS_POSTS.put(`post:${slug}`, JSON.stringify(post));

      return jsonResponse(
        {
          success: true,
          slug,
          message: "Post saved successfully",
        },
        200
      );
    }

    // GET /api/admin/posts/:slug - Get specific post
    if (
      path.match(/^\/api\/admin\/posts\/[^\/]+$/) &&
      request.method === "GET"
    ) {
      const slug = path.split("/").pop();
      const post = await env.CALMIQS_POSTS.get(`post:${slug}`);

      if (!post) {
        return jsonResponse({ error: "Post not found" }, 404);
      }

      return jsonResponse(JSON.parse(post), 200);
    }

    // DELETE /api/admin/posts/:slug - Delete post
    if (
      path.match(/^\/api\/admin\/posts\/[^\/]+$/) &&
      request.method === "DELETE"
    ) {
      const slug = path.split("/").pop();

      await env.CALMIQS_POSTS.delete(`post:${slug}`);

      // Also delete associated comments
      const list = await env.CALMIQS_POSTS.list({
        prefix: `comments:${slug}:`,
      });
      for (const key of list.keys) {
        await env.CALMIQS_POSTS.delete(key.name);
      }

      return jsonResponse(
        {
          success: true,
          message: "Post and associated comments deleted",
        },
        200
      );
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    console.error("Posts API error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}
