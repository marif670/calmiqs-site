// ============================================
// functions/api/posts.js
// ============================================

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const token = request.headers.get("X-Admin-Token");
  const isAdmin =
    token === "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Hadia@2017_Ayesha@2007";

  try {
    // GET all posts
    if (request.method === "GET") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      try {
        const posts = [];
        const list = await env.CALMIQS_POSTS.list();

        console.log("Total keys in KV:", list.keys.length);

        for (const key of list.keys) {
          const data = await env.CALMIQS_POSTS.get(key.name);
          if (data) {
            try {
              const post = JSON.parse(data);
              post.slug = key.name;
              posts.push(post);
            } catch (e) {
              console.error("Failed to parse key:", key.name, e);
            }
          }
        }

        console.log("Posts loaded:", posts.length);
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        return new Response(
          JSON.stringify({
            success: true,
            posts,
            total: posts.length,
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      } catch (err) {
        console.error("GET posts error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // POST save post
    if (request.method === "POST") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      try {
        const postData = await request.json();
        const key = postData.slug;
        const post = {
          ...postData,
          updatedAt: new Date().toISOString(),
        };

        await env.CALMIQS_POSTS.put(key, JSON.stringify(post));

        return new Response(
          JSON.stringify({
            success: true,
            message: "Post saved",
            slug: postData.slug,
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      } catch (err) {
        console.error("POST error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // DELETE post
    if (request.method === "DELETE") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      try {
        const url = new URL(request.url);
        const slug = url.searchParams.get("slug");

        if (!slug) {
          return new Response(JSON.stringify({ error: "Slug required" }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        await env.CALMIQS_POSTS.delete(slug);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Post deleted",
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      } catch (err) {
        console.error("DELETE error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("Posts error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
