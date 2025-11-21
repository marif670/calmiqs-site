// functions/api/admin/posts.js

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  "Content-Type": "application/json",
};

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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  // GET /api/admin/posts - List all posts
  if (path === "/api/admin/posts" && request.method === "GET") {
    try {
      const posts = [];
      const list = await env.CALMIQS_POSTS.list({ prefix: "post:" });

      for (const key of list.keys) {
        const post = await env.CALMIQS_POSTS.get(key.name);
        if (post) {
          posts.push(JSON.parse(post));
        }
      }

      posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return new Response(
        JSON.stringify({
          success: true,
          posts,
          total: posts.length,
        }),
        { headers: corsHeaders }
      );
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // POST /api/admin/posts - Create/Update post
  if (path === "/api/admin/posts" && request.method === "POST") {
    try {
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
        return new Response(
          JSON.stringify({ error: "Missing slug or title" }),
          {
            status: 400,
            headers: corsHeaders,
          }
        );
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

      // Save to KV with key format: post:{slug}
      await env.CALMIQS_POSTS.put(`post:${slug}`, JSON.stringify(post));

      return new Response(
        JSON.stringify({
          success: true,
          slug,
          message: "Post saved successfully",
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    } catch (error) {
      console.error("Post save error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // GET /api/admin/posts/:slug - Get specific post
  if (path.match(/^\/api\/admin\/posts\/[^\/]+$/) && request.method === "GET") {
    const slug = path.split("/").pop();

    try {
      const post = await env.CALMIQS_POSTS.get(`post:${slug}`);

      if (!post) {
        return new Response(JSON.stringify({ error: "Post not found" }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      return new Response(post, { headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // DELETE /api/admin/posts/:slug - Delete post
  if (
    path.match(/^\/api\/admin\/posts\/[^\/]+$/) &&
    request.method === "DELETE"
  ) {
    const slug = path.split("/").pop();

    try {
      await env.CALMIQS_POSTS.delete(`post:${slug}`);

      // Also delete associated comments
      const list = await env.CALMIQS_POSTS.list({
        prefix: `comments:${slug}:`,
      });
      for (const key of list.keys) {
        await env.CALMIQS_POSTS.delete(key.name);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Post and associated comments deleted",
        }),
        { headers: corsHeaders }
      );
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: corsHeaders,
  });
}
