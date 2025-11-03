export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // Helper to return JSON response
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  // GET — fetch all or one post
  if (method === "GET") {
    const key = url.searchParams.get("key");
    if (key) {
      const post = await env.CALMIQS_POSTS.get(key, { type: "json" });
      return post ? json(post) : json({ error: "Not found" }, 404);
    }
    // Return all posts
    const keys = await env.CALMIQS_POSTS.list();
    const posts = {};
    for (const { name } of keys.keys) {
      posts[name] = await env.CALMIQS_POSTS.get(name, { type: "json" });
    }
    return json(posts);
  }

  // POST — add or update a post
  if (method === "POST") {
    try {
      const body = await request.json();
      if (!body.key || !body.data) return json({ error: "Invalid data" }, 400);
      await env.CALMIQS_POSTS.put(body.key, JSON.stringify(body.data));
      return json({ success: true });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // DELETE — remove a post
  if (method === "DELETE") {
    const key = url.searchParams.get("key");
    if (!key) return json({ error: "Missing key" }, 400);
    await env.CALMIQS_POSTS.delete(key);
    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
