// posts.js - Handle all post CRUD operations
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // Auth middleware
  const token = request.headers.get("X-Admin-Token");
  if (!token || token !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (method === "GET") {
      return handleGetPosts(context);
    } else if (method === "POST") {
      return handleSavePost(context);
    } else if (method === "DELETE") {
      return handleDeletePost(context);
    } else {
      return new Response("Method not allowed", { status: 405 });
    }
  } catch (error) {
    console.error("Posts API Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleGetPosts(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (slug) {
    // Get single post
    const post = await env.CALMIQS_POSTS.get(`post:${slug}`, "json");
    if (!post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(post), {
      headers: { "Content-Type": "application/json" },
    });
  } else {
    // List all posts
    const list = await env.CALMIQS_POSTS.list({ prefix: "post:" });
    const posts = [];
    for (const key of list.keys) {
      const post = await env.CALMIQS_POSTS.get(key.name, "json");
      if (post) posts.push(post);
    }
    return new Response(JSON.stringify({ posts: posts.reverse() }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleSavePost(context) {
  const { env, request } = context;
  const data = await request.json();

  if (!data.title || !data.slug) {
    return new Response(JSON.stringify({ error: "Title and slug required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const postData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  // Save to KV with retry logic (KV rate limit: 1 write/sec per key)
  try {
    await env.CALMIQS_POSTS.put(`post:${data.slug}`, JSON.stringify(postData));
  } catch (error) {
    // If rate limited, wait and retry
    if (error.message.includes("429")) {
      await new Promise((r) => setTimeout(r, 1000));
      await env.CALMIQS_POSTS.put(
        `post:${data.slug}`,
        JSON.stringify(postData)
      );
    } else {
      throw error;
    }
  }

  return new Response(JSON.stringify({ success: true, slug: data.slug }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleDeletePost(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response(JSON.stringify({ error: "Slug required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await env.CALMIQS_POSTS.delete(`post:${slug}`);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
