export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // ✅ Define isAdmin as VARIABLE
  const token = request.headers.get("X-Admin-Token");
  const expectedToken =
    env.ADMIN_SECRET ||
    "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Hadia@2017_Ayesha@2007";
  const isAdmin = token && token === expectedToken;

  console.log("Token received:", token ? "yes" : "no");
  console.log("Is admin:", isAdmin);

  // ========== GET all posts ==========
  if (request.method === "GET" && path === "/api/posts") {
    try {
      const posts = {};
      const list = await env.CALMIQS_POSTS.list();

      for (const key of list.keys) {
        if (key.name.startsWith("post:")) {
          const data = await env.CALMIQS_POSTS.get(key.name);
          if (data) {
            const slug = key.name.replace("post:", "");
            posts[slug] = JSON.parse(data);
          }
        }
      }

      return new Response(JSON.stringify({ success: true, posts }), {
        status: 200,
        headers: cors,
      });
    } catch (err) {
      console.error("GET error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: cors,
      });
    }
  }

  // ========== POST new post ==========
  if (request.method === "POST" && path === "/api/posts") {
    // ✅ Use isAdmin WITHOUT parentheses
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }

    try {
      const body = await request.json();
      console.log("POST body:", body);

      const { slug, data } = body;

      if (!slug || !data) {
        return new Response(
          JSON.stringify({
            error: "Missing slug or data",
            received: { hasSlug: !!slug, hasData: !!data },
          }),
          { status: 400, headers: cors }
        );
      }

      // Add timestamps
      data.updatedAt = new Date().toISOString();
      if (!data.createdAt) {
        data.createdAt = data.updatedAt;
      }

      // Save to KV
      const kvKey = `post:${slug}`;
      await env.CALMIQS_POSTS.put(kvKey, JSON.stringify(data));

      console.log("Post saved:", kvKey);

      return new Response(
        JSON.stringify({
          success: true,
          slug,
          kvKey,
          message: "Post saved successfully",
        }),
        { status: 200, headers: cors }
      );
    } catch (err) {
      console.error("POST error:", err);
      return new Response(
        JSON.stringify({ error: err.message, stack: err.stack }),
        { status: 500, headers: cors }
      );
    }
  }

  // ========== DELETE post ==========
  if (request.method === "DELETE" && path.startsWith("/api/posts/")) {
    // ✅ Use isAdmin WITHOUT parentheses
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }

    try {
      const slug = path.replace("/api/posts/", "");

      if (!slug) {
        return new Response(JSON.stringify({ error: "No slug provided" }), {
          status: 400,
          headers: cors,
        });
      }

      const kvKey = `post:${slug}`;
      await env.CALMIQS_POSTS.delete(kvKey);

      // Also delete associated comments
      const commentsList = await env.CALMIQS_POSTS.list({
        prefix: `comments:${slug}:`,
      });
      for (const key of commentsList.keys) {
        await env.CALMIQS_POSTS.delete(key.name);
      }

      console.log("Post deleted:", kvKey);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: cors,
      });
    } catch (err) {
      console.error("DELETE error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: cors,
      });
    }
  }

  // 404
  return new Response(
    JSON.stringify({
      error: "Not found",
      path,
      method: request.method,
    }),
    { status: 404, headers: cors }
  );
}
