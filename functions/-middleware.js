// functions/_middleware.js
// This runs for ALL requests and should definitely catch /comments

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  console.log("Middleware intercepted:", url.pathname, request.method);

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // ========== DEBUG STATUS ENDPOINT ==========
  if (url.pathname === "/api/status" && request.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "ok",
        worker: "running",
        timestamp: new Date().toISOString(),
        env: {
          hasKV: !!env.CALMIQS_POSTS,
          hasR2: !!env.R2_BUCKET,
        },
        request: {
          method: request.method,
          url: url.href,
          headers: Object.fromEntries(request.headers),
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // ========== COMMENTS ROUTES ==========

  // POST /comments - Add new comment
  if (url.pathname === "/comments" && request.method === "POST") {
    console.log("Comments POST route matched");

    try {
      const body = await request.json();
      console.log("Received body:", body);

      const { postSlug, name, email, comment, parentId } = body;

      // Validation
      if (!postSlug || !name || !email || !comment) {
        console.log("Validation failed");
        return new Response(
          JSON.stringify({
            error: "Missing required fields",
            received: { postSlug, name, email, hasComment: !!comment },
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(
          JSON.stringify({
            error: "Invalid email address",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Generate comment ID
      const commentId = `${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const commentData = {
        id: commentId,
        postSlug,
        name: sanitize(name),
        email,
        comment: sanitize(comment),
        parentId: parentId || null,
        status: "pending",
        createdAt: new Date().toISOString(),
        ip: request.headers.get("CF-Connecting-IP") || "unknown",
      };

      // Store in KV
      const kvKey = `comments:${postSlug}:${commentId}`;
      console.log("Storing to KV:", kvKey);

      await env.CALMIQS_POSTS.put(kvKey, JSON.stringify(commentData));

      console.log("Comment stored successfully");

      return new Response(
        JSON.stringify({
          success: true,
          commentId,
          message: "Comment submitted for review",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error handling comment:", error);
      return new Response(
        JSON.stringify({
          error: error.message,
          stack: error.stack,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  // GET /comments/:postSlug - Get comments for a post
  if (url.pathname.startsWith("/comments/") && request.method === "GET") {
    console.log("Comments GET route matched");

    const postSlug = url.pathname.split("/")[2];
    console.log("Getting comments for:", postSlug);

    try {
      const comments = [];
      const list = await env.CALMIQS_POSTS.list({
        prefix: `comments:${postSlug}:`,
      });

      console.log("Found keys:", list.keys.length);

      for (const key of list.keys) {
        const value = await env.CALMIQS_POSTS.get(key.name);
        if (value) {
          const comment = JSON.parse(value);
          if (comment.status === "approved") {
            comments.push(comment);
          }
        }
      }

      comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return new Response(JSON.stringify({ comments }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error getting comments:", error);
      return new Response(
        JSON.stringify({
          error: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  // ========== POSTS ROUTES ==========

  // GET /posts
  if (url.pathname === "/posts" && request.method === "GET") {
    console.log("Posts GET route matched");

    try {
      const posts = {};
      const list = await env.CALMIQS_POSTS.list({ prefix: "post:" });

      for (const key of list.keys) {
        const value = await env.CALMIQS_POSTS.get(key.name);
        if (value) {
          const slug = key.name.replace("post:", "");
          posts[slug] = JSON.parse(value);
        }
      }

      return new Response(JSON.stringify(posts), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // If no route matched, pass to next handler
  console.log("No route matched, passing to next");
  return next();
}

function sanitize(str) {
  return String(str)
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim()
    .slice(0, 1000);
}
